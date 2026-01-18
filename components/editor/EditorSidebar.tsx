
import React, { useRef, useState } from 'react';
import { GameData, CustomStatDef } from '../../types';
import { Plus, Map as MapIcon, Save, Download, ArrowLeft, RotateCcw, Upload, FileSpreadsheet, Settings, AlertTriangle, Key, UserCog, Trash2, Heart } from 'lucide-react';
import { exportGameDataToZip, exportGameDataToExcel, loadGameDataFromFile } from '../../lib/file-storage';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { generateId } from '../../lib/utils';

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
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(10000); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    type: null,
    file: null
  });
  
  const { hasAutosave, lastAutoSaveTime, loadAutosave } = useAutoSave(data, autoSaveInterval);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCustomStat = () => {
    const newStat: CustomStatDef = {
      id: generateId(),
      label: '새 스탯',
      min: 0,
      max: 100,
      defaultValue: 50,
      hpWeight: 0,
      isHpBound: false
    };
    const updatedStats = [...(data.customStats || []), newStat];
    onSave({ ...data, customStats: updatedStats });
  };

  const handleUpdateCustomStat = (id: string, updates: Partial<CustomStatDef>) => {
    let updatedStats = (data.customStats || []).map(s => s.id === id ? { ...s, ...updates } : s);
    
    // If setting isHpBound to true, unset others
    if (updates.isHpBound === true) {
        updatedStats = updatedStats.map(s => s.id === id ? s : { ...s, isHpBound: false });
    }

    onSave({ ...data, customStats: updatedStats });
  };

  const handleRemoveCustomStat = (id: string) => {
    const updatedStats = (data.customStats || []).filter(s => s.id !== id);
    onSave({ ...data, customStats: updatedStats });
  };

  const executeLoadAction = async () => {
    if (confirmation.type === 'AUTOSAVE') {
        const loaded = loadAutosave();
        if (loaded) onSave(loaded);
    } else if (confirmation.type === 'IMPORT' && confirmation.file) {
        try {
            const loadedData = await loadGameDataFromFile(confirmation.file);
            onLoadData(loadedData);
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : '파일 로드 중 오류가 발생했습니다.');
        }
    }
    setConfirmation({ isOpen: false, type: null, file: null });
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
                <button onClick={() => setConfirmation({ isOpen: true, type: 'AUTOSAVE', file: null })} className="w-full bg-orange-900/40 hover:bg-orange-800/60 text-orange-200 text-xs py-2 rounded flex items-center justify-center gap-2 mb-1 border border-orange-700/50 transition-colors">
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
                  onChange={(e) => {
                      const file = e.target.files?.[0];
                      if(file) setConfirmation({ isOpen: true, type: 'IMPORT', file });
                      e.target.value = '';
                  }} 
                  accept=".json,.zip" 
                  className="hidden" 
              />
              <Button fullWidth onClick={() => exportGameDataToZip(data)} variant="secondary" className="text-xs px-2">
                  <Download size={14} /> ZIP
              </Button>
          </div>
          
          <Button fullWidth onClick={() => exportGameDataToExcel(data)} variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 text-xs border border-emerald-900/50">
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

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="시나리오 설정"
        maxWidth="max-w-md"
      >
        <div className="space-y-6 pb-4">
          <section className="space-y-3">
             <div>
                <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                   <Key size={14} className="text-orange-400"/> 운영자 암호
                </label>
                <input 
                   type="text" 
                   value={data.adminKey || ''}
                   onChange={(e) => onSave({ ...data, adminKey: e.target.value })}
                   placeholder="플레이 시 사용할 운영자 암호"
                   className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                   <Heart size={14} className="text-red-400"/> 캐릭터 기본 체력 (Base HP)
                </label>
                <input 
                   type="number" 
                   value={data.baseHp ?? 100}
                   onChange={(e) => onSave({ ...data, baseHp: parseInt(e.target.value) || 0 })}
                   className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                />
                <p className="text-[10px] text-gray-500 mt-1">스탯 연동 전의 기본 체력 수치입니다.</p>
             </div>
          </section>

          <section className="border-t border-[#444] pt-4">
             <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                   <UserCog size={14} className="text-indigo-400"/> 캐릭터 스탯 정의
                </label>
                <button onClick={handleAddCustomStat} className="text-xs bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded text-white font-bold">+ 추가</button>
             </div>
             
             <div className="space-y-3">
                {(data.customStats || []).length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">정의된 스탯이 없습니다.</p>}
                {(data.customStats || []).map((stat) => (
                    <div key={stat.id} className="bg-[#1e1e1e] p-3 rounded border border-[#444] relative group/stat">
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" value={stat.label} 
                                onChange={(e) => handleUpdateCustomStat(stat.id, { label: e.target.value })}
                                className="flex-1 bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white"
                                placeholder="스탯 이름 (예: 근력)"
                            />
                            <button onClick={() => handleRemoveCustomStat(stat.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
                            <div>
                                <span className="block text-gray-500 mb-1">최소값</span>
                                <input type="number" value={stat.min} onChange={(e) => handleUpdateCustomStat(stat.id, { min: parseInt(e.target.value)||0 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" />
                            </div>
                            <div>
                                <span className="block text-gray-500 mb-1">최대값</span>
                                <input type="number" value={stat.max} onChange={(e) => handleUpdateCustomStat(stat.id, { max: parseInt(e.target.value)||100 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" />
                            </div>
                            <div>
                                <span className="block text-gray-500 mb-1">기본값</span>
                                <input type="number" value={stat.defaultValue} onChange={(e) => handleUpdateCustomStat(stat.id, { defaultValue: parseInt(e.target.value)||0 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-black/20 p-2 rounded">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={stat.isHpBound || false} 
                                    onChange={(e) => handleUpdateCustomStat(stat.id, { isHpBound: e.target.checked })}
                                    className="w-3 h-3 accent-red-500"
                                />
                                <span className="text-[10px] text-gray-400 font-bold uppercase">체력 연동</span>
                            </label>
                            {stat.isHpBound && (
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap">가중치 (Weight)</span>
                                    <input 
                                        type="number" 
                                        value={stat.hpWeight ?? 0}
                                        onChange={(e) => handleUpdateCustomStat(stat.id, { hpWeight: parseInt(e.target.value) || 0 })}
                                        className="w-12 bg-[#2a2a2a] border border-[#555] rounded text-center text-[10px] text-white"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
             </div>
          </section>

          <section className="border-t border-[#444] pt-4">
             <label className="block text-sm font-bold text-gray-300 mb-2">자동 저장 간격</label>
             <select 
                value={autoSaveInterval} 
                onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
                className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-white"
             >
                <option value={0}>사용 안 함</option>
                <option value={5000}>5초</option>
                <option value={10000}>10초 (기본)</option>
                <option value={60000}>1분</option>
             </select>
          </section>
        </div>
      </Modal>

      <Modal isOpen={confirmation.isOpen} onClose={() => setConfirmation({ isOpen: false, type: null, file: null })} title="데이터 불러오기" maxWidth="max-w-sm">
        <div className="text-center p-2">
           <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
           <p className="text-gray-300 text-sm mb-6">작업 중인 내용이 유실될 수 있습니다. 계속하시겠습니까?</p>
           <div className="flex gap-2">
              <Button fullWidth variant="ghost" onClick={() => setConfirmation({ isOpen: false, type: null, file: null })}>취소</Button>
              <Button fullWidth variant="danger" onClick={executeLoadAction}>불러오기</Button>
           </div>
        </div>
      </Modal>
    </>
  );
};
