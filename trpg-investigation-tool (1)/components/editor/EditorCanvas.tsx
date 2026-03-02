
import React, { useRef, useState, useMemo } from 'react';
import { MapScene, MapObject } from '../../types';
import { getShapeStyle } from '../../lib/styles';
import { Move } from 'lucide-react';

interface EditorCanvasProps {
  currentMap?: MapScene;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObjectPosition: (id: string, x: number, y: number) => void;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ 
  currentMap, selectedObjectId, onSelectObject, onUpdateObjectPosition 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number, y: number } | null>(null);
  const objectStart = useRef<{ x: number, y: number } | null>(null);
  const dragDidMove = useRef(false);
  const wasSelectedOnDown = useRef(false);

  const sortedObjects = useMemo(() => {
    if (!currentMap) return [];
    return [...currentMap.objects].sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10));
  }, [currentMap]);

  const handleMouseDown = (e: React.MouseEvent, obj: MapObject) => {
    e.stopPropagation();
    setIsDragging(true);
    
    dragStart.current = { x: e.clientX, y: e.clientY };
    objectStart.current = { x: obj.x, y: obj.y };
    dragDidMove.current = false;
    
    wasSelectedOnDown.current = (selectedObjectId === obj.id);
    onSelectObject(obj.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedObjectId || !dragStart.current || !objectStart.current) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragDidMove.current = true;
    }
    
    onUpdateObjectPosition(selectedObjectId, objectStart.current.x + dx, objectStart.current.y + dy);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStart.current = null;
    objectStart.current = null;
  };

  const handleObjectClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!dragDidMove.current) {
        if (wasSelectedOnDown.current) {
            onSelectObject(null);
        }
    }
  };

  return (
    <div 
      className="flex-1 relative overflow-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed flex items-center justify-center p-12"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {currentMap && (
        <div 
          className="relative shadow-2xl bg-[#2e2e2e] shrink-0 border border-[#444] transition-all duration-300"
          style={{ 
            width: `${currentMap.width || 1200}px`,
            height: `${currentMap.height || 800}px`,
            backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
          onClick={() => onSelectObject(null)}
        >
           {!currentMap.bgImage && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 pointer-events-none gap-2">
               <p>배경 이미지가 없습니다.</p>
               <p className="text-sm opacity-50">{currentMap.width || 1200} x {currentMap.height || 800}</p>
             </div>
           )}
           
           {sortedObjects.map(obj => (
             <div
                key={obj.id}
                onMouseDown={(e) => handleMouseDown(e, obj)}
                onClick={handleObjectClick}
                className={`absolute cursor-move select-none group`}
                style={{
                  left: obj.x,
                  top: obj.y,
                  width: obj.width,
                  height: obj.height,
                  zIndex: selectedObjectId === obj.id ? 1000 : (obj.zIndex ?? 10)
                }}
             >
                {/* Visual Shape Representation */}
                <div 
                    className="w-full h-full flex items-center justify-center text-xs text-center font-bold p-1 overflow-hidden transition-colors"
                    style={{
                        backgroundColor: obj.color,
                        backgroundImage: obj.image ? `url(${obj.image})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        ...getShapeStyle(obj.shape)
                    }}
                >
                    <span className="bg-black/50 px-1 rounded text-white pointer-events-none drop-shadow-md">{obj.label}</span>
                </div>

                {/* Selection Border (Always Rectangle) */}
                {selectedObjectId === obj.id && (
                    <>
                        <div className="absolute inset-0 border-2 border-white pointer-events-none"></div>
                        <div className="absolute right-0 bottom-0 p-1 cursor-nwse-resize bg-white text-black rounded-tl">
                            <Move size={10} />
                        </div>
                    </>
                )}
             </div>
           ))}
        </div>
      )}
    </div>
  );
};
