
import { useState, useEffect, useCallback } from 'react';
import { GlobalCombatState, CombatSession, FactionPlayerProfile, CombatLogEntry, FactionGameData, FactionMap } from '../../../types';
import { generateId } from '../../../lib/utils';
import { rollFactionAttack, rollFactionHeal, rollFactionDefend, rollFactionFlee } from '../../../lib/game-logic';
import { useNetwork } from '../../../hooks/useNetwork';

interface UseCombatSystemProps {
    network: ReturnType<typeof useNetwork>;
    players: FactionPlayerProfile[];
    myProfile: FactionPlayerProfile | null;
    isAdmin: boolean;
    selectedAdminPlayer: FactionPlayerProfile | undefined;
    broadcastProfileUpdate: (profile: FactionPlayerProfile) => void;
    updateMapData: (newMaps: FactionMap[]) => void;
    data: FactionGameData;
    currentMap: FactionMap | undefined;
}

export const useCombatSystem = ({ 
    network, players, myProfile, isAdmin, selectedAdminPlayer, 
    broadcastProfileUpdate, updateMapData, data, currentMap 
}: UseCombatSystemProps) => {
    const { broadcast, sendToHost, networkMode } = network;
    const [combatState, setCombatState] = useState<GlobalCombatState>({});
    const [adminCombatViewOpen, setAdminCombatViewOpen] = useState(false);

    // -- Derived Visibility --
    const relevantBlockId = isAdmin 
        ? (selectedAdminPlayer?.currentBlockId) 
        : (myProfile?.currentBlockId);

    const activeSession = relevantBlockId ? combatState[relevantBlockId] : undefined;
    const isCombatActiveInRelevantBlock = !!activeSession?.isActive;

    const showCombatUI = isCombatActiveInRelevantBlock && activeSession && (
        (isAdmin && adminCombatViewOpen) || 
        (!isAdmin && myProfile?.currentBlockId === activeSession.combatBlockId)
    );

    // Auto-open Admin View
    useEffect(() => {
        if (isAdmin && activeSession?.isActive) {
            if (activeSession.turnCount === 1 && activeSession.logs.length <= 1) {
                setAdminCombatViewOpen(true);
            }
        } else if (!isCombatActiveInRelevantBlock) {
            setAdminCombatViewOpen(false);
        }
    }, [isCombatActiveInRelevantBlock, isAdmin]); // Keep deps minimal to avoid loops

    // -- Sync Logic --
    const syncCombatState = useCallback((newState: GlobalCombatState) => {
        setCombatState(newState);
        if (networkMode === 'HOST') {
            broadcast({ type: 'SYNC_COMBAT_STATE', state: newState });
        } else {
            sendToHost({ type: 'SYNC_COMBAT_STATE', state: newState });
        }
    }, [networkMode, broadcast, sendToHost]);

    // -- Combat Core Functions --

    const endCombat = (blockId: string, winnerFactionId: string | null, loserFactionId: string | null, reason: string) => {
        const session = combatState[blockId];
        if (!session) return;
  
        let finalLogs = [...session.logs, { id: generateId(), timestamp: Date.now(), text: `🏁 전투 종료! (${reason})`, type: 'SYSTEM' as const }];
        const winnerFaction = data.factions.find(f => f.id === winnerFactionId);
        const loserFaction = data.factions.find(f => f.id === loserFactionId);
        
        if (winnerFaction) {
            finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `🏆 승리: ${winnerFaction.name}`, type: 'SYSTEM' });
            if (currentMap && blockId) {
                const newBlocks = currentMap.blocks.map(b => b.id === blockId ? { ...b, ownerId: winnerFactionId!, occupationProgress: 0 } : b);
                const newMap = { ...currentMap, blocks: newBlocks };
                updateMapData(data.maps.map(m => m.id === currentMap.id ? newMap : m));
            }
        }
  
        if (loserFaction) {
             finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `💀 패배/도주: ${loserFaction.name}`, type: 'SYSTEM' });
             if (currentMap) {
                 const unoccupiedBlocks = currentMap.blocks.filter(b => !b.ownerId);
                 const targetPool = unoccupiedBlocks.length > 0 ? unoccupiedBlocks : currentMap.blocks;
                 const losers = players.filter(p => p.factionId === loserFactionId && p.currentBlockId === blockId);
                 
                 const randomBlock = targetPool[Math.floor(Math.random() * targetPool.length)];
                 
                 losers.forEach(loser => {
                     broadcastProfileUpdate({ ...loser, currentBlockId: randomBlock.id });
                 });
             }
        }
  
        const newGlobalState = { ...combatState };
        delete newGlobalState[blockId];
        syncCombatState(newGlobalState);
    };

    const checkCombatVictory = (blockId: string, session: CombatSession) => {
        const combatLocId = blockId;
        const combatants = players.filter(p => p.currentBlockId === combatLocId);
        const factionsInvolved = Array.from(new Set(combatants.map(p => p.factionId)));
        
        if (factionsInvolved.length < 2) return; 
        
        const factionStats = factionsInvolved.map(fid => {
            const members = combatants.filter(p => p.factionId === fid);
            const activeMembers = members.filter(p => p.hp > 0 && !session.fledPlayerIds.includes(p.id));
            return { fid, activeCount: activeMembers.length, members };
        });
        const survivingFactions = factionStats.filter(f => f.activeCount > 0);
        if (survivingFactions.length === 1) {
            const winner = survivingFactions[0];
            const loser = factionStats.find(f => f.fid !== winner.fid);
            endCombat(blockId, winner.fid, loser?.fid || null, "적군 전멸/도주");
            return;
        }
        if (survivingFactions.length === 0) { endCombat(blockId, null, null, "무승부 (전원 불능)"); return; }
        if (session.turnCount > 5) {
            let minDamage = Infinity; let winnerId = null; let loserId = null;
            factionsInvolved.forEach(fid => {
                 const dmg = session.factionDamage[fid] || 0;
                 if (dmg < minDamage) { minDamage = dmg; winnerId = fid; } else { loserId = fid; }
            });
            if (winnerId) { endCombat(blockId, winnerId, loserId, "5턴 종료 (피해량 판정)"); } else { endCombat(blockId, null, null, "5턴 종료 (피해량 동점)"); }
        }
    };

    const toggleCombat = () => {
        let combatLocId: string | undefined;
        if (isAdmin && selectedAdminPlayer) {
            combatLocId = selectedAdminPlayer.currentBlockId;
        } else {
            combatLocId = myProfile?.currentBlockId;
        }
  
        if (!combatLocId) {
            alert("대상 위치를 찾을 수 없습니다.");
            return;
        }
  
        const combatPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0);
        if (combatPlayers.length === 0) return;
  
        const existingSession = combatState[combatLocId];
  
        if (!existingSession?.isActive) {
            // Start
            const factionsInvolved = Array.from(new Set(combatPlayers.map(p => p.factionId)));
            const factionInitiative = factionsInvolved.map(fid => {
                const members = combatPlayers.filter(p => p.factionId === fid);
                const totalAgility = members.reduce((sum, p) => sum + p.stats.agility, 0);
                const sortedMembers = [...members].sort((a, b) => b.stats.agility - a.stats.agility);
                return { fid, totalAgility, members: sortedMembers };
            });
            factionInitiative.sort((a, b) => b.totalAgility - a.totalAgility);
            const turnOrder = factionInitiative.flatMap(f => f.members.map(p => p.id));
            const firstPlayerId = turnOrder[0];
  
            const newSession: CombatSession = {
                isActive: true, 
                currentTurnPlayerId: firstPlayerId, 
                combatBlockId: combatLocId,
                turnCount: 1, 
                phase: 'ACTION', 
                pendingAction: null,
                logs: [{ id: generateId(), timestamp: Date.now(), text: "⚠️ 전투가 시작되었습니다! 민첩 총합이 높은 진영이 선공을 가져갑니다.", type: 'SYSTEM' }], 
                factionDamage: {}, 
                fledPlayerIds: [],
                turnOrder
            };
            syncCombatState({ ...combatState, [combatLocId]: newSession });
  
        } else {
            // Stop
            const newGlobalState = { ...combatState };
            delete newGlobalState[combatLocId];
            syncCombatState(newGlobalState);
        }
    };

    const resolveTurn = (targetBlockId?: string, extraLogs: CombatLogEntry[] = [], damageUpdates: Record<string, number> = {}) => {
        const blockId = targetBlockId || (isAdmin ? selectedAdminPlayer?.currentBlockId : myProfile?.currentBlockId);
        if (!blockId) return;
  
        const session = combatState[blockId];
        if (!session || !session.isActive) return;
        if (players.length === 0) return;
  
        const { turnOrder } = session;
        if (turnOrder.length === 0) return;
  
        const currentIdx = turnOrder.indexOf(session.currentTurnPlayerId || '');
        
        let nextIdx = currentIdx;
        let nextPlayerId = null;
        let loops = 0;
        let nextTurnCount = session.turnCount;
        let found = false;
        let isRoundOver = false;
  
        // Find next valid player
        while (!found && loops < turnOrder.length + 1) {
            nextIdx = (nextIdx + 1) % turnOrder.length;
            
            if (nextIdx === 0) {
                nextTurnCount++;
                isRoundOver = true;
            }
  
            const pid = turnOrder[nextIdx];
            const player = players.find(p => p.id === pid);
            
            if (player && player.hp > 0 && player.currentBlockId === blockId && !session.fledPlayerIds.includes(player.id)) {
                nextPlayerId = pid;
                found = true;
            }
            loops++;
        }
  
        if (!found || !nextPlayerId) { 
            endCombat(blockId, null, null, "전투원 없음 (전원 불능/도주)"); 
            return; 
        }
        
        const newFactionDamage = { ...session.factionDamage };
        Object.entries(damageUpdates).forEach(([fid, amt]) => {
            newFactionDamage[fid] = (newFactionDamage[fid] || 0) + amt;
        });
  
        // PAUSE if Round Over
        if (isRoundOver) {
            if (nextTurnCount > 5) {
                const updatedSessionForEnd = { ...session, factionDamage: newFactionDamage, turnCount: nextTurnCount };
                checkCombatVictory(blockId, updatedSessionForEnd);
                return;
            }
  
            const updatedSession: CombatSession = {
                ...session, 
                currentTurnPlayerId: null, // Paused
                turnCount: nextTurnCount, 
                phase: 'ACTION', 
                pendingAction: null,
                factionDamage: newFactionDamage,
                logs: [...session.logs, ...extraLogs, { id: generateId(), timestamp: Date.now(), text: `⏳ 라운드 종료. 전체 턴(Global Turn) 대기 중...`, type: 'SYSTEM' as const }]
            };
            syncCombatState({ ...combatState, [blockId]: updatedSession });
  
        } else {
            const nextPlayer = players.find(p => p.id === nextPlayerId);
            const updatedSession: CombatSession = {
                ...session, 
                currentTurnPlayerId: nextPlayerId, 
                turnCount: nextTurnCount, 
                phase: 'ACTION', 
                pendingAction: null,
                factionDamage: newFactionDamage,
                logs: [...session.logs, ...extraLogs, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer?.name}의 차례 (Round ${nextTurnCount})`, type: 'SYSTEM' as const }]
            };
            syncCombatState({ ...combatState, [blockId]: updatedSession });
        }
    };

    const handleCombatAction = (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => {
        if (!myProfile) return;
        const source = myProfile;
        const blockId = source.currentBlockId;
        if (!blockId) return;
  
        const session = combatState[blockId];
        if (!session) return;
  
        const target = players.find(p => p.id === targetId);
        if (!target && type !== 'FLEE') return;
  
        if (type === 'HEAL' && target) {
            const { success, checkRoll, checkThreshold, healAmount, healDie } = rollFactionHeal(source.stats.spirit);
            let logText = "";
            if (success) {
                 const newTarget = { ...target, hp: Math.min(target.maxHp, target.hp + healAmount) };
                 broadcastProfileUpdate(newTarget);
                 logText = `✨ [${source.name}] 치유 성공! (1D20=${checkRoll} > ${checkThreshold}) ➔ [${target.name}] +${healAmount} (1D${healDie})`;
            } else { 
                 logText = `💦 [${source.name}] 치유 실패... (1D20=${checkRoll} ≤ ${checkThreshold})`; 
            }
            const newLog: CombatLogEntry = { id: generateId(), timestamp: Date.now(), text: logText, type: 'HEAL' };
            resolveTurn(blockId, [newLog]);
  
        } else if (type === 'ATTACK' && target) {
            const { roll, maxDie } = rollFactionAttack(source.stats.attack);
            const newSession: CombatSession = {
                ...session, phase: 'RESPONSE', pendingAction: { type: 'ATTACK', sourceId: source.id, targetId: target.id, damageValue: roll, maxDie },
                logs: [...session.logs, { id: generateId(), timestamp: Date.now(), text: `⚔️ [${source.name}] 공격 ➔ [${target.name}] 데미지 ${roll} (1D${maxDie})! 대응하세요!`, type: 'ATTACK' }]
            };
            syncCombatState({ ...combatState, [blockId]: newSession });
  
        } else if (type === 'FLEE') {
            const { success, roll, threshold } = rollFactionFlee(session.turnCount);
            let logText = "";
            let extraLog: CombatLogEntry;
            
            if (success) {
                logText = `💨 [${source.name}] 전투 이탈 성공! (1D20=${roll} > ${threshold})`;
                extraLog = { id: generateId(), timestamp: Date.now(), text: logText, type: 'FLEE' };
                
                const newSession = { ...session, fledPlayerIds: [...session.fledPlayerIds, source.id] };
                // Optimistic update for calculation
                const tempState = { ...combatState, [blockId]: newSession };
                
                // --- Logic to find next player (Duplicated from resolveTurn due to sync issues if calling direct) ---
                const { turnOrder } = newSession;
                let nextIdx = turnOrder.indexOf(newSession.currentTurnPlayerId || '');
                let nextPlayerId = null;
                let loops = 0;
                let nextTurnCount = newSession.turnCount;
                let found = false;
                let isRoundOver = false;
                
                while (!found && loops < turnOrder.length + 1) {
                    nextIdx = (nextIdx + 1) % turnOrder.length;
                    if (nextIdx === 0) { nextTurnCount++; isRoundOver = true; }
                    const pid = turnOrder[nextIdx];
                    const player = players.find(p => p.id === pid);
                    if (player && player.hp > 0 && player.currentBlockId === blockId && !newSession.fledPlayerIds.includes(player.id)) {
                        nextPlayerId = pid; found = true;
                    }
                    loops++;
                }
                
                 if (!found || !nextPlayerId) { 
                     endCombat(blockId, null, null, "전투원 없음 (전원 불능/도주)"); 
                     return; 
                 }
                 
                 if (isRoundOver) {
                     if (nextTurnCount > 5) {
                         checkCombatVictory(blockId, { ...newSession, turnCount: nextTurnCount });
                         return;
                     }
                     const finalSession: CombatSession = {
                         ...newSession, currentTurnPlayerId: null, turnCount: nextTurnCount, phase: 'ACTION', pendingAction: null,
                         logs: [...newSession.logs, extraLog, { id: generateId(), timestamp: Date.now(), text: `⏳ 라운드 종료. 전체 턴(Global Turn) 대기 중...`, type: 'SYSTEM' }]
                     };
                     syncCombatState({ ...combatState, [blockId]: finalSession });
  
                 } else {
                     const nextPlayer = players.find(p => p.id === nextPlayerId);
                     const finalSession: CombatSession = {
                         ...newSession, currentTurnPlayerId: nextPlayerId, turnCount: nextTurnCount, phase: 'ACTION', pendingAction: null,
                         logs: [...newSession.logs, extraLog, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer?.name}의 차례 (Round ${nextTurnCount})`, type: 'SYSTEM' }]
                     };
                     syncCombatState({ ...combatState, [blockId]: finalSession });
                 }
  
            } else { 
                logText = `🚫 [${source.name}] 도주 실패... (1D20=${roll} ≤ ${threshold})`; 
                extraLog = { id: generateId(), timestamp: Date.now(), text: logText, type: 'FLEE' };
                resolveTurn(blockId, [extraLog]);
            }
        }
    };

    const handleCombatResponse = (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', responseTargetId?: string) => {
        if (!myProfile) return;
        const blockId = myProfile.currentBlockId;
        if (!blockId) return;
  
        const session = combatState[blockId];
        if (!session || !session.pendingAction) return;
  
        const pending = session.pendingAction;
        const attacker = players.find(p => p.id === pending.sourceId);
        const originalTarget = players.find(p => p.id === pending.targetId);
        const responder = myProfile;
        if (!attacker || !originalTarget) return;
  
        let logText = "";
        let finalDamage = 0;
        let damageUpdates: Record<string, number> = {};
        const applyDamage = (amount: number, targetProfile: FactionPlayerProfile) => {
             const dealt = Math.min(targetProfile.hp, amount);
             const newHp = targetProfile.hp - dealt;
             broadcastProfileUpdate({ ...targetProfile, hp: newHp });
             const fid = targetProfile.factionId;
             return { newHp, damageDealt: dealt, fid };
        };
  
        if (type === 'DEFEND') {
            const { roll, maxDie } = rollFactionDefend(responder.stats.defense);
            finalDamage = Math.max(0, pending.damageValue - roll);
            const res = applyDamage(finalDamage, responder);
            damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
            logText = `🛡️ [${responder.name}] 방어! (1D${maxDie}=${roll}) ➔ ${pending.damageValue} 중 ${finalDamage} 피해 받음.`;
            
        } else if (type === 'COUNTER') {
            finalDamage = pending.damageValue;
            const res1 = applyDamage(finalDamage, responder);
            damageUpdates[res1.fid] = (damageUpdates[res1.fid] || 0) + res1.damageDealt;
            
            const { roll, maxDie } = rollFactionAttack(responder.stats.attack);
            const res2 = applyDamage(roll, attacker);
            damageUpdates[res2.fid] = (damageUpdates[res2.fid] || 0) + res2.damageDealt;
            logText = `⚔️ [${responder.name}] 반격! ${pending.damageValue} 피해 받고 ➔ [${attacker.name}]에게 ${roll} (1D${maxDie}) 되돌려줌!`;
            
        } else if (type === 'COVER') {
            const { roll, maxDie } = rollFactionDefend(responder.stats.defense);
            finalDamage = Math.max(0, pending.damageValue - roll);
            const res = applyDamage(finalDamage, responder);
            damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
            logText = `🛡️ [${responder.name}] 대리 방어! [${originalTarget.name}] 대신 맞음. (1D${maxDie}=${roll}) ➔ ${finalDamage} 피해.`;
            
        } else if (type === 'HEAL') {
            finalDamage = pending.damageValue;
            const res1 = applyDamage(finalDamage, originalTarget);
            damageUpdates[res1.fid] = (damageUpdates[res1.fid] || 0) + res1.damageDealt;
            
            const healTarget = players.find(p => p.id === responseTargetId) || responder;
            const { success, checkRoll, healAmount } = rollFactionHeal(responder.stats.spirit);
            if (success) {
                 const newHealTarget = { ...healTarget, hp: Math.min(healTarget.maxHp, healTarget.hp + healAmount) };
                 if (healTarget.id === originalTarget.id) {
                     const afterDmg = Math.max(0, originalTarget.hp - finalDamage);
                     newHealTarget.hp = Math.min(healTarget.maxHp, afterDmg + healAmount);
                 }
                 broadcastProfileUpdate(newHealTarget);
                 logText = `➕ [${responder.name}] 맞으면서 치유! [${originalTarget.name}] ${pending.damageValue} 피해. [${healTarget.name}] +${healAmount} 회복.`;
            } else { 
                logText = `💦 [${responder.name}] 치유 시도했으나 실패. [${originalTarget.name}] ${pending.damageValue} 피해만 받음.`; 
            }
            
        } else if (type === 'FLEE') {
            const { success, roll, threshold } = rollFactionFlee(session.turnCount);
            if (success) {
                logText = `💨 [${responder.name}] 회피 성공! (1D20=${roll} > ${threshold})`;
            } else {
                finalDamage = pending.damageValue;
                const res = applyDamage(finalDamage, responder);
                damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
                logText = `🚫 [${responder.name}] 회피 실패! ${pending.damageValue} 피해 받음. (1D20=${roll} ≤ ${threshold})`;
            }
        }
  
        const newLog: CombatLogEntry = { id: generateId(), timestamp: Date.now(), text: logText, type: type === 'COUNTER' ? 'ATTACK' : (type === 'HEAL' ? 'HEAL' : (type === 'FLEE' ? 'FLEE' : 'DEFEND')) };
        resolveTurn(blockId, [newLog], damageUpdates);
    };

    const resumeCombatsOnGlobalTurn = () => {
        const newCombatState = { ...combatState };
        let combatUpdated = false;
    
        Object.keys(newCombatState).forEach(key => {
            const session = newCombatState[key];
            if (session.isActive && session.currentTurnPlayerId === null) {
                const { turnOrder } = session;
                let nextPlayerId = null;
                
                for (const pid of turnOrder) {
                    const p = players.find(pl => pl.id === pid);
                    if (p && p.hp > 0 && p.currentBlockId === key && !session.fledPlayerIds.includes(p.id)) {
                        nextPlayerId = pid;
                        break;
                    }
                }
    
                if (nextPlayerId) {
                    const nextPlayer = players.find(p => p.id === nextPlayerId);
                    newCombatState[key] = {
                        ...session,
                        currentTurnPlayerId: nextPlayerId,
                        logs: [...session.logs, { id: generateId(), timestamp: Date.now(), text: `🔄 전체 턴 경과! 전투 ${session.turnCount}라운드 시작. (${nextPlayer?.name}의 차례)`, type: 'SYSTEM' }]
                    };
                    combatUpdated = true;
                } else {
                    delete newCombatState[key];
                    combatUpdated = true;
                }
            }
        });
    
        if (combatUpdated) {
            syncCombatState(newCombatState);
        }
    };

    return {
        combatState, setCombatState,
        adminCombatViewOpen, setAdminCombatViewOpen,
        activeSession,
        isCombatActiveInRelevantBlock,
        showCombatUI,
        toggleCombat,
        handleCombatAction,
        handleCombatResponse,
        resolveTurn,
        resumeCombatsOnGlobalTurn
    };
};
