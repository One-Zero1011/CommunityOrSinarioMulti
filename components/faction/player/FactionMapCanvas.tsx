
import React from 'react';
import { FactionMap, FactionPlayerProfile, Faction } from '../../../types';
import { User, Flag, EyeOff } from 'lucide-react';

interface FactionMapCanvasProps {
    currentMap?: FactionMap;
    players?: FactionPlayerProfile[]; // To display players on the map
    isAdmin?: boolean;
    myProfile?: FactionPlayerProfile | null; // Needed for Fog of War calculation
    onBlockClick?: (blockId: string) => void;
    factions?: Faction[];
}

export const FactionMapCanvas: React.FC<FactionMapCanvasProps> = ({ 
    currentMap, players = [], isAdmin = false, myProfile, onBlockClick, factions = [] 
}) => {
    
    const getFactionColor = (id: string | undefined) => {
        if (!id) return null;
        return factions.find(f => f.id === id)?.color;
    };

    return (
        <div className="flex-1 bg-[#151515] flex items-center justify-center p-8 overflow-auto relative">
            {currentMap ? (
                <div 
                    className="bg-[#000] p-1 shadow-2xl border-4 border-[#333] transition-all"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${currentMap.cols}, 1fr)`,
                        gap: '4px',
                        width: 'min(100%, 900px)',
                        aspectRatio: `${currentMap.cols}/${currentMap.rows}`
                    }}
                >
                    {currentMap.blocks.map(block => {
                        // 1. Fog of War Logic
                        // Visible if: I am Admin OR I am currently IN this block
                        const isVisible = isAdmin || (myProfile?.currentBlockId === block.id);
                        
                        // Find players on this block
                        const occupants = players.filter(p => p.currentBlockId === block.id);
                        const ownerColor = getFactionColor(block.ownerId);

                        return (
                            <div 
                                key={block.id}
                                onClick={() => onBlockClick && onBlockClick(block.id)}
                                className={`relative flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden ${isVisible ? 'hover:brightness-110 active:scale-[0.98]' : 'hover:bg-opacity-80'}`}
                                style={{ 
                                    backgroundColor: block.color,
                                    border: ownerColor ? `4px solid ${ownerColor}` : 'none'
                                }}
                            >
                                {/* Fog Overlay (If not visible) */}
                                {!isVisible && (
                                    <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
                                        <EyeOff className="text-white/20" size={24} />
                                    </div>
                                )}

                                {/* Ownership Indicator (Full overlay tint) - Visible even in fog (Map Knowledge) */}
                                {ownerColor && (
                                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundColor: ownerColor }}></div>
                                )}
                                
                                {/* Occupation Progress (Dots) - Visible only if visible */}
                                {isVisible && !block.ownerId && block.occupationProgress && block.occupationProgress > 0 && (
                                    <div className="absolute top-2 left-2 flex gap-1 z-0">
                                        {Array.from({ length: block.occupationProgress }).map((_, i) => (
                                            <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-pulse border border-white shadow-sm" title="점령 진행 중"></div>
                                        ))}
                                    </div>
                                )}

                                {/* Block Label */}
                                <span className={`text-2xl font-bold drop-shadow-sm select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 ${isVisible ? 'text-gray-800/40' : 'text-gray-500/20'}`}>
                                    {block.label}
                                </span>

                                {/* Score (Hidden if not admin) */}
                                <span className="absolute bottom-2 right-2 text-xs font-bold text-black/60 bg-white/30 px-1.5 rounded-full z-0">
                                    {isAdmin ? `${block.score}점` : '???'}
                                </span>
                                
                                {/* Owner Flag - Visible based on Map Knowledge (Always visible if owned) */}
                                {block.ownerId && (
                                    <div className="absolute top-2 right-2 z-0">
                                        <Flag size={16} fill={ownerColor} stroke={ownerColor} />
                                    </div>
                                )}

                                {/* Occupants Overlay - HIDDEN BY FOG */}
                                {isVisible && (
                                    <div className="z-10 w-full h-full p-2 flex flex-wrap items-center justify-center gap-1 content-center">
                                        {occupants.map(p => (
                                            <div 
                                                key={p.id} 
                                                className="w-8 h-8 rounded-full border-2 border-white bg-gray-700 shadow-md overflow-hidden relative group/avatar"
                                                title={p.name}
                                            >
                                                {p.avatar ? (
                                                    <img src={p.avatar} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={16} className="text-gray-300 m-auto mt-1" />
                                                )}
                                                {/* Hover Name */}
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1 rounded opacity-0 group-hover/avatar:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                                                    {p.name}
                                                </div>
                                                
                                                {/* HP Indicator (Mini) */}
                                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600">
                                                    <div 
                                                        className={`h-full ${p.hp < p.maxHp * 0.3 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                        style={{ width: `${(p.hp / p.maxHp) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Hover Effect for Movement (Only visible to player) */}
                                {!isAdmin && myProfile && (
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center z-30">
                                        <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">
                                            {myProfile.currentBlockId === block.id ? "현재 위치" : "이동"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-gray-500">맵 데이터가 없습니다.</div>
            )}
        </div>
    );
};
