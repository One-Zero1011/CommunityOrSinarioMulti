
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

  // Color Palette for Maps (ARGB Hex)
  const MAP_COLORS = [
      "FFE0B2", // Orange
      "C8E6C9", // Green
      "BBDEFB", // Blue
      "E1BEE7", // Purple
      "FFECB3", // Amber
      "B2DFDB", // Teal
      "F8BBD0", // Pink
      "D7CCC8", // Brown
  ];

  const HEADER_COLOR = "EEEEEE"; // Light Gray

  // 1. Header Row
  rows.push([
    "구역 (Map)", 
    "분류 (Category)", 
    "이름 (Name)", 
    "조건 (Condition)", 
    "효과 (Effect)", 
    "내용 (Description)"
  ]);

  // Helper to find object label by ID
  const findObjLabel = (id?: string) => {
      if (!id) return "";
      for (const m of data.maps) {
          const found = m.objects.find(o => o.id === id);
          if (found) return found.label;
      }
      return id; 
  };

  // Helper to find map name by ID
  const findMapName = (id?: string) => {
      if (!id) return "";
      const m = data.maps.find(map => map.id === id);
      return m ? m.name : id;
  };

  let rowIndex = 1; // Current row index (0-based from rows array perspective)
  const mapRowRanges: { start: number, end: number, color: string }[] = [];

  data.maps.forEach((map, mapIdx) => {
    const startRow = rowIndex;

    // Map Title Row
    rows.push([`📍 [${map.name}]`, "", "", "", "", ""]);
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
    rowIndex++;

    // Map Description Row (Modified: No Prefix)
    if (map.description && map.description.trim() !== "") {
        rows.push([map.description, "", "", "", "", ""]);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
        rowIndex++;
    }

    // Separate Objects
    const interactables = map.objects.filter(o => o.type === 'OBJECT' || o.type === 'MAP_LINK');
    const decorations = map.objects.filter(o => o.type === 'DECORATION' || o.type === 'SPAWN_POINT');

    // === SECTION 1: INTERACTABLES ===
    if (interactables.length > 0) {
        interactables.forEach(obj => {
            const objStartRow = rowIndex;
            const objTypeLabel = obj.type === 'MAP_LINK' ? '이동' : '조사';

            // Base Info & Default Effect
            const baseEffects: string[] = [];
            if (obj.targetMapId) baseEffects.push(`➡ 이동: ${findMapName(obj.targetMapId)}`);
            if (obj.revealObjectId) baseEffects.push(`👁 공개: ${findObjLabel(obj.revealObjectId)}`);
            if (obj.hideObjectId) baseEffects.push(`🚫 숨김: ${findObjLabel(obj.hideObjectId)}`);
            if (obj.isSingleUse) baseEffects.push(`1회성`);

            rows.push([
                map.name,                 
                objTypeLabel,             
                obj.label,                
                "기본 (Default)",         
                baseEffects.join("\n"),   
                obj.description || ""     
            ]);
            rowIndex++;

            // Probability Outcomes (Sub-rows)
            if (obj.useProbability && obj.data) {
                const outcomes = [
                    { label: "  ↳ 대성공", data: obj.data.outcomes.CRITICAL_SUCCESS },
                    { label: "  ↳ 성공", data: obj.data.outcomes.SUCCESS },
                    { label: "  ↳ 실패", data: obj.data.outcomes.FAILURE },
                    { label: "  ↳ 대실패", data: obj.data.outcomes.CRITICAL_FAILURE },
                ];

                outcomes.forEach(outcome => {
                    const effs: string[] = [];
                    if (outcome.data.hpChange !== 0) effs.push(`HP ${outcome.data.hpChange > 0 ? '+' : ''}${outcome.data.hpChange}`);
                    if (outcome.data.itemDrop) effs.push(`📦 획득: ${outcome.data.itemDrop}`);
                    if (outcome.data.targetMapId) effs.push(`➡ 이동: ${findMapName(outcome.data.targetMapId)}`);
                    if (outcome.data.revealObjectId) effs.push(`👁 공개: ${findObjLabel(outcome.data.revealObjectId)}`);
                    if (outcome.data.hideObjectId) effs.push(`🚫 숨김: ${findObjLabel(outcome.data.hideObjectId)}`);

                    rows.push([
                        map.name,
                        objTypeLabel,
                        obj.label,
                        outcome.label,
                        effs.join("\n"),
                        outcome.data.text
                    ]);
                    rowIndex++;
                });
            }

            // Merge "Object Name" and "Category" cells for clarity
            if (rowIndex - 1 > objStartRow) {
                merges.push({ s: { r: objStartRow, c: 1 }, e: { r: rowIndex - 1, c: 1 } }); // Merge Category
                merges.push({ s: { r: objStartRow, c: 2 }, e: { r: rowIndex - 1, c: 2 } }); // Merge Name
            }
        });
    } else {
        rows.push([map.name, "조사", "(없음)", "-", "-", "-"]);
        rowIndex++;
    }

    // === SECTION 2: DECORATIONS ===
    if (decorations.length > 0) {
        // Separator for Decorations
        rows.push([map.name, "장식/기타", "---- 환경 요소 ----", "", "", ""]);
        rowIndex++;

        decorations.forEach(obj => {
            const typeLabel = obj.type === 'SPAWN_POINT' ? '시작 지점' : '장식';
            rows.push([
                map.name,
                typeLabel,
                obj.label,
                "-",
                "-",
                obj.description || "(설명 없음)"
            ]);
            rowIndex++;
        });
    }

    // Record range for coloring
    mapRowRanges.push({
        start: startRow,
        end: rowIndex - 1,
        color: MAP_COLORS[mapIdx % MAP_COLORS.length]
    });

    // Empty row separator
    if (mapIdx < data.maps.length - 1) {
        rows.push(["", "", "", "", "", ""]);
        rowIndex++;
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Apply Merges
  if (merges.length > 0) {
      ws['!merges'] = merges;
  }

  // Set Column Widths
  const wscols = [
      { wch: 15 }, // Map Name
      { wch: 10 }, // Category
      { wch: 20 }, // Object Name
      { wch: 15 }, // Condition
      { wch: 25 }, // Effect
      { wch: 60 }, // Description Text
  ];
  ws['!cols'] = wscols;

  // Apply Styles (Best Attempt for Style-Supporting Libraries)
  if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
          // Determine Row Color
          let fgColor = "FFFFFF";
          if (R === 0) {
              fgColor = HEADER_COLOR;
          } else {
              const mapRange = mapRowRanges.find(mr => R >= mr.start && R <= mr.end);
              if (mapRange) {
                  fgColor = mapRange.color;
              }
          }

          for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              if (!ws[cellAddress]) continue;

              // Initialize style object if not present
              if (!ws[cellAddress].s) ws[cellAddress].s = {};

              // 1. Fill Color
              ws[cellAddress].s.fill = {
                  patternType: "solid",
                  fgColor: { rgb: fgColor }
              };

              // 2. Borders
              ws[cellAddress].s.border = {
                  top: { style: "thin", color: { auto: 1 } },
                  bottom: { style: "thin", color: { auto: 1 } },
                  left: { style: "thin", color: { auto: 1 } },
                  right: { style: "thin", color: { auto: 1 } }
              };

              // 3. Alignment
              ws[cellAddress].s.alignment = {
                  vertical: "top",
                  wrapText: true
              };

              // 4. Header Special Styling
              if (R === 0) {
                  ws[cellAddress].s.font = { bold: true, sz: 12 };
                  ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
              }
          }
      }
  }

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
