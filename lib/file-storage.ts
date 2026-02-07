
import JSZip from 'jszip';
// @ts-ignore
import * as XLSX from 'xlsx';
import { GameData, MapScene, MapObject, FactionGameData, CombatGameData } from '../types';
import { blobToBase64 } from './utils';

export const exportGameDataToZip = async (data: GameData) => {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  const exportData = JSON.parse(JSON.stringify(data));
  
  await Promise.all(exportData.maps.map(async (map: MapScene) => {
    const originalMap = data.maps.find(m => m.id === map.id);
    
    // 1. Process Map Background Image
    if (originalMap?.bgImage) {
      try {
        const response = await fetch(originalMap.bgImage);
        const blob = await response.blob();
        let ext = "png";
        if (blob.type === "image/jpeg") ext = "jpg";
        else if (blob.type === "image/gif") ext = "gif";
        
        const filename = `${map.id}_bg.${ext}`;
        if (imagesFolder) imagesFolder.file(filename, blob);
        map.bgImage = `images/${filename}`;
      } catch (e) {
        console.warn("Could not fetch image for export", originalMap.bgImage);
        map.bgImage = originalMap.bgImage; 
      }
    }

    // 2. Process Object Images
    await Promise.all(map.objects.map(async (obj: MapObject) => {
        const originalObj = originalMap?.objects.find(o => o.id === obj.id);
        if (originalObj?.image) {
            try {
                const response = await fetch(originalObj.image);
                const blob = await response.blob();
                let ext = "png";
                if (blob.type === "image/jpeg") ext = "jpg";
                else if (blob.type === "image/gif") ext = "gif";
                
                const filename = `${map.id}_${obj.id}.${ext}`;
                if (imagesFolder) imagesFolder.file(filename, blob);
                obj.image = `images/${filename}`;
            } catch (e) {
                console.warn("Could not fetch object image", originalObj.image);
                obj.image = originalObj.image;
            }
        }
    }));
  }));

  zip.file("data.json", JSON.stringify(exportData, null, 2));
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `TRPG_Scenario_${new Date().toISOString().slice(0,10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportGameDataToExcel = (data: GameData) => {
  const wb = XLSX.utils.book_new();
  const rows: any[] = [];
  const merges: any[] = [];

  // 1. Header Row
  rows.push([
    "세부장소 (Map)", 
    "오브젝트 (Object)", 
    "조건/판정 (Condition)", 
    "효과/이동 (Effect)", 
    "내용 (서술)", 
    "조사 가능 구역 (Visible Zone)"
  ]);

  // Helper to find object label by ID
  const findObjLabel = (id?: string) => {
      if (!id) return "";
      for (const m of data.maps) {
          const found = m.objects.find(o => o.id === id);
          if (found) return found.label;
      }
      return id; // Fallback to ID if not found
  };

  // Helper to find map name by ID
  const findMapName = (id?: string) => {
      if (!id) return "";
      const m = data.maps.find(map => map.id === id);
      return m ? m.name : id;
  };

  let rowIndex = 1; // Current row index (0-based, starting after header)

  data.maps.forEach(map => {
    // [New Feature] Add Map Description Row if exists
    if (map.description && map.description.trim() !== "") {
        rows.push([map.description]);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } }); // Merge row across 6 columns
        rowIndex++;
    }

    const mapStartRow = rowIndex;
    
    // Generate a summary string of visible objects for the last column
    const visibleObjectsStr = map.objects
        .filter(o => !o.hidden && (o.type === 'OBJECT' || o.type === 'MAP_LINK'))
        .map(o => `[ ${o.label} ]`)
        .join("  ");

    if (map.objects.length === 0) {
        // Empty map case
        rows.push([map.name, "(오브젝트 없음)", "", "", "", ""]);
        rowIndex++;
    } else {
        map.objects.forEach(obj => {
            const objStartRow = rowIndex;

            // --- Row A: Basic Description (Always present) ---
            const baseEffects: string[] = [];
            if (obj.targetMapId) baseEffects.push(`이동: ${findMapName(obj.targetMapId)}`);
            if (obj.revealObjectId) baseEffects.push(`공개: ${findObjLabel(obj.revealObjectId)}`);
            if (obj.hideObjectId) baseEffects.push(`숨김: ${findObjLabel(obj.hideObjectId)}`);

            rows.push([
                map.name,                 // Col 0: Map Name
                obj.label,                // Col 1: Object Name
                "기본 (Default)",         // Col 2: Condition
                baseEffects.join("\n"),   // Col 3: Effect
                obj.description || "",    // Col 4: Description
                visibleObjectsStr         // Col 5: Visible Zone
            ]);
            rowIndex++;

            // --- Row B~E: Probability Outcomes ---
            if (obj.useProbability && obj.data) {
                const outcomes = [
                    { label: "대성공", data: obj.data.outcomes.CRITICAL_SUCCESS },
                    { label: "성공", data: obj.data.outcomes.SUCCESS },
                    { label: "실패", data: obj.data.outcomes.FAILURE },
                    { label: "대실패", data: obj.data.outcomes.CRITICAL_FAILURE },
                ];

                outcomes.forEach(outcome => {
                    const effs: string[] = [];
                    if (outcome.data.hpChange !== 0) effs.push(`HP ${outcome.data.hpChange > 0 ? '+' : ''}${outcome.data.hpChange}`);
                    if (outcome.data.itemDrop) effs.push(`획득: ${outcome.data.itemDrop}`);
                    if (outcome.data.targetMapId) effs.push(`이동: ${findMapName(outcome.data.targetMapId)}`);
                    if (outcome.data.revealObjectId) effs.push(`공개: ${findObjLabel(outcome.data.revealObjectId)}`);
                    if (outcome.data.hideObjectId) effs.push(`숨김: ${findObjLabel(outcome.data.hideObjectId)}`);

                    rows.push([
                        map.name,
                        obj.label,
                        outcome.label,
                        effs.join("\n"),
                        outcome.data.text,
                        visibleObjectsStr
                    ]);
                    rowIndex++;
                });
            }

            // Merge Object Name Column (if it spans multiple rows)
            if (rowIndex - 1 > objStartRow) {
                merges.push({ s: { r: objStartRow, c: 1 }, e: { r: rowIndex - 1, c: 1 } });
            }
        });
    }

    // Merge Map Name Column & Visible Zone Column (if they span multiple rows)
    if (rowIndex - 1 > mapStartRow) {
        merges.push({ s: { r: mapStartRow, c: 0 }, e: { r: rowIndex - 1, c: 0 } }); // Map Name
        merges.push({ s: { r: mapStartRow, c: 5 }, e: { r: rowIndex - 1, c: 5 } }); // Visible Zone
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Apply Merges
  if (merges.length > 0) {
      ws['!merges'] = merges;
  }

  // Set Column Widths for better readability
  const wscols = [
      { wch: 20 }, // Map Name
      { wch: 25 }, // Object Name
      { wch: 15 }, // Condition
      { wch: 25 }, // Effect
      { wch: 60 }, // Description Text
      { wch: 40 }, // Visible Zone Summary
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "시나리오 상세");
  XLSX.writeFile(wb, `Scenario_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const loadGameDataFromFile = async (file: File): Promise<GameData> => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.json')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (!json.maps || !Array.isArray(json.maps)) {
             throw new Error("올바르지 않은 데이터 형식입니다 (maps 누락)");
          }
          resolve(json);
        } catch (err) {
          reject('JSON 파싱 실패: ' + err);
        }
      };
      reader.onerror = () => reject('파일 읽기 실패');
      reader.readAsText(file);
    });
  } else if (fileName.endsWith('.zip')) {
    try {
      const zip = await JSZip.loadAsync(file);
      const dataFile = zip.file("data.json");
      if (!dataFile) {
        throw new Error("압축 파일 내에 data.json이 존재하지 않습니다.");
      }
      
      const jsonText = await dataFile.async("string");
      const json: GameData = JSON.parse(jsonText);
      
      if (!json.maps || !Array.isArray(json.maps)) {
          throw new Error("올바르지 않은 데이터 형식입니다 (maps 누락)");
      }

      // Restore images (Map Backgrounds AND Object Images)
      const mapsWithImages = await Promise.all(json.maps.map(async (map: MapScene) => {
         // 1. Restore Map BG
         let newMap = { ...map };
         if (map.bgImage && !map.bgImage.startsWith("http")) {
             // Try to load from zip if valid path
             const imageFile = zip.file(map.bgImage);
             if (imageFile) {
                 const blob = await imageFile.async("blob");
                 // Change: Convert restored blob to Base64
                 newMap.bgImage = await blobToBase64(blob);
             }
         }

         // 2. Restore Object Images
         const newObjects = await Promise.all(map.objects.map(async (obj) => {
             let newObj = { ...obj };
             if (obj.image && !obj.image.startsWith("http")) {
                 const imageFile = zip.file(obj.image);
                 if (imageFile) {
                    const blob = await imageFile.async("blob");
                    // Change: Convert restored blob to Base64
                    newObj.image = await blobToBase64(blob);
                 }
             }
             return newObj;
         }));

         newMap.objects = newObjects;
         return newMap;
      }));

      return { ...json, maps: mapsWithImages };
    } catch (e) {
      console.error(e);
      throw new Error("ZIP 파일 처리 중 오류가 발생했습니다: " + (e instanceof Error ? e.message : String(e)));
    }
  } else {
    throw new Error('지원하지 않는 파일 형식입니다. (.json 또는 .zip)');
  }
};

export const loadFactionDataFromFile = async (file: File): Promise<FactionGameData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (!json.maps || !Array.isArray(json.maps) || !json.factions) {
             throw new Error("올바르지 않은 진영 데이터 형식입니다.");
          }
          resolve(json);
        } catch (err) {
          reject('파일 로드 실패: ' + err);
        }
      };
      reader.onerror = () => reject('파일 읽기 실패');
      reader.readAsText(file);
    });
};

export const loadCombatDataFromFile = async (file: File): Promise<CombatGameData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.stats || !Array.isArray(json.stats)) {
           throw new Error("올바르지 않은 전투 데이터 형식입니다.");
        }
        resolve(json);
      } catch (err) {
        reject('파일 로드 실패: ' + err);
      }
    };
    reader.onerror = () => reject('파일 읽기 실패');
    reader.readAsText(file);
  });
};
