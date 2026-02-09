
import React, { useRef, useState } from 'react';
import { GameData, CustomStatDef, DiceRange, GlobalVariable, VariableType } from '../../types';
import { Plus, Map as MapIcon, Save, Download, ArrowLeft, RotateCcw, Upload, FileSpreadsheet, Settings, AlertTriangle, Key, UserCog, Trash2, Heart, Hash, Database, Type, ToggleLeft, ToggleRight } from 'lucide-react';
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
  const [isVariablesOpen, setIsVariablesOpen] = useState(false); // Variable Modal State
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    type: null,
    file: null
  });
  
  const { hasAutosave, lastAutoSaveTime, loadAutosave } = useAutoSave(data, autoSaveInterval);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Stats Logic ---
  const handleAddCustomStat = () => {
    const newStat: CustomStatDef = {
      id: generateId(),
      label: '새 스탯',
      min: 0,
      max: 100,
      defaultValue: 50,
      hpWeight: 0,
      isHpBound: false,
      diceRanges: [
          { threshold: 50, dice: 10 },
          { threshold: 100, dice: 20 }
      ]
    };
    const updatedStats = [...(data.customStats || []), newStat];
    onSave({ ...data, customStats: updatedStats });
  };

  const handleUpdateCustomStat = (id: string, updates: Partial<CustomStatDef>) => {
    let updatedStats = (data.customStats || []).map(s => s.id === id ? { ...s, ...updates } : s);
    if (updates.isHpBound === true) {
        updatedStats = updatedStats.map(s => s.id === id ? s : { ...s, isHpBound: false });
    }
    onSave({ ...data, customStats: updatedStats });
  };

  const handleRemoveCustomStat = (id: string) => {
    const updatedStats = (data.customStats || []).filter(s => s.id !== id);
    onSave({ ...data, customStats: updatedStats });
  };

  const handleAddDiceRange = (statId: string) => {
      const stat = data.customStats?.find(s => s.id === statId);
      if (!stat) return;
      const newRanges = [...(stat.diceRanges || []), { threshold: 100, dice: 20 }];
      handleUpdateCustomStat(statId, { diceRanges: newRanges });
  };

  // --- Variables Logic ---
  const handleAddVariable = () => {
      const newVar: GlobalVariable = {
          id: generateId(),
          name: `변수_${(data.globalVariables?.length || 0) + 1}`,
          type: 'NUMBER',
          initialValue: 0
      };
      onSave({ ...data, globalVariables: [...(data.globalVariables || []), newVar] });
  };

  const handleUpdateVariable = (id: string, updates: Partial<GlobalVariable>) => {
      const updatedVars = (data.globalVariables || []).map(v => {
          if (v.id === id) {
              const newVar = { ...v, ...updates };
              // Ensure value type consistency
              if (updates.type) {
                  if (updates.type === 'NUMBER') newVar.initialValue = 0;
                  else if (updates.type === 'BOOLEAN') newVar.initialValue = false;
                  else if (updates.type === 'STRING') newVar.initialValue = '';
              }
              return newVar;
          }
          return v;
      });
      onSave({ ...data, globalVariables: updatedVars });
  };

  const handleDeleteVariable = (id: string) => {
      onSave({ ...data, globalVariables: (data.globalVariables || []).filter(v => v.id !== id) });
  };

  // --- Load Logic ---
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
              <Button fullWidth onClick={() => fileInputRef.current?.click()} variant="secondary" className="text-xs px-2"><Upload size={14} /> 불러오기</Button>
              <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(file) setConfirmation({ isOpen: true, type: 'IMPORT', file }); e.target.value = ''; }} accept=".json,.zip" className="hidden" />
              <Button fullWidth onClick={() => exportGameDataToZip(data)} variant="secondary" className="text-xs px-2"><Download size={14} /> ZIP</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
              <Button fullWidth onClick={() => exportGameDataToExcel(data, false)} variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 text-[10px] px-1 border border-emerald-900/50">
                  <FileSpreadsheet size={14} /> Excel (핵심)
              </Button>
              <Button fullWidth onClick={() => exportGameDataToExcel(data, true)} variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 text-[10px] px-1 border border-emerald-900/50">
                  <FileSpreadsheet size={14} /> Excel (전체)
              </Button>
          </div>
          <div className="flex gap-2 mt-2 pt-2 border-t border-[#444]">
            <Button fullWidth onClick={() => setIsVariablesOpen(true)} variant="secondary" className="text-xs px-2"><Database size={14} /> 변수</Button>
            <Button fullWidth onClick={() => setIsSettingsOpen(true)} variant="secondary" className="text-xs px-2"><Settings size={14} /> 설정</Button>
          </div>
          <Button fullWidth onClick={onBack} variant="ghost" icon={ArrowLeft} className="text-xs">나가기</Button>
        </div>
      </div>

      {/* Variables Modal */}
      <Modal isOpen={isVariablesOpen} onClose={() => setIsVariablesOpen(false)} title="전역 변수 관리 (Global Variables)" maxWidth="max-w-2xl">
          <div className="space-y-4">
              <div className="flex justify-between items-end">
                  <p className="text-xs text-gray-400">게임 전체에서 공유되는 변수들을 정의합니다.<br/>시나리오 분기나 상태 추적에 사용할 수 있습니다.</p>
                  <button onClick={handleAddVariable} className="text-xs bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 rounded text-white font-bold flex items-center gap-1">
                      <Plus size={12}/> 변수 추가
                  </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                  {(data.globalVariables || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500 italic border border-dashed border-[#444] rounded">
                          등록된 변수가 없습니다.
                      </div>
                  )}
                  {(data.globalVariables || []).map((v) => (
                      <div key={v.id} className="bg-[#1e1e1e] p-3 rounded border border-[#444] flex items-center gap-3">
                          {/* Name */}
                          <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1 font-bold">이름</label>
                              <input 
                                  type="text" 
                                  value={v.name} 
                                  onChange={(e) => handleUpdateVariable(v.id, { name: e.target.value })} 
                                  className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1.5 text-sm text-white font-bold"
                                  placeholder="변수명"
                              />
                          </div>

                          {/* Type */}
                          <div className="w-32">
                              <label className="block text-[10px] text-gray-500 mb-1 font-bold flex items-center gap-1"><Type size={10}/> 타입</label>
                              <select 
                                  value={v.type} 
                                  onChange={(e) => handleUpdateVariable(v.id, { type: e.target.value as VariableType })} 
                                  className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1.5 text-xs text-gray-300"
                              >
                                  <option value="NUMBER">숫자 (Number)</option>
                                  <option value="BOOLEAN">논리 (Bool)</option>
                                  <option value="STRING">문자열 (String)</option>
                              </select>
                          </div>

                          {/* Initial Value */}
                          <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1 font-bold">초기값</label>
                              {v.type === 'BOOLEAN' ? (
                                  <div className="flex items-center h-[30px]">
                                      <button 
                                          onClick={() => handleUpdateVariable(v.id, { initialValue: !v.initialValue })}
                                          className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-colors ${v.initialValue ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/50' : 'bg-red-900/50 text-red-400 border border-red-500/50'}`}
                                      >
                                          {v.initialValue ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                          {v.initialValue ? 'TRUE (ON)' : 'FALSE (OFF)'}
                                      </button>
                                  </div>
                              ) : v.type === 'NUMBER' ? (
                                  <input 
                                      type="number" 
                                      value={v.initialValue as number} 
                                      onChange={(e) => handleUpdateVariable(v.id, { initialValue: parseFloat(e.target.value) || 0 })} 
                                      className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1.5 text-sm text-white font-mono"
                                  />
                              ) : (
                                  <input 
                                      type="text" 
                                      value={v.initialValue as string} 
                                      onChange={(e) => handleUpdateVariable(v.id, { initialValue: e.target.value })} 
                                      className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1.5 text-sm text-white"
                                      placeholder="Value..."
                                  />
                              )}
                          </div>

                          {/* Delete */}
                          <div className="pt-5">
                              <button onClick={() => handleDeleteVariable(v.id)} className="text-gray-500 hover:text-red-400 p-1">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </Modal>

      {/* Settings Modal (Existing) */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="시나리오 설정" maxWidth="max-w-2xl">
        <div className="space-y-6 pb-4 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-2"><Key size={14} className="text-orange-400"/> 운영자 암호</label>
                <input type="text" value={data.adminKey || ''} onChange={(e) => onSave({ ...data, adminKey: e.target.value })} placeholder="플레이 시 사용할 운영자 암호" className="w-full bg-[#383838] border border-[#555] rounded px-3 py-1.5 text-sm text-white" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-2"><Heart size={14} className="text-red-400"/> 캐릭터 기본 체력 (Base HP)</label>
                <input type="number" value={data.baseHp ?? 100} onChange={(e) => onSave({ ...data, baseHp: parseInt(e.target.value) || 0 })} className="w-full bg-[#383838] border border-[#555] rounded px-3 py-1.5 text-sm text-white" />
             </div>
          </div>

          <section className="border-t border-[#444] pt-4">
             <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-gray-300 flex items-center gap-2"><UserCog size={14} className="text-indigo-400"/> 캐릭터 스탯 및 판정 설정</label>
                <button onClick={handleAddCustomStat} className="text-xs bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded text-white font-bold">+ 추가</button>
             </div>
             
             <div className="space-y-4">
                {(data.customStats || []).map((stat) => (
                    <div key={stat.id} className="bg-[#1e1e1e] p-4 rounded border border-[#444] relative">
                        <div className="flex gap-2 mb-3">
                            <input type="text" value={stat.label} onChange={(e) => handleUpdateCustomStat(stat.id, { label: e.target.value })} className="flex-1 bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white font-bold" />
                            <button onClick={() => handleRemoveCustomStat(stat.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[10px] mb-4">
                            <div><span className="block text-gray-500 mb-1">최소</span><input type="number" value={stat.min} onChange={(e) => handleUpdateCustomStat(stat.id, { min: parseInt(e.target.value)||0 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" /></div>
                            <div><span className="block text-gray-500 mb-1">최대</span><input type="number" value={stat.max} onChange={(e) => handleUpdateCustomStat(stat.id, { max: parseInt(e.target.value)||100 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" /></div>
                            <div><span className="block text-gray-500 mb-1">기본</span><input type="number" value={stat.defaultValue} onChange={(e) => handleUpdateCustomStat(stat.id, { defaultValue: parseInt(e.target.value)||0 })} className="w-full bg-[#2a2a2a] border border-[#555] rounded p-1 text-center text-white" /></div>
                            <div className="flex flex-col items-center">
                                <span className="block text-gray-500 mb-1">HP 연동</span>
                                <input type="checkbox" checked={stat.isHpBound || false} onChange={(e) => handleUpdateCustomStat(stat.id, { isHpBound: e.target.checked })} className="mt-1" />
                            </div>
                        </div>

                        {/* Method B Dice Ranges UI */}
                        <div className="mt-2 bg-black/20 p-2 rounded border border-[#333]">
                            <p className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1"><Hash size={10}/> 방식 B: 구간별 가변 주사위 설정</p>
                            <div className="space-y-1">
                                {(stat.diceRanges || []).map((range, ridx) => (
                                    <div key={ridx} className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-500 w-16">스탯 ≤</span>
                                        <input type="number" value={range.threshold} onChange={(e) => {
                                            const newRanges = [...(stat.diceRanges || [])];
                                            newRanges[ridx].threshold = parseInt(e.target.value) || 0;
                                            handleUpdateCustomStat(stat.id, { diceRanges: newRanges });
                                        }} className="w-12 bg-[#2a2a2a] border border-[#444] text-[9px] text-center" />
                                        <span className="text-[9px] text-gray-500">이면</span>
                                        <span className="text-[9px] text-indigo-400 font-bold ml-auto">D</span>
                                        <input type="number" value={range.dice} onChange={(e) => {
                                            const newRanges = [...(stat.diceRanges || [])];
                                            newRanges[ridx].dice = parseInt(e.target.value) || 0;
                                            handleUpdateCustomStat(stat.id, { diceRanges: newRanges });
                                        }} className="w-12 bg-[#2a2a2a] border border-[#444] text-[9px] text-center" />
                                        <button onClick={() => {
                                            const newRanges = stat.diceRanges?.filter((_, i) => i !== ridx);
                                            handleUpdateCustomStat(stat.id, { diceRanges: newRanges });
                                        }} className="text-gray-600 hover:text-red-400"><Trash2 size={10}/></button>
                                    </div>
                                ))}
                                <button onClick={() => handleAddDiceRange(stat.id)} className="w-full py-1 mt-1 text-[9px] border border-dashed border-[#444] text-gray-500 hover:text-white">+ 구간 추가</button>
                            </div>
                        </div>
                    </div>
                ))}
             </div>
          </section>
        </div>
      </Modal>

      {/* Load Confirmation Modal */}
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
