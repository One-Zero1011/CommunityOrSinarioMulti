
import React from 'react';
import { ArrowLeft, Wifi, Check, Copy, Unlock, User, Sword } from 'lucide-react';
import { FactionPlayerProfile, FactionMap } from '../../../types';

interface FactionHUDProps {
    title: string;
    currentMap?: FactionMap;
    currentTurn: number;
    networkMode: 'SOLO' | 'HOST' | 'CLIENT';
    peerId: string | null;
    copiedId: boolean;
    setCopiedId: (v: boolean) => void;
    isAdmin: boolean;
    myProfile: FactionPlayerProfile | null;
    onExit: () => void;
    mapList: FactionMap[];
    onChangeMap: (id: string) => void;
    
    // Combat Watch
    combatActive?: boolean;
    onWatchCombat?: () => void;
}

export const FactionHUD: React.FC<FactionHUDProps> = ({ 
    title, currentMap, currentTurn, networkMode, peerId, copiedId, setCopiedId, isAdmin, myProfile, onExit, mapList, onChangeMap,
    combatActive, onWatchCombat
}) => {
    return (
        <div className="h-14 bg-[#252525] border-b border-[#444] flex items-center justify-between px-3 md:px-6 shrink-0 z-20 shadow-md">
             {/* Left Section */}
             <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <button onClick={onExit} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-bold transition-colors shrink-0">
                    <ArrowLeft size={18} /> <span className="hidden md:inline">나가기</span>
                </button>
                
                <div className="hidden md:block h-6 w-px bg-[#444]"></div>
                
                {/* Title hidden on mobile to save space */}
                <h1 className="hidden lg:block font-bold text-lg text-white truncate max-w-[200px]">{title}</h1>
                
                <div className="bg-black/40 border border-[#555] px-2 md:px-3 py-1 rounded text-[10px] md:text-xs text-orange-400 font-mono font-bold whitespace-nowrap shrink-0">
                    TURN {currentTurn}
                </div>

                {isAdmin ? (
                    <select 
                        value={currentMap?.id || ''} 
                        onChange={(e) => onChangeMap(e.target.value)}
                        className="bg-[#333] text-gray-200 border border-[#555] rounded px-1 md:px-2 py-1 text-xs md:text-sm outline-none focus:border-orange-500 max-w-[80px] md:max-w-[150px] truncate"
                    >
                        {mapList.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="bg-[#333] px-2 md:px-3 py-1 rounded-full text-xs font-mono text-gray-300 max-w-[80px] md:max-w-[200px] truncate">
                        {currentMap?.name}
                    </div>
                )}
             </div>

             {/* Right Section */}
             <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
                
                {/* Admin Watch Combat Button */}
                {isAdmin && combatActive && onWatchCombat && (
                    <button 
                        onClick={onWatchCombat}
                        className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/50 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.3)] transition-all"
                    >
                        <Sword size={14} className="animate-bounce" /> 
                        <span className="hidden md:inline">전투 관전하기</span>
                        <span className="md:hidden">전투 중</span>
                    </button>
                )}

                {networkMode !== 'SOLO' && (
                    <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${networkMode === 'HOST' ? 'bg-orange-900/30 border-orange-500/30 text-orange-200' : 'bg-blue-900/30 border-blue-500/30 text-blue-200'}`}>
                        <Wifi size={14} />
                        {networkMode === 'HOST' ? 'HOST' : 'CLIENT'}
                    </div>
                )}

                {networkMode === 'HOST' && peerId && (
                    <div 
                        className="flex items-center gap-2 bg-[#111] px-2 md:px-3 py-1.5 rounded-lg border border-[#444] cursor-pointer hover:bg-[#222] transition-colors"
                        onClick={() => {
                            navigator.clipboard.writeText(peerId);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                        }}
                    >
                        <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">CODE:</span>
                        <span className="font-mono text-xs md:text-sm text-white select-all">{peerId}</span>
                        {copiedId ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                    </div>
                )}
                
                {isAdmin ? (
                     <div className="bg-yellow-600 border border-yellow-500 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 shadow-lg shadow-yellow-900/20 whitespace-nowrap">
                        <Unlock size={14} /> <span className="hidden md:inline">운영자</span>
                     </div>
                ) : (
                    myProfile && (
                        <div className="flex items-center gap-2 md:gap-3 bg-[#333] pl-1 pr-2 md:pl-2 md:pr-4 py-1 rounded-full border border-[#444]">
                            <div className="w-6 h-6 rounded-full bg-gray-600 overflow-hidden shrink-0">
                                {myProfile.avatar ? <img src={myProfile.avatar} className="w-full h-full object-cover"/> : <User size={16} className="m-1"/>}
                            </div>
                            <span className="text-xs md:text-sm font-bold text-gray-200 max-w-[60px] md:max-w-[100px] truncate">{myProfile.name}</span>
                        </div>
                    )
                )}
             </div>
        </div>
    );
};
