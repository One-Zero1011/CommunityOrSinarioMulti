
import React, { useState } from 'react';
import { GameData, MapScene, MapObject, ObjectType } from '../../types';
import { DEFAULT_PROBABILITY } from '../../lib/constants';
import { generateId } from '../../lib/utils';
import { EditorSidebar } from './EditorSidebar';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { ObjectInspector } from './ObjectInspector';

interface EditorProps {
  initialData: GameData;
  onSave: (data: GameData) => void;
  onBack: () => void;
}

export const Editor: React.FC<EditorProps> = ({ initialData, onSave, onBack }) => {
  const [data, setData] = useState<GameData>(initialData);
  const [currentMapId, setCurrentMapId] = useState<string>(initialData.maps[0]?.id || '');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  
  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedObject = currentMap?.objects.find(o => o.id === selectedObjectId);

  // -- Actions --

  const updateCurrentMap = (updater: (map: MapScene) => MapScene) => {
    if (!currentMap) return;
    const newMap = updater({ ...currentMap });
    setData(prev => ({
      ...prev,
      maps: prev.maps.map(m => m.id === currentMapId ? newMap : m)
    }));
  };

  const handleAddMap = () => {
    const newId = `map_${generateId()}`;
    const newMap: MapScene = {
      id: newId,
      name: `새 구역 ${data.maps.length + 1}`,
      objects: []
    };
    setData(prev => ({ ...prev, maps: [...prev.maps, newMap] }));
    setCurrentMapId(newId);
  };

  const handleAddObject = (type: ObjectType) => {
    if (!currentMap) return;
    const newObj: MapObject = {
      id: generateId(),
      type,
      label: type === 'MAP_LINK' ? '이동' : (type === 'OBJECT' ? '조사 목표' : '장식'),
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      color: type === 'MAP_LINK' ? 'rgba(59, 130, 246, 0.8)' : (type === 'OBJECT' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(100, 116, 139, 0.8)'),
      shape: 'RECTANGLE',
      description: '',
      useProbability: type === 'OBJECT',
      data: type === 'OBJECT' ? JSON.parse(JSON.stringify(DEFAULT_PROBABILITY)) : undefined,
      targetMapId: type === 'MAP_LINK' ? (data.maps[0]?.id || '') : undefined
    };
    updateCurrentMap(m => ({ ...m, objects: [...m.objects, newObj] }));
    setSelectedObjectId(newObj.id);
  };

  const handleUpdateObject = (id: string, changes: Partial<MapObject>) => {
    updateCurrentMap(m => ({
      ...m,
      objects: m.objects.map(o => o.id === id ? { ...o, ...changes } : o)
    }));
  };

  const handleDeleteObject = (id: string) => {
    updateCurrentMap(m => ({
      ...m,
      objects: m.objects.filter(o => o.id !== id)
    }));
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  const handleUpdateMapProperties = (updates: Partial<MapScene>) => {
    updateCurrentMap(m => ({ ...m, ...updates }));
  };
  
  const handleBackgroundUpload = (file: File) => {
    if (currentMap) {
        const url = URL.createObjectURL(file);
        handleUpdateMapProperties({ bgImage: url });
    }
  };

  const handleLoadData = (newData: GameData) => {
      setData(newData);
      if (!newData.maps.some(m => m.id === currentMapId)) {
          setCurrentMapId(newData.maps[0]?.id || newData.startMapId || (newData.maps.length > 0 ? newData.maps[0].id : ''));
      }
      onSave(newData); // Also update global/parent state
  };

  return (
    <div className="flex h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden">
      <EditorSidebar 
        data={data}
        currentMapId={currentMapId}
        onSelectMap={setCurrentMapId}
        onAddMap={handleAddMap}
        onSave={(d) => { onSave(d); setData(d); }} 
        onLoadData={handleLoadData}
        onBack={onBack}
      />

      <div className="flex-1 flex flex-col relative bg-[#2e2e2e] overflow-hidden">
        <EditorToolbar 
          mapName={currentMap?.name || 'Unknown'} 
          onAddObject={handleAddObject}
          onBackgroundUpload={handleBackgroundUpload}
        />
        <EditorCanvas 
          currentMap={currentMap}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onUpdateObjectPosition={(id, x, y) => handleUpdateObject(id, { x, y })}
        />
      </div>

      <ObjectInspector 
        mapList={data.maps}
        currentMap={currentMap}
        selectedObject={selectedObject}
        onUpdateMap={handleUpdateMapProperties}
        onUpdateObject={handleUpdateObject}
        onDeleteObject={handleDeleteObject}
      />
    </div>
  );
};
