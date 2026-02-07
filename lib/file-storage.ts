
import JSZip from 'jszip';
// @ts-ignore
import * as XLSX from 'xlsx';
import { GameData, MapScene, MapObject, FactionGameData, CombatGameData, OutcomeDef, ProbabilityProfile } from '../types';
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

export const exportGameDataToExcel = (data: GameData, includeEnvironment: boolean = true) => {
  const wb = XLSX.utils.book_new();
  const rows: any[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  
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

  // Helper: Replace \n with \r\n for Excel and ensure string
  const formatText = (text?: string) => {
      if (!text) return "";
      return text.toString().replace(/\n/g, "\r\n");
  };

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

  // Helper to construct effect strings
  const getEffectsList = (targetMapId?: string, revealId?: string, hideId?: string, hpChange?: number, itemDrop?: string) => {
      const effects: string[] = [];
      if (hpChange && hpChange !== 0) effects.push(`HP ${hpChange > 0 ? '+' : ''}${hpChange}`);
      if (itemDrop) effects.push(`📦 획득: ${itemDrop}`);
      if (targetMapId) effects.push(`➡ 이동: ${findMapName(targetMapId)}`);
      if (revealId) effects.push(`👁 공개: ${findObjLabel(revealId)}`);
      if (hideId) effects.push(`🚫 숨김: ${findObjLabel(hideId)}`);
      return effects.join(', ');
  };

  // Helper to format OutcomeDef into a string
  const formatOutcome = (outcome: OutcomeDef) => {
      const effects = getEffectsList(outcome.targetMapId, outcome.revealObjectId, outcome.hideObjectId, outcome.hpChange, outcome.itemDrop);
      const text = outcome.text ? `"${outcome.text}"` : '';
      // Combine text and effects
      return [text, effects].filter(Boolean).join(' / ');
  };

  // Helper to build probability block string
  const buildProbabilityString = (profile: ProbabilityProfile) => {
      const outcomes = [
          { label: '[대성공]', data: profile.outcomes.CRITICAL_SUCCESS },
          { label: '[성공]', data: profile.outcomes.SUCCESS },
          { label: '[실패]', data: profile.outcomes.FAILURE },
          { label: '[대실패]', data: profile.outcomes.CRITICAL_FAILURE },
      ];
      
      return outcomes.map(o => {
          const content = formatOutcome(o.data);
          return `${o.label} ${content}`;
      }).join('\r\n');
  };

  // 1. Header Row
  rows.push([
    "구역 (Map)", 
    "이름 (Name)", 
    "조건 (Condition)", 
    "효과 (Effect)", 
    "내용 (Description)"
  ]);

  const mapRowRanges: { start: number, end: number, color: string }[] = [];

  data.maps.forEach((map, mapIdx) => {
    // Start row for coloring
    const mapStartRow = rows.length;

    // 1. Map Title Row
    rows.push([
        map.name,
        `📍 [${map.name}] 입니다.`,
        "-",
        "-",
        "-"
    ]);

    // 2. Map Description
    if (map.description && map.description.trim() !== "") {
        rows.push([
            map.name,
            "(맵 서술)",
            "-",
            "-",
            formatText(map.description)
        ]);
    }

    // Separate Objects
    const interactables = map.objects.filter(o => o.type === 'OBJECT' || o.type === 'MAP_LINK');
    const decorations = map.objects.filter(o => o.type === 'DECORATION' || o.type === 'SPAWN_POINT');

    // 3. Interactables
    interactables.forEach(obj => {
        const objStartRow = rows.length; // Start tracking for Object Name merge

        // --- Main Object Logic ---
        let mainEffects = "";
        let mainDesc = formatText(obj.description);

        if (obj.useProbability && obj.data) {
            // If main interaction is probability based
            mainEffects = buildProbabilityString(obj.data);
            
            // Add side effects that happen regardless of roll (rare but possible in data structure)
            const sideEffects = getEffectsList(obj.targetMapId, obj.revealObjectId, obj.hideObjectId);
            if (sideEffects) mainEffects = `(기본: ${sideEffects})\r\n` + mainEffects;

        } else {
            // Basic Interaction
            const effects = getEffectsList(obj.targetMapId, obj.revealObjectId, obj.hideObjectId);
            if (obj.isSingleUse) mainEffects = `(1회성) ${effects}`;
            else mainEffects = effects;
        }

        rows.push([
            map.name,
            obj.label,
            "[기본]", // Condition
            mainEffects || "-",
            mainDesc
        ]);

        // --- Sub Actions Logic ---
        if (obj.subActions && obj.subActions.length > 0) {
            obj.subActions.forEach(action => {
                let subEffects = "";
                let subDesc = formatText(action.text);

                if (action.actionType === 'PROBABILITY' && action.data) {
                    const rollInfo = `🎲 판정: ${action.statMethod || '운'}`;
                    const probOutcomes = buildProbabilityString(action.data);
                    
                    const sideEffects = getEffectsList(action.targetMapId, action.revealObjectId, action.hideObjectId);
                    
                    subEffects = `${rollInfo}\r\n${probOutcomes}`;
                    if(sideEffects) subEffects += `\r\n(추가: ${sideEffects})`;

                } else {
                    // BASIC Action
                    subEffects = getEffectsList(action.targetMapId, action.revealObjectId, action.hideObjectId);
                }

                rows.push([
                    map.name,
                    obj.label, // Same Object Name
                    `[${action.label}]`, // Condition: Sub Action Name
                    subEffects || "-",
                    subDesc
                ]);
            });
        }

        const objEndRow = rows.length - 1; // End tracking

        // Merge Cells for Object Name (Column 1) if multiple rows exist
        if (objEndRow > objStartRow) {
            merges.push({ s: { r: objStartRow, c: 1 }, e: { r: objEndRow, c: 1 } });
        }
    });

    // 4. Decorations / Environment (Conditional)
    if (includeEnvironment && decorations.length > 0) {
        // Environment Section Header
        rows.push([
            map.name,
            "🌲 [ 환경 요소 ]",
            "",
            "",
            ""
        ]);

        decorations.forEach(obj => {
            if (obj.type === 'SPAWN_POINT') return; // Skip spawn points in excel
            
            rows.push([
                map.name, // Explicit Map Name
                obj.label,
                "-",
                "-",
                formatText(obj.description)
            ]);
        });
    }

    // Determine end row
    let mapEndRow = rows.length - 1;

    // Handle empty maps (if map has no desc and no objects, add placeholder)
    if (mapEndRow < mapStartRow + 1) { // +1 because we added Title Row
        rows.push([map.name, "(데이터 없음)", "-", "-", "-"]);
        mapEndRow = rows.length - 1;
    }

    // Merge Cells for Map Name (Column 0)
    if (mapEndRow > mapStartRow) {
        merges.push({ s: { r: mapStartRow, c: 0 }, e: { r: mapEndRow, c: 0 } });
    }

    // Record range for coloring
    mapRowRanges.push({
        start: mapStartRow,
        end: mapEndRow,
        color: MAP_COLORS[mapIdx % MAP_COLORS.length]
    });

    // Spacer row
    rows.push(["", "", "", "", ""]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Apply Merges
  if (merges.length > 0) {
      ws['!merges'] = merges;
  }
  
  // Set Column Widths
  const wscols = [
      { wch: 15 }, // Map Name
      { wch: 20 }, // Object Name
      { wch: 20 }, // Condition
      { wch: 50 }, // Effect (Wider for multi-line outcomes)
      { wch: 50 }, // Description
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

              // 3. Alignment (CRITICAL for Newlines)
              ws[cellAddress].s.alignment = {
                  vertical: "top", 
                  wrapText: true
              };

              // Special Alignment for Map Title Row (Starts with 📍 in Column B)
              if (C === 1 && rows[R][1] && rows[R][1].toString().startsWith('📍')) {
                   ws[cellAddress].s.font = { bold: true, sz: 14 };
              }

              // Environment Header Row Styling
              if (C === 1 && rows[R][1] && rows[R][1].toString().includes("환경 요소")) {
                   ws[cellAddress].s.font = { bold: true, sz: 11 };
                   ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                   ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "E0E0E0" } }; 
              }

              // 4. Header Special Styling
              if (R === 0) {
                  ws[cellAddress].s.font = { bold: true, sz: 12 };
                  ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
              }
          }
      }
  }

  const suffix = includeEnvironment ? "" : "_Core";
  XLSX.utils.book_append_sheet(wb, ws, "시나리오 상세");
  XLSX.writeFile(wb, `Scenario_Export${suffix}_${new Date().toISOString().slice(0,10)}.xlsx`);
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
