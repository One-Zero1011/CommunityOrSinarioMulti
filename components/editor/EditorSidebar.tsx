
import React, { useRef, useState } from 'react';
import { GameData } from '../../types';
import { Plus, Map as MapIcon, Save, Download, ArrowLeft, RotateCcw, Upload, FileSpreadsheet, Settings, AlertTriangle, Key } from 'lucide-react';
import { exportGameDataToZip, exportGameDataToExcel, loadGameDataFromFile } from '../../lib/file-storage';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface EditorSidebarProps {
  data: GameData;
  currentMapId: string;
  onSelectMap: (id: string) => void;
  onAddMap: () => void;
  onSave: (data: GameData) => void;
  onLoadData: (data: GameData) => void;
  onBack: () => void;
}

interface ConfirmationState {
  isOpen: boolean;
  type: 'AUTOSAVE' | 'IMPORT' | null;
  file: File | null;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ 
  data, currentMapId, onSelectMap, onAddMap, onSave, onLoadData, onBack
}) => {
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(10000); // Default 10s
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    type: null,
    file: null
  });
  
  const { hasAutosave, lastAutoSaveTime, loadAutosave } = useAutoSave(data, autoSaveInterval);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // -- Action Handlers (Trigger Modal) --

  const handleLoadAutosaveTrigger = () => {
    setConfirmation({
      isOpen: true,
      type: 'AUTOSAVE',
      file: null
    });
  };

  const handleImportTrigger = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be selected again later
    e.target.value = '';

    setConfirmation({
      isOpen: true,
      type: 'IMPORT',
      file: file
    });
  };

  const closeConfirmation = () => {
    setConfirmation({ isOpen: false, type: null, file: null });
  };

  // -- Execution Logic --

  const executeLoadAction = async () => {
    if (confirmation.type === 'AUTOSAVE') {
        const loaded = loadAutosave();
        if (loaded) onSave(loaded);
    } else if (confirmation.type === 'IMPORT' && confirmation.file) {
        try {
            const loadedData = await loadGameDataFromFile(confirmation.file);
            onLoadData(loadedData);
            // alert("파일을 불러왔습니다"); // Success feedback if needed
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : '파일 로드 중 오류가 발생했습니다.');
        }
    }
    closeConfirmation();
  };

  const handleExport = () => {
    exportGameDataToZip(data);
  };

  const handleExcelExport = () => {
    exportGameDataToExcel(data);
  };

  return (
    <>
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
                <button onClick={handleLoadAutosaveTrigger} className="w-full bg-orange-900/40 hover:bg-orange-800/60 text-orange-200 text-xs py-2 rounded flex items-center justify-center gap-2 mb-1 border border-orange-700/50 transition-colors">
                  <RotateCcw size={14} /> 자동 저장 불러오기
                </button>
                {lastAutoSaveTime && (
                    <p className="text-[10px] text-gray-500 text-center flex justify-between px-2">
                        <span>마지막 저장: {lastAutoSaveTime}</span>
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
                  onChange={handleImportTrigger} 
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

          <div className="flex gap-2 mt-2 pt-2 border-t border-[#444]">
            <Button fullWidth onClick={() => setIsSettingsOpen(true)} variant="secondary" className="text-xs">
                <Settings size={14} /> 설정
            </Button>
            <Button fullWidth onClick={onBack} variant="ghost" icon={ArrowLeft} className="text-xs">
               나가기
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="에디터 설정"
        maxWidth="max-w-sm"
        footer={<Button variant="primary" onClick={() => setIsSettingsOpen(false)}>확인</Button>}
      >
        <div className="space-y-6">
          {/* Admin Key Setting */}
          <div>
             <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                <Key size={14} className="text-orange-400"/> 운영자 암호 (Admin Key)
             </label>
             <input 
                type="text" 
                value={data.adminKey || ''}
                onChange={(e) => onSave({ ...data, adminKey: e.target.value })}
                placeholder="플레이 시 사용할 운영자 암호"
                className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
             />
             <p className="text-xs text-gray-500 mt-2">
               * 게임 플레이 시 이 암호를 입력하면 운영자 권한을 얻을 수 있습니다.
             </p>
          </div>

          <div className="border-t border-[#444] pt-4">
             <label className="block text-sm font-bold text-gray-300 mb-2">자동 저장 간격</label>
             <div className="grid grid-cols-1 gap-2">
               {[
                 { label: '사용 안 함', value: 0 },
                 { label: '5초', value: 5000 },
                 { label: '10초 (기본)', value: 10000 },
                 { label: '30초', value: 30000 },
                 { label: '1분', value: 60000 },
               ].map((option) => (
                 <button
                   key={option.value}
                   onClick={() => setAutoSaveInterval(option.value)}
                   className={`flex items-center justify-between px-4 py-2 rounded text-sm transition-colors border ${
                     autoSaveInterval === option.value
                       ? 'bg-indigo-600 border-indigo-500 text-white'
                       : 'bg-[#383838] border-[#444] text-gray-300 hover:bg-[#444]'
                   }`}
                 >
                   <span>{option.label}</span>
                   {autoSaveInterval === option.value && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                 </button>
               ))}
             </div>
             <p className="text-xs text-gray-500 mt-2">
               * 데이터 변경이 감지되면 설정된 시간 후에 브라우저에 자동 저장됩니다.
             </p>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmation.isOpen}
        onClose={closeConfirmation}
        title="데이터 불러오기 확인"
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeConfirmation}>취소</Button>
            <Button variant="danger" onClick={executeLoadAction}>불러오기</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center p-2">
           <div className="bg-red-500/10 p-3 rounded-full mb-4">
              <AlertTriangle size={32} className="text-red-500" />
           </div>
           <h4 className="text-lg font-bold text-white mb-2">정말 불러오시겠습니까?</h4>
           <p className="text-gray-400 text-sm mb-4">
             새로운 데이터를 불러오면 <span className="text-red-400 font-bold">현재 작업 중인 내용이 덮어씌워지며</span>, 
             저장하지 않은 변경 사항은 복구할 수 없습니다.
           </p>
           {confirmation.type === 'AUTOSAVE' && (
             <div className="bg-[#383838] px-3 py-2 rounded border border-[#555] text-xs text-orange-200 flex items-center gap-2">
                <RotateCcw size={12} />
                자동 저장된 시점을 불러옵니다.
             </div>
           )}
           {confirmation.type === 'IMPORT' && confirmation.file && (
             <div className="bg-[#383838] px-3 py-2 rounded border border-[#555] text-xs text-gray-300 flex items-center gap-2 truncate max-w-full">
                <Upload size={12} />
                <span className="truncate">{confirmation.file.name}</span>
             </div>
           )}
        </div>
      </Modal>
    </>
  );
};