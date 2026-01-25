
import React, { useState, useRef } from 'react';
import { GameData, MapScene, MapObject, ObjectType } from '../../types';
import { DEFAULT_PROBABILITY } from '../../lib/constants';
import { generateId } from '../../lib/utils';
import { getShapeStyle } from '../../lib/styles';
import { EditorSidebar } from '../editor/EditorSidebar'; // Reuse components where possible
import { ObjectInspector } from '../editor/ObjectInspector';
import { ImageCropperModal, CropShape } from '../common/ImageCropperModal';
import { ArrowLeft, Save, Map as MapIcon, Layers, Settings } from 'lucide-react';

interface MobileEditorProps {
  initialData: GameData;
  onSave: (data: GameData) => void;
  onBack: () => void;
}

type Tab = 'MAPS' | 'CANVAS' | 'PROPS';

export const MobileEditor: React.FC<MobileEditorProps> = ({ initialData, onSave, onBack }) => {
  const [data, setData] = useState<GameData>(initialData);
  const [currentMapId, setCurrentMapId] = useState<string>(initialData.maps[0]?.id || '');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('CANVAS');
  
  const [cropState, setCropState] = useState<{isOpen: boolean; file: File|null; onConfirm: (b:string)=>void}>({isOpen:false, file:null, onConfirm:()=>{}});

  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedObject = currentMap?.objects.find(o => o.id === selectedObjectId);

  // -- Actions (Duplicated logic for safety/independence) --
  const updateCurrentMap = (updater: (map: MapScene) => MapScene) => {
    if (!currentMap) return;
    const newMap = updater({ ...currentMap });
    setData(prev => ({ ...prev, maps: prev.maps.map(m => m.id === currentMapId ? newMap : m) }));
  };

  const handleAddMap = () => {
    const newId = `map_${generateId()}`;
    const newMap = { id: newId, name: `New Map ${data.maps.length + 1}`, width: 1200, height: 800, objects: [] };
    setData(prev => ({ ...prev, maps: [...prev.maps, newMap] }));
    setCurrentMapId(newId);
  };

  const handleAddObject = (type: ObjectType) => {
    if (!currentMap) return;
    
    let label = '장식';
    let color = 'rgba(100, 116, 139, 0.8)';
    let width = 80;
    let height = 80;
    
    if (type === 'OBJECT') {
        label = '조사';
        color = 'rgba(16, 185, 129, 0.8)';
    } else if (type === 'MAP_LINK') {
        label = '이동';
        color = 'rgba(59, 130, 246, 0.8)';
    } else if (type === 'SPAWN_POINT') {
        label = '시작';
        color = 'rgba(139, 92, 246, 0.8)'; // Violet
        width = 64;
        height = 64;
    }

    const newObj: MapObject = {
      id: generateId(),
      type,
      label,
      x: 100, y: 100, width, height,
      color,
      shape: type === 'SPAWN_POINT' ? 'CIRCLE' : 'RECTANGLE',
      useProbability: type === 'OBJECT',
      data: type === 'OBJECT' ? JSON.parse(JSON.stringify(DEFAULT_PROBABILITY)) : undefined
    };
    updateCurrentMap(m => ({ ...m, objects: [...m.objects, newObj] }));
    setSelectedObjectId(newObj.id);
    setActiveTab('PROPS'); // Auto-switch to properties
  };

  const handleUpdateObject = (id: string, changes: Partial<MapObject>) => {
    updateCurrentMap(m => ({ ...m, objects: m.objects.map(o => o.id === id ? { ...o, ...changes } : o) }));
  };

  const handleDeleteObject = (id: string) => {
    updateCurrentMap(m => ({ ...m, objects: m.objects.filter(o => o.id !== id) }));
    setSelectedObjectId(null);
    setActiveTab('CANVAS');
  };

  // -- Touch Dragging Logic --
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{x:number, y:number} | null>(null);
  const objStart = useRef<{x:number, y:number} | null>(null);

  const handleTouchStart = (e: React.TouchEvent, obj: MapObject) => {
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      objStart.current = { x: obj.x, y: obj.y };
      setSelectedObjectId(obj.id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging || !dragStart.current || !objStart.current || !selectedObjectId) return;
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      handleUpdateObject(selectedObjectId, { x: objStart.current.x + dx, y: objStart.current.y + dy });
  };

  return (
    <div className="flex flex-col h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden">
        {/* Top Bar */}
        <div className="h-12 bg-[#252525] border-b border-[#444] flex items-center justify-between px-3">
            <button onClick={onBack}><ArrowLeft size={20} /></button>
            <span className="font-bold truncate max-w-[150px]">{currentMap?.name}</span>
            <button onClick={() => onSave(data)} className="text-indigo-400"><Save size={20} /></button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
            {activeTab === 'MAPS' && (
                <div className="h-full overflow-y-auto">
                    <EditorSidebar 
                        data={data} 
                        currentMapId={currentMapId} 
                        onSelectMap={(id) => { setCurrentMapId(id); setActiveTab('CANVAS'); }} 
                        onAddMap={handleAddMap} 
                        onSave={onSave} 
                        onLoadData={(d) => { setData(d); onSave(d); }} 
                        onBack={onBack} 
                    />
                </div>
            )}
            
            {activeTab === 'CANVAS' && (
                <div className="h-full relative overflow-auto touch-none bg-[#1a1a1a]" onTouchMove={handleTouchMove} onTouchEnd={() => setIsDragging(false)}>
                    {currentMap && (
                        <div className="relative shadow-xl" style={{ 
                            width: `${currentMap.width || 1200}px`, 
                            height: `${currentMap.height || 800}px`, 
                            backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none',
                            backgroundSize: 'cover'
                        }}>
                             {currentMap.objects.map(obj => (
                                 <div key={obj.id}
                                     onTouchStart={(e) => handleTouchStart(e, obj)}
                                     onClick={(e) => { e.stopPropagation(); setSelectedObjectId(obj.id); }}
                                     className="absolute"
                                     style={{
                                         left: obj.x, top: obj.y, width: obj.width, height: obj.height,
                                         backgroundColor: obj.color,
                                         border: selectedObjectId === obj.id ? '2px solid white' : 'none',
                                         backgroundImage: obj.image ? `url(${obj.image})` : undefined,
                                         backgroundSize: 'cover',
                                         ...getShapeStyle(obj.shape)
                                     }}
                                 >
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow bg-black/30 pointer-events-none">{obj.label}</span>
                                 </div>
                             ))}
                        </div>
                    )}
                    
                    {/* Floating Add Buttons */}
                    <div className="fixed bottom-20 right-4 flex flex-col gap-2">
                        <button onClick={() => handleAddObject('OBJECT')} className="bg-emerald-600 p-3 rounded-full shadow-lg text-white font-bold text-xs">
                           + 조사
                        </button>
                        <button onClick={() => handleAddObject('DECORATION')} className="bg-gray-600 p-3 rounded-full shadow-lg text-white font-bold text-xs">
                           + 장식
                        </button>
                        <button onClick={() => handleAddObject('SPAWN_POINT')} className="bg-violet-600 p-3 rounded-full shadow-lg text-white font-bold text-xs">
                           + 시작
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'PROPS' && (
                <div className="h-full overflow-y-auto pb-20">
                    <ObjectInspector 
                        mapList={data.maps} 
                        currentMap={currentMap} 
                        selectedObject={selectedObject} 
                        onUpdateMap={(u) => updateCurrentMap(m => ({ ...m, ...u }))} 
                        onUpdateObject={handleUpdateObject} 
                        onDeleteObject={handleDeleteObject} 
                    />
                </div>
            )}
        </div>

        {/* Bottom Tab Bar */}
        <div className="h-14 bg-[#1e1e1e] border-t border-[#444] flex items-center justify-around z-10">
            <button onClick={() => setActiveTab('MAPS')} className={`flex flex-col items-center text-[10px] ${activeTab === 'MAPS' ? 'text-indigo-400' : 'text-gray-500'}`}>
                <MapIcon size={20} /> 맵 목록
            </button>
            <button onClick={() => setActiveTab('CANVAS')} className={`flex flex-col items-center text-[10px] ${activeTab === 'CANVAS' ? 'text-indigo-400' : 'text-gray-500'}`}>
                <Layers size={20} /> 캔버스
            </button>
            <button onClick={() => setActiveTab('PROPS')} className={`flex flex-col items-center text-[10px] ${activeTab === 'PROPS' ? 'text-indigo-400' : 'text-gray-500'}`}>
                <Settings size={20} /> 속성 {selectedObjectId && <span className="w-2 h-2 bg-red-500 rounded-full absolute ml-3 mt-[-2px]"></span>}
            </button>
        </div>
        
        <ImageCropperModal isOpen={cropState.isOpen} file={cropState.file} onConfirm={cropState.onConfirm} onClose={() => setCropState(p => ({...p, isOpen:false}))} />
    </div>
  );
};
