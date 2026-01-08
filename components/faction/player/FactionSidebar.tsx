
import React, { useRef, useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionChatMessage } from '../../../types';
import { Crown, Users, Settings, User, EyeOff, Heart, Upload, MessageSquare, Shield, MapPin, Send } from 'lucide-react';
import { blobToBase64 } from '../../../lib/utils';

interface FactionSidebarProps {
    data: FactionGameData;
    players: FactionPlayerProfile[];
    myProfile: FactionPlayerProfile | null;
    isAdmin: boolean;
    selectedPlayerId: string | null;
    onSelectPlayer: (id: string | null) => void;
    onUpdateProfile: (updates: Partial<FactionPlayerProfile>) => void;
    chatMessages?: FactionChatMessage[];
    onSendMessage?: (text: string, channel: 'TEAM' | 'BLOCK') => void;
}

export const FactionSidebar: React.FC<FactionSidebarProps> = ({ 
    data, players, myProfile, isAdmin, selectedPlayerId, onSelectPlayer, onUpdateProfile,
    chatMessages = [], onSendMessage
}) => {
    const [activeTab, setActiveTab] = useState<'LIST' | 'CHAT'>('LIST');
    const [chatChannel, setChatChannel] = useState<'TEAM' | 'BLOCK'>('TEAM');
    const [inputText, setInputText] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);
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

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim() && onSendMessage) {
            onSendMessage(inputText, chatChannel);
            setInputText("");
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        if (activeTab === 'CHAT') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, activeTab, chatChannel]);

    // Filter Messages Logic
    const filteredMessages = chatMessages.filter(msg => {
        if (isAdmin) return true; // Admin sees all messages
        
        if (msg.channel === 'TEAM') {
            // FIX: Restrict to TEAM members only (targetId is teamId here)
            return msg.targetId === myProfile?.teamId;
        } else if (msg.channel === 'BLOCK') {
            // Restrict to current BLOCK members
            return msg.targetId === myProfile?.currentBlockId;
        }
        return false;
    });

    const isBlockChatDisabled = !myProfile?.currentBlockId;

    const getTeamName = (factionId: string, teamId: string) => {
        const faction = data.factions.find(f => f.id === factionId);
        const team = faction?.teams.find(t => t.id === teamId);
        return team ? team.name : 'Unknown Team';
    };

    const getBlockName = (blockId: string) => {
        // Search all maps for the block label (inefficient but safe for small data)
        for(const map of data.maps) {
            const block = map.blocks.find(b => b.id === blockId);
            if(block) return `지역 ${block.label}`;
        }
        return 'Unknown Loc';
    };

    return (
        <div className="w-80 bg-[#222] border-r border-[#444] flex flex-col shadow-xl z-10 shrink-0">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-[#444]">
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'LIST' ? 'bg-[#2a2a2a] text-white border-b-2 border-orange-500' : 'bg-[#222] text-gray-500 hover:text-gray-300'}`}
                >
                    <Users size={16} /> {isAdmin ? "참가자" : "진영"}
                </button>
                <button 
                    onClick={() => setActiveTab('CHAT')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'CHAT' ? 'bg-[#2a2a2a] text-white border-b-2 border-orange-500' : 'bg-[#222] text-gray-500 hover:text-gray-300'}`}
                >
                    <MessageSquare size={16} /> 채팅
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col">
                
                {/* List Tab */}
                {activeTab === 'LIST' && (
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
                                            // Only see own team or if admin
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
                                                        return (
                                                            <div 
                                                                key={player.id}
                                                                onClick={() => isAdmin && onSelectPlayer(player.id)}
                                                                className={`flex flex-col p-2 rounded transition-colors ${isAdmin ? 'cursor-pointer hover:bg-[#333]' : ''} ${selectedPlayerId === player.id ? 'bg-orange-900/30 border border-orange-500/50' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-2 mb-1">
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
                                                                <div className="flex justify-end mt-0.5">
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
                )}

                {/* Chat Tab */}
                {activeTab === 'CHAT' && (
                    <div className="flex flex-col h-full bg-[#1a1a1a]">
                        {/* Channel Switcher */}
                        <div className="flex p-2 gap-2 border-b border-[#333]">
                            <button 
                                onClick={() => setChatChannel('TEAM')}
                                className={`flex-1 py-1.5 text-xs rounded font-bold flex items-center justify-center gap-1 transition-colors ${chatChannel === 'TEAM' ? 'bg-indigo-600 text-white' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}
                            >
                                <Shield size={12} /> 팀 채팅
                            </button>
                            <button 
                                onClick={() => setChatChannel('BLOCK')}
                                disabled={isBlockChatDisabled && !isAdmin}
                                className={`flex-1 py-1.5 text-xs rounded font-bold flex items-center justify-center gap-1 transition-colors ${chatChannel === 'BLOCK' ? 'bg-emerald-600 text-white' : 'bg-[#333] text-gray-400 hover:bg-[#444]'} ${(isBlockChatDisabled && !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <MapPin size={12} /> 지역 채팅
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {filteredMessages.length === 0 && (
                                <div className="text-center text-gray-600 text-xs mt-4">
                                    {chatChannel === 'TEAM' ? "팀원들과 대화를 시작해보세요." : "이 지역에 있는 사람들과 대화할 수 있습니다."}
                                </div>
                            )}
                            
                            {filteredMessages.map(msg => {
                                const isMe = msg.senderId === myProfile?.id;
                                const senderFaction = data.factions.find(f => f.id === msg.senderFactionId);
                                
                                // Extra Info Label for Admin (Showing context source)
                                const contextLabel = msg.channel === 'TEAM' 
                                    ? getTeamName(msg.senderFactionId, msg.targetId) 
                                    : getBlockName(msg.targetId);

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-1 mb-0.5">
                                            {senderFaction && !isMe && (
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: senderFaction.color }}></div>
                                            )}
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {msg.senderName} 
                                                {/* Show Context for Admin to distinguish mixed messages */}
                                                {isAdmin && <span className="text-gray-600 font-normal ml-1">({contextLabel})</span>}
                                            </span>
                                        </div>
                                        <div className={`text-sm px-3 py-2 rounded-lg max-w-[90%] break-words ${isMe ? 'bg-indigo-700 text-white rounded-tr-none' : 'bg-[#2e2e2e] text-gray-200 border border-[#444] rounded-tl-none'}`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] text-gray-600 mt-0.5">
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-2 border-t border-[#333] bg-[#222]">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={!onSendMessage || (chatChannel === 'BLOCK' && isBlockChatDisabled && !isAdmin)}
                                    className="w-full bg-[#111] border border-[#333] rounded-full pl-3 pr-10 py-2 text-sm text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50"
                                    placeholder={chatChannel === 'BLOCK' && isBlockChatDisabled ? "지역 채팅 불가 (맵 외부)" : "메시지 입력..."}
                                />
                                <button 
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="absolute right-1 top-1 bottom-1 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
            
            {/* Hidden Input for Avatar Update */}
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
