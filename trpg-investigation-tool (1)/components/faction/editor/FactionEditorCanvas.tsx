
import React from 'react';
import { FactionMap } from '../../../types';
import { Map as MapIcon, Save } from 'lucide-react';
import { Button } from '../../common/Button';

interface FactionEditorCanvasProps {
    currentMap?: FactionMap;
    selectedBlockId: string | null;
    setSelectedBlockId: (id: string) => void;
    onSave: () => void;
}

export const FactionEditorCanvas: React.FC<FactionEditorCanvasProps> = ({ 
    currentMap, selectedBlockId, setSelectedBlockId, onSave 
}) => {
    return (
        <div className="flex-1 flex flex-col bg-[#1a1a1a]">
            {/* Toolbar */}
            <div className="h-14 bg-[#252525] border-b border-[#444] flex items-center justify-between px-6 shrink-0">
                <div className="font-bold text-lg flex items-center gap-2">
                    {currentMap ? (
                        <>
                            <MapIcon size={20} className="text-indigo-400"/>
                            {currentMap.name}
                        </>
                    ) : (
                        <span className="text-gray-500">맵을 선택해주세요</span>
                    )}
                </div>
                <Button onClick={onSave} variant="primary" icon={Save}>데이터 저장 (.json)</Button>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                {currentMap ? (
                    <div 
                        className="bg-[#111] p-1 shadow-2xl border border-[#444]"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${currentMap.cols}, 1fr)`,
                            gap: '4px',
                            width: 'min(100%, 800px)',
                            aspectRatio: `${currentMap.cols}/${currentMap.rows}`
                        }}
                    >
                        {currentMap.blocks.map(block => (
                            <div 
                                key={block.id}
                                onClick={() => setSelectedBlockId(block.id)}
                                className={`relative flex flex-col items-center justify-center cursor-pointer transition-all hover:brightness-110 select-none ${selectedBlockId === block.id ? 'ring-4 ring-orange-500 z-10' : 'hover:scale-[1.02]'}`}
                                style={{ backgroundColor: block.color }}
                            >
                                <span className="text-2xl font-bold text-gray-800 drop-shadow-sm">{block.label}</span>
                                <span className="text-xs font-bold text-black/50 bg-white/20 px-1.5 rounded-full mt-1">{block.score}점</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-500 flex flex-col items-center gap-2">
                        <MapIcon size={48} className="opacity-20" />
                        <p>좌측 메뉴에서 맵을 선택하거나 새로 만드세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
