
import React, { useRef } from 'react';
import { GameData } from '../../types';
import { Plus, Map as MapIcon, Save, Download, ArrowLeft, RotateCcw, Upload, FileSpreadsheet } from 'lucide-react';
import { exportGameDataToZip, exportGameDataToExcel, loadGameDataFromFile } from '../../lib/file-storage';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Button } from '../common/Button';

interface EditorSidebarProps {
  data: GameData;
  currentMapId: string;
  onSelectMap: (id: string) => void;
  onAddMap: () => void;
  onSave: (data: GameData) => void;
  onLoadData: (data: GameData) => void;
  onBack: () => void;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ 
  data, currentMapId, onSelectMap, onAddMap, onSave, onLoadData, onBack
}) => {
  const { hasAutosave, lastAutoSaveTime, loadAutosave } = useAutoSave(data);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleLoadAutosave = () => {
      if (confirm('자동 저장된 데이터를 불러오시겠습니까? 현재 작업 내용이 사라집니다.')) {
          const loaded = loadAutosave();
          if (loaded) onSave(loaded);
      }
  };

  const handleExport = () => {
    exportGameDataToZip(data);
  };

  const handleExcelExport = () => {
    exportGameDataToExcel(data);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value immediately to ensure the change event fires even if the same file is selected again
    // and to avoid issues with the event object persisting across async operations.
    e.target.value = '';

    if (confirm('현재 작업 중인 내용이 덮어씌워집니다. 계속하시겠습니까?')) {
        try {
            const loadedData = await loadGameDataFromFile(file);
            onLoadData(loadedData);
            alert("시나리오를 성공적으로 불러왔습니다.");
        } catch (err) {
            console.error("Import failed:", err);
            alert(err instanceof Error ? err.message : '파일 로드 실패');
        }
    }
  };

  return (
    <div className="w-64 bg-[#252525] border-r border-[#444] flex flex-col text-gray-200">
      <div className="p-4 border-b border-[#444] font-bold text-lg flex items-center justify-between">
        <span>맵 목록</span>
        <button onClick={onAddMap} className="p-1 hover:bg-[#383838] rounded"><Plus size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {data.maps.map(m => (
          <div 
            key={m.id}
            onClick={() => onSelectMap(m.id)}
            className={`p-2 rounded cursor-pointer flex items-center gap-2 ${currentMapId === m.id ? 'bg-indigo-700' : 'hover:bg-[#383838]'}`}
          >
            <MapIcon size={16} />
            <span className="truncate">{m.name}</span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[#444] space-y-2">
         {hasAutosave && (
           <div className="mb-2 pb-2 border-b border-[#444]">
               <button onClick={handleLoadAutosave} className="w-full bg-orange-900/40 hover:bg-orange-800/60 text-orange-200 text-xs py-2 rounded flex items-center justify-center gap-2 mb-1 border border-orange-700/50 transition-colors">
                <RotateCcw size={14} /> 자동 저장 불러오기
               </button>
               {lastAutoSaveTime && (
                   <p className="text-[10px] text-gray-500 text-center">
                       마지막 자동 저장: {lastAutoSaveTime}
                   </p>
               )}
           </div>
         )}
         
         <Button fullWidth onClick={() => onSave(data)} variant="primary" icon={Save}>저장</Button>
         
         <div className="grid grid-cols-2 gap-2">
             <Button fullWidth onClick={() => fileInputRef.current?.click()} variant="secondary" className="text-xs px-2">
                 <Upload size={14} /> 불러오기
             </Button>
             <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleImport} 
                 accept=".json,.zip" 
                 className="hidden" 
             />
             <Button fullWidth onClick={handleExport} variant="secondary" className="text-xs px-2">
                 <Download size={14} /> ZIP
             </Button>
         </div>
         
         <Button fullWidth onClick={handleExcelExport} variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 text-xs border border-emerald-900/50">
             <FileSpreadsheet size={14} /> Excel 내보내기
         </Button>

         <Button fullWidth onClick={onBack} variant="ghost" icon={ArrowLeft} className="mt-2 text-xs">메뉴로 돌아가기</Button>
      </div>
    </div>
  );
};
