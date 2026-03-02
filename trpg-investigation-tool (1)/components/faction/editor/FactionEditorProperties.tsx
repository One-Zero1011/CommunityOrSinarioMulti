
import React from 'react';
import { FactionMap, FactionBlock } from '../../../types';
import { Grid, Map as MapIcon } from 'lucide-react';

interface FactionEditorPropertiesProps {
    currentMap?: FactionMap;
    selectedBlock?: FactionBlock;
    onUpdateMapName: (name: string) => void;
    onResizeGrid: (rows: number, cols: number) => void;
    onUpdateBlock: (id: string, updates: Partial<FactionBlock>) => void;
}

export const FactionEditorProperties: React.FC<FactionEditorPropertiesProps> = ({
    currentMap, selectedBlock, onUpdateMapName, onResizeGrid, onUpdateBlock
}) => {
    return (
        <div className="w-80 bg-[#252525] border-l border-[#444] flex flex-col p-4 overflow-y-auto z-10 shadow-lg">
            <h3 className="font-bold mb-6 text-gray-300 border-b border-[#444] pb-2 flex items-center gap-2">
                <Grid size={18}/> 맵 속성
            </h3>
            
            {currentMap ? (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">맵 이름</label>
                        <input 
                            type="text" 
                            value={currentMap.name} 
                            onChange={(e) => onUpdateMapName(e.target.value)}
                            className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 outline-none transition-colors"
                        />
                    </div>

                    <div className="bg-[#1e1e1e] p-3 rounded border border-[#444]">
                        <label className="block text-xs uppercase text-gray-500 mb-2 flex items-center gap-1 font-bold">
                             그리드 크기 (Reset)
                        </label>
                        <div className="flex gap-2">
                             <div className="flex-1">
                                <span className="text-xs text-gray-500 block mb-1">행 (Rows)</span>
                                <input 
                                    type="number" min="1" max="10" 
                                    value={currentMap.rows} 
                                    onChange={(e) => onResizeGrid(parseInt(e.target.value)||1, currentMap.cols)}
                                    className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-center"
                                />
                             </div>
                             <div className="flex-1">
                                <span className="text-xs text-gray-500 block mb-1">열 (Cols)</span>
                                <input 
                                    type="number" min="1" max="10" 
                                    value={currentMap.cols} 
                                    onChange={(e) => onResizeGrid(currentMap.rows, parseInt(e.target.value)||1)}
                                    className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-center"
                                />
                             </div>
                        </div>
                    </div>

                    <div className="border-t border-[#444] pt-4 mt-4">
                        <h4 className="font-bold text-gray-300 mb-4 flex items-center gap-2">
                            <MapIcon size={16} /> 선택된 블록
                        </h4>
                        {selectedBlock ? (
                            <div className="space-y-4 bg-[#1e1e1e] p-4 rounded border border-[#444]">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">라벨</label>
                                    <input 
                                        type="text" 
                                        value={selectedBlock.label} 
                                        onChange={(e) => onUpdateBlock(selectedBlock.id, { label: e.target.value })}
                                        className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">점수</label>
                                    <input 
                                        type="number" 
                                        value={selectedBlock.score} 
                                        onChange={(e) => onUpdateBlock(selectedBlock.id, { score: parseInt(e.target.value)||0 })}
                                        className="w-full bg-[#383838] border border-[#555] rounded px-2 py-1 text-sm text-gray-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">배경 색상</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            value={selectedBlock.color} 
                                            onChange={(e) => onUpdateBlock(selectedBlock.id, { color: e.target.value })}
                                            className="h-8 w-12 bg-transparent cursor-pointer border-none"
                                        />
                                        <span className="text-xs font-mono text-gray-400">{selectedBlock.color}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic text-center py-4 bg-[#1e1e1e] rounded border border-[#444] border-dashed">
                                그리드에서 블록을 클릭하세요.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-gray-500 text-sm">표시할 속성이 없습니다.</div>
            )}
        </div>
    );
};
