
import React, { useState, useEffect, useRef } from 'react';
import { FactionPlayerProfile, CombatState, FactionChatMessage } from '../../../types';
import { Sword, Heart, Shield, AlertTriangle, ArrowRight, XCircle, Wind, MessageSquare, Send, MapPin } from 'lucide-react';

interface FactionCombatUIProps {
    myProfile: FactionPlayerProfile | null;
    players: FactionPlayerProfile[];
    combatState: CombatState;
    // Handlers
    onAction: (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => void;
    onResponse: (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', targetId?: string) => void;
    
    // Chat Props
    chatMessages: FactionChatMessage[];
    onSendMessage: (text: string, channel: 'TEAM' | 'BLOCK') => void;
}

export const FactionCombatUI: React.FC<FactionCombatUIProps> = ({ 
    myProfile, players, combatState, onAction, onResponse, chatMessages, onSendMessage
}) => {
    const [actionStep, setActionStep] = useState<'SELECT_ACTION' | 'SELECT_TARGET'>('SELECT_ACTION');
    const [selectedActionType, setSelectedActionType] = useState<'ATTACK' | 'HEAL' | null>(null);
    const [healTargetStep, setHealTargetStep] = useState(false); // For Heal Response

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatChannel, setChatChannel] = useState<'TEAM' | 'BLOCK'>('TEAM');
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);
    const prevMsgCountRef = useRef(chatMessages.length);
    const [hasNewMsg, setHasNewMsg] = useState(false);

    const isMyTurn = myProfile && combatState.currentTurnPlayerId === myProfile.id;
    const activePlayer = players.find(p => p.id === combatState.currentTurnPlayerId);
    
    // -- Filtering --
    const enemies = myProfile ? players.filter(p => p.factionId !== myProfile.factionId && p.hp > 0) : [];
    
    // Healing Logic Update: Same Faction AND Same Team (includes self)
    const allies = myProfile ? players.filter(p => p.factionId === myProfile.factionId && p.teamId === myProfile.teamId && p.hp > 0) : [];

    // -- Chat Logic --
    useEffect(() => {
        if (isChatOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setHasNewMsg(false);
        } else if (chatMessages.length > prevMsgCountRef.current) {
            setHasNewMsg(true);
        }
        prevMsgCountRef.current = chatMessages.length;
    }, [chatMessages, isChatOpen, chatChannel]);

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            onSendMessage(chatInput, chatChannel);
            setChatInput("");
        }
    };

    const filteredMessages = chatMessages.filter(msg => {
        if (msg.channel !== chatChannel) return false;
        if (msg.channel === 'TEAM') return msg.targetId === myProfile?.teamId;
        if (msg.channel === 'BLOCK') return msg.targetId === myProfile?.currentBlockId;
        return false;
    });

    // -- Action Phase Logic --
    const handleActionClick = (action: 'ATTACK' | 'HEAL') => {
        setSelectedActionType(action);
        setActionStep('SELECT_TARGET');
    };

    const handleFleeAction = () => {
        if (!myProfile) return;
        // Flee targets self effectively, just passing ID placeholder
        onAction('FLEE', myProfile.id);
    };

    const handleTargetSelect = (target: FactionPlayerProfile) => {
        if (!selectedActionType) return;
        onAction(selectedActionType, target.id);
        setActionStep('SELECT_ACTION'); // Reset for next time (though phase will change)
    };

    // -- Response Phase Logic --
    // We need to know who is being attacked
    const pending = combatState.pendingAction;
    const attacker = pending ? players.find(p => p.id === pending.sourceId) : null;
    const target = pending ? players.find(p => p.id === pending.targetId) : null;
    
    const isTargetMe = myProfile && target && myProfile.id === target.id;
    // Cover Logic: Can cover only if same Faction AND same Team (Updated consistency)
    const canCover = myProfile && target && myProfile.factionId === target.factionId && myProfile.teamId === target.teamId && myProfile.id !== target.id;

    const handleHealResponseClick = () => {
        setHealTargetStep(true);
    };

    const handleHealResponseTarget = (target: FactionPlayerProfile) => {
        onResponse('HEAL', target.id);
        setHealTargetStep(false);
    };

    // -- Render --

    return (
        <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center animate-fade-in p-4">
             {/* Header Turn Info */}
             <div className="absolute top-16 bg-gradient-to-r from-transparent via-orange-900/80 to-transparent w-full p-4 text-center border-y border-orange-500/30">
                 <h2 className="text-3xl font-bold text-white uppercase tracking-widest drop-shadow-lg flex items-center justify-center gap-4">
                     <Sword size={32} className="text-orange-500" /> 
                     {combatState.phase === 'ACTION' 
                        ? (isMyTurn ? "나의 턴 (MY TURN)" : `${activePlayer?.name || 'Unknown'}의 턴`)
                        : "대응 단계 (RESPONSE)"
                     }
                     <Sword size={32} className="text-orange-500 scale-x-[-1]" /> 
                 </h2>
                 <p className="text-orange-200/70 mt-2 font-mono">
                     {combatState.phase === 'ACTION' && (
                         isMyTurn ? `행동을 선택하세요 (Round ${combatState.turnCount} / 5)` : `다른 플레이어의 행동을 기다리는 중... (Round ${combatState.turnCount} / 5)`
                     )}
                     {combatState.phase === 'RESPONSE' && pending && `${attacker?.name} ➔ ${target?.name} 공격 중! (${pending.damageValue} 데미지)`}
                 </p>
                 {combatState.turnCount > 5 && (
                     <p className="text-red-400 font-bold animate-pulse text-sm mt-1">마지막 판정 진행 중...</p>
                 )}
             </div>

             {/* Main Action Area */}
             <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl relative">
                 
                 {/* 1. ACTION PHASE */}
                 {combatState.phase === 'ACTION' && isMyTurn && (
                     <>
                        {actionStep === 'SELECT_ACTION' && (
                            <div className="flex gap-6 w-full max-w-2xl justify-center">
                                <button 
                                    onClick={() => handleActionClick('ATTACK')}
                                    className="group relative bg-[#2a2a2a] hover:bg-red-900/40 border-2 border-[#444] hover:border-red-500 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all hover:scale-105 w-48"
                                >
                                    <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                                        <Sword size={32} className="text-white" />
                                    </div>
                                    <div className="text-xl font-bold text-white">공격</div>
                                    <div className="text-xs text-gray-400 text-center">
                                        ATK 기반 데미지
                                    </div>
                                </button>

                                <button 
                                    onClick={() => handleActionClick('HEAL')}
                                    className="group relative bg-[#2a2a2a] hover:bg-green-900/40 border-2 border-[#444] hover:border-green-500 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all hover:scale-105 w-48"
                                >
                                    <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-green-600 transition-colors">
                                        <Heart size={32} className="text-white" />
                                    </div>
                                    <div className="text-xl font-bold text-white">치유</div>
                                    <div className="text-xs text-gray-400 text-center">
                                        SPI 기반 회복 (같은 팀만)
                                    </div>
                                </button>

                                <button 
                                    onClick={handleFleeAction}
                                    className="group relative bg-[#2a2a2a] hover:bg-gray-700 border-2 border-[#444] hover:border-gray-400 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all hover:scale-105 w-48"
                                >
                                    <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-gray-500 transition-colors">
                                        <Wind size={32} className="text-white" />
                                    </div>
                                    <div className="text-xl font-bold text-white">도주</div>
                                    <div className="text-xs text-gray-400 text-center">
                                        전투 이탈 시도<br/>
                                        (확률: {20 - (Math.min(5, Math.max(1, combatState.turnCount)) * 2)}+)
                                    </div>
                                </button>
                            </div>
                        )}

                        {actionStep === 'SELECT_TARGET' && (
                            <div className="w-full bg-[#1e1e1e] border border-[#444] rounded-xl p-6 shadow-2xl animate-fade-in-up">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#444]">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {selectedActionType === 'ATTACK' ? <Sword className="text-red-500"/> : <Heart className="text-green-500"/>}
                                        대상 선택 ({selectedActionType === 'ATTACK' ? '적군' : '같은 팀 아군'})
                                    </h3>
                                    <button onClick={() => setActionStep('SELECT_ACTION')} className="text-gray-500 hover:text-white"><XCircle /></button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
                                    {(selectedActionType === 'ATTACK' ? enemies : allies).map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => handleTargetSelect(t)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${selectedActionType === 'ATTACK' ? 'bg-red-900/10 border-red-900/30 hover:bg-red-900/30 hover:border-red-500' : 'bg-green-900/10 border-green-900/30 hover:bg-green-900/30 hover:border-green-500'}`}
                                        >
                                            <div className="w-10 h-10 rounded bg-black/50 overflow-hidden">
                                                {t.avatar && <img src={t.avatar} className="w-full h-full object-cover"/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-200 truncate">{t.name}</div>
                                                <div className="text-xs text-gray-500">HP: {t.hp}/{t.maxHp}</div>
                                            </div>
                                            <ArrowRight size={16} className="text-gray-500" />
                                        </button>
                                    ))}
                                    {(selectedActionType === 'ATTACK' ? enemies : allies).length === 0 && (
                                        <div className="col-span-3 text-center text-gray-500 py-4">대상이 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        )}
                     </>
                 )}

                 {/* 2. RESPONSE PHASE */}
                 {combatState.phase === 'RESPONSE' && (
                     <>
                        {healTargetStep ? (
                             <div className="w-full bg-[#1e1e1e] border border-[#444] rounded-xl p-6 shadow-2xl animate-fade-in-up">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#444]">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Heart className="text-green-500"/> 치유 대상 선택 (대응 행동 - 같은 팀)
                                    </h3>
                                    <button onClick={() => setHealTargetStep(false)} className="text-gray-500 hover:text-white"><XCircle /></button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
                                    {allies.map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => handleHealResponseTarget(t)}
                                            className="flex items-center gap-3 p-3 rounded-lg border bg-green-900/10 border-green-900/30 hover:bg-green-900/30 hover:border-green-500 transition-all text-left"
                                        >
                                            <div className="w-10 h-10 rounded bg-black/50 overflow-hidden">
                                                {t.avatar && <img src={t.avatar} className="w-full h-full object-cover"/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-200 truncate">{t.name}</div>
                                                <div className="text-xs text-gray-500">HP: {t.hp}/{t.maxHp}</div>
                                            </div>
                                            <ArrowRight size={16} className="text-gray-500" />
                                        </button>
                                    ))}
                                    {allies.length === 0 && <div className="col-span-3 text-center text-gray-500">치유할 수 있는 팀원이 없습니다.</div>}
                                </div>
                             </div>
                        ) : (
                            <div className="flex flex-col gap-6 items-center">
                                {/* Warning Message */}
                                <div className="bg-red-900/40 border border-red-500 px-6 py-4 rounded-xl text-center backdrop-blur-sm animate-pulse">
                                    <div className="flex items-center justify-center gap-2 text-red-200 font-bold text-lg mb-1">
                                        <AlertTriangle /> 경고: 공격받고 있습니다!
                                    </div>
                                    <div className="text-white text-2xl font-black mb-2">{pending?.damageValue} 데미지 예정</div>
                                    <div className="text-gray-300 text-sm">
                                        대상: <span className="text-white font-bold">{target?.name}</span>
                                    </div>
                                </div>

                                {/* Buttons Container */}
                                <div className="flex gap-4 flex-wrap justify-center">
                                    {isTargetMe && (
                                        <>
                                            <button 
                                                onClick={() => onResponse('DEFEND')}
                                                className="flex flex-col items-center gap-2 bg-blue-900/60 hover:bg-blue-800 border-2 border-blue-500/50 hover:border-blue-400 p-6 rounded-xl w-32 transition-all hover:scale-105"
                                            >
                                                <Shield size={32} className="text-blue-400" />
                                                <span className="font-bold text-white">방어</span>
                                                <span className="text-[10px] text-gray-400">데미지 감소<br/>(1D{15 + ((myProfile.stats.defense)*5)})</span>
                                            </button>

                                            <button 
                                                onClick={() => onResponse('COUNTER')}
                                                className="flex flex-col items-center gap-2 bg-red-900/60 hover:bg-red-800 border-2 border-red-500/50 hover:border-red-400 p-6 rounded-xl w-32 transition-all hover:scale-105"
                                            >
                                                <Sword size={32} className="text-red-400" />
                                                <span className="font-bold text-white">반격</span>
                                                <span className="text-[10px] text-gray-400">맞고 공격하기<br/>(1D{15 + ((myProfile.stats.attack)*5)})</span>
                                            </button>

                                            <button 
                                                onClick={() => onResponse('FLEE')}
                                                className="flex flex-col items-center gap-2 bg-gray-700/60 hover:bg-gray-600 border-2 border-gray-400/50 hover:border-gray-200 p-6 rounded-xl w-32 transition-all hover:scale-105"
                                            >
                                                <Wind size={32} className="text-white" />
                                                <span className="font-bold text-white">도주</span>
                                                <span className="text-[10px] text-gray-400">0 데미지 시도<br/>(판정&gt; {20 - (Math.min(5, Math.max(1, combatState.turnCount)) * 2)})</span>
                                            </button>
                                        </>
                                    )}

                                    {canCover && (
                                        <button 
                                            onClick={() => onResponse('COVER')}
                                            className="flex flex-col items-center gap-2 bg-yellow-900/60 hover:bg-yellow-800 border-2 border-yellow-500/50 hover:border-yellow-400 p-6 rounded-xl w-32 transition-all hover:scale-105"
                                        >
                                            <Shield size={32} className="text-yellow-400" />
                                            <span className="font-bold text-white">대리 방어</span>
                                            <span className="text-[10px] text-gray-400">대신 맞기<br/>(1D{15 + ((myProfile.stats.defense)*5)})</span>
                                        </button>
                                    )}

                                    {(isTargetMe || canCover) && (
                                        <button 
                                            onClick={handleHealResponseClick}
                                            className="flex flex-col items-center gap-2 bg-green-900/60 hover:bg-green-800 border-2 border-green-500/50 hover:border-green-400 p-6 rounded-xl w-32 transition-all hover:scale-105"
                                        >
                                            <Heart size={32} className="text-green-400" />
                                            <span className="font-bold text-white">치유</span>
                                            <span className="text-[10px] text-gray-400">맞고 치유하기<br/>(SPI 판정)</span>
                                        </button>
                                    )}

                                    {!isTargetMe && !canCover && (
                                        <div className="text-gray-400 italic">대응할 수 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        )}
                     </>
                 )}
             </div>

             {/* Log Area - Shifted up slightly to accommodate chat */}
             <div className="absolute bottom-16 w-full max-w-3xl h-36 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pointer-events-none">
                 <div className="w-full h-full overflow-y-auto flex flex-col-reverse gap-1 mask-image-gradient">
                     {[...combatState.logs].reverse().map(log => (
                         <div key={log.id} className={`text-sm px-2 py-1 rounded backdrop-blur-sm ${log.type === 'ATTACK' ? 'text-red-300 bg-red-900/20' : log.type === 'HEAL' ? 'text-green-300 bg-green-900/20' : log.type === 'DEFEND' ? 'text-blue-300 bg-blue-900/20' : log.type === 'FLEE' ? 'text-gray-200 bg-gray-600/50' : 'text-gray-400 bg-black/40'}`}>
                             <span className="text-[10px] opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                             {log.text}
                         </div>
                     ))}
                 </div>
             </div>

             {/* Combat Chat Toggle */}
             <div className="absolute bottom-4 right-4 z-50">
                 <button 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="bg-[#2a2a2a] hover:bg-[#383838] text-white p-3 rounded-full shadow-lg border border-[#444] relative"
                 >
                     <MessageSquare size={24} />
                     {hasNewMsg && !isChatOpen && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-black"></span>}
                 </button>
             </div>

             {/* Chat Box */}
             {isChatOpen && (
                 <div className="absolute bottom-20 right-4 w-80 h-96 bg-[#1a1a1a]/95 border border-[#444] rounded-lg shadow-2xl flex flex-col overflow-hidden z-50 animate-fade-in-up">
                     <div className="flex border-b border-[#444]">
                        <button 
                            onClick={() => setChatChannel('TEAM')}
                            className={`flex-1 py-2 text-xs font-bold ${chatChannel === 'TEAM' ? 'bg-[#2a2a2a] text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            팀 채팅
                        </button>
                        <button 
                            onClick={() => setChatChannel('BLOCK')}
                            className={`flex-1 py-2 text-xs font-bold ${chatChannel === 'BLOCK' ? 'bg-[#2a2a2a] text-red-400 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            지역 채팅
                        </button>
                        <button onClick={() => setIsChatOpen(false)} className="px-3 hover:text-white text-gray-500"><XCircle size={16}/></button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/20">
                        {filteredMessages.length === 0 && <div className="text-center text-gray-500 text-xs mt-4">메시지가 없습니다.</div>}
                        {filteredMessages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.senderId === myProfile?.id ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] text-gray-400 px-1">{msg.senderName}</span>
                                <div className={`px-2 py-1.5 rounded text-xs max-w-[90%] break-words ${msg.senderId === myProfile?.id ? (msg.channel === 'TEAM' ? 'bg-blue-900/50 text-blue-100 border border-blue-500/30' : 'bg-red-900/50 text-red-100 border border-red-500/30') : 'bg-[#333] text-gray-200 border border-[#444]'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef}></div>
                     </div>
                     <form onSubmit={handleSendChat} className="p-2 border-t border-[#444] bg-[#222]">
                        <div className="relative">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                className="w-full bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none pr-8"
                                placeholder="메시지 전송..."
                            />
                            <button type="submit" className="absolute right-1 top-1 text-gray-400 hover:text-white p-0.5">
                                <Send size={14} />
                            </button>
                        </div>
                     </form>
                 </div>
             )}
        </div>
    );
};
