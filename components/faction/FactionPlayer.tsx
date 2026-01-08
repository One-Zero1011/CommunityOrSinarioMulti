
import React, { useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, CombatState, FactionMap, FactionChatMessage } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { FactionSetupModal } from './player/FactionSetupModal';
import { FactionHUD } from './player/FactionHUD';
import { FactionSidebar } from './player/FactionSidebar';
import { FactionMapCanvas } from './player/FactionMapCanvas';
import { FactionAdminPanel } from './player/FactionAdminPanel';
import { FactionCombatUI } from './player/FactionCombatUI';
import { rollFactionAttack, rollFactionHeal, rollFactionDefend, rollFactionFlee } from '../../lib/game-logic';
import { generateId } from '../../lib/utils';

interface FactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const FactionPlayer: React.FC<FactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  const { networkMode, peerId, startHost, connections, hostConnection, broadcast, sendToHost } = network;
  
  const [data, setData] = useState<FactionGameData>(initialData);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Players State
  const [myProfile, setMyProfile] = useState<FactionPlayerProfile | null>(null);
  const [players, setPlayers] = useState<FactionPlayerProfile[]>([]);
  const [chatMessages, setChatMessages] = useState<FactionChatMessage[]>([]);
  
  // Combat State
  const [combatState, setCombatState] = useState<CombatState>({
      isActive: false,
      currentTurnPlayerId: null,
      turnCount: 1,
      phase: 'ACTION',
      pendingAction: null,
      logs: [],
      factionDamage: {},
      fledPlayerIds: []
  });

  const [currentMapId, setCurrentMapId] = useState(initialData.maps[0]?.id || '');
  const [copiedId, setCopiedId] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');

  // Admin UI State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(true);

  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);

  // -- Network Logic --

  useEffect(() => {
    if (networkMode === 'SOLO') startHost();
  }, [networkMode, startHost]);

  useEffect(() => {
    if (networkMode === 'HOST') {
        const interval = setInterval(() => {
            broadcast({ type: 'SYNC_GAMEDATA', payload: data as any });
            if (combatState.isActive) {
                broadcast({ type: 'SYNC_COMBAT_STATE', state: combatState });
            }
            // Optimization: Only sync chat periodically if there are changes, or rely on event-based sync
            // For now, event-based is safer for chat.
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [networkMode, broadcast, data, combatState]);

  useEffect(() => {
    const handleAction = (msg: any) => {
        if (networkMode === 'HOST') {
            if (msg.type === 'JOIN_FACTION_GAME') {
                const newProfile = msg.profile;
                setPlayers(prev => {
                    const filtered = prev.filter(p => p.id !== newProfile.id);
                    const newPlayers = [...filtered, newProfile];
                    broadcast({ type: 'SYNC_PLAYERS', players: newPlayers });
                    return newPlayers;
                });
            } else if (msg.type === 'UPDATE_PLAYER_PROFILE') {
                 const updatedProfile = msg.profile;
                 setPlayers(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
                 broadcast({ type: 'UPDATE_PLAYER_PROFILE', profile: updatedProfile });
            } else if (msg.type === 'REQUEST_FACTION_CHAT') {
                 const newMessage = msg.message;
                 setChatMessages(prev => {
                     const newChat = [...prev, newMessage];
                     // Sync to all clients immediately
                     broadcast({ type: 'SYNC_FACTION_CHAT', messages: newChat });
                     return newChat;
                 });
            }
        } else if (networkMode === 'CLIENT') {
            if (msg.type === 'SYNC_GAMEDATA') {
                if (msg.payload.factions) {
                    setData(msg.payload);
                    setIsDataLoaded(true);
                    if (!currentMapId && msg.payload.maps.length > 0) {
                        setCurrentMapId(msg.payload.maps[0].id);
                    }
                }
            } else if (msg.type === 'SYNC_PLAYERS') {
                setPlayers(msg.players);
            } else if (msg.type === 'CHANGE_FACTION_MAP') {
                setCurrentMapId(msg.mapId);
            } else if (msg.type === 'UPDATE_PLAYER_PROFILE') {
                const updatedProfile = msg.profile;
                setPlayers(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
                if (myProfile && myProfile.id === updatedProfile.id) {
                    setMyProfile(updatedProfile);
                }
            } else if (msg.type === 'SYNC_COMBAT_STATE') {
                setCombatState(msg.state);
            } else if (msg.type === 'SYNC_FACTION_MAP_DATA') {
                // Update just the maps (for occupation data)
                setData(prev => ({ ...prev, maps: msg.maps }));
            } else if (msg.type === 'SYNC_FACTION_CHAT') {
                setChatMessages(msg.messages);
            }
        }
    };

    if (networkMode === 'HOST') {
        connections.forEach(conn => { conn.off('data'); conn.on('data', handleAction); });
    } else if (networkMode === 'CLIENT' && hostConnection) {
        hostConnection.off('data');
        hostConnection.on('data', handleAction);
    }
  }, [networkMode, connections, hostConnection, currentMapId, myProfile, players]);

  // -- Handlers --

  const handlePlayerJoin = (profile: FactionPlayerProfile) => {
      setMyProfile(profile);
      setPlayers(prev => [...prev, profile]);
      setIsSetupOpen(false);
      
      if (networkMode === 'CLIENT') {
          sendToHost({ type: 'JOIN_FACTION_GAME', profile });
      } else if (networkMode === 'HOST') {
           broadcast({ type: 'SYNC_PLAYERS', players: [...players, profile] });
      }
  };

  const broadcastProfileUpdate = (profile: FactionPlayerProfile) => {
      setPlayers(prev => prev.map(p => p.id === profile.id ? profile : p));
      if (myProfile && myProfile.id === profile.id) setMyProfile(profile);

      if (networkMode === 'HOST') {
          broadcast({ type: 'UPDATE_PLAYER_PROFILE', profile });
      } else {
          sendToHost({ type: 'UPDATE_PLAYER_PROFILE', profile });
      }
  };

  const updateMapData = (newMaps: FactionMap[]) => {
      setData(prev => ({ ...prev, maps: newMaps }));
      if (networkMode === 'HOST') {
          broadcast({ type: 'SYNC_FACTION_MAP_DATA', maps: newMaps });
      }
  };

  const handleAdminLogin = () => { setIsAdmin(true); setIsSetupOpen(false); };
  const handleMapChange = (mapId: string) => {
      setCurrentMapId(mapId);
      if (networkMode === 'HOST') broadcast({ type: 'CHANGE_FACTION_MAP', mapId });
  };
  const updateAdminPlayer = (updates: Partial<FactionPlayerProfile>) => {
      if (!selectedAdminPlayer) return;
      broadcastProfileUpdate({ ...selectedAdminPlayer, ...updates });
  };

  const handleSendMessage = (text: string, channel: 'TEAM' | 'BLOCK') => {
      if (!myProfile) return;
      
      // FIX: Use teamId for TEAM channel instead of factionId
      const targetId = channel === 'TEAM' ? myProfile.teamId : (myProfile.currentBlockId || '');
      
      if (channel === 'BLOCK' && !targetId) {
          alert("현재 맵의 블록 위에 있지 않아 지역 채팅을 할 수 없습니다.");
          return;
      }

      const newMessage: FactionChatMessage = {
          id: generateId(),
          senderName: myProfile.name,
          senderId: myProfile.id,
          senderFactionId: myProfile.factionId,
          text,
          timestamp: Date.now(),
          channel,
          targetId // This will be teamId or blockId
      };

      if (networkMode === 'CLIENT') {
          sendToHost({ type: 'REQUEST_FACTION_CHAT', message: newMessage });
      } else {
          setChatMessages(prev => {
              const newChat = [...prev, newMessage];
              broadcast({ type: 'SYNC_FACTION_CHAT', messages: newChat });
              return newChat;
          });
      }
  };

  const handleBlockClick = (blockId: string) => {
      // Only active players can move
      if (!myProfile || !currentMap) return;

      // Find Target Info
      const targetBlock = currentMap.blocks.find(b => b.id === blockId);
      if (!targetBlock) return;

      // 1. Admin Bypass: Admins can move anywhere
      if (isAdmin) {
          broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
          return;
      }

      // 2. Initial Spawn (First Turn): If player has no location, allow anywhere
      if (!myProfile.currentBlockId) {
          broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
          return;
      }

      // 3. Adjacent Movement Rule
      const currentBlock = currentMap.blocks.find(b => b.id === myProfile.currentBlockId);
      
      // Safety check: if current location is invalid (e.g. map switch glitch), treat as spawn
      if (!currentBlock) {
          broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
          return;
      }

      const dx = Math.abs(targetBlock.colIndex - currentBlock.colIndex);
      const dy = Math.abs(targetBlock.rowIndex - currentBlock.rowIndex);
      
      // Allow adjacent (Up/Down/Left/Right) OR Same block
      const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
      const isSame = dx === 0 && dy === 0;

      if (isAdjacent || isSame) {
          broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
      } else {
          alert("인접한 칸으로만 이동할 수 있습니다.");
      }
  };

  // -- Peaceful Occupation Logic --

  const advanceGlobalTurn = () => {
    if (!currentMap) return;
    
    // Logic: Iterate all blocks. If only one faction is present, increment progress.
    const newBlocks = currentMap.blocks.map(block => {
        const occupants = players.filter(p => p.currentBlockId === block.id);
        const factionsPresent = new Set(occupants.map(p => p.factionId));
        
        let newBlock = { ...block };

        if (factionsPresent.size === 1) {
            const factionId = Array.from(factionsPresent)[0];
            
            // If already owned by this faction, nothing happens (or maybe fully reinforced)
            if (block.ownerId !== factionId) {
                const currentProgress = block.occupationProgress || 0;
                const nextProgress = currentProgress + 1;
                
                if (nextProgress >= 3) {
                    newBlock.ownerId = factionId;
                    newBlock.occupationProgress = 0; // Reset after occupation
                } else {
                    newBlock.occupationProgress = nextProgress;
                }
            } else {
                 newBlock.occupationProgress = 0; // Reset if holding own territory
            }
        } else {
            // Empty or Mixed: Reset progress
            newBlock.occupationProgress = 0;
        }
        return newBlock;
    });

    const newMap = { ...currentMap, blocks: newBlocks };
    updateMapData(data.maps.map(m => m.id === currentMapId ? newMap : m));
  };


  // -- Combat Logic --

  const syncCombatState = (newState: CombatState) => {
      setCombatState(newState);
      if (networkMode === 'HOST') broadcast({ type: 'SYNC_COMBAT_STATE', state: newState });
  };

  const endCombat = (winnerFactionId: string | null, loserFactionId: string | null, reason: string) => {
      let finalLogs = [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `🏁 전투 종료! (${reason})`, type: 'SYSTEM' as const }];
      
      const winnerFaction = data.factions.find(f => f.id === winnerFactionId);
      const loserFaction = data.factions.find(f => f.id === loserFactionId);

      if (winnerFaction) {
          finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `🏆 승리: ${winnerFaction.name}`, type: 'SYSTEM' });
          
          // 1. Assign Territory to Winner
          // Assuming combat happens in ONE block where players are gathered.
          // We check where the players are (usually combat is local to a block).
          // We pick the block of the first active player.
          const combatLocId = players.find(p => p.id === combatState.currentTurnPlayerId)?.currentBlockId;
          if (currentMap && combatLocId) {
              const newBlocks = currentMap.blocks.map(b => b.id === combatLocId ? { ...b, ownerId: winnerFactionId!, occupationProgress: 0 } : b);
              const newMap = { ...currentMap, blocks: newBlocks };
              updateMapData(data.maps.map(m => m.id === currentMapId ? newMap : m));
          }
      }

      if (loserFaction) {
           finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `💀 패배: ${loserFaction.name} (패배한 진영은 무작위 빈 지역으로 이동됩니다)`, type: 'SYSTEM' });
           
           // 2. Teleport Losers
           if (currentMap) {
               const unoccupiedBlocks = currentMap.blocks.filter(b => !b.ownerId);
               const targetPool = unoccupiedBlocks.length > 0 ? unoccupiedBlocks : currentMap.blocks;
               
               // Find all players of losing faction
               const losers = players.filter(p => p.factionId === loserFactionId);
               
               // Move each loser to a random valid block
               losers.forEach(loser => {
                   const randomBlock = targetPool[Math.floor(Math.random() * targetPool.length)];
                   broadcastProfileUpdate({ ...loser, currentBlockId: randomBlock.id });
               });
           }
      }

      const newState: CombatState = {
          isActive: false,
          currentTurnPlayerId: null,
          turnCount: 1,
          phase: 'ACTION',
          pendingAction: null,
          logs: finalLogs,
          factionDamage: {},
          fledPlayerIds: []
      };
      syncCombatState(newState);
  };

  const checkCombatVictory = (currentState: CombatState) => {
      // 1. Identify factions in combat
      // (Assume 2 factions for simplicity based on prompt context, but logic handles sets)
      const combatants = players.filter(p => p.currentBlockId === players.find(x => x.id === currentState.currentTurnPlayerId)?.currentBlockId);
      const factionsInvolved = Array.from(new Set(combatants.map(p => p.factionId)));

      if (factionsInvolved.length < 2) return; // Not enough factions to decide outcome yet

      // Count active members per faction (HP > 0 and NOT Fled)
      const factionStats = factionsInvolved.map(fid => {
          const members = combatants.filter(p => p.factionId === fid);
          const activeMembers = members.filter(p => p.hp > 0 && !currentState.fledPlayerIds.includes(p.id));
          return { fid, activeCount: activeMembers.length, members };
      });

      // Victory Condition 2: Wipeout / Flee
      const survivingFactions = factionStats.filter(f => f.activeCount > 0);
      
      if (survivingFactions.length === 1) {
          // Only one faction remains
          const winner = survivingFactions[0];
          const loser = factionStats.find(f => f.fid !== winner.fid);
          endCombat(winner.fid, loser?.fid || null, "적군 전멸/도주");
          return;
      }
      
      // If everyone died?
      if (survivingFactions.length === 0) {
          endCombat(null, null, "무승부 (전원 불능)");
          return;
      }

      // Victory Condition 1: 5 Turn Limit
      // We check this at the START of turn 6 (so > 5)
      if (currentState.turnCount > 5) {
          // Compare Damage
          let minDamage = Infinity;
          let winnerId = null;
          let loserId = null;

          factionsInvolved.forEach(fid => {
               const dmg = currentState.factionDamage[fid] || 0;
               if (dmg < minDamage) {
                   minDamage = dmg;
                   winnerId = fid;
               } else {
                   loserId = fid;
               }
          });
          
          // Handle tie? (Just pick one for now or Draw)
          if (winnerId) {
             endCombat(winnerId, loserId, "5턴 종료 (피해량 판정)");
          } else {
             endCombat(null, null, "5턴 종료 (피해량 동점)");
          }
      }
  };

  const toggleCombat = () => {
      const combatLocId = myProfile?.currentBlockId;
      if (!combatLocId) return;

      const combatPlayers = players.filter(p => p.currentBlockId === combatLocId);
      
      if (combatPlayers.length === 0) return;

      // Group by faction for initiative? Simple: Random or first found
      const firstPlayerId = combatPlayers[0].id;

      const newState: CombatState = {
          isActive: !combatState.isActive,
          currentTurnPlayerId: !combatState.isActive ? firstPlayerId : null,
          turnCount: 1,
          phase: 'ACTION',
          pendingAction: null,
          logs: [{ id: generateId(), timestamp: Date.now(), text: !combatState.isActive ? "⚠️ 전투가 시작되었습니다!" : "🏁 전투가 중단되었습니다.", type: 'SYSTEM' }],
          factionDamage: {},
          fledPlayerIds: []
      };
      syncCombatState(newState);
  };

  const nextTurn = () => {
      if (!combatState.isActive || players.length === 0) return;
      
      const combatLocId = players.find(p => p.id === combatState.currentTurnPlayerId)?.currentBlockId;
      const validPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0 && !combatState.fledPlayerIds.includes(p.id));

      if (validPlayers.length === 0) {
          endCombat(null, null, "전투원 없음");
          return;
      }

      const currentIndex = validPlayers.findIndex(p => p.id === combatState.currentTurnPlayerId);
      // Determine next index among valid players
      const nextIndex = (currentIndex + 1) % validPlayers.length;
      const nextPlayer = validPlayers[nextIndex];
      
      // Increment turn count only if we cycled back to start? 
      // Simplified: Increment count every time user clicks "Next Turn" might be too fast.
      // Better: Increment Global Combat Turn count when everyone has acted? 
      // For this simple tool, let's just increment `turnCount` linearly and treat it as "Actions taken".
      // BUT Prompt says "5 Turns". Usually means Rounds.
      // Let's assume the button "Next Turn" passes turn to next player. 
      // We need to track rounds.
      // Hack: We will check turn limit based on raw count assuming roughly equal turns, OR
      // just check logic every specific interval. 
      // Let's increment turnCount. *Actually* let's assume `turnCount` in `CombatState` is "Round Number".
      // We need to know when a Round ends.
      // Simplification: `turnCount` increases when the FIRST player gets the turn again?
      // Let's just manually increment turn count via Admin if needed, OR increment automatically every X actions.
      // Let's stick to the prompt's logic: "5 turns ended". I will assume `turnCount` is currently "Round".
      // I will add a check: if `nextIndex === 0` (cycled back to first player in list), increment round.
      
      const isNewRound = nextIndex === 0;
      const nextTurnCount = isNewRound ? combatState.turnCount + 1 : combatState.turnCount;

      const newState: CombatState = {
          ...combatState,
          currentTurnPlayerId: nextPlayer.id,
          turnCount: nextTurnCount,
          phase: 'ACTION',
          pendingAction: null,
          logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer.name}의 차례 (Round ${nextTurnCount})`, type: 'SYSTEM' as const }]
      };
      
      syncCombatState(newState);
      
      // Check Victory Condition 1 (Time Limit) immediately if new round started and > 5
      if (isNewRound && nextTurnCount > 5) {
          checkCombatVictory(newState); 
      }
  };

  const addCombatLog = (text: string, type: 'ATTACK' | 'HEAL' | 'DEFEND' | 'SYSTEM' | 'FLEE') => {
      const newLog = { id: generateId(), timestamp: Date.now(), text, type };
      const newState = { ...combatState, logs: [...combatState.logs, newLog] };
      syncCombatState(newState);
  };

  // --- Core Combat Logic Exposed to UI ---

  const handleCombatAction = (type: 'ATTACK' | 'HEAL' | 'FLEE', targetId: string) => {
      if (!myProfile) return;
      
      const source = myProfile;
      const target = players.find(p => p.id === targetId);
      if (!target) return;

      if (type === 'HEAL') {
          const { success, checkRoll, checkThreshold, healAmount, healDie } = rollFactionHeal(source.stats.spirit);
          if (success) {
               const newTarget = { ...target, hp: Math.min(target.maxHp, target.hp + healAmount) };
               broadcastProfileUpdate(newTarget);
               addCombatLog(`✨ [${source.name}] 치유 성공! (1D20=${checkRoll} > ${checkThreshold}) ➔ [${target.name}] +${healAmount} (1D${healDie})`, 'HEAL');
          } else {
               addCombatLog(`💦 [${source.name}] 치유 실패... (1D20=${checkRoll} ≤ ${checkThreshold})`, 'HEAL');
          }
      } else if (type === 'ATTACK') {
          const { roll, maxDie } = rollFactionAttack(source.stats.attack);
          
          const newState: CombatState = {
              ...combatState,
              phase: 'RESPONSE',
              pendingAction: {
                  type: 'ATTACK',
                  sourceId: source.id,
                  targetId: target.id,
                  damageValue: roll,
                  maxDie
              },
              logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `⚔️ [${source.name}] 공격 ➔ [${target.name}] 데미지 ${roll} (1D${maxDie})! 대응하세요!`, type: 'ATTACK' }]
          };
          syncCombatState(newState);
      } else if (type === 'FLEE') {
          const { success, roll, threshold } = rollFactionFlee(combatState.turnCount);
          if (success) {
              addCombatLog(`💨 [${source.name}] 전투 이탈 성공! (1D20=${roll} > ${threshold})`, 'FLEE');
              // Update state to mark as fled
              const newState = {
                  ...combatState,
                  fledPlayerIds: [...combatState.fledPlayerIds, source.id]
              };
              syncCombatState(newState);
              // Check victory immediately after someone leaves
              checkCombatVictory(newState);
          } else {
              addCombatLog(`🚫 [${source.name}] 도주 실패... (1D20=${roll} ≤ ${threshold})`, 'FLEE');
          }
      }
  };

  const handleCombatResponse = (type: 'DEFEND' | 'COUNTER' | 'COVER' | 'HEAL' | 'FLEE', responseTargetId?: string) => {
      if (!myProfile || !combatState.pendingAction) return;
      
      const pending = combatState.pendingAction;
      const attacker = players.find(p => p.id === pending.sourceId);
      const originalTarget = players.find(p => p.id === pending.targetId);
      const responder = myProfile;

      if (!attacker || !originalTarget) return;

      let logText = "";
      let finalDamage = 0;
      let victim = originalTarget; // Default victim is original target

      // Track Damage Helper
      const applyDamage = (amount: number, targetProfile: FactionPlayerProfile) => {
           const dealt = Math.min(targetProfile.hp, amount);
           const newHp = targetProfile.hp - dealt;
           broadcastProfileUpdate({ ...targetProfile, hp: newHp });
           
           // Update Faction Damage Counter
           const fid = targetProfile.factionId;
           const currentTotal = combatState.factionDamage[fid] || 0;
           return { newHp, updatedDamage: { [fid]: currentTotal + dealt } };
      };

      let damageUpdates = {};

      if (type === 'DEFEND') {
          const { roll, maxDie } = rollFactionDefend(responder.stats.defense);
          finalDamage = Math.max(0, pending.damageValue - roll);
          
          const res = applyDamage(finalDamage, responder);
          damageUpdates = res.updatedDamage;
          
          logText = `🛡️ [${responder.name}] 방어! (1D${maxDie}=${roll}) ➔ ${pending.damageValue} 중 ${finalDamage} 피해 받음.`;
          addCombatLog(logText, 'DEFEND');

      } else if (type === 'COUNTER') {
          finalDamage = pending.damageValue;
          const res1 = applyDamage(finalDamage, responder);
          
          const { roll, maxDie } = rollFactionAttack(responder.stats.attack);
          const res2 = applyDamage(roll, attacker);

          damageUpdates = { ...res1.updatedDamage, ...res2.updatedDamage };

          logText = `⚔️ [${responder.name}] 반격! ${pending.damageValue} 피해 받고 ➔ [${attacker.name}]에게 ${roll} (1D${maxDie}) 되돌려줌!`;
          addCombatLog(logText, 'ATTACK');

      } else if (type === 'COVER') {
          victim = responder; // Cover takes the hit
          const { roll, maxDie } = rollFactionDefend(responder.stats.defense);
          finalDamage = Math.max(0, pending.damageValue - roll);
          
          const res = applyDamage(finalDamage, responder);
          damageUpdates = res.updatedDamage;

          logText = `🛡️ [${responder.name}] 대리 방어! [${originalTarget.name}] 대신 맞음. (1D${maxDie}=${roll}) ➔ ${finalDamage} 피해.`;
          addCombatLog(logText, 'DEFEND');

      } else if (type === 'HEAL') {
          finalDamage = pending.damageValue;
          const res1 = applyDamage(finalDamage, originalTarget);
          damageUpdates = res1.updatedDamage;
          
          const healTarget = players.find(p => p.id === responseTargetId) || responder;
          const { success, checkRoll, healAmount, healDie } = rollFactionHeal(responder.stats.spirit);
          
          if (success) {
               const newHealTarget = { ...healTarget, hp: Math.min(healTarget.maxHp, healTarget.hp + healAmount) };
               // If healing the victim, calculate carefully based on new state? 
               // For simplicity, just add HP. The race condition of setPlayer state update vs local var is handled by optimistic calc here or sequential logic.
               // Since applyDamage broadcasted, wait? No, just broadcast heal too.
               // But wait, if target is same, we might have conflict. 
               // Simple fix: calculate locally.
               if (healTarget.id === originalTarget.id) {
                   // Calculate net result
                   const afterDmg = Math.max(0, originalTarget.hp - finalDamage);
                   newHealTarget.hp = Math.min(healTarget.maxHp, afterDmg + healAmount);
               }
               broadcastProfileUpdate(newHealTarget);
               logText = `➕ [${responder.name}] 맞으면서 치유! [${originalTarget.name}] ${pending.damageValue} 피해. [${healTarget.name}] +${healAmount} 회복.`;
          } else {
               logText = `💦 [${responder.name}] 치유 시도했으나 실패. [${originalTarget.name}] ${pending.damageValue} 피해만 받음.`;
          }
          addCombatLog(logText, 'HEAL');
      } else if (type === 'FLEE') {
          const { success, roll, threshold } = rollFactionFlee(combatState.turnCount);
          if (success) {
              logText = `💨 [${responder.name}] 도주 성공! 공격을 회피했습니다. (1D20=${roll} > ${threshold})`;
              // Fleeing during response avoids damage
              const newState = {
                  ...combatState,
                  fledPlayerIds: [...combatState.fledPlayerIds, responder.id]
              };
              // Wait to sync until after log
              // Merging state updates manually
              combatState.fledPlayerIds = newState.fledPlayerIds; 
              addCombatLog(logText, 'FLEE');
          } else {
              finalDamage = pending.damageValue;
              const res = applyDamage(finalDamage, responder);
              damageUpdates = res.updatedDamage;
              
              logText = `🚫 [${responder.name}] 도주 실패! 붙잡혀서 ${pending.damageValue} 피해 받음. (1D20=${roll} ≤ ${threshold})`;
              addCombatLog(logText, 'FLEE');
          }
      }

      // Merge damage stats
      const newFactionDamage = { ...combatState.factionDamage };
      Object.entries(damageUpdates).forEach(([fid, amt]) => {
          newFactionDamage[fid] = (newFactionDamage[fid] || 0) + (amt as number);
      });

      const resetState: CombatState = {
          ...combatState,
          phase: 'ACTION',
          pendingAction: null,
          factionDamage: newFactionDamage,
          logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: logText, type: 'SYSTEM' }]
      };
      
      syncCombatState(resetState);

      // Check Victory Condition 2 (Wipeout) immediately after resolution
      checkCombatVictory(resetState);
  };

  if (networkMode === 'CLIENT' && !isDataLoaded) {
      return (
          <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white flex-col gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              <p>호스트로부터 진영 데이터를 받아오는 중...</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 overflow-hidden font-sans relative">
        
        {isSetupOpen && (
            <FactionSetupModal 
                data={data}
                onClose={onExit}
                onJoin={handlePlayerJoin}
                onAdminLogin={handleAdminLogin}
            />
        )}

        {combatState.isActive && (
            <FactionCombatUI 
                myProfile={myProfile}
                players={players}
                combatState={combatState}
                onAction={handleCombatAction}
                onResponse={handleCombatResponse}
            />
        )}

        <FactionHUD 
            title={data.title}
            currentMap={currentMap}
            networkMode={networkMode}
            peerId={peerId}
            copiedId={copiedId}
            setCopiedId={setCopiedId}
            isAdmin={isAdmin}
            myProfile={myProfile}
            onExit={onExit}
            mapList={data.maps}
            onChangeMap={handleMapChange}
        />

        <div className="flex-1 flex overflow-hidden">
            <div className="hidden md:flex">
                <FactionSidebar 
                    data={data}
                    players={players}
                    myProfile={myProfile}
                    isAdmin={isAdmin}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                    onUpdateProfile={(updates) => myProfile && broadcastProfileUpdate({ ...myProfile, ...updates })}
                    chatMessages={chatMessages}
                    onSendMessage={handleSendMessage}
                />
            </div>

            <FactionMapCanvas 
                currentMap={currentMap} 
                players={players}
                isAdmin={isAdmin}
                myProfile={myProfile} // Pass myProfile for Fog of War
                onBlockClick={handleBlockClick}
                factions={data.factions}
            />

            {isAdmin && selectedAdminPlayer && (
                 <FactionAdminPanel 
                    selectedPlayer={selectedAdminPlayer}
                    onClose={() => setSelectedPlayerId(null)}
                    onUpdatePlayer={updateAdminPlayer}
                    combatActive={combatState.isActive}
                    onToggleCombat={toggleCombat}
                    onNextTurn={nextTurn}
                    onAdvanceGlobalTurn={advanceGlobalTurn}
                 />
            )}
        </div>
    </div>
  );
};
