
import JSZip from 'jszip';
// @ts-ignore
import * as XLSX from 'xlsx';
import { GameData, MapScene, MapObject } from '../types';
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

  // Headers
  rows.push([
    "맵 ID", "맵 이름", 
    "오브젝트 ID", "라벨(이름)", "유형", "설명", "좌표(X,Y)", 
    "이동 대상 맵",
    "확률 사용 여부",
    "대성공(%)", "대성공 결과", "대성공 HP", "대성공 획득", "대성공 이동",
    "성공(%)", "성공 결과", "성공 HP", "성공 획득", "성공 이동",
    "실패(%)", "실패 결과", "실패 HP", "실패 획득", "실패 이동",
    "대실패(%)", "대실패 결과", "대실패 HP", "대실패 획득", "대실패 이동"
  ]);

  data.maps.forEach(map => {
    if (map.objects.length === 0) {
       rows.push([map.id, map.name, "(없음)", "", "", "", "", "", ""]);
    } else {
       map.objects.forEach(obj => {
          const row: (string | number)[] = [
             map.id,
             map.name,
             obj.id,
             obj.label,
             obj.type,
             obj.description || "",
             `${obj.x},${obj.y}`,
             obj.targetMapId ? (data.maps.find(m => m.id === obj.targetMapId)?.name || obj.targetMapId) : "",
             obj.useProbability ? "O" : "X"
          ];

          if (obj.useProbability && obj.data) {
             // Critical Success
             row.push(
               obj.data.criticalSuccess,
               obj.data.outcomes.CRITICAL_SUCCESS.text,
               obj.data.outcomes.CRITICAL_SUCCESS.hpChange,
               obj.data.outcomes.CRITICAL_SUCCESS.itemDrop || "",
               obj.data.outcomes.CRITICAL_SUCCESS.targetMapId ? (data.maps.find(m => m.id === obj.data.outcomes.CRITICAL_SUCCESS.targetMapId)?.name || "이동") : ""
             );
             // Success
             row.push(
                obj.data.success,
                obj.data.outcomes.SUCCESS.text,
                obj.data.outcomes.SUCCESS.hpChange,
                obj.data.outcomes.SUCCESS.itemDrop || "",
                obj.data.outcomes.SUCCESS.targetMapId ? (data.maps.find(m => m.id === obj.data.outcomes.SUCCESS.targetMapId)?.name || "이동") : ""
              );
             // Failure
             row.push(
                obj.data.failure,
                obj.data.outcomes.FAILURE.text,
                obj.data.outcomes.FAILURE.hpChange,
                obj.data.outcomes.FAILURE.itemDrop || "",
                obj.data.outcomes.FAILURE.targetMapId ? (data.maps.find(m => m.id === obj.data.outcomes.FAILURE.targetMapId)?.name || "이동") : ""
              );
             // Critical Failure
             row.push(
                obj.data.criticalFailure,
                obj.data.outcomes.CRITICAL_FAILURE.text,
                obj.data.outcomes.CRITICAL_FAILURE.hpChange,
                obj.data.outcomes.CRITICAL_FAILURE.itemDrop || "",
                obj.data.outcomes.CRITICAL_FAILURE.targetMapId ? (data.maps.find(m => m.id === obj.data.outcomes.CRITICAL_FAILURE.targetMapId)?.name || "이동") : ""
              );
          } else {
             // Fill empty cells for structure
             row.push(...Array(20).fill(""));
          }
          rows.push(row);
       });
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Auto-width adjustment approximation
  const wscols = rows[0].map(() => ({ wch: 15 }));
  wscols[1] = { wch: 20 }; // Map Name
  wscols[3] = { wch: 20 }; // Label
  wscols[5] = { wch: 30 }; // Description
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "시나리오 데이터");
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
