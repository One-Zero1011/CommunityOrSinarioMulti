
import React, { useRef } from 'react';
import { FactionGameData, FactionPlayerProfile } from '../../../types';
import { Users, Settings, User, EyeOff, Upload, CheckCircle2, Hourglass } from 'lucide-react';
import { blobToBase64 } from '../../../lib/utils';

interface FactionSidebarProps {
    data: FactionGameData;
    players: FactionPlayerProfile[];
    myProfile: FactionPlayerProfile | null;
    isAdmin: boolean;
    selectedPlayerId: string | null;
    onSelectPlayer: (id: string | null) => void;
    onUpdateProfile: (updates: Partial<FactionPlayerProfile>) => void;
}

export const FactionSidebar: React.FC<FactionSidebarProps> = ({ 
    data, players, myProfile, isAdmin, selectedPlayerId, onSelectPlayer, onUpdateProfile
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const base64 = await blobToBase64(e.target.files[0]);
                onUpdateProfile({ avatar: base64 });
            } catch (err) {
                console.error(err);
            }
        }
    };

    const currentTurn = data.currentTurn || 1;

    return (
        <div className="w-80 bg-[#222] border-r border-[#444] flex flex-col shadow-xl z-10 shrink-0">
            {/* Header */}
            <div className="h-12 bg-[#252525] flex items-center justify-center border-b border-[#444]">
                <h2 className="font-bold text-gray-200 flex items-center gap-2 text-sm">
                    <Users size={16} /> {isAdmin ? "전체 참가자 목록" : "진영 현황"}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {data.factions.map(faction => (
                    <div key={faction.id} className={`bg-[#2a2a2a] rounded-lg border overflow-hidden ${myProfile?.factionId === faction.id ? 'border-2 border-white' : 'border-[#444]'}`}>
                        <div 
                            className="p-3 font-bold text-white flex items-center gap-2"
                            style={{ backgroundColor: faction.color + '40', borderBottom: `2px solid ${faction.color}` }}
                        >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: faction.color }}></div>
                            {faction.name}
                            {myProfile?.factionId === faction.id && <span className="text-[10px] bg-white text-black px-1 rounded ml-auto font-bold">MY</span>}
                        </div>
                        <div className="p-2 space-y-2">
                            {faction.teams.length === 0 && <p className="text-xs text-gray-600 italic p-2">팀이 없습니다.</p>}
                            {faction.teams.map(team => {
                                const teamPlayers = players.filter(p => p.teamId === team.id);
                                
                                const visiblePlayers = teamPlayers.filter(p => {
                                    if (isAdmin) return true; 
                                    if (!myProfile) return false; 
                                    return p.id === myProfile.id || p.teamId === myProfile.teamId;
                                });

                                const hasHiddenPlayers = teamPlayers.length > 0 && visiblePlayers.length === 0;

                                return (
                                    <div key={team.id} className="bg-[#1e1e1e] rounded border border-[#333] overflow-hidden">
                                        <div className="bg-[#252525] px-2 py-1.5 text-xs text-gray-400 font-bold border-b border-[#333] flex justify-between">
                                            <span>{team.name}</span>
                                            <span className="text-[10px] bg-[#333] px-1.5 rounded text-gray-500">{teamPlayers.length}</span>
                                        </div>
                                        <div className="p-1">
                                            {teamPlayers.length === 0 && <p className="text-[10px] text-gray-600 italic p-1">대기 중...</p>}
                                            {hasHiddenPlayers && (
                                                <div className="text-[10px] text-gray-600 italic p-1 flex items-center gap-1 justify-center py-2">
                                                    <EyeOff size={12} /> 정보 비공개
                                                </div>
                                            )}
                                            {visiblePlayers.map(player => {
                                                const isMe = player.id === myProfile?.id;
                                                const hasActed = player.lastActionTurn === currentTurn;

                                                return (
                                                    <div 
                                                        key={player.id}
                                                        onClick={() => isAdmin && onSelectPlayer(player.id)}
                                                        className={`flex flex-col p-2 rounded transition-colors ${isAdmin ? 'cursor-pointer hover:bg-[#333]' : ''} ${selectedPlayerId === player.id ? 'bg-orange-900/30 border border-orange-500/50' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {/* Status Indicator (Ready/Done) - Visible mainly to Admin */}
                                                            {isAdmin && (
                                                                <div title={hasActed ? "행동 완료" : "행동 가능"}>
                                                                    {hasActed ? (
                                                                        <CheckCircle2 size={12} className="text-red-500" />
                                                                    ) : (
                                                                        <Hourglass size={12} className="text-green-500" />
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className={`w-5 h-5 rounded-full bg-gray-700 overflow-hidden shrink-0 relative group ${isMe ? 'cursor-pointer ring-1 ring-white' : ''}`}
                                                                onClick={(e) => {
                                                                    if (isMe) {
                                                                        e.stopPropagation();
                                                                        fileInputRef.current?.click();
                                                                    }
                                                                }}
                                                            >
                                                                {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover"/> : <User size={12} className="m-auto mt-1"/>}
                                                                {isMe && (
                                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Upload size={10} className="text-white"/>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isMe ? (
                                                                <input 
                                                                    type="text"
                                                                    value={player.name}
                                                                    onChange={(e) => onUpdateProfile({ name: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="flex-1 bg-transparent border-b border-gray-600 focus:border-indigo-500 text-xs font-bold text-white outline-none px-1"
                                                                />
                                                            ) : (
                                                                <span className={`text-xs truncate flex-1 ${isMe ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                                    {player.name}
                                                                </span>
                                                            )}
                                                            {isAdmin && <Settings size={12} className="ml-auto text-gray-600 opacity-0 group-hover:opacity-100" />}
                                                        </div>
                                                        <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden flex relative">
                                                            <div 
                                                                className={`h-full transition-all duration-300 ${player.hp < (player.maxHp * 0.3) ? 'bg-red-500' : 'bg-green-500'}`}
                                                                style={{ width: `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between mt-0.5">
                                                            <span className="text-[9px] text-gray-500 leading-none">{player.hp}/{player.maxHp}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarChange} 
            />
        </div>
    );
};
