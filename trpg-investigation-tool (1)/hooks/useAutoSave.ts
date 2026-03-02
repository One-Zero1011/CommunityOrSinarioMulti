
import { useState, useEffect } from 'react';
import { GameData } from '../types';

export const useAutoSave = (data: GameData, interval: number = 10000) => {
  const [hasAutosave, setHasAutosave] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);

  // Auto-save Effect
  useEffect(() => {
    // interval이 0이면 자동 저장 비활성화
    if (interval <= 0) return;

    const autoSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem('TRPG_EDITOR_AUTOSAVE', JSON.stringify(data));
        localStorage.setItem('TRPG_EDITOR_AUTOSAVE_DATE', new Date().toISOString());
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, interval); 

    return () => clearTimeout(autoSaveTimer);
  }, [data, interval]);

  // Check existence
  useEffect(() => {
    const checkAutosave = () => {
        const saved = localStorage.getItem('TRPG_EDITOR_AUTOSAVE');
        const time = localStorage.getItem('TRPG_EDITOR_AUTOSAVE_DATE');
        setHasAutosave(!!saved);
        if (time) {
            setLastAutoSaveTime(new Date(time).toLocaleTimeString());
        }
    };
    
    checkAutosave();
    const intervalId = setInterval(checkAutosave, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const loadAutosave = (): GameData | null => {
      try {
          const saved = localStorage.getItem('TRPG_EDITOR_AUTOSAVE');
          if (saved) {
              return JSON.parse(saved);
          }
      } catch(e) {
          console.error(e);
      }
      return null;
  };

  return { hasAutosave, lastAutoSaveTime, loadAutosave };
};
