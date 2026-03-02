import { useState, useEffect, useCallback } from 'react';
import { GlobalCombatState, CombatSession, FactionPlayerProfile, CombatLogEntry, FactionGameData, FactionMap, PendingCombatAction } from '../../../types';
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
    }, [isCombatActiveInRelevantBlock, isAdmin, activeSession]);

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
  
        const finalLogs: CombatLogEntry[] = [...session.logs, { id: generateId(), timestamp: Date.now(), text: `🏁 전투 종료! (${reason})`, type: 'SYSTEM' }];
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
        const combatants = players.filter(p => p.currentBlockId === blockId);
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

        if (survivingFactions.length === 0) { 
            endCombat(blockId, null, null, "무승부 (전원 불능)"); 
            return; 
        }

        if (session.turnCount > 5) {
            let minDamage = Infinity; 
            let winnerId: string | null = null; 
            let loserId: string | null = null;
            
            factionsInvolved.forEach(fid => {
                 const dmg = session.factionDamage[fid] || 0;
                 if (dmg < minDamage) { 
                    minDamage = dmg; 
                    winnerId = fid; 
                } else { 
                    loserId = fid; 
                }
            });

            if (winnerId) { 
                endCombat(blockId, winnerId, loserId, "5턴 종료 (피해량 판정)"); 
            } else { 
                endCombat(blockId, null, null, "5턴 종료 (피해량 동점)"); 
            }
        }
    };

    const toggleCombat = () => {
        const combatLocId = isAdmin && selectedAdminPlayer ? selectedAdminPlayer.currentBlockId : myProfile?.currentBlockId;
  
        if (!combatLocId) {
            alert("대상 위치를 찾을 수 없습니다.");
            return;
        }
  
        const combatPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0);
        if (combatPlayers.length === 0) return;
  
        const existingSession = combatState[combatLocId];
  
        if (!existingSession?.isActive) {
            const factionsInvolved = Array.from(new Set(combatPlayers.map(p => p.factionId)));
            const factionInitiative = factionsInvolved.map(fid => {
                const members = combatPlayers.filter(p => p.factionId === fid);
                const totalAgility = members.reduce((sum, p) => sum + p.stats.agility, 0);
                const sortedMembers = [...members].sort((a, b) => b.stats.agility - a.stats.agility);
                return { fid, totalAgility, members: sortedMembers };
            });
            factionInitiative.sort((a, b) => b.totalAgility - a.totalAgility);
            const turnOrder = factionInitiative.flatMap(f => f.members.map(p => p.id));
            const firstPlayerId = turnOrder[0] || null;
  
            const newSession: CombatSession = {
                isActive: true, 
                currentTurnPlayerId: firstPlayerId, 
                combatBlockId: combatLocId,
                turnCount: 1, 
                phase: 'ACTION', 
                pendingAction: null,
                logs: [{ id: generateId(), timestamp: Date.now(), text: "⚠️ 전투가 시작되었습니다!", type: 'SYSTEM' }], 
                factionDamage: {}, 
                fledPlayerIds: [],
                turnOrder
            };
            syncCombatState({ ...combatState, [combatLocId]: newSession });
        } else {
            const newGlobalState = { ...combatState };
            delete newGlobalState[combatLocId];
            syncCombatState(newGlobalState);
        }
    };

    const resolveTurn = (targetBlockId?: string, extraLogs: CombatLogEntry[] = [], damageUpdates: Record<string, number> = {}, sessionOverride?: CombatSession) => {
        const blockId = targetBlockId || (isAdmin ? selectedAdminPlayer?.currentBlockId : myProfile?.currentBlockId);
        if (!blockId) return;
  
        const session = sessionOverride || combatState[blockId];
        if (!session || !session.isActive) return;
  
        const { turnOrder } = session;
        if (turnOrder.length === 0) return;
  
        const currentIdx = turnOrder.indexOf(session.currentTurnPlayerId || '');
        let nextIdx = currentIdx;
        let nextPlayerId: string | null = null;
        let loops = 0;
        let nextTurnCount = session.turnCount;
        let found = false;
        let isRoundOver = false;
  
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
            endCombat(blockId, null, null, "전투원 없음"); 
            return; 
        }
        
        const newFactionDamage = { ...session.factionDamage };
        Object.entries(damageUpdates).forEach(([fid, amt]) => {
            newFactionDamage[fid] = (newFactionDamage[fid] || 0) + amt;
        });
  
        if (isRoundOver) {
            if (nextTurnCount > 5) {
                checkCombatVictory(blockId, { ...session, factionDamage: newFactionDamage, turnCount: nextTurnCount });
                return;
            }
            const updatedSession: CombatSession = {
                ...session, 
                currentTurnPlayerId: null,
                turnCount: nextTurnCount, 
                phase: 'ACTION', 
                pendingAction: null,
                factionDamage: newFactionDamage,
                logs: [...session.logs, ...extraLogs, { id: generateId(), timestamp: Date.now(), text: `⏳ 라운드 종료.`, type: 'SYSTEM' }]
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
                logs: [...session.logs, ...extraLogs, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer?.name}의 차례`, type: 'SYSTEM' }]
            };
            syncCombatState({ ...combatState, [blockId]: updatedSession });
        }
    };

    const handleCombatAction = (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => {
        if (!myProfile) return;
        const blockId = myProfile.currentBlockId;
        if (!blockId) return;
        const session = combatState[blockId];
        if (!session) return;

        // Guard: Fled players cannot take actions
        if (session.fledPlayerIds.includes(myProfile.id)) return;
  
        const target = players.find(p => p.id === targetId);
  
        if (type === 'HEAL' && target) {
            const res = rollFactionHeal(myProfile.stats.spirit);
            let logMsg = "";
            if (res.success) {
                 broadcastProfileUpdate({ ...target, hp: Math.min(target.maxHp, target.hp + res.healAmount) });
                 logMsg = `✨ [${myProfile.name}] 치유 성공! +${res.healAmount}`;
            } else { 
                 logMsg = `💦 [${myProfile.name}] 치유 실패...`; 
            }
            resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: logMsg, type: 'HEAL' }]);
        } else if (type === 'ATTACK' && target) {
            const res = rollFactionAttack(myProfile.stats.attack);
            const newAction: PendingCombatAction = { type: 'ATTACK', sourceId: myProfile.id, targetId: target.id, damageValue: res.roll, maxDie: res.maxDie };
            syncCombatState({
                ...combatState, 
                [blockId]: {
                    ...session, 
                    phase: 'RESPONSE', 
                    pendingAction: newAction,
                    logs: [...session.logs, { id: generateId(), timestamp: Date.now(), text: `⚔️ [${myProfile.name}] 공격! (${res.roll})`, type: 'ATTACK' }]
                }
            });
        } else if (type === 'FLEE') {
            const res = rollFactionFlee(session.turnCount);
            if (res.success) {
                const log: CombatLogEntry = { id: generateId(), timestamp: Date.now(), text: `💨 [${myProfile.name}] 도주 성공!`, type: 'FLEE' };
                const newFled = [...session.fledPlayerIds, myProfile.id];
                const updatedSession = { ...session, fledPlayerIds: newFled };
                // We sync the state but also pass updatedSession to resolveTurn to avoid stale state issues
                syncCombatState({ ...combatState, [blockId]: updatedSession });
                resolveTurn(blockId, [log], {}, updatedSession);
            } else { 
                resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: `🚫 [${myProfile.name}] 도주 실패!`, type: 'FLEE' }]);
            }
        }
    };

    const handleCombatResponse = (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', responseTargetId?: string) => {
        if (!myProfile || !myProfile.currentBlockId) return;
        const blockId = myProfile.currentBlockId;
        const session = combatState[blockId];
        if (!session || !session.pendingAction) return;

        // Guard: Fled players cannot respond
        if (session.fledPlayerIds.includes(myProfile.id)) return;
  
        const pending = session.pendingAction;
        const attacker = players.find(p => p.id === pending.sourceId);
        const originalTarget = players.find(p => p.id === pending.targetId);
        if (!attacker || !originalTarget) return;
  
        let logText = "";
        const damageUpdates: Record<string, number> = {};

        const applyDamage = (amount: number, targetProfile: FactionPlayerProfile) => {
             const dealt = Math.min(targetProfile.hp, amount);
             broadcastProfileUpdate({ ...targetProfile, hp: targetProfile.hp - dealt });
             damageUpdates[targetProfile.factionId] = (damageUpdates[targetProfile.factionId] || 0) + dealt;
        };
  
        if (type === 'DEFEND') {
            const res = rollFactionDefend(myProfile.stats.defense);
            const finalDmg = Math.max(0, pending.damageValue - res.roll);
            applyDamage(finalDmg, myProfile);
            logText = `🛡️ [${myProfile.name}] 방어! (${res.roll}) ➔ ${finalDmg} 피해.`;
        } else if (type === 'COUNTER') {
            applyDamage(pending.damageValue, myProfile);
            const res = rollFactionAttack(myProfile.stats.attack);
            applyDamage(res.roll, attacker);
            logText = `⚔️ [${myProfile.name}] 반격! 피해 받고 ➔ [${attacker.name}]에게 ${res.roll} 되돌려줌!`;
        } else if (type === 'COVER') {
            const res = rollFactionDefend(myProfile.stats.defense);
            const finalDmg = Math.max(0, pending.damageValue - res.roll);
            applyDamage(finalDmg, myProfile);
            logText = `🛡️ [${myProfile.name}] 대리 방어! (${res.roll}) ➔ ${finalDmg} 피해.`;
        } else if (type === 'HEAL') {
            applyDamage(pending.damageValue, originalTarget);
            const healTarget = players.find(p => p.id === responseTargetId) || myProfile;
            const res = rollFactionHeal(myProfile.stats.spirit);
            if (res.success) {
                 broadcastProfileUpdate({ ...healTarget, hp: Math.min(healTarget.maxHp, healTarget.hp + res.healAmount) });
                 // Fixed: using logText directly instead of undefined logMsg
                 logText = `➕ [${myProfile.name}] 치료하며 맞음! +${res.healAmount}`;
            } else { 
                 // Fixed: using logText directly instead of undefined logMsg
                 logText = `💦 [${myProfile.name}] 치료 실패하며 맞음.`; 
            }
        } else if (type === 'FLEE') {
            const res = rollFactionFlee(session.turnCount);
            if (res.success) {
                logText = `💨 [${myProfile.name}] 회피 성공!`;
            } else {
                applyDamage(pending.damageValue, myProfile);
                logText = `🚫 [${myProfile.name}] 회피 실패! ${pending.damageValue} 피해.`;
            }
        }
  
        resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: logText, type: 'DEFEND' }], damageUpdates);
    };

    const resumeCombatsOnGlobalTurn = () => {
        const newCombatState = { ...combatState };
        let combatUpdated = false;
    
        Object.keys(newCombatState).forEach(key => {
            const session = newCombatState[key];
            if (session.isActive && session.currentTurnPlayerId === null) {
                const { turnOrder } = session;
                let nextPlayerId: string | null = null;
                for (const pid of turnOrder) {
                    const p = players.find(pl => pl.id === pid);
                    if (p && p.hp > 0 && p.currentBlockId === key && !session.fledPlayerIds.includes(p.id)) {
                        nextPlayerId = pid;
                        break;
                    }
                }
                if (nextPlayerId) {
                    newCombatState[key] = {
                        ...session,
                        currentTurnPlayerId: nextPlayerId,
                        logs: [...session.logs, { id: generateId(), timestamp: Date.now(), text: `🔄 다음 라운드 시작!`, type: 'SYSTEM' }]
                    };
                    combatUpdated = true;
                } else {
                    delete newCombatState[key];
                    combatUpdated = true;
                }
            }
        });
        if (combatUpdated) syncCombatState(newCombatState);
    };

    const handleDeleteCharacterFromCombat = (targetId: string) => {
        if (!isAdmin) return;
        
        const blockId = isAdmin && selectedAdminPlayer ? selectedAdminPlayer.currentBlockId : myProfile?.currentBlockId;
        if (!blockId) return;
        
        const session = combatState[blockId];
        if (!session || !session.isActive) return;

        const target = players.find(p => p.id === targetId);
        const newTurnOrder = session.turnOrder.filter(id => id !== targetId);
        const newFledIds = session.fledPlayerIds.filter(id => id !== targetId);
        
        let nextTurnPlayerId = session.currentTurnPlayerId;
        let extraLogs: CombatLogEntry[] = [{ 
            id: generateId(), 
            timestamp: Date.now(), 
            text: `🚫 [운영자] ${target?.name || '캐릭터'}가 전장에서 이탈(삭제)되었습니다.`, 
            type: 'SYSTEM' 
        }];

        // If the deleted player was the current turn holder, advance the turn
        if (session.currentTurnPlayerId === targetId) {
            const currentIdx = session.turnOrder.indexOf(targetId);
            let nextIdx = currentIdx;
            let found = false;
            let loops = 0;
            
            while (!found && loops < newTurnOrder.length) {
                nextIdx = nextIdx % newTurnOrder.length;
                const pid = newTurnOrder[nextIdx];
                const p = players.find(pl => pl.id === pid);
                if (p && p.hp > 0 && p.currentBlockId === blockId && !newFledIds.includes(p.id)) {
                    nextTurnPlayerId = pid;
                    found = true;
                }
                nextIdx++;
                loops++;
            }
            
            if (!found) nextTurnPlayerId = null;
        }

        const updatedSession: CombatSession = {
            ...session,
            turnOrder: newTurnOrder,
            fledPlayerIds: newFledIds,
            currentTurnPlayerId: nextTurnPlayerId,
            logs: [...session.logs, ...extraLogs]
        };

        syncCombatState({ ...combatState, [blockId]: updatedSession });
        
        // Check if combat should end (e.g. only one faction left)
        checkCombatVictory(blockId, updatedSession);
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
        resumeCombatsOnGlobalTurn,
        handleDeleteCharacterFromCombat
    };
};
