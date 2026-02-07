
import React, { useState } from 'react';
import { CombatGameData, CombatEntity, CombatRules, StatImpact } from '../../types';
import { ArrowLeft, User, Sword, Shield, Zap, RotateCcw, Play, Plus, Trash2, CheckCircle2, Skull, UserPlus, Users, ArrowRight, Wind, Download, Clipboard, Check } from 'lucide-react';
import { Button } from '../common/Button';
import { generateId } from '../../lib/utils';
import { resolveWeightedStatValue } from '../../lib/game-logic';

interface CombatPlayerProps {
    data: CombatGameData;
    onExit: () => void;
}

type Phase = 'SETUP' | 'BATTLE';
type TurnState = 'ACTION' | 'DODGE' | 'REACTION' | 'RESOLVE';
type ReactionType = 'DEFEND' | 'COUNTER' | 'COVER' | null;

export const CombatPlayer: React.FC<CombatPlayerProps> = ({ data, onExit }) => {
    // Phase
    const [phase, setPhase] = useState<Phase>('SETUP');
    
    // Entities
    const [entities, setEntities] = useState<CombatEntity[]>([]);
    
    // Setup Inputs
    const [newName, setNewName] = useState('');
    const [newTeam, setNewTeam] = useState<'A' | 'B'>('A');
    const [newStats, setNewStats] = useState<Record<string, number>>({});

    // Battle State
    const [turnQueue, setTurnQueue] = useState<string[]>([]); // Entity IDs
    const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
    const [turnState, setTurnState] = useState<TurnState>('ACTION');
    
    // Detailed Reaction State
    const [pendingAction, setPendingAction] = useState<{ 
        sourceId: string, 
        targetId: string, 
        originalRoll: number, 
        currentDamage: number, 
        impact?: StatImpact 
    } | null>(null);

    const [reactionType, setReactionType] = useState<ReactionType>(null);
    const [coveringEntityId, setCoveringEntityId] = useState<string | null>(null);

    const [logs, setLogs] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    // -- Derived --
    const rules: CombatRules = data.rules || { initiativeStatId: '', turnOrder: 'INDIVIDUAL', allowDefend: false, allowCounter: false, allowCover: false, allowDodge: false };
    const currentEntityId = turnQueue[currentTurnIndex];
    const currentEntity = entities.find(e => e.id === currentEntityId);

    const isEntityDead = (entity: CombatEntity) => {
        if (!rules.deathStatId) return false;
        return (entity.stats[rules.deathStatId] || 0) <= 0;
    };

    const getMappedDisplay = (statId: string, val: number) => {
        const statDef = data.stats.find(s => s.id === statId);
        const mapping = statDef?.valueMapping;
        if (!mapping) return null;
        
        let entries = mapping[val];
        if (!entries) {
            // @ts-ignore
            entries = mapping[String(val)];
        }

        if (!entries || entries.length === 0) return null;
        
        if (entries.length === 1) return `${entries[0].value}`;
        
        const min = Math.min(...entries.map(e => e.value));
        const max = Math.max(...entries.map(e => e.value));
        if (min === max) return `${min}`;
        return `${min}~${max}`;
    };

    const handleAddEntity = () => {
        if(!newName.trim()) return;
        const initialStats: Record<string, number> = {};
        
        data.stats.forEach(s => {
            const rawVal = newStats[s.id] ?? s.defaultValue;
            
            // If the stat is marked as lookup mode, resolve its value immediately during initialization
            if (s.isValueLookup) {
                initialStats[s.id] = resolveWeightedStatValue(rawVal, s.valueMapping);
            } else {
                initialStats[s.id] = rawVal;
            }
        });

        const newEntity: CombatEntity = {
            id: generateId(),
            name: newName,
            team: newTeam,
            stats: initialStats
        };

        setEntities([...entities, newEntity]);
        setNewName('');
        setNewStats({});
    };

    const handleRemoveEntity = (id: string) => {
        setEntities(entities.filter(e => e.id !== id));
    };

    const handleStartBattle = () => {
        if (entities.length < 2) {
            alert("최소 2명의 참가자가 필요합니다.");
            return;
        }

        let order: string[] = [];
        const initStat = rules.initiativeStatId;

        if (rules.turnOrder === 'TEAM_SUM' && initStat) {
            const sumA = entities.filter(e => e.team === 'A').reduce((acc, e) => acc + (e.stats[initStat] || 0), 0);
            const sumB = entities.filter(e => e.team === 'B').reduce((acc, e) => acc + (e.stats[initStat] || 0), 0);
            const teamAIds = entities.filter(e => e.team === 'A').sort((a,b) => (b.stats[initStat]||0) - (a.stats[initStat]||0)).map(e => e.id);
            const teamBIds = entities.filter(e => e.team === 'B').sort((a,b) => (b.stats[initStat]||0) - (a.stats[initStat]||0)).map(e => e.id);
            if (sumA >= sumB) order = [...teamAIds, ...teamBIds];
            else order = [...teamBIds, ...teamAIds];
            addLog(`⚡ 팀 합산 선공 결정! (A: ${sumA} vs B: ${sumB}) -> ${sumA >= sumB ? 'A팀' : 'B팀'} 선공`);
        } else {
            order = [...entities].sort((a, b) => {
                const valA = initStat ? (a.stats[initStat] || 0) : Math.random();
                const valB = initStat ? (b.stats[initStat] || 0) : Math.random();
                return valB - valA;
            }).map(e => e.id);
            addLog(`⚡ 개별 선공 결정 완료.`);
        }

        setTurnQueue(order);
        setCurrentTurnIndex(0);
        setTurnState('ACTION');
        setPhase('BATTLE');
        addLog(`⚔️ 전투 시작! 첫 턴: ${entities.find(e => e.id === order[0])?.name}`);
    };

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    const handleExportLogs = () => {
        if (logs.length === 0) return;
        const text = logs.slice().reverse().join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Combat_Log_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopyLogs = () => {
        if (logs.length === 0) return;
        const text = logs.slice().reverse().join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAction = (statId: string, targetId: string) => {
        if (!currentEntity) return;
        const statDef = data.stats.find(s => s.id === statId);
        if (!statDef) return;

        const statVal = currentEntity.stats[statId] || 0;
        
        // If stat is lookup, use value directly. If not, resolve weighted roll.
        const roll = statDef.isValueLookup ? statVal : resolveWeightedStatValue(statVal, statDef.valueMapping);
        
        const impact = statDef.impacts?.[0]; 

        if (impact && impact.operation === 'SUBTRACT') {
            setPendingAction({ 
                sourceId: currentEntity.id, 
                targetId, 
                originalRoll: roll, 
                currentDamage: roll, 
                impact 
            });
            setReactionType(null); 
            setCoveringEntityId(null);
            
            if (rules.allowDodge) {
                setTurnState('DODGE');
                addLog(`${currentEntity.name} 공격(위력:${roll})! -> 회피 판정 대기`);
            } else if (rules.allowDefend || rules.allowCounter || rules.allowCover) {
                setTurnState('REACTION');
                addLog(`${currentEntity.name} 공격(위력:${roll})! -> 대응 선택 대기`);
            } else {
                resolveAction(targetId, roll, impact);
            }
        } else {
            resolveAction(targetId, roll, impact);
        }
    };

    const handleDodge = () => {
        if (!pendingAction) return;
        const defender = entities.find(e => e.id === pendingAction.targetId);
        if (!defender) return;

        const dodgeStatId = rules.dodgeStatId;
        if (!dodgeStatId) {
            alert("회피에 사용할 스탯이 설정되지 않았습니다.");
            return;
        }
        
        const statDef = data.stats.find(s => s.id === dodgeStatId);
        const statVal = defender.stats[dodgeStatId] || 0;
        
        const dodgeChance = statDef?.isValueLookup ? statVal : resolveWeightedStatValue(statVal, statDef?.valueMapping);
        const randomRoll = Math.random() * 100;
        const isSuccess = randomRoll <= dodgeChance;

        if (isSuccess) {
            addLog(`💨 [회피 성공] 회피율 ${dodgeChance}% (Roll: ${randomRoll.toFixed(1)}) -> 데미지 무효화!`);
            setPendingAction(prev => prev ? ({ ...prev, currentDamage: 0 }) : null);
        } else {
            addLog(`💥 [회피 실패] 회피율 ${dodgeChance}% (Roll: ${randomRoll.toFixed(1)}) -> 실패`);
        }

        if (rules.allowDefend || rules.allowCounter || rules.allowCover) {
            setTurnState('REACTION');
        } else {
            resolveAction(pendingAction.targetId, isSuccess ? 0 : pendingAction.currentDamage, pendingAction.impact);
        }
    };

    const handleReactionSelect = (type: ReactionType) => {
        setReactionType(type);
        if (type !== 'COVER') setCoveringEntityId(null);
    };

    const handleCoverSelect = (allyId: string) => {
        setReactionType('COVER');
        setCoveringEntityId(allyId);
    };

    const executeReaction = () => {
        if (!pendingAction || !reactionType) return;
        
        const rollerId = reactionType === 'COVER' ? coveringEntityId : pendingAction.targetId;
        const roller = entities.find(e => e.id === rollerId);
        if (!roller) return;

        let rollStatId = '';
        if (reactionType === 'DEFEND') rollStatId = rules.defenseStatId || '';
        else if (reactionType === 'COUNTER') rollStatId = rules.counterStatId || '';
        else if (reactionType === 'COVER') rollStatId = rules.coverStatId || '';

        if (!rollStatId) {
            alert("해당 대응 행동에 대한 스탯이 규칙에 설정되지 않았습니다.");
            return;
        }

        const statDef = data.stats.find(s => s.id === rollStatId);
        if (!statDef) return;

        const rollVal = roller.stats[rollStatId] || 0;
        const reactionRoll = statDef.isValueLookup ? rollVal : resolveWeightedStatValue(rollVal, statDef.valueMapping);
        
        const incomingDmg = pendingAction.currentDamage;

        if (reactionType === 'DEFEND') {
            const reducedDmg = Math.max(0, incomingDmg - reactionRoll);
            addLog(`🛡️ [방어] ${roller.name}의 ${statDef.label} 판정(${reactionRoll}): 데미지 ${incomingDmg} -> ${reducedDmg}`);
            resolveAction(pendingAction.targetId, reducedDmg, pendingAction.impact);
        } else if (reactionType === 'COUNTER') {
            addLog(`⚔️ [반격] ${roller.name}의 ${statDef.label} 판정(${reactionRoll})으로 반격!`);
            resolveAction(pendingAction.targetId, incomingDmg, pendingAction.impact, false); 
            resolveAction(pendingAction.sourceId, reactionRoll, pendingAction.impact, true);
        } else if (reactionType === 'COVER') {
            const reducedDmg = Math.max(0, incomingDmg - reactionRoll);
            addLog(`🛡️ [대리방어] ${roller.name}가 ${entities.find(e => e.id === pendingAction.targetId)?.name}을(를) 대신하여 맞습니다! (${statDef.label} 판정 ${reactionRoll}): 데미지 ${reducedDmg}`);
            resolveAction(rollerId!, reducedDmg, pendingAction.impact);
        }
    };

    const skipReaction = () => {
        if(pendingAction) {
            addLog(`💥 반응하지 않고 그대로 맞습니다.`);
            resolveAction(pendingAction.targetId, pendingAction.currentDamage, pendingAction.impact);
        }
    };

    const resolveAction = (targetId: string, amount: number, impact?: StatImpact, isTurnEnd = true) => {
        if (impact) {
            const targetEntity = entities.find(e => e.id === targetId);
            const targetStatDef = data.stats.find(s => s.id === impact.targetStatId);
            
            if (targetEntity && targetStatDef) {
                const currentVal = targetEntity.stats[impact.targetStatId] || 0;
                let newVal: number = currentVal;
                
                if (impact.operation === 'SUBTRACT') {
                    const minLimit = (rules.deathStatId === impact.targetStatId) ? 0 : targetStatDef.min;
                    newVal = Math.max(minLimit, currentVal - amount);
                    addLog(`🩸 ${targetEntity.name}의 ${targetStatDef.label} -${amount} (${currentVal} -> ${newVal})`);
                    
                    if (rules.deathStatId === impact.targetStatId && newVal <= 0) {
                        addLog(`💀 [사망] ${targetEntity.name}이(가) 쓰러졌습니다!`);
                    }
                } else {
                    if (rules.deathStatId === impact.targetStatId) {
                         newVal = currentVal + amount; 
                    } else {
                         newVal = Math.min(targetStatDef.max, currentVal + amount);
                    }
                    addLog(`✨ ${targetEntity.name}의 ${targetStatDef.label} +${amount} (${currentVal} -> ${newVal})`);
                }

                setEntities(prev => prev.map(e => e.id === targetId ? { ...e, stats: { ...e.stats, [impact.targetStatId]: newVal } } : e));
            }
        } else {
            addLog(`🎲 ${currentEntity?.name}의 행동 결과: ${amount} (효과 없음)`);
        }

        if (isTurnEnd) nextTurn();
    };

    const nextTurn = () => {
        setPendingAction(null);
        setReactionType(null);
        setCoveringEntityId(null);
        setTurnState('ACTION');
        
        let nextIndex = currentTurnIndex;
        let loopCount = 0;
        let found = false;

        while(loopCount < turnQueue.length) {
            nextIndex = (nextIndex + 1) % turnQueue.length;
            const nextEntityId = turnQueue[nextIndex];
            const nextEntity = entities.find(e => e.id === nextEntityId);
            
            if (nextEntity && !isEntityDead(nextEntity)) {
                found = true;
                break;
            }
            loopCount++;
        }

        if (!found) {
            addLog(`🏁 생존자가 없습니다. 전투 종료?`);
        } else {
            setCurrentTurnIndex(nextIndex);
            const nextEntityId = turnQueue[nextIndex];
            const nextEnt = entities.find(e => e.id === nextEntityId);
            addLog(`⏩ 다음 턴: ${nextEnt?.name}`);
        }
    };

    const getPossibleCovers = (targetId: string) => {
        const target = entities.find(e => e.id === targetId);
        if(!target) return [];
        return entities.filter(e => e.team === target.team && e.id !== target.id && !isEntityDead(e));
    };

    return (
        <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 font-sans">
            <div className="h-14 bg-[#252525] border-b border-[#444] flex items-center justify-between px-6 shrink-0 shadow-md">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="text-gray-400 hover:text-white flex items-center gap-1"><ArrowLeft size={18} /> 종료</button>
                    <h1 className="font-bold text-lg text-rose-400">{data.title} - {phase === 'SETUP' ? '참가자 설정' : '전투 진행'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {phase === 'BATTLE' && (
                        <>
                            <button 
                                onClick={handleCopyLogs}
                                className="text-xs bg-[#333] text-gray-300 px-3 py-1.5 rounded hover:bg-[#444] flex items-center gap-1.5 transition-colors border border-[#555]"
                            >
                                {copied ? <Check size={14} className="text-green-400" /> : <Clipboard size={14} />}
                                로그 복사
                            </button>
                            <button 
                                onClick={handleExportLogs}
                                className="text-xs bg-[#333] text-gray-300 px-3 py-1.5 rounded hover:bg-[#444] flex items-center gap-1.5 transition-colors border border-[#555]"
                            >
                                <Download size={14} />
                                다운로드 (.txt)
                            </button>
                            <div className="h-4 w-px bg-[#444] mx-1"></div>
                            <button onClick={() => setPhase('SETUP')} className="text-xs bg-rose-900/30 text-rose-300 px-3 py-1.5 rounded hover:bg-rose-900/50 border border-rose-800/50">설정으로 복귀</button>
                        </>
                    )}
                </div>
            </div>

            {phase === 'SETUP' && (
                <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-[#252525] p-6 rounded-xl border border-[#444] shadow-lg h-fit">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserPlus/> 참가자 추가</h3>
                            <div className="space-y-4">
                                <input 
                                    type="text" 
                                    placeholder="이름" 
                                    value={newName} 
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-[#333] border border-[#555] rounded px-3 py-2 text-white outline-none"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setNewTeam('A')} className={`flex-1 py-2 rounded font-bold transition-all ${newTeam === 'A' ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-500'}`}>A팀 (Blue)</button>
                                    <button onClick={() => setNewTeam('B')} className={`flex-1 py-2 rounded font-bold transition-all ${newTeam === 'B' ? 'bg-red-600 text-white' : 'bg-[#333] text-gray-500'}`}>B팀 (Red)</button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar border-t border-[#444] pt-2">
                                    <p className="text-xs text-gray-500 font-bold mb-2">초기 스탯 설정</p>
                                    {data.stats.map(s => (
                                        <div key={s.id} className="flex flex-col gap-1 mb-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-300">{s.label} ({s.min}~{s.max} 단계)</span>
                                                <input 
                                                    type="number"
                                                    value={newStats[s.id] ?? s.defaultValue}
                                                    onChange={(e) => setNewStats({...newStats, [s.id]: parseInt(e.target.value)})}
                                                    className="w-16 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-center text-white"
                                                />
                                            </div>
                                            {s.isValueLookup && (
                                                <div className="text-[10px] text-gray-500 bg-black/20 p-1 rounded italic">
                                                    * 변환 값: {getMappedDisplay(s.id, newStats[s.id] ?? s.defaultValue) || '-'}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button fullWidth onClick={handleAddEntity} icon={Plus}>추가하기</Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex-1 bg-[#1e1e1e] p-4 rounded-xl border border-[#444] overflow-y-auto max-h-[500px]">
                                <h3 className="font-bold text-gray-400 mb-3 flex justify-between">
                                    <span>참가자 목록 ({entities.length})</span>
                                </h3>
                                {entities.length === 0 && <p className="text-gray-600 text-center py-4">참가자가 없습니다.</p>}
                                {entities.map(ent => (
                                    <div key={ent.id} className={`flex justify-between items-center p-3 mb-2 rounded border ${ent.team === 'A' ? 'bg-blue-900/20 border-blue-900/50' : 'bg-red-900/20 border-red-900/50'}`}>
                                        <div>
                                            <span className={`font-bold mr-2 ${ent.team === 'A' ? 'text-blue-400' : 'text-red-400'}`}>{ent.team}팀</span>
                                            <span className="font-bold text-white">{ent.name}</span>
                                        </div>
                                        <button onClick={() => handleRemoveEntity(ent.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                            <Button fullWidth variant="primary" onClick={handleStartBattle} icon={Play} className="py-4 text-lg">전투 시작</Button>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'BATTLE' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        <div className="w-full md:w-1/3 bg-[#252525] p-4 border-r border-[#444] flex flex-col relative overflow-y-auto">
                            <div className="mb-4 bg-black/40 p-3 rounded-lg border border-[#444] flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-gray-500 font-bold block">현재 턴</span>
                                    <span className={`text-xl font-bold ${currentEntity?.team === 'A' ? 'text-blue-400' : 'text-red-400'}`}>{currentEntity?.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-500 block">상태</span>
                                    <span className={`text-sm font-bold ${turnState === 'ACTION' ? 'text-yellow-400' : (turnState === 'DODGE' ? 'text-emerald-400' : 'text-red-400')}`}>
                                        {turnState === 'ACTION' ? '행동 중' : (turnState === 'DODGE' ? '회피 판정' : '대응 선택')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {turnState === 'ACTION' && currentEntity && (
                                    <div className="space-y-4 animate-fade-in">
                                        <p className="text-sm text-gray-400 font-bold mb-2">사용할 스탯 (행동)</p>
                                        {data.stats.map(s => {
                                            const statVal = currentEntity.stats[s.id];
                                            const displayPower = getMappedDisplay(s.id, statVal);

                                            return (
                                                <div key={s.id} className="bg-[#333] p-3 rounded border border-[#555] hover:border-gray-400 transition-colors group">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-gray-200">{s.label}</span>
                                                        <div className="text-right">
                                                            <span className="font-mono text-lg">{statVal}</span>
                                                            {displayPower && !s.isValueLookup && (
                                                                <span className="text-xs text-gray-400 block">
                                                                    (위력: {displayPower})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {s.impacts && s.impacts.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                                            {entities.filter(e => e.id !== currentEntity.id && !isEntityDead(e)).map(target => (
                                                                <button 
                                                                    key={target.id}
                                                                    onClick={() => handleAction(s.id, target.id)}
                                                                    className={`text-xs py-2 rounded font-bold border transition-all ${target.team !== currentEntity.team ? 'bg-red-900/40 text-red-200 border-red-800 hover:bg-red-800' : 'bg-blue-900/40 text-blue-200 border-blue-800 hover:bg-blue-800'}`}
                                                                >
                                                                    {target.name}에게 사용
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => handleAction(s.id, currentEntity.id)} className="w-full py-2 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white">단독 판정 (Roll)</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <button onClick={nextTurn} className="w-full py-3 border border-gray-600 text-gray-400 rounded hover:bg-[#333] mt-4">턴 넘기기</button>
                                    </div>
                                )}

                                {turnState === 'DODGE' && pendingAction && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-emerald-900/20 border border-emerald-500 p-4 rounded-xl text-center">
                                            <h3 className="text-emerald-400 font-bold mb-1">💨 회피 판정!</h3>
                                            <div className="text-white text-sm">
                                                <span className="font-bold text-lg">{entities.find(e => e.id === pendingAction.targetId)?.name}</span>
                                                <div className="text-xs text-gray-300 mt-1">들어오는 공격: <span className="font-mono text-lg font-bold text-red-400">{pendingAction.originalRoll}</span></div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleDodge}
                                            className="w-full py-4 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            <Wind size={24} /> 회피 시도
                                        </button>
                                    </div>
                                )}

                                {turnState === 'REACTION' && pendingAction && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-red-900/20 border border-red-500 p-4 rounded-xl text-center">
                                            <h3 className="text-red-400 font-bold mb-1">⚠️ 대응 선택!</h3>
                                            <div className="text-white text-sm">
                                                <span className="font-bold text-lg">{entities.find(e => e.id === pendingAction.targetId)?.name}</span>
                                                <div className="text-xs text-red-300 mt-1">
                                                    예상 데미지: <span className="font-mono text-lg font-bold">
                                                        {pendingAction.currentDamage === 0 ? "0 (회피 성공)" : pendingAction.currentDamage}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {!reactionType && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {rules.allowDefend && (
                                                    <button onClick={() => handleReactionSelect('DEFEND')} className="py-3 bg-blue-700 hover:bg-blue-600 rounded text-white font-bold flex items-center justify-center gap-2">
                                                        <Shield size={18}/> 방어 (데미지 감소)
                                                    </button>
                                                )}
                                                {rules.allowCounter && (
                                                    <button onClick={() => handleReactionSelect('COUNTER')} className="py-3 bg-red-700 hover:bg-red-600 rounded text-white font-bold flex items-center justify-center gap-2">
                                                        <Sword size={18}/> 반격 (맞고 때리기)
                                                    </button>
                                                )}
                                                {rules.allowCover && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-400 font-bold px-1 mt-2">대리 방어 (아군 선택)</p>
                                                        {getPossibleCovers(pendingAction.targetId).length === 0 && <div className="text-xs text-gray-600 px-2">가능한 아군 없음</div>}
                                                        {getPossibleCovers(pendingAction.targetId).map(ally => (
                                                            <button key={ally.id} onClick={() => handleCoverSelect(ally.id)} className="w-full py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-white text-xs font-bold flex items-center justify-center gap-2">
                                                                <Users size={14}/> {ally.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <button onClick={skipReaction} className="py-3 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 font-bold flex items-center justify-center gap-2 mt-2">
                                                    <Skull size={18}/> 반응 안함 (그대로 맞기)
                                                </button>
                                            </div>
                                        )}

                                        {reactionType && (
                                            <div className="bg-[#333] p-3 rounded border border-gray-500 animate-fade-in">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-bold text-white text-sm">
                                                        {reactionType === 'COVER' ? `${entities.find(e=>e.id===coveringEntityId)?.name}의 행동` : `${entities.find(e=>e.id===pendingAction.targetId)?.name}의 행동`}
                                                    </span>
                                                    <button onClick={() => { setReactionType(null); setCoveringEntityId(null); }} className="text-xs text-gray-400 underline">취소</button>
                                                </div>
                                                <button onClick={executeReaction} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-bold shadow-lg">확정</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[#1a1a1a]">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                                {entities.map(ent => {
                                    const dead = isEntityDead(ent);
                                    return (
                                        <div key={ent.id} className={`relative p-3 rounded-xl border-2 transition-all ${ent.id === currentEntityId ? 'scale-105 shadow-xl z-10' : 'opacity-80'} ${ent.team === 'A' ? 'bg-blue-900/20 border-blue-600' : 'bg-red-900/20 border-red-600'} ${dead ? 'grayscale opacity-50 border-gray-600 bg-gray-900' : ''}`}>
                                            {ent.id === currentEntityId && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-bold text-[10px] px-2 rounded-full">TURN</div>}
                                            {dead && <div className="absolute inset-0 flex items-center justify-center z-20"><Skull size={48} className="text-gray-500 opacity-80" /></div>}
                                            
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-3 h-3 rounded-full ${ent.team === 'A' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                                <span className={`font-bold truncate text-sm ${dead ? 'line-through text-gray-500' : 'text-white'}`}>{ent.name}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {Object.entries(ent.stats).map(([k, v]) => {
                                                    const val = v as number;
                                                    const def = data.stats.find(s => s.id === k);
                                                    return (
                                                        <div key={k} className="flex justify-between text-xs text-gray-400">
                                                            <span className={k === rules.deathStatId ? 'text-red-400 font-bold' : ''}>{def?.label}</span>
                                                            <span className={`font-mono ${k === rules.deathStatId && val <= 0 ? 'text-red-600' : 'text-white'}`}>{val}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="h-72 bg-black border-t-2 border-[#444] p-4 overflow-y-auto font-mono shadow-2xl z-10 shrink-0">
                        <div className="flex flex-col-reverse justify-end min-h-full">
                             {logs.map((log, i) => (
                                <div key={i} className="text-gray-200 text-base md:text-lg border-b border-gray-800/50 pb-1 mb-1 leading-snug">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
