
import React, { useState, useEffect, useRef } from 'react';
import { GameData, MapScene, MapObject, ShapeType, ResultType, StatMethod } from '../../types';
import { Shapes, Trash2, Palette, FileText, Dices, Upload, MapPin, MousePointer2, Image as ImageIcon, X, Eye, EyeOff, Layers, ShieldAlert, Box, ChevronUp, ChevronDown, BringToFront, SendToBack, Settings2, Target, HelpCircle, Info, Maximize, Flag } from 'lucide-react';
import { blobToBase64 } from '../../lib/utils';
import { ImageCropperModal, CropShape } from '../common/ImageCropperModal';

interface ObjectInspectorProps {
  mapList: MapScene[];
  currentMap: MapScene | undefined;
  selectedObject: MapObject | undefined;
  onUpdateMap: (updates: Partial<MapScene>) => void;
  onUpdateObject: (id: string, updates: Partial<MapObject>) => void;
  onDeleteObject: (id: string) => void;
  gameData?: GameData; 
}

const METHOD_DESCRIPTIONS: Record<StatMethod, string> = {
  SIMPLE: "캐릭터의 능력치와 상관없이 오직 운(설정된 확률)으로만 성공 여부를 결정합니다.",
  ADDITIVE: "기초 성공 확률에 캐릭터의 스탯 수치를 더해 최종 성공률(%)을 계산합니다. (1D100 ≤ 기초+스탯)",
  VARIABLE_DICE: "스탯 수치에 따라 주사위 종류(D6, D20 등)를 바꿉니다. 굴린 눈금이 목표값보다 높으면 성공합니다.",
  DIFFICULTY: "고정된 난이도에서 내 스탯을 뺀 값보다 주사위 눈금이 낮으면 성공합니다. (1D100 ≤ 난이도-스탯)",
  THRESHOLD: "캐릭터의 스탯 수치 자체가 성공의 기준선이 됩니다. 스탯보다 낮게 나와야 성공하는 정통 TRPG 방식입니다. (1D100 ≤ 스탯)"
};

const OutcomeEditor = ({ label, resultType, color, selectedObject, onUpdateObject, mapList, currentMap }: any) => {
  if (!selectedObject.data) return null;
  const outcome = selectedObject.data.outcomes[resultType];
  const mapObjects = currentMap?.objects.filter((o:any) => o.id !== selectedObject.id) || [];
  return (
      <div className="p-2 bg-[#1e1e1e] rounded border border-[#444] mb-2">
          <p className={`text-xs font-bold mb-1 ${color}`}>{label}</p>
          <textarea rows={2} value={outcome.text} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, text: e.target.value } } } })} className="w-full bg-[#383838] border border-[#555] rounded p-1 text-xs mb-1 text-gray-200" placeholder={`${label} 결과 텍스트`} />
          <div className="flex gap-2 mb-1">
              <input type="number" placeholder="HP" className="w-1/3 bg-[#383838] text-xs p-1 rounded border border-[#555] text-gray-200" value={outcome.hpChange} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, hpChange: parseInt(e.target.value) || 0 } } } })} />
              <input type="text" placeholder="아이템/상태" className="w-2/3 bg-[#383838] text-xs p-1 rounded border border-[#555] text-gray-200" value={outcome.itemDrop || ''} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, itemDrop: e.target.value } } } })} />
          </div>
          <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2"><MapPin size={12} className="text-gray-500" /><select value={outcome.targetMapId || ''} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, targetMapId: e.target.value || undefined } } } })} className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-gray-200"><option value="">(이동 없음)</option>{mapList.map((m:any) => (<option key={m.id} value={m.id}>{m.name}</option>))}</select></div>
              <div className="flex items-center gap-2"><Eye size={12} className="text-emerald-500" /><select value={outcome.revealObjectId || ''} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, revealObjectId: e.target.value || undefined } } } })} className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-emerald-100"><option value="">(활성화할 대상)</option>{mapObjects.map((o:any) => (<option key={o.id} value={o.id}>{o.label}</option>))}</select></div>
              <div className="flex items-center gap-2"><EyeOff size={12} className="text-red-500" /><select value={outcome.hideObjectId || ''} onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, outcomes: { ...selectedObject.data!.outcomes, [resultType]: { ...outcome, hideObjectId: e.target.value || undefined } } } })} className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-red-100"><option value="">(비활성화할 대상)</option>{mapObjects.map((o:any) => (<option key={o.id} value={o.id}>{o.label}</option>))}</select></div>
          </div>
      </div>
  );
};

export const ObjectInspector: React.FC<ObjectInspectorProps> = ({
  mapList, currentMap, selectedObject, onUpdateMap, onUpdateObject, onDeleteObject, gameData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectImageInputRef = useRef<HTMLInputElement>(null);
  const [tempColor, setTempColor] = useState("#000000");
  const [tempOpacity, setTempOpacity] = useState(100);

  const [cropState, setCropState] = useState<{
    isOpen: boolean;
    file: File | null;
    initialAspectRatio?: number | null;
    initialShape?: CropShape;
    onConfirm: (base64: string) => void;
  }>({ isOpen: false, file: null, onConfirm: () => {} });

  useEffect(() => {
    if (selectedObject) {
       const rgbaMatch = selectedObject.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
       if (rgbaMatch) {
         const r = parseInt(rgbaMatch[1]);
         const g = parseInt(rgbaMatch[2]);
         const b = parseInt(rgbaMatch[3]);
         const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
         const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
         setTempColor(hex);
         setTempOpacity(Math.round(a * 100));
       } else if (selectedObject.color.startsWith('#')) {
         setTempColor(selectedObject.color);
         setTempOpacity(100);
       }
    }
  }, [selectedObject?.id, selectedObject?.color]);

  const applyColorChange = (hex: string, opacity: number) => {
    setTempColor(hex);
    setTempOpacity(opacity);
    if (selectedObject) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const rgba = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
      onUpdateObject(selectedObject.id, { color: rgba });
    }
  };

  const handleImageUploadTrigger = (e: React.ChangeEvent<HTMLInputElement>, type: 'MAP_BG' | 'OBJ_IMG') => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      e.target.value = ''; 
      
      let initRatio: number | null = null;
      let initShape: CropShape = 'RECTANGLE';

      if (type === 'OBJ_IMG' && selectedObject) {
         if (selectedObject.shape === 'CIRCLE') {
             initRatio = 1;
             initShape = 'CIRCLE';
         } else if (selectedObject.shape === 'ROUNDED') {
             initShape = 'ROUNDED';
         }
      }

      setCropState({
        isOpen: true,
        file: file,
        initialAspectRatio: initRatio,
        initialShape: initShape,
        onConfirm: (base64) => {
          if (type === 'MAP_BG' && currentMap) {
            onUpdateMap({ bgImage: base64 });
          } else if (type === 'OBJ_IMG' && selectedObject) {
            onUpdateObject(selectedObject.id, { image: base64 });
          }
        }
      });
    }
  };

  const handleBringToFront = () => {
    if (!selectedObject || !currentMap) return;
    const maxZ = Math.max(...currentMap.objects.map(o => o.zIndex || 0), 0);
    onUpdateObject(selectedObject.id, { zIndex: maxZ + 1 });
  };

  const handleSendToBack = () => {
    if (!selectedObject || !currentMap) return;
    const minZ = Math.min(...currentMap.objects.map(o => o.zIndex || 0), 0);
    onUpdateObject(selectedObject.id, { zIndex: minZ - 1 });
  };

  const isSpawnPoint = selectedObject?.type === 'SPAWN_POINT';

  return (
    <>
      <div className="w-80 bg-[#252525] border-l border-[#444] flex flex-col p-4 overflow-y-auto text-gray-200 custom-scrollbar">
        <h3 className="font-bold mb-4 text-gray-300">속성 (Properties)</h3>
        
        <div className="mb-6 p-3 bg-[#1e1e1e] rounded space-y-3 border border-[#444]">
          <div><label className="block text-xs uppercase text-gray-400 mb-1">맵 이름</label><input type="text" value={currentMap?.name || ''} onChange={(e) => onUpdateMap({ name: e.target.value })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" /></div>
          
          <div className="grid grid-cols-2 gap-2">
             <div>
                <label className="block text-xs uppercase text-gray-400 mb-1 flex items-center gap-1"><Maximize size={10}/> 맵 가로</label>
                <input type="number" value={currentMap?.width || 1200} onChange={(e) => onUpdateMap({ width: parseInt(e.target.value) || 1200 })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" />
             </div>
             <div>
                <label className="block text-xs uppercase text-gray-400 mb-1 flex items-center gap-1"><Maximize size={10} className="rotate-90"/> 맵 세로</label>
                <input type="number" value={currentMap?.height || 800} onChange={(e) => onUpdateMap({ height: parseInt(e.target.value) || 800 })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" />
             </div>
          </div>

          <div><label className="block text-xs uppercase text-gray-400 mb-1">배경 이미지</label><button onClick={() => fileInputRef.current?.click()} className="w-full bg-indigo-700 hover:bg-indigo-600 py-1.5 text-xs rounded flex items-center justify-center gap-2 font-bold shadow-md"><Upload size={14} /> 업로드</button><input type="file" ref={fileInputRef} onChange={(e) => handleImageUploadTrigger(e, 'MAP_BG')} accept="image/*" className="hidden" /></div>
        </div>

        {selectedObject ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#444]"><span className="font-semibold text-emerald-400 flex items-center gap-2"><Shapes size={16} /> 오브젝트 설정</span><button onClick={() => onDeleteObject(selectedObject.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button></div>
            
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1"><label className="block text-xs uppercase text-gray-400 mb-1">이름 (라벨)</label><input type="text" value={selectedObject.label} onChange={(e) => onUpdateObject(selectedObject.id, { label: e.target.value })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" /></div>
                {!isSpawnPoint && (
                    <label className="flex flex-col items-center gap-1 cursor-pointer group">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">시작 시 숨김</span>
                        <div 
                            onClick={() => onUpdateObject(selectedObject.id, { hidden: !selectedObject.hidden })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors relative ${selectedObject.hidden ? 'bg-orange-600' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedObject.hidden ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </label>
                )}
            </div>

            {isSpawnPoint ? (
                <div className="p-3 bg-violet-900/20 border border-violet-500/30 rounded text-center">
                    <Flag className="mx-auto text-violet-400 mb-2" size={24} />
                    <p className="text-sm font-bold text-violet-300">캐릭터 시작 위치</p>
                    <p className="text-xs text-gray-400 mt-1">플레이어가 이 맵에 처음 진입하거나<br/>캐릭터를 생성할 때 나타나는 위치입니다.</p>
                </div>
            ) : (
                <div className="p-3 bg-[#1e1e1e] rounded border border-[#444] space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
                            <Palette size={12} /> 외형 (Appearance)
                        </h4>
                        <div className="flex gap-1">
                        <button 
                            onClick={() => onUpdateObject(selectedObject.id, { isSolid: !selectedObject.isSolid })}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${selectedObject.isSolid ? 'bg-red-900/40 text-red-400 border-red-500/50' : 'bg-gray-700 text-gray-400 border-gray-600'}`}
                            title="물리 충돌 여부 (플레이어 통과 불가)"
                        >
                            {selectedObject.isSolid ? <ShieldAlert size={10} /> : <Box size={10} />}
                            {selectedObject.isSolid ? 'Solid' : 'Pass'}
                        </button>
                        </div>
                    </div>

                    <div>
                    <label className="block text-xs text-gray-500 mb-1">레이어 순서 (Z-Index)</label>
                    <div className="flex gap-2">
                        <input 
                        type="number"
                        value={selectedObject.zIndex ?? 10}
                        onChange={(e) => onUpdateObject(selectedObject.id, { zIndex: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                        />
                        <button onClick={handleBringToFront} className="flex-1 bg-[#383838] hover:bg-[#4a4a4a] text-[10px] rounded border border-[#555] flex items-center justify-center gap-1"><BringToFront size={12} /> 맨 앞으로</button>
                        <button onClick={handleSendToBack} className="flex-1 bg-[#383838] hover:bg-[#4a4a4a] text-[10px] rounded border border-[#555] flex items-center justify-center gap-1"><SendToBack size={12} /> 맨 뒤로</button>
                    </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">모양 (Shape)</label>
                        <select 
                            value={selectedObject.shape || 'RECTANGLE'}
                            onChange={(e) => onUpdateObject(selectedObject.id, { shape: e.target.value as ShapeType })}
                            className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                        >
                            <option value="RECTANGLE">사각형 (기본)</option>
                            <option value="ROUNDED">둥근 사각형</option>
                            <option value="CIRCLE">원형</option>
                            <option value="TRIANGLE">삼각형</option>
                            <option value="DIAMOND">다이아몬드</option>
                            <option value="PENTAGON">오각형</option>
                            <option value="HEXAGON">육각형</option>
                            <option value="OCTAGON">팔각형</option>
                            <option value="STAR">별</option>
                            <option value="CROSS">십자가</option>
                            <option value="MESSAGE">말풍선</option>
                            <option value="ARROW">화살표</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">오브젝트 이미지</label>
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" 
                                value={selectedObject.image || ''} 
                                onChange={(e) => onUpdateObject(selectedObject.id, { image: e.target.value })}
                                className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200"
                                placeholder="이미지 URL..."
                            />
                            {selectedObject.image && (
                                <button 
                                onClick={() => onUpdateObject(selectedObject.id, { image: undefined })}
                                className="bg-red-900/50 hover:bg-red-800 text-red-200 p-1 rounded border border-red-800 shrink-0"
                                title="이미지 제거"
                                >
                                <X size={14} />
                                </button>
                            )}
                        </div>
                        <button onClick={() => objectImageInputRef.current?.click()} className="w-full bg-[#383838] hover:bg-[#4a4a4a] py-1 text-xs rounded flex items-center justify-center gap-2 border border-[#555] text-gray-300">
                            <ImageIcon size={12} /> 이미지 업로드
                        </button>
                        <input 
                            type="file" 
                            ref={objectImageInputRef} 
                            onChange={(e) => handleImageUploadTrigger(e, 'OBJ_IMG')} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">색상</label>
                            <input 
                                type="color" 
                                value={tempColor}
                                onChange={(e) => applyColorChange(e.target.value, tempOpacity)}
                                className="h-6 w-full cursor-pointer bg-transparent border-none p-0"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">투명도 ({tempOpacity}%)</label>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={tempOpacity}
                                onChange={(e) => applyColorChange(tempColor, parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[#444] pt-2 mt-2">
                    <div><label className="block text-xs text-gray-500 mb-1">너비</label><input type="number" value={selectedObject.width} onChange={(e) => onUpdateObject(selectedObject.id, { width: parseInt(e.target.value) })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200" /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">높이</label><input type="number" value={selectedObject.height} onChange={(e) => onUpdateObject(selectedObject.id, { height: parseInt(e.target.value) })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200" /></div>
                    </div>
                </div>
            )}
            
            {(selectedObject.type === 'OBJECT' || selectedObject.type === 'MAP_LINK') && (
              <div className="space-y-4 pt-2 border-t border-[#444]">
                <div>
                    <label className="block text-xs font-bold text-gray-300 mb-2">상호작용 방식</label>
                    <div className="flex bg-[#1e1e1e] rounded p-1 gap-1 border border-[#444]">
                      <button className={`flex-1 text-[10px] py-1.5 rounded transition-colors ${selectedObject.useProbability ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`} onClick={() => onUpdateObject(selectedObject.id, { useProbability: true })}>판정 (Stat/Dice)</button>
                      <button className={`flex-1 text-[10px] py-1.5 rounded transition-colors ${!selectedObject.useProbability ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`} onClick={() => onUpdateObject(selectedObject.id, { useProbability: false })}>일반/이동</button>
                    </div>
                </div>

                {selectedObject.useProbability && (
                    <div className="bg-indigo-900/10 p-3 rounded border border-indigo-500/30 space-y-3">
                        <p className="text-[10px] font-bold text-indigo-400 flex items-center gap-1 uppercase"><Settings2 size={12}/> 1. 판정 방식 설정 (Logic)</p>
                        
                        <div>
                            <label className="block text-[10px] text-gray-500 mb-1">판정 종류</label>
                            <select value={selectedObject.statMethod || 'SIMPLE'} onChange={(e) => onUpdateObject(selectedObject.id, { statMethod: e.target.value as StatMethod })} className="w-full bg-[#2a2a2a] border border-[#444] rounded p-1 text-xs text-white">
                                <option value="SIMPLE">단순 판정 (운)</option>
                                <option value="ADDITIVE">방식 A: 확률 가산</option>
                                <option value="VARIABLE_DICE">방식 B: 가변 주사위</option>
                                <option value="DIFFICULTY">방식 C: 난이도 대항</option>
                                <option value="THRESHOLD">방식 D: 기준치 (전통)</option>
                            </select>
                        </div>

                        {/* Method Help Description */}
                        <div className="flex gap-2 bg-black/30 p-2 rounded border border-white/5">
                            <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-[9px] leading-relaxed text-gray-400 italic">
                                {METHOD_DESCRIPTIONS[selectedObject.statMethod || 'SIMPLE']}
                            </p>
                        </div>

                        {selectedObject.statMethod !== 'SIMPLE' && (
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1">대상 스탯</label>
                                <select value={selectedObject.targetStatId || ''} onChange={(e) => onUpdateObject(selectedObject.id, { targetStatId: e.target.value })} className="w-full bg-[#2a2a2a] border border-[#444] rounded p-1 text-xs text-white">
                                    <option value="">(스탯 선택)</option>
                                    {gameData?.customStats?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                        )}

                        {selectedObject.statMethod === 'VARIABLE_DICE' && (
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1 flex items-center gap-1"><Target size={10}/> 성공 목표값 (Dice Roll ≥ X)</label>
                                <input type="number" value={selectedObject.successTargetValue || 0} onChange={(e) => onUpdateObject(selectedObject.id, { successTargetValue: parseInt(e.target.value) || 0 })} className="w-full bg-[#2a2a2a] border border-[#444] rounded p-1 text-xs text-white" />
                            </div>
                        )}

                        {selectedObject.statMethod === 'DIFFICULTY' && (
                            <div>
                                <label className="block text-[10px] text-gray-500 mb-1 flex items-center gap-1"><ShieldAlert size={10}/> 고정 난이도 (1D100 ≤ X-Stat)</label>
                                <input type="number" value={selectedObject.difficultyValue || 0} onChange={(e) => onUpdateObject(selectedObject.id, { difficultyValue: parseInt(e.target.value) || 0 })} className="w-full bg-[#2a2a2a] border border-[#444] rounded p-1 text-xs text-white" />
                            </div>
                        )}
                    </div>
                )}

                <div><label className="block text-xs font-bold text-gray-300 mb-1">기본 설명 (항상 노출)</label><textarea rows={3} value={selectedObject.description || ''} onChange={(e) => onUpdateObject(selectedObject.id, { description: e.target.value })} className="w-full bg-[#383838] border border-[#555] rounded p-1 text-xs text-gray-200" placeholder="조사 시 상단에 항상 출력되는 서술입니다." /></div>

                {selectedObject.useProbability && selectedObject.data && (
                    <div className="space-y-3 border-t border-[#444] pt-4 relative">
                        <div className="flex flex-col items-center mb-2">
                             <ChevronDown className="text-indigo-500 animate-bounce" size={20} />
                             <p className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1"><Dices size={12}/> 2. 결과별 시나리오 설정 (Outcomes)</p>
                             <p className="text-[8px] text-gray-500 text-center mt-1">위의 주사위 판정 결과가 아래 4단계 중 어디에 속하느냐에 따라 보상이 결정됩니다.</p>
                        </div>
                        
                        <div className="mt-2 space-y-2 pb-10">
                            <OutcomeEditor label="대성공 시" resultType="CRITICAL_SUCCESS" color="text-yellow-500" selectedObject={selectedObject} onUpdateObject={onUpdateObject} mapList={mapList} currentMap={currentMap} />
                            <OutcomeEditor label="성공 시" resultType="SUCCESS" color="text-green-500" selectedObject={selectedObject} onUpdateObject={onUpdateObject} mapList={mapList} currentMap={currentMap} />
                            <OutcomeEditor label="실패 시" resultType="FAILURE" color="text-gray-400" selectedObject={selectedObject} onUpdateObject={onUpdateObject} mapList={mapList} currentMap={currentMap} />
                            <OutcomeEditor label="대실패 시" resultType="CRITICAL_FAILURE" color="text-red-500" selectedObject={selectedObject} onUpdateObject={onUpdateObject} mapList={mapList} currentMap={currentMap} />
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center italic mt-10">오브젝트를 선택하여 속성을 편집하세요.</div>
        )}
      </div>
      <ImageCropperModal isOpen={cropState.isOpen} file={cropState.file} initialAspectRatio={cropState.initialAspectRatio} initialShape={cropState.initialShape} onConfirm={cropState.onConfirm} onClose={() => setCropState(p => ({ ...p, isOpen: false, file: null }))} />
    </>
  );
};
