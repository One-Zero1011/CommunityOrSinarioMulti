
import { useState, useEffect } from 'react';
import { CombatState, FactionPlayerProfile, FactionGameData, FactionMap, CombatLogEntry } from '../../types';
import { useNetwork } from '../useNetwork';
import { rollFactionAttack, rollFactionHeal, rollFactionDefend, rollFactionFlee } from '../../lib/game-logic';
import { generateId } from '../../lib/utils';

export const useFactionCombat = (
  network: ReturnType<typeof useNetwork>,
  players: FactionPlayerProfile[],
  data: FactionGameData,
  myProfile: FactionPlayerProfile | null,
  updateMapData: (newMaps: FactionMap[]) => void,
  broadcastProfileUpdate: (profile: FactionPlayerProfile) => void
) => {
  const { networkMode, broadcast, sendToHost, connections, hostConnection } = network;
  const [activeCombats, setActiveCombats] = useState<Record<string, CombatState>>({});

  // Combat Network Sync
  useEffect(() => {
    if (networkMode === 'HOST') {
      const interval = setInterval(() => {
        broadcast({ type: 'SYNC_COMBAT_STATE', combats: activeCombats });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [networkMode, broadcast, activeCombats]);

  useEffect(() => {
    const handleAction = (msg: any) => {
      if (networkMode === 'HOST') {
        if (msg.type === 'SYNC_COMBAT_STATE') {
          setActiveCombats(msg.combats);
          broadcast({ type: 'SYNC_COMBAT_STATE', combats: msg.combats });
        }
      } else if (networkMode === 'CLIENT') {
        if (msg.type === 'SYNC_COMBAT_STATE') {
          setActiveCombats(msg.combats);
        }
      }
    };

    if (networkMode === 'HOST') {
      connections.forEach(conn => { conn.off('data'); conn.on('data', handleAction); });
    } else if (networkMode === 'CLIENT' && hostConnection) {
      hostConnection.off('data');
      hostConnection.on('data', handleAction);
    }
  }, [networkMode, connections, hostConnection]);

  // --- Core Combat Logic ---

  const syncCombats = (newCombats: Record<string, CombatState>) => {
    setActiveCombats(newCombats);
    if (networkMode === 'HOST') {
      broadcast({ type: 'SYNC_COMBAT_STATE', combats: newCombats });
    } else {
      sendToHost({ type: 'SYNC_COMBAT_STATE', combats: newCombats });
    }
  };

  const updateCombatState = (blockId: string, newState: CombatState | undefined) => {
    const newCombats = { ...activeCombats };
    if (newState) {
      newCombats[blockId] = newState;
    } else {
      delete newCombats[blockId];
    }
    syncCombats(newCombats);
  };

  const endCombat = (blockId: string, winnerFactionId: string | null, loserFactionId: string | null, reason: string) => {
    const currentCombat = activeCombats[blockId];
    if (!currentCombat) return;

    let finalLogs = [...currentCombat.logs, { id: generateId(), timestamp: Date.now(), text: `🏁 전투 종료! (${reason})`, type: 'SYSTEM' as const }];
    const winnerFaction = data.factions.find(f => f.id === winnerFactionId);
    const loserFaction = data.factions.find(f => f.id === loserFactionId);

    if (winnerFaction) {
      finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `🏆 승리: ${winnerFaction.name}`, type: 'SYSTEM' });
      // Update Map Ownership
      const currentMap = data.maps.find(m => m.blocks.some(b => b.id === blockId));
      if (currentMap) {
        const newBlocks = currentMap.blocks.map(b => b.id === blockId ? { ...b, ownerId: winnerFactionId!, occupationProgress: 0 } : b);
        const newMap = { ...currentMap, blocks: newBlocks };
        updateMapData(data.maps.map(m => m.id === currentMap.id ? newMap : m));
      }
    }

    if (loserFaction) {
      finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `💀 패배/도주: ${loserFaction.name}`, type: 'SYSTEM' });
      const currentMap = data.maps.find(m => m.blocks.some(b => b.id === blockId));
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

    updateCombatState(blockId, undefined);
  };

  const checkCombatVictory = (blockId: string, currentState: CombatState) => {
    if (!blockId) return;

    const combatants = players.filter(p => p.currentBlockId === blockId);
    const factionsInvolved = Array.from(new Set(combatants.map(p => p.factionId))) as string[];

    if (factionsInvolved.length < 2) return;

    const factionStats = factionsInvolved.map(fid => {
      const members = combatants.filter(p => p.factionId === fid);
      const activeMembers = members.filter(p => p.hp > 0 && !currentState.fledPlayerIds.includes(p.id));
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

    if (currentState.turnCount > 5) {
      let minDamage = Infinity; let winnerId = null; let loserId = null;
      factionsInvolved.forEach(fid => {
        const dmg = currentState.factionDamage[fid] || 0;
        if (dmg < minDamage) { minDamage = dmg; winnerId = fid; } else { loserId = fid; }
      });
      if (winnerId) { endCombat(blockId, winnerId, loserId, "5턴 종료 (피해량 판정)"); } else { endCombat(blockId, null, null, "5턴 종료 (피해량 동점)"); }
    }
  };

  const toggleCombat = (targetBlockId?: string, isAdmin: boolean = false, selectedPlayerId?: string | null) => {
    let combatLocId = targetBlockId;
    if (!combatLocId) {
        if (isAdmin && selectedPlayerId) {
            const targetPlayer = players.find(p => p.id === selectedPlayerId);
            combatLocId = targetPlayer?.currentBlockId;
        } else {
            combatLocId = myProfile?.currentBlockId;
        }
    }

    if (!combatLocId) { alert("유효한 전투 위치가 아닙니다."); return; }

    const existingCombat = activeCombats[combatLocId];
    if (!existingCombat) {
        const combatPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0);
        if (combatPlayers.length === 0) return;

        const factionsInvolved = Array.from(new Set(combatPlayers.map(p => p.factionId))) as string[];
        const factionInitiative = factionsInvolved.map(fid => {
            const members = combatPlayers.filter(p => p.factionId === fid);
            const totalAgility = members.reduce((sum, p) => sum + p.stats.agility, 0);
            const sortedMembers = [...members].sort((a, b) => b.stats.agility - a.stats.agility);
            return { fid, totalAgility, members: sortedMembers };
        });
        factionInitiative.sort((a, b) => b.totalAgility - a.totalAgility);
        const turnOrder = factionInitiative.flatMap(f => f.members.map(p => p.id));

        const newState: CombatState = {
            isActive: true,
            currentTurnPlayerId: turnOrder[0],
            combatBlockId: combatLocId,
            turnCount: 1,
            phase: 'ACTION',
            pendingAction: null,
            logs: [{ id: generateId(), timestamp: Date.now(), text: "⚠️ 전투가 시작되었습니다! 민첩 총합이 높은 진영이 선공을 가져갑니다.", type: 'SYSTEM' }],
            factionDamage: {},
            fledPlayerIds: [],
            turnOrder
        };
        updateCombatState(combatLocId, newState);
    } else {
        updateCombatState(combatLocId, undefined);
    }
  };

  const resolveTurn = (targetBlockId: string, extraLogs: CombatLogEntry[] = [], damageUpdates: Record<string, number> = {}) => {
    const blockId = targetBlockId;
    if (!blockId) return;

    const currentCombat = activeCombats[blockId];
    if (!currentCombat || !currentCombat.isActive) return;

    const { turnOrder } = currentCombat;
    const currentIdx = turnOrder.indexOf(currentCombat.currentTurnPlayerId || '');
    let nextIdx = currentIdx;
    let nextPlayerId = null;
    let loops = 0;
    let nextTurnCount = currentCombat.turnCount;
    let found = false;

    while (!found && loops < turnOrder.length + 1) {
        nextIdx = (nextIdx + 1) % turnOrder.length;
        if (nextIdx === 0) nextTurnCount++;

        const pid = turnOrder[nextIdx];
        const player = players.find(p => p.id === pid);
        if (player && player.hp > 0 && player.currentBlockId === blockId && !currentCombat.fledPlayerIds.includes(player.id)) {
            nextPlayerId = pid;
            found = true;
        }
        loops++;
    }

    if (!found || !nextPlayerId) {
        endCombat(blockId, null, null, "전투원 없음 (전원 불능/도주)");
        return;
    }

    const nextPlayer = players.find(p => p.id === nextPlayerId);
    const newFactionDamage = { ...currentCombat.factionDamage };
    Object.entries(damageUpdates).forEach(([fid, amt]) => {
        newFactionDamage[fid] = (newFactionDamage[fid] || 0) + amt;
    });

    const newState: CombatState = {
        ...currentCombat,
        currentTurnPlayerId: nextPlayerId,
        turnCount: nextTurnCount,
        phase: 'ACTION',
        pendingAction: null,
        factionDamage: newFactionDamage,
        logs: [...currentCombat.logs, ...extraLogs, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer?.name}의 차례 (Round ${nextTurnCount})`, type: 'SYSTEM' as const }]
    };

    updateCombatState(blockId, newState);
    if (nextTurnCount > 5 && nextIdx === 0) {
        checkCombatVictory(blockId, newState);
    }
  };

  const handleCombatAction = (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => {
    const blockId = myProfile?.currentBlockId;
    if (!blockId || !activeCombats[blockId]) return;
    const combat = activeCombats[blockId];
    const source = myProfile;
    const target = players.find(p => p.id === targetId);
    if (!target && type !== 'FLEE') return;

    if (type === 'HEAL') {
        if (!target) return;
        const { success, checkRoll, checkThreshold, healAmount, healDie } = rollFactionHeal(source!.stats.spirit);
        let logText = "";
        if (success) {
            const newTarget = { ...target, hp: Math.min(target.maxHp, target.hp + healAmount) };
            broadcastProfileUpdate(newTarget);
            logText = `✨ [${source!.name}] 치유 성공! (1D20=${checkRoll} > ${checkThreshold}) ➔ [${target.name}] +${healAmount} (1D${healDie})`;
        } else {
            logText = `💦 [${source!.name}] 치유 실패... (1D20=${checkRoll} ≤ ${checkThreshold})`;
        }
        resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: logText, type: 'HEAL' }]);

    } else if (type === 'ATTACK') {
        if (!target) return;
        const { roll, maxDie } = rollFactionAttack(source!.stats.attack);
        const newState: CombatState = {
            ...combat, phase: 'RESPONSE', pendingAction: { type: 'ATTACK', sourceId: source!.id, targetId: target.id, damageValue: roll, maxDie },
            logs: [...combat.logs, { id: generateId(), timestamp: Date.now(), text: `⚔️ [${source!.name}] 공격 ➔ [${target.name}] 데미지 ${roll} (1D${maxDie})! 대응하세요!`, type: 'ATTACK' }]
        };
        updateCombatState(blockId, newState);

    } else if (type === 'FLEE') {
        const { success, roll, threshold } = rollFactionFlee(combat.turnCount);
        if (success) {
            const updatedCombat = { ...combat, fledPlayerIds: [...combat.fledPlayerIds, source!.id] };
            updateCombatState(blockId, updatedCombat);
            resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: `💨 [${source!.name}] 전투 이탈 성공!`, type: 'FLEE' }]);
        } else {
            resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: `🚫 [${source!.name}] 도주 실패...`, type: 'FLEE' }]);
        }
    }
  };

  const handleCombatResponse = (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', responseTargetId?: string) => {
    const blockId = myProfile?.currentBlockId;
    if (!blockId || !activeCombats[blockId]) return;
    const combat = activeCombats[blockId];
    if (!combat.pendingAction) return;

    const pending = combat.pendingAction;
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
        const { roll, maxDie } = rollFactionDefend(responder!.stats.defense);
        finalDamage = Math.max(0, pending.damageValue - roll);
        const res = applyDamage(finalDamage, responder!);
        damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
        logText = `🛡️ [${responder!.name}] 방어! (1D${maxDie}=${roll}) ➔ ${pending.damageValue} 중 ${finalDamage} 피해 받음.`;
    } else if (type === 'COUNTER') {
        finalDamage = pending.damageValue;
        const res1 = applyDamage(finalDamage, responder!);
        damageUpdates[res1.fid] = (damageUpdates[res1.fid] || 0) + res1.damageDealt;
        const { roll, maxDie } = rollFactionAttack(responder!.stats.attack);
        const res2 = applyDamage(roll, attacker);
        damageUpdates[res2.fid] = (damageUpdates[res2.fid] || 0) + res2.damageDealt;
        logText = `⚔️ [${responder!.name}] 반격! ${pending.damageValue} 피해 받고 ➔ [${attacker.name}]에게 ${roll} (1D${maxDie}) 되돌려줌!`;
    } else if (type === 'COVER') {
        const { roll, maxDie } = rollFactionDefend(responder!.stats.defense);
        finalDamage = Math.max(0, pending.damageValue - roll);
        const res = applyDamage(finalDamage, responder!);
        damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
        logText = `🛡️ [${responder!.name}] 대리 방어! ➔ ${finalDamage} 피해.`;
    } else if (type === 'HEAL') {
        finalDamage = pending.damageValue;
        const res1 = applyDamage(finalDamage, originalTarget);
        damageUpdates[res1.fid] = (damageUpdates[res1.fid] || 0) + res1.damageDealt;
        const healTarget = players.find(p => p.id === responseTargetId) || responder;
        const { success, healAmount } = rollFactionHeal(responder!.stats.spirit);
        if (success) {
            const newHealTarget = { ...healTarget!, hp: Math.min(healTarget!.maxHp, healTarget!.hp + healAmount) };
            if (healTarget!.id === originalTarget.id) {
                const afterDmg = Math.max(0, originalTarget.hp - finalDamage);
                newHealTarget.hp = Math.min(healTarget!.maxHp, afterDmg + healAmount);
            }
            broadcastProfileUpdate(newHealTarget);
            logText = `➕ [${responder!.name}] 맞으면서 치유 성공!`;
        } else {
            logText = `💦 [${responder!.name}] 치유 실패...`;
        }
    } else if (type === 'FLEE') {
        const { success, roll, threshold } = rollFactionFlee(combat.turnCount);
        if (success) {
            logText = `💨 [${responder!.name}] 도주 성공!`;
            const updatedCombat = { ...combat, fledPlayerIds: [...combat.fledPlayerIds, responder!.id] };
            updateCombatState(blockId, updatedCombat);
        } else {
            finalDamage = pending.damageValue;
            const res = applyDamage(finalDamage, responder!);
            damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
            logText = `🚫 [${responder!.name}] 도주 실패!`;
        }
    }

    resolveTurn(blockId, [{ id: generateId(), timestamp: Date.now(), text: logText, type: type === 'COUNTER' ? 'ATTACK' : (type === 'HEAL' ? 'HEAL' : (type === 'FLEE' ? 'FLEE' : 'DEFEND')) }], damageUpdates);
  };

  return {
    activeCombats,
    toggleCombat,
    resolveTurn,
    handleCombatAction,
    handleCombatResponse
  };
};
