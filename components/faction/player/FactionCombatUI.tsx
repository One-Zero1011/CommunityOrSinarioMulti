


import React, { useState, useEffect, useRef } from 'react';
import { FactionPlayerProfile, CombatState, FactionChatMessage } from '../../../types';
import { Sword, Heart, Shield, AlertTriangle, XCircle, Wind, MessageSquare, Send, EyeOff, User, Skull, Target, Zap } from 'lucide-react';

interface FactionCombatUIProps {
    myProfile: FactionPlayerProfile | null;
    players: FactionPlayerProfile[];
    combatState: CombatState;
    onAction: (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => void;
    onResponse: (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', targetId?: string) => void;
    chatMessages: FactionChatMessage[];
    onSendMessage: (text: string, channel: 'TEAM' | 'BLOCK') => void;
    isAdmin?: boolean;
    onClose?: () => void;
}

export const FactionCombatUI: React.FC<FactionCombatUIProps> = ({ 
    myProfile, players, combatState, onAction, onResponse, chatMessages, onSendMessage, isAdmin, onClose
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

    // Derived State
    const activePlayerId = combatState.currentTurnPlayerId;
    const activePlayer = players.find(p => p.id === activePlayerId);
    const isMyTurn = myProfile && activePlayerId === myProfile.id;
    
    // Split Players
    // IMPORTANT: Combat participants are determined by the block ID anchored in CombatState
    const currentBlockId = combatState.combatBlockId;
    
    // Filter players actually in this combat (same block)
    const combatants = players.filter(p => p.currentBlockId === currentBlockId);

    // Grouping
    const myFactionId = myProfile?.factionId;
    // If Admin, just split by first faction found vs others, or just show all. 
    // Admin view: Enemies = distinct faction from active player? 
    // Let's stick to perspective: If Admin, view from Active Player's perspective? Or just split arbitrarily.
    // Better: View from "My Profile" perspective. If Admin has no profile, assume Active Player's faction is "Ally" side for visualization.
    const perspectiveFactionId = myFactionId || activePlayer?.factionId;

    const allies = combatants.filter(p => p.factionId === perspectiveFactionId);
    const enemies = combatants.filter(p => p.factionId !== perspectiveFactionId);

    const pending = combatState.pendingAction;
    const attacker = pending ? players.find(p => p.id === pending.sourceId) : null;
    const target = pending ? players.find(p => p.id === pending.targetId) : null;

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

    // -- Action Handlers --
    const handleActionClick = (action: 'ATTACK' | 'HEAL') => {
        setSelectedActionType(action);
        setActionStep('SELECT_TARGET');
    };

    const handleFleeAction = () => {
        if (!myProfile) return;
        onAction('FLEE', myProfile.id);
    };

    const handleCardClick = (player: FactionPlayerProfile, isEnemy: boolean) => {
        // 1. Action Phase Targeting
        if (isMyTurn && actionStep === 'SELECT_TARGET' && selectedActionType) {
            if (selectedActionType === 'ATTACK') {
                if (!isEnemy) return; // Can't attack allies
                onAction('ATTACK', player.id);
            } else if (selectedActionType === 'HEAL') {
                if (isEnemy) return; // Can't heal enemies
                onAction('HEAL', player.id);
            }
            setActionStep('SELECT_ACTION');
            return;
        }

        // 2. Response Phase Healing Targeting
        if (combatState.phase === 'RESPONSE' && healTargetStep) {
            if (isEnemy) return;
            onResponse('HEAL', player.id);
            setHealTargetStep(false);
        }
    };

    // -- Helper Components --
    const PlayerCard = ({ player, isEnemy }: { player: FactionPlayerProfile, isEnemy: boolean }) => {
        const isDead = player.hp <= 0;
        const isFled = combatState.fledPlayerIds.includes(player.id);
        const isActive = player.id === activePlayerId;
        const isTargeted = target?.id === player.id;
        const isMe = myProfile?.id === player.id;
        
        // Targeting Mode Visuals
        const isSelectable = (
            (isMyTurn && actionStep === 'SELECT_TARGET' && ((selectedActionType === 'ATTACK' && isEnemy) || (selectedActionType === 'HEAL' && !isEnemy))) ||
            (healTargetStep && !isEnemy)
        ) && !isDead && !isFled;

        const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));

        return (
            <div 
                onClick={() => isSelectable && handleCardClick(player, isEnemy)}
                className={`
                    relative flex flex-col items-center p-2 rounded-xl transition-all duration-300 w-24 md:w-32 shrink-0
                    ${isDead || isFled ? 'opacity-50 grayscale scale-90' : ''}
                    ${isActive ? 'ring-4 ring-yellow-400 bg-yellow-900/30 scale-105 z-10 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}
                    ${isTargeted ? 'ring-4 ring-red-600 bg-red-900/30 animate-pulse scale-105 z-10' : ''}
                    ${isSelectable ? 'cursor-pointer hover:scale-110 hover:brightness-125 ring-2 ring-white animate-bounce-slight' : ''}
                    ${!isActive && !isTargeted && !isSelectable ? 'bg-black/40 border border-white/10' : ''}
                `}
            >
                {/* Status Badges */}
                {isActive && <div className="absolute -top-3 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-20 shadow-sm animate-bounce">TURN</div>}
                {isTargeted && <div className="absolute -top-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-20 shadow-sm flex items-center gap-1"><Target size={10}/> TARGET</div>}
                {isFled && <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl z-20"><span className="text-gray-400 font-bold text-xs">도주함</span></div>}
                {isDead && <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl z-20"><Skull className="text-gray-500" size={24}/></div>}

                {/* Avatar */}
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-gray-800 border-2 shadow-lg mb-2 relative ${isEnemy ? 'border-red-400/50' : 'border-blue-400/50'}`}>
                    {player.avatar ? (
                        <img src={player.avatar} className="w-full h-full object-cover" alt={player.name} />
                    ) : (
                        <User className="w-full h-full p-3 text-gray-500" />
                    )}
                    {isMe && <div className="absolute bottom-0 inset-x-0 bg-indigo-600 text-[8px] text-center text-white font-bold">ME</div>}
                </div>

                {/* Info */}
                <div className="text-center w-full">
                    <div className="text-xs font-bold text-white truncate shadow-black drop-shadow-md mb-1 px-1">{player.name}</div>
                    
                    {/* HP Bar */}
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden border border-black/50 relative">
                        <div 
                            className={`h-full transition-all duration-500 ${hpPercent < 30 ? 'bg-red-500' : 'bg-green-500'}`} 
                            style={{ width: `${hpPercent}%` }}
                        />
                    </div>
                    <div className="text-[9px] text-gray-300 font-mono mt-0.5">
                        {player.hp}/{player.maxHp}
                    </div>
                </div>
            </div>
        );
    };

    // -- Main Render --
    return (
        <div className="absolute inset-0 z-40 bg-black/90 flex flex-col animate-fade-in overflow-hidden font-sans">
             
             {/* Admin Controls */}
             {isAdmin && onClose && (
                 <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 z-50 bg-gray-800/80 hover:bg-gray-700 text-white px-3 py-1 rounded-full border border-gray-600 flex items-center gap-2 text-xs font-bold"
                 >
                     <EyeOff size={14} /> 관전 숨기기
                 </button>
             )}

             {/* 1. TOP: ENEMIES */}
             <div className="flex-1 bg-gradient-to-b from-red-900/20 to-transparent p-4 flex flex-col justify-start">
                <h3 className="text-red-400 font-bold text-xs uppercase tracking-widest text-center mb-2 flex items-center justify-center gap-2">
                    <Sword size={12}/> Enemies (적군)
                </h3>
                <div className="flex items-start justify-center gap-2 md:gap-6 overflow-x-auto pb-4 no-scrollbar">
                    {enemies.length === 0 && <div className="text-gray-500 text-sm">적군이 없습니다.</div>}
                    {enemies.map(p => <PlayerCard key={p.id} player={p} isEnemy={true} />)}
                </div>
             </div>

             {/* 2. CENTER: ACTION STAGE */}
             <div className="flex-0 shrink-0 min-h-[200px] flex flex-col items-center justify-center relative py-4">
                 
                 {/* Turn Indicator Banner */}
                 <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                 
                 {/* Combat Phase: ACTION */}
                 {combatState.phase === 'ACTION' && (
                     <>
                        {isMyTurn ? (
                            <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                                {actionStep === 'SELECT_ACTION' ? (
                                    <>
                                        <div className="text-yellow-400 font-bold text-lg animate-pulse mb-2">당신의 턴입니다!</div>
                                        <div className="flex gap-4">
                                            <button onClick={() => handleActionClick('ATTACK')} className="flex flex-col items-center gap-1 bg-red-900/80 hover:bg-red-600 border border-red-500 p-4 rounded-xl w-24 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-900/50">
                                                <Sword size={32} className="text-white"/>
                                                <span className="font-bold text-sm text-white">공격</span>
                                            </button>
                                            <button onClick={() => handleActionClick('HEAL')} className="flex flex-col items-center gap-1 bg-green-900/80 hover:bg-green-600 border border-green-500 p-4 rounded-xl w-24 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-green-900/50">
                                                <Heart size={32} className="text-white"/>
                                                <span className="font-bold text-sm text-white">치유</span>
                                            </button>
                                            <button onClick={handleFleeAction} className="flex flex-col items-center gap-1 bg-gray-700/80 hover:bg-gray-500 border border-gray-400 p-4 rounded-xl w-24 transition-all hover:scale-110 active:scale-95 shadow-lg">
                                                <Wind size={32} className="text-white"/>
                                                <span className="font-bold text-sm text-white">도주</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 animate-bounce-slight">
                                        <div className="bg-black/50 px-6 py-2 rounded-full border border-white/30 text-white font-bold text-lg">
                                            {selectedActionType === 'ATTACK' ? '공격할 적을 선택하세요' : '치유할 아군을 선택하세요'}
                                        </div>
                                        <button onClick={() => setActionStep('SELECT_ACTION')} className="text-gray-400 hover:text-white underline text-sm">
                                            취소하고 다시 선택
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 opacity-80">
                                <div className="w-12 h-12 border-4 border-t-orange-500 border-gray-700 rounded-full animate-spin"></div>
                                <div className="text-orange-200 font-bold text-lg">{activePlayer?.name}의 턴 진행 중...</div>
                            </div>
                        )}
                     </>
                 )}

                 {/* Combat Phase: RESPONSE */}
                 {combatState.phase === 'RESPONSE' && (
                     <div className="flex flex-col items-center w-full max-w-lg px-4 animate-fade-in">
                         {/* Attack Info Card */}
                         <div className="bg-red-950/80 border border-red-500/50 rounded-lg p-4 flex items-center gap-4 w-full shadow-2xl mb-4 relative overflow-hidden">
                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>
                             <div className="flex-1 text-right">
                                 <div className="text-xs text-red-300">공격자</div>
                                 <div className="font-bold text-white text-lg">{attacker?.name}</div>
                             </div>
                             <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 rounded-full w-12 h-12 border border-red-500">
                                 <Sword size={20} className="text-red-500"/>
                                 <span className="text-[10px] font-bold text-white">{pending?.damageValue} DMG</span>
                             </div>
                             <div className="flex-1 text-left">
                                 <div className="text-xs text-red-300">대상</div>
                                 <div className="font-bold text-white text-lg">{target?.name}</div>
                             </div>
                         </div>

                         {/* Response Buttons */}
                         {healTargetStep ? (
                             <div className="bg-black/60 p-4 rounded-xl border border-green-500 text-center animate-fade-in">
                                 <h4 className="text-green-400 font-bold mb-2">치유 대상을 선택하세요 (아군 카드 클릭)</h4>
                                 <button onClick={() => setHealTargetStep(false)} className="text-sm text-gray-400 underline">취소</button>
                             </div>
                         ) : (
                             <div className="flex gap-2 flex-wrap justify-center">
                                 {target?.id === myProfile?.id && (
                                     <>
                                        <button onClick={() => onResponse('DEFEND')} className="bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold border-b-4 border-blue-950 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2">
                                            <Shield size={16}/> 방어
                                        </button>
                                        <button onClick={() => onResponse('COUNTER')} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold border-b-4 border-red-950 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2">
                                            <Sword size={16}/> 반격
                                        </button>
                                        <button onClick={() => onResponse('FLEE')} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-bold border-b-4 border-gray-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2">
                                            <Wind size={16}/> 도주
                                        </button>
                                     </>
                                 )}
                                 
                                 {/* Cover / Heal options for others */}
                                 {myProfile && target?.id !== myProfile.id && myProfile.teamId === target?.teamId && (
                                     <button onClick={() => onResponse('COVER')} className="bg-yellow-700 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold border-b-4 border-yellow-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2">
                                         <Shield size={16}/> 대리 방어
                                     </button>
                                 )}
                                 
                                 {(target?.id === myProfile?.id || (myProfile && target?.teamId === myProfile.teamId)) && (
                                     <button onClick={() => setHealTargetStep(true)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2">
                                         <Heart size={16}/> 응급 치유
                                     </button>
                                 )}
                             </div>
                         )}
                         
                         {/* Waiting Message */}
                         {(!isMyTurn && target?.id !== myProfile?.id && !healTargetStep) && (
                             <div className="text-gray-400 text-sm animate-pulse mt-2">
                                 {target?.name}의 대응을 기다리는 중...
                             </div>
                         )}
                     </div>
                 )}

                 <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
             </div>

             {/* 3. BOTTOM: ALLIES */}
             <div className="flex-1 bg-gradient-to-t from-blue-900/20 to-transparent p-4 flex flex-col justify-end">
                <div className="flex items-end justify-center gap-2 md:gap-6 overflow-x-auto pt-4 no-scrollbar">
                    {allies.map(p => <PlayerCard key={p.id} player={p} isEnemy={false} />)}
                </div>
                <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-2">
                    <Shield size={12}/> Allies (아군)
                </h3>
             </div>

             {/* 4. FOOTER: LOGS */}
             <div className="h-32 bg-black/80 backdrop-blur-md border-t border-gray-800 p-2 relative">
                 <div className="absolute top-0 right-0 p-2 flex gap-2">
                     {/* Chat Toggle */}
                     <button 
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full border border-gray-600 relative"
                     >
                         <MessageSquare size={18} />
                         {hasNewMsg && !isChatOpen && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
                     </button>
                 </div>

                 {/* Logs Stream */}
                 <div className="h-full overflow-y-auto pr-10 text-sm space-y-1 custom-scrollbar">
                     {[...combatState.logs].reverse().map(log => (
                         <div key={log.id} className={`flex gap-2 ${log.type === 'ATTACK' ? 'text-red-300' : log.type === 'HEAL' ? 'text-green-300' : log.type === 'DEFEND' ? 'text-blue-300' : 'text-gray-400'}`}>
                             <span className="text-gray-600 text-[10px] whitespace-nowrap mt-0.5">[{new Date(log.timestamp).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                             <span>{log.text}</span>
                         </div>
                     ))}
                 </div>
             </div>

             {/* Chat Modal/Popover */}
             {isChatOpen && (
                 <div className="absolute bottom-36 right-4 w-72 h-64 bg-[#1a1a1a] border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden z-50">
                     <div className="flex border-b border-gray-700">
                        <button onClick={() => setChatChannel('TEAM')} className={`flex-1 py-1 text-xs font-bold ${chatChannel === 'TEAM' ? 'bg-blue-900/30 text-blue-300' : 'text-gray-500'}`}>팀</button>
                        <button onClick={() => setChatChannel('BLOCK')} className={`flex-1 py-1 text-xs font-bold ${chatChannel === 'BLOCK' ? 'bg-red-900/30 text-red-300' : 'text-gray-500'}`}>지역</button>
                        <button onClick={() => setIsChatOpen(false)} className="px-2 text-gray-500"><XCircle size={14}/></button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/20">
                        {filteredMessages.map(msg => (
                            <div key={msg.id} className={`text-xs ${msg.senderId === myProfile?.id ? 'text-right' : 'text-left'}`}>
                                <span className="text-[10px] text-gray-500">{msg.senderName}</span>
                                <div className={`px-2 py-1 rounded inline-block max-w-[90%] ${msg.senderId === myProfile?.id ? 'bg-blue-900/50 text-blue-100' : 'bg-gray-800 text-gray-200'}`}>{msg.text}</div>
                            </div>
                        ))}
                        <div ref={chatEndRef}></div>
                     </div>
                     <form onSubmit={handleSendChat} className="p-1 border-t border-gray-700 flex bg-[#222]">
                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="flex-1 bg-transparent text-xs text-white px-2 outline-none" placeholder="메시지..." />
                        <button type="submit" className="text-gray-400 hover:text-white px-2"><Send size={14}/></button>
                     </form>
                 </div>
             )}
        </div>
    );
};