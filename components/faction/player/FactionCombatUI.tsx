
import React, { useState } from 'react';
import { FactionPlayerProfile, CombatState } from '../../../types';
import { Sword, Heart, Shield, AlertTriangle, ArrowRight, XCircle, Wind } from 'lucide-react';

interface FactionCombatUIProps {
    myProfile: FactionPlayerProfile | null;
    players: FactionPlayerProfile[];
    combatState: CombatState;
    // Handlers
    onAction: (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => void;
    onResponse: (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', targetId?: string) => void; 
    // `targetId` in response usually implies who I heal, or redundant if self-focused. 
    // For Heal Response, we might need a target.
}

export const FactionCombatUI: React.FC<FactionCombatUIProps> = ({ 
    myProfile, players, combatState, onAction, onResponse
}) => {
    const [actionStep, setActionStep] = useState<'SELECT_ACTION' | 'SELECT_TARGET'>('SELECT_ACTION');
    const [selectedActionType, setSelectedActionType] = useState<'ATTACK' | 'HEAL' | null>(null);
    const [healTargetStep, setHealTargetStep] = useState(false); // For Heal Response

    const isMyTurn = myProfile && combatState.currentTurnPlayerId === myProfile.id;
    const activePlayer = players.find(p => p.id === combatState.currentTurnPlayerId);
    
    // -- Filtering --
    const enemies = myProfile ? players.filter(p => p.factionId !== myProfile.factionId && p.hp > 0) : [];
    const allies = myProfile ? players.filter(p => p.factionId === myProfile.factionId && p.hp > 0) : []; // Includes self

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
    const canCover = myProfile && target && myProfile.factionId === target.factionId && myProfile.id !== target.id;

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
                                        SPI 기반 회복
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
                                        대상 선택 ({selectedActionType === 'ATTACK' ? '적군' : '아군'})
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
                                        <Heart className="text-green-500"/> 치유 대상 선택 (대응 행동)
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
                                                <span className="text-[10px] text-gray-400">0 데미지 시도<br/>(판정> {20 - (Math.min(5, Math.max(1, combatState.turnCount)) * 2)})</span>
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

             {/* Log Area */}
             <div className="absolute bottom-0 w-full max-w-3xl h-48 bg-gradient-to-t from-black to-transparent p-4 pointer-events-none">
                 <div className="w-full h-full overflow-y-auto flex flex-col-reverse gap-1 mask-image-gradient">
                     {[...combatState.logs].reverse().map(log => (
                         <div key={log.id} className={`text-sm px-2 py-1 rounded backdrop-blur-sm ${log.type === 'ATTACK' ? 'text-red-300 bg-red-900/20' : log.type === 'HEAL' ? 'text-green-300 bg-green-900/20' : log.type === 'DEFEND' ? 'text-blue-300 bg-blue-900/20' : log.type === 'FLEE' ? 'text-gray-200 bg-gray-600/50' : 'text-gray-400 bg-black/40'}`}>
                             <span className="text-[10px] opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                             {log.text}
                         </div>
                     ))}
                 </div>
             </div>
        </div>
    );
};
