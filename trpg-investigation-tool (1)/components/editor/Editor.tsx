
import React, { useState, useEffect, useCallback } from 'react';
import { GameData, MapScene, MapObject, ObjectType } from '../../types';
import { DEFAULT_PROBABILITY } from '../../lib/constants';
import { generateId, blobToBase64 } from '../../lib/utils';
import { EditorSidebar } from './EditorSidebar';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { ObjectInspector } from './ObjectInspector';
import { ImageCropperModal, CropShape } from '../common/ImageCropperModal';

interface EditorProps {
  initialData: GameData;
  onSave: (data: GameData) => void;
  onBack: () => void;
}

interface CropState {
  isOpen: boolean;
  file: File | null;
  initialAspectRatio?: number | null;
  initialShape?: CropShape;
  onConfirm: (base64: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ initialData, onSave, onBack }) => {
  const [data, setData] = useState<GameData>(initialData);
  const [currentMapId, setCurrentMapId] = useState<string>(initialData.maps[0]?.id || '');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<MapObject | null>(null);
  
  // Crop Modal State
  const [cropState, setCropState] = useState<CropState>({
    isOpen: false,
    file: null,
    onConfirm: () => {},
  });
  
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
    
    // Default properties based on type
    let label = '장식';
    let color = 'rgba(100, 116, 139, 0.8)';
    let width = 100;
    let height = 100;
    
    if (type === 'OBJECT') {
        label = '조사 목표';
        color = 'rgba(16, 185, 129, 0.8)';
    } else if (type === 'MAP_LINK') {
        label = '이동';
        color = 'rgba(59, 130, 246, 0.8)';
    } else if (type === 'SPAWN_POINT') {
        label = '시작 위치';
        color = 'rgba(139, 92, 246, 0.8)'; // Violet
        width = 64;
        height = 64;
    }

    const newObj: MapObject = {
      id: generateId(),
      type,
      label,
      x: 100,
      y: 100,
      width,
      height,
      color,
      shape: type === 'SPAWN_POINT' ? 'CIRCLE' : 'RECTANGLE',
      description: '',
      useProbability: type === 'OBJECT',
      data: type === 'OBJECT' ? JSON.parse(JSON.stringify(DEFAULT_PROBABILITY)) : undefined,
      targetMapId: type === 'MAP_LINK' ? (data.maps[0]?.id || '') : undefined,
      isSolid: false,
      zIndex: 10
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
  
  // Modified to use Cropper
  const handleBackgroundUpload = (file: File) => {
    if (currentMap) {
      setCropState({
        isOpen: true,
        file,
        initialAspectRatio: null, // Backgrounds usually free form
        initialShape: 'RECTANGLE',
        onConfirm: (base64) => {
          handleUpdateMapProperties({ bgImage: base64 });
        }
      });
    }
  };

  const handleLoadData = (newData: GameData) => {
      setData(newData);
      if (!newData.maps.some(m => m.id === currentMapId)) {
          setCurrentMapId(newData.maps[0]?.id || newData.startMapId || (newData.maps.length > 0 ? newData.maps[0].id : ''));
      }
      onSave(newData); // Also update global/parent state
  };

  // -- Copy & Paste Logic --
  const handleCopy = useCallback(() => {
      if (selectedObject) {
          const clone = JSON.parse(JSON.stringify(selectedObject));
          setClipboard(clone);
      }
  }, [selectedObject]);

  const handlePaste = useCallback(() => {
      if (clipboard && currentMap) {
          const newId = generateId();
          const newObj = { 
              ...clipboard, 
              id: newId, 
              x: clipboard.x + 20, 
              y: clipboard.y + 20,
              label: `${clipboard.label} (Copy)`
          };
          
          // Ensure it stays within bounds (optional)
          const maxX = (currentMap.width || 1200) - newObj.width;
          const maxY = (currentMap.height || 800) - newObj.height;
          if (newObj.x > maxX) newObj.x = Math.max(0, maxX);
          if (newObj.y > maxY) newObj.y = Math.max(0, maxY);

          updateCurrentMap(m => ({ ...m, objects: [...m.objects, newObj] }));
          setSelectedObjectId(newId);
      }
  }, [clipboard, currentMap]); // Removed updateCurrentMap from dependencies to rely on state closure or refs if needed, but here simple deps are fine.

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore if input/textarea is focused
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
              e.preventDefault();
              handleCopy();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
              e.preventDefault();
              handlePaste();
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
              if (selectedObjectId) handleDeleteObject(selectedObjectId);
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, selectedObjectId]); // Add dependencies

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
        onCopy={handleCopy}
        onPaste={handlePaste}
        canPaste={!!clipboard}
        gameData={data}
      />

      {/* Image Cropper Modal */}
      <ImageCropperModal 
        isOpen={cropState.isOpen}
        file={cropState.file}
        initialAspectRatio={cropState.initialAspectRatio}
        initialShape={cropState.initialShape}
        onClose={() => setCropState(prev => ({ ...prev, isOpen: false, file: null }))}
        onConfirm={cropState.onConfirm}
      />
    </div>
  );
};
