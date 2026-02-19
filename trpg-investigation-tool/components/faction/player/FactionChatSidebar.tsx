
import React, { useRef, useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionChatMessage } from '../../../types';
import { Shield, MapPin, Send } from 'lucide-react';

interface FactionChatSidebarProps {
    data: FactionGameData;
    myProfile: FactionPlayerProfile | null;
    isAdmin: boolean;
    chatMessages: FactionChatMessage[];
    onSendMessage: (text: string, channel: 'TEAM' | 'BLOCK') => void;
}

export const FactionChatSidebar: React.FC<FactionChatSidebarProps> = ({ 
    data, myProfile, isAdmin, chatMessages, onSendMessage 
}) => {
    const [chatChannel, setChatChannel] = useState<'TEAM' | 'BLOCK'>('TEAM');
    const [inputText, setInputText] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText, chatChannel);
            setInputText("");
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatChannel]);

    // Filter Messages Logic
    const filteredMessages = chatMessages.filter(msg => {
        // 1. Strict Channel Separation: Only show messages for the active tab
        if (msg.channel !== chatChannel) return false;

        // 2. Admin sees all messages within the active channel
        if (isAdmin) return true; 
        
        // 3. Player Filter
        if (msg.channel === 'TEAM') {
            return msg.targetId === myProfile?.teamId;
        } else if (msg.channel === 'BLOCK') {
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
        for(const map of data.maps) {
            const block = map.blocks.find(b => b.id === blockId);
            if(block) return `지역 ${block.label}`;
        }
        return 'Unknown Loc';
    };

    return (
        <div className="w-80 bg-[#1a1a1a] flex flex-col h-full border-l border-[#444] shadow-xl z-10 shrink-0">
            {/* Channel Switcher Tabs */}
            <div className="flex h-12">
                <button 
                    onClick={() => setChatChannel('TEAM')}
                    className={`flex-1 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${chatChannel === 'TEAM' ? 'bg-[#2a2a2a] text-blue-400 border-blue-500' : 'bg-[#151515] text-gray-500 border-[#333] hover:text-gray-300'}`}
                >
                    <Shield size={16} /> 팀 채팅
                </button>
                <button 
                    onClick={() => setChatChannel('BLOCK')}
                    disabled={isBlockChatDisabled && !isAdmin}
                    className={`flex-1 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${chatChannel === 'BLOCK' ? 'bg-[#2a2a2a] text-red-400 border-red-500' : 'bg-[#151515] text-gray-500 border-[#333] hover:text-gray-300'} ${(isBlockChatDisabled && !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <MapPin size={16} /> 지역 채팅
                </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#1a1a1a]">
                {filteredMessages.length === 0 && (
                    <div className="text-center text-gray-600 text-xs mt-4">
                        {chatChannel === 'TEAM' ? "팀원들과 작전을 논의하세요." : "현재 위치한 지역의 사람들과 대화합니다."}
                    </div>
                )}
                
                {filteredMessages.map(msg => {
                    const isMe = msg.senderId === myProfile?.id;
                    const senderFaction = data.factions.find(f => f.id === msg.senderFactionId);
                    
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
                                    {isAdmin && <span className="text-gray-600 font-normal ml-1">({contextLabel})</span>}
                                </span>
                            </div>
                            <div className={`text-sm px-3 py-2 rounded-lg max-w-[90%] break-words shadow-sm ${
                                isMe 
                                    ? (msg.channel === 'TEAM' ? 'bg-blue-900/40 border border-blue-500/50 text-blue-100 rounded-tr-none' : 'bg-red-900/40 border border-red-500/50 text-red-100 rounded-tr-none') 
                                    : 'bg-[#2e2e2e] text-gray-200 border border-[#444] rounded-tl-none'
                            }`}>
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
            <form onSubmit={handleSend} className="p-3 bg-[#222] border-t border-[#444]">
                <div className="relative">
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={!onSendMessage || (chatChannel === 'BLOCK' && isBlockChatDisabled && !isAdmin)}
                        className="w-full bg-[#111] border border-[#333] rounded-full pl-4 pr-10 py-2.5 text-sm text-gray-200 focus:border-indigo-500 outline-none disabled:opacity-50 placeholder-gray-600"
                        placeholder={chatChannel === 'BLOCK' && isBlockChatDisabled ? "지역 채팅 불가 (맵 외부)" : (chatChannel === 'TEAM' ? "팀에게 메시지 전송..." : "지역에 메시지 전송...")}
                    />
                    <button 
                        type="submit"
                        disabled={!inputText.trim()}
                        className={`absolute right-1.5 top-1.5 bottom-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed ${chatChannel === 'TEAM' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </form>
        </div>
    );
};
