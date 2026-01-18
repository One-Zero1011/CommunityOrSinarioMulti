
import React, { useState, useEffect, useRef } from 'react';
import { GameData, MapScene, MapObject, ShapeType, ResultType } from '../../types';
import { Shapes, Trash2, Palette, FileText, Dices, Upload, MapPin, MousePointer2, Image as ImageIcon, X, Eye, EyeOff, Layers } from 'lucide-react';
import { blobToBase64 } from '../../lib/utils';
import { ImageCropperModal, CropShape } from '../common/ImageCropperModal';

interface ObjectInspectorProps {
  mapList: MapScene[];
  currentMap: MapScene | undefined;
  selectedObject: MapObject | undefined;
  onUpdateMap: (updates: Partial<MapScene>) => void;
  onUpdateObject: (id: string, updates: Partial<MapObject>) => void;
  onDeleteObject: (id: string) => void;
}

// Extracted Component for Outcome Editor
const OutcomeEditor = ({ 
  label, 
  resultType, 
  color,
  selectedObject,
  onUpdateObject,
  mapList,
  currentMap
}: { 
  label: string, 
  resultType: ResultType, 
  color: string,
  selectedObject: MapObject,
  onUpdateObject: (id: string, updates: Partial<MapObject>) => void,
  mapList: MapScene[],
  currentMap: MapScene | undefined
}) => {
  if (!selectedObject.data) return null;
  const outcome = selectedObject.data.outcomes[resultType];
  const mapObjects = currentMap?.objects.filter(o => o.id !== selectedObject.id) || [];
  
  return (
      <div className="p-2 bg-[#1e1e1e] rounded border border-[#444] mb-2">
          <p className={`text-xs font-bold mb-1 ${color}`}>{label}</p>
          <textarea 
          rows={2}
          value={outcome.text}
          onChange={(e) => onUpdateObject(selectedObject.id, { 
              data: { 
              ...selectedObject.data!, 
              outcomes: { 
                  ...selectedObject.data!.outcomes, 
                  [resultType]: { ...outcome, text: e.target.value } 
              } 
              } 
          })}
          className="w-full bg-[#383838] border border-[#555] rounded p-1 text-xs mb-1 text-gray-200"
          placeholder={`${label} 결과 텍스트`}
          />
          <div className="flex gap-2 mb-1">
              <input 
                  type="number" 
                  placeholder="HP" 
                  className="w-1/3 bg-[#383838] text-xs p-1 rounded border border-[#555] text-gray-200" 
                  value={outcome.hpChange} 
                  onChange={(e) => onUpdateObject(selectedObject.id, { 
                      data: { 
                          ...selectedObject.data!, 
                          outcomes: { 
                              ...selectedObject.data!.outcomes, 
                              [resultType]: { ...outcome, hpChange: parseInt(e.target.value) || 0 } 
                          } 
                      } 
                  })} 
              />
              <input 
                  type="text" 
                  placeholder="아이템/상태" 
                  className="w-2/3 bg-[#383838] text-xs p-1 rounded border border-[#555] text-gray-200" 
                  value={outcome.itemDrop || ''} 
                  onChange={(e) => onUpdateObject(selectedObject.id, { 
                      data: { 
                          ...selectedObject.data!, 
                          outcomes: { 
                              ...selectedObject.data!.outcomes, 
                              [resultType]: { ...outcome, itemDrop: e.target.value } 
                          } 
                      } 
                  })} 
              />
          </div>
          
          <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-500" />
                  <select 
                    value={outcome.targetMapId || ''}
                    onChange={(e) => onUpdateObject(selectedObject.id, { 
                        data: { 
                            ...selectedObject.data!, 
                            outcomes: { 
                                ...selectedObject.data!.outcomes, 
                                [resultType]: { ...outcome, targetMapId: e.target.value || undefined } 
                            } 
                        } 
                    })}
                    className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-gray-200"
                  >
                    <option value="">(이동 없음)</option>
                    {mapList.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
              </div>
              
              <div className="flex items-center gap-2">
                  <Eye size={12} className="text-emerald-500" />
                  <select 
                    value={outcome.revealObjectId || ''}
                    onChange={(e) => onUpdateObject(selectedObject.id, { 
                        data: { 
                            ...selectedObject.data!, 
                            outcomes: { 
                                ...selectedObject.data!.outcomes, 
                                [resultType]: { ...outcome, revealObjectId: e.target.value || undefined } 
                            } 
                        } 
                    })}
                    className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-emerald-100"
                  >
                    <option value="">(활성화할 대상)</option>
                    {mapObjects.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
              </div>

              <div className="flex items-center gap-2">
                  <EyeOff size={12} className="text-red-500" />
                  <select 
                    value={outcome.hideObjectId || ''}
                    onChange={(e) => onUpdateObject(selectedObject.id, { 
                        data: { 
                            ...selectedObject.data!, 
                            outcomes: { 
                                ...selectedObject.data!.outcomes, 
                                [resultType]: { ...outcome, hideObjectId: e.target.value || undefined } 
                            } 
                        } 
                    })}
                    className="flex-1 bg-[#383838] border border-[#555] rounded p-1 text-[10px] text-red-100"
                  >
                    <option value="">(비활성화할 대상)</option>
                    {mapObjects.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
              </div>
          </div>
      </div>
  );
};

export const ObjectInspector: React.FC<ObjectInspectorProps> = ({
  mapList, currentMap, selectedObject, onUpdateMap, onUpdateObject, onDeleteObject
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

  const mapObjectsExceptSelected = currentMap?.objects.filter(o => o.id !== selectedObject?.id) || [];

  return (
    <>
      <div className="w-80 bg-[#252525] border-l border-[#444] flex flex-col p-4 overflow-y-auto text-gray-200 custom-scrollbar">
        <h3 className="font-bold mb-4 text-gray-300">속성 (Properties)</h3>
        
        <div className="mb-6 p-3 bg-[#1e1e1e] rounded space-y-3 border border-[#444]">
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">맵 이름</label>
            <input 
                type="text" 
                value={currentMap?.name || ''} 
                onChange={(e) => onUpdateMap({ name: e.target.value })}
                className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
            />
          </div>
          <div>
              <label className="block text-xs uppercase text-gray-400 mb-1">전체 배경 이미지</label>
              <div className="flex gap-2">
                <input 
                    type="text" 
                    value={currentMap?.bgImage || ''} 
                    onChange={(e) => onUpdateMap({ bgImage: e.target.value })}
                    className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                    placeholder="https://..."
                />
              </div>
              <div className="mt-2">
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-indigo-700 hover:bg-indigo-600 py-2 text-sm rounded flex items-center justify-center gap-2 font-bold shadow-md">
                    <Upload size={16} /> 배경 이미지 업로드
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => handleImageUploadTrigger(e, 'MAP_BG')} 
                    accept="image/*" 
                    className="hidden" 
                />
              </div>
          </div>
        </div>

        {selectedObject ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#444]">
              <span className="font-semibold text-emerald-400 flex items-center gap-2">
                <Shapes size={16} /> 오브젝트 설정
              </span>
              <button onClick={() => onDeleteObject(selectedObject.id)} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs uppercase text-gray-400 mb-1">이름 (라벨)</label>
                <input 
                  type="text"
                  value={selectedObject.label}
                  onChange={(e) => onUpdateObject(selectedObject.id, { label: e.target.value })}
                  className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                />
              </div>
              <label className="flex flex-col items-center gap-1 cursor-pointer group">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">시작 시 숨김</span>
                  <div 
                    onClick={() => onUpdateObject(selectedObject.id, { hidden: !selectedObject.hidden })}
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedObject.hidden ? 'bg-orange-600' : 'bg-gray-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedObject.hidden ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
              </label>
            </div>

            <div className="p-3 bg-[#1e1e1e] rounded border border-[#444] space-y-3">
                <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
                    <Palette size={12} /> 외형 (Appearance)
                </h4>
                
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
                            className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                            placeholder="https://..."
                        />
                        {selectedObject.image && (
                            <button 
                              onClick={() => onUpdateObject(selectedObject.id, { image: undefined })}
                              className="bg-red-900/50 hover:bg-red-800 text-red-200 p-1 rounded border border-red-800"
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
                        <label className="block text-xs text-gray-500 mb-1">색상 (Overlay)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={tempColor}
                                onChange={(e) => applyColorChange(e.target.value, tempOpacity)}
                                className="h-8 w-full cursor-pointer bg-transparent"
                            />
                        </div>
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                      <label className="block text-xs text-gray-500 mb-1">너비</label>
                      <input type="number" value={selectedObject.width} onChange={(e) => onUpdateObject(selectedObject.id, { width: parseInt(e.target.value) })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" />
                  </div>
                  <div>
                      <label className="block text-xs text-gray-500 mb-1">높이</label>
                      <input type="number" value={selectedObject.height} onChange={(e) => onUpdateObject(selectedObject.id, { height: parseInt(e.target.value) })} className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200" />
                  </div>
                </div>
            </div>
            
            {(selectedObject.type === 'OBJECT' || selectedObject.type === 'MAP_LINK') && (
              <div className="space-y-3 pt-2 border-t border-[#444]">
                
                <div>
                    <label className="block text-xs font-bold text-gray-300 mb-2">상호작용 방식 (Interaction Mode)</label>
                    <div className="flex bg-[#1e1e1e] rounded p-1 gap-1 border border-[#444]">
                      <button
                        className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors ${selectedObject.useProbability ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#383838]'}`}
                        onClick={() => onUpdateObject(selectedObject.id, { useProbability: true })}
                      >
                        <Dices size={12} /> 판정 (Dice)
                      </button>
                      <button
                        className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors ${!selectedObject.useProbability ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#383838]'}`}
                        onClick={() => onUpdateObject(selectedObject.id, { useProbability: false })}
                      >
                        <MousePointer2 size={12} /> 일반/이동
                      </button>
                    </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                      <FileText size={12} /> 설명 (Description)
                  </label>
                  <textarea
                    rows={3}
                    value={selectedObject.description || ''}
                    onChange={(e) => onUpdateObject(selectedObject.id, { description: e.target.value })}
                    className="w-full bg-[#383838] border border-[#555] rounded p-1 text-xs text-gray-200 focus:border-indigo-500 outline-none"
                    placeholder="조사 시 항상 출력되는 텍스트입니다."
                  />
                </div>

                {!selectedObject.useProbability && (
                    <div className="bg-indigo-900/20 p-2 rounded border border-indigo-500/30 space-y-2">
                        <div>
                            <label className="block text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                                <MapPin size={12} /> 이동 대상 (Target Map)
                            </label>
                            <select 
                                value={selectedObject.targetMapId || ''}
                                onChange={(e) => onUpdateObject(selectedObject.id, { targetMapId: e.target.value || undefined })}
                                className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200"
                            >
                              <option value="">(이동 없음)</option>
                              {mapList.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                                <Layers size={12} /> 상호작용 시 자동 활성화 (Reveal)
                            </label>
                            <select 
                                value={selectedObject.revealObjectId || ''}
                                onChange={(e) => onUpdateObject(selectedObject.id, { revealObjectId: e.target.value || undefined })}
                                className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200"
                            >
                              <option value="">(활성화할 대상 없음)</option>
                              {mapObjectsExceptSelected.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                                <Layers size={12} className="opacity-50" /> 상호작용 시 자동 비활성화 (Hide)
                            </label>
                            <select 
                                value={selectedObject.hideObjectId || ''}
                                onChange={(e) => onUpdateObject(selectedObject.id, { hideObjectId: e.target.value || undefined })}
                                className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-xs text-gray-200"
                            >
                              <option value="">(비활성화할 대상 없음)</option>
                              {mapObjectsExceptSelected.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))}
                            </select>
                        </div>
                    </div>
                )}

                {selectedObject.useProbability && selectedObject.data && (
                    <div className="space-y-3 animate-fade-in mt-2 border-t border-[#444] pt-2">
                        <p className="text-xs font-bold text-gray-300">판정 확률 (%)</p>
                        <div className="grid grid-cols-4 gap-1 text-center text-xs">
                            <div>
                            <span className="block text-yellow-500">대성공</span>
                            <input 
                                type="number" 
                                value={selectedObject.data.criticalSuccess} 
                                onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, criticalSuccess: parseInt(e.target.value) } })}
                                className="w-full bg-[#383838] px-1 text-center border border-[#555] rounded text-gray-200"
                            />
                            </div>
                            <div>
                            <span className="block text-green-500">성공</span>
                            <input 
                                type="number" 
                                value={selectedObject.data.success} 
                                onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, success: parseInt(e.target.value) } })}
                                className="w-full bg-[#383838] px-1 text-center border border-[#555] rounded text-gray-200"
                            />
                            </div>
                            <div>
                            <span className="block text-gray-400">실패</span>
                            <input 
                                type="number" 
                                value={selectedObject.data.failure} 
                                onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, failure: parseInt(e.target.value) } })}
                                className="w-full bg-[#383838] px-1 text-center border border-[#555] rounded text-gray-200"
                            />
                            </div>
                            <div>
                            <span className="block text-red-500">대실패</span>
                            <input 
                                type="number" 
                                value={selectedObject.data.criticalFailure} 
                                onChange={(e) => onUpdateObject(selectedObject.id, { data: { ...selectedObject.data!, criticalFailure: parseInt(e.target.value) } })}
                                className="w-full bg-[#383838] px-1 text-center border border-[#555] rounded text-gray-200"
                            />
                            </div>
                        </div>

                        <div className="mt-2 space-y-2 pb-10">
                            <OutcomeEditor 
                              label="대성공" 
                              resultType="CRITICAL_SUCCESS" 
                              color="text-yellow-500" 
                              selectedObject={selectedObject}
                              onUpdateObject={onUpdateObject}
                              mapList={mapList}
                              currentMap={currentMap}
                            />
                            <OutcomeEditor 
                              label="성공" 
                              resultType="SUCCESS" 
                              color="text-green-500" 
                              selectedObject={selectedObject}
                              onUpdateObject={onUpdateObject}
                              mapList={mapList}
                              currentMap={currentMap}
                            />
                            <OutcomeEditor 
                              label="실패" 
                              resultType="FAILURE" 
                              color="text-gray-400" 
                              selectedObject={selectedObject}
                              onUpdateObject={onUpdateObject}
                              mapList={mapList}
                              currentMap={currentMap}
                            />
                            <OutcomeEditor 
                              label="대실패" 
                              resultType="CRITICAL_FAILURE" 
                              color="text-red-500" 
                              selectedObject={selectedObject}
                              onUpdateObject={onUpdateObject}
                              mapList={mapList}
                              currentMap={currentMap}
                            />
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

      <ImageCropperModal 
        isOpen={cropState.isOpen}
        file={cropState.file}
        initialAspectRatio={cropState.initialAspectRatio}
        initialShape={cropState.initialShape}
        onClose={() => setCropState(prev => ({ ...prev, isOpen: false, file: null }))}
        onConfirm={cropState.onConfirm}
      />
    </>
  );
};
