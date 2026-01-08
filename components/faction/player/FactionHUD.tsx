
import React from 'react';
import { ArrowLeft, Wifi, Check, Copy, Unlock, User } from 'lucide-react';
import { FactionPlayerProfile, FactionMap } from '../../../types';

interface FactionHUDProps {
    title: string;
    currentMap?: FactionMap;
    networkMode: 'SOLO' | 'HOST' | 'CLIENT';
    peerId: string | null;
    copiedId: boolean;
    setCopiedId: (v: boolean) => void;
    isAdmin: boolean;
    myProfile: FactionPlayerProfile | null;
    onExit: () => void;
    mapList: FactionMap[];
    onChangeMap: (id: string) => void;
}

export const FactionHUD: React.FC<FactionHUDProps> = ({ 
    title, currentMap, networkMode, peerId, copiedId, setCopiedId, isAdmin, myProfile, onExit, mapList, onChangeMap
}) => {
    return (
        <div className="h-14 bg-[#252525] border-b border-[#444] flex items-center justify-between px-6 shrink-0 z-20 shadow-md">
             <div className="flex items-center gap-4">
                <button onClick={onExit} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-bold transition-colors">
                    <ArrowLeft size={18} /> 나가기
                </button>
                <div className="h-6 w-px bg-[#444]"></div>
                <h1 className="font-bold text-lg text-white">{title}</h1>
                
                {isAdmin ? (
                    <select 
                        value={currentMap?.id || ''} 
                        onChange={(e) => onChangeMap(e.target.value)}
                        className="bg-[#333] text-gray-200 border border-[#555] rounded px-2 py-1 text-sm outline-none focus:border-orange-500"
                    >
                        {mapList.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="bg-[#333] px-3 py-1 rounded-full text-xs font-mono text-gray-300">
                        {currentMap?.name}
                    </div>
                )}
             </div>

             <div className="flex items-center gap-4">
                {networkMode !== 'SOLO' && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${networkMode === 'HOST' ? 'bg-orange-900/30 border-orange-500/30 text-orange-200' : 'bg-blue-900/30 border-blue-500/30 text-blue-200'}`}>
                        <Wifi size={14} />
                        {networkMode === 'HOST' ? 'HOST' : 'CLIENT'}
                    </div>
                )}

                {networkMode === 'HOST' && peerId && (
                    <div 
                        className="flex items-center gap-2 bg-[#111] px-3 py-1.5 rounded-lg border border-[#444] cursor-pointer hover:bg-[#222] transition-colors"
                        onClick={() => {
                            navigator.clipboard.writeText(peerId);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                        }}
                    >
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">CODE:</span>
                        <span className="font-mono text-sm text-white select-all">{peerId}</span>
                        {copiedId ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                    </div>
                )}
                
                {isAdmin ? (
                     <div className="bg-yellow-600 border border-yellow-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-yellow-900/20">
                        <Unlock size={14} /> 운영자 모드
                     </div>
                ) : (
                    myProfile && (
                        <div className="flex items-center gap-3 bg-[#333] pl-2 pr-4 py-1 rounded-full border border-[#444]">
                            <div className="w-6 h-6 rounded-full bg-gray-600 overflow-hidden">
                                {myProfile.avatar ? <img src={myProfile.avatar} className="w-full h-full object-cover"/> : <User size={16} className="m-1"/>}
                            </div>
                            <span className="text-sm font-bold text-gray-200">{myProfile.name}</span>
                        </div>
                    )
                )}
             </div>
        </div>
    );
};
