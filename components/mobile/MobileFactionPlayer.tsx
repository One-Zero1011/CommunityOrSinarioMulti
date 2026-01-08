
import React, { useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, CombatState, FactionMap, FactionChatMessage } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { FactionSetupModal } from '../faction/player/FactionSetupModal';
import { FactionHUD } from '../faction/player/FactionHUD';
import { FactionSidebar } from '../faction/player/FactionSidebar';
import { FactionChatSidebar } from '../faction/player/FactionChatSidebar';
import { FactionMapCanvas } from '../faction/player/FactionMapCanvas';
import { FactionAdminPanel } from '../faction/player/FactionAdminPanel';
import { FactionCombatUI } from '../faction/player/FactionCombatUI';
import { rollFactionAttack, rollFactionHeal, rollFactionDefend, rollFactionFlee } from '../../lib/game-logic';
import { generateId } from '../../lib/utils';
import { Lock, Hourglass, Megaphone, Menu, MessageSquare } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface MobileFactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const MobileFactionPlayer: React.FC<MobileFactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  const { networkMode, peerId, startHost, connections, hostConnection, broadcast, sendToHost } = network;
  
  const [data, setData] = useState<FactionGameData>({
      ...initialData,
      currentTurn: initialData.currentTurn || 1
  });
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

  // UI State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  
  // Mobile Specific UI State
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  // Announcement State
  const [announcement, setAnnouncement] = useState<{title: string, message: string} | null>(null);

  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);

  // Turn Status
  const isTurnFinished = myProfile && myProfile.lastActionTurn === data.currentTurn;

  // -- Derived Combat Visibility --
  const activeCombatPlayer = players.find(p => p.id === combatState.currentTurnPlayerId);
  const combatBlockId = activeCombatPlayer?.currentBlockId;
  const isProfileInCombat = myProfile && combatBlockId && myProfile.currentBlockId === combatBlockId;
  
  // Only show combat UI if combat is active AND I am in the same block (or I am admin observing)
  const showCombatUI = combatState.isActive && (isAdmin || isProfileInCombat);

  // -- Network Logic --

  useEffect(() => {
    if (networkMode === 'SOLO') startHost();
  }, [networkMode, startHost]);

  useEffect(() => {
    if (networkMode === 'HOST') {
        const interval = setInterval(() => {
            broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
            if (combatState.isActive) {
                broadcast({ type: 'SYNC_COMBAT_STATE', state: combatState });
            }
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
                     broadcast({ type: 'SYNC_FACTION_CHAT', messages: newChat });
                     return newChat;
                 });
            } else if (msg.type === 'SYNC_COMBAT_STATE') {
                // Client requesting combat state update
                setCombatState(msg.state);
                broadcast({ type: 'SYNC_COMBAT_STATE', state: msg.state });
            }
        } else if (networkMode === 'CLIENT') {
            if (msg.type === 'SYNC_FACTION_GAMEDATA') {
                setData(msg.payload);
                setIsDataLoaded(true);
                if (!currentMapId && msg.payload.maps.length > 0) {
                    setCurrentMapId(msg.payload.maps[0].id);
                }
            } else if (msg.type === 'SYNC_GAMEDATA') {
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
                setData(prev => ({ ...prev, maps: msg.maps }));
            } else if (msg.type === 'SYNC_FACTION_CHAT') {
                setChatMessages(msg.messages);
            } else if (msg.type === 'ADMIN_ANNOUNCEMENT') {
                const isGlobal = msg.targetId === null;
                const isForMe = myProfile && msg.targetId === myProfile.id;
                
                if (isGlobal || isForMe) {
                    setAnnouncement({ title: msg.title, message: msg.message });
                }
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

  const sendAdminAnnouncement = (targetId: string | null, title: string, message: string) => {
      if (networkMode === 'HOST') {
          broadcast({ type: 'ADMIN_ANNOUNCEMENT', targetId, title, message });
          if (targetId === null) {
              setAnnouncement({ title, message });
          }
      }
  };

  const handleSendMessage = (text: string, channel: 'TEAM' | 'BLOCK') => {
      if (!myProfile) return;
      
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
          targetId
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
      if (!currentMap) return;

      if (isAdmin) {
          if (selectedPlayerId) {
              const targetPlayer = players.find(p => p.id === selectedPlayerId);
              if (targetPlayer) {
                  broadcastProfileUpdate({ ...targetPlayer, currentBlockId: blockId });
              }
          } else if (myProfile) {
              broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
          }
          return;
      }

      if (!myProfile) return;

      const targetBlock = currentMap.blocks.find(b => b.id === blockId);
      if (!targetBlock) return;

      if (myProfile.lastActionTurn === data.currentTurn) return;

      let canMove = false;
      if (!myProfile.currentBlockId) {
          canMove = true;
      } else {
          const currentBlock = currentMap.blocks.find(b => b.id === myProfile.currentBlockId);
          if (currentBlock) {
            const dx = Math.abs(targetBlock.colIndex - currentBlock.colIndex);
            const dy = Math.abs(targetBlock.rowIndex - currentBlock.rowIndex);
            const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
            const isSame = dx === 0 && dy === 0; 
            if (isAdjacent || isSame) canMove = true;
            else alert("인접한 칸으로만 이동할 수 있습니다.");
          } else {
              canMove = true;
          }
      }

      if (canMove) {
          broadcastProfileUpdate({ 
              ...myProfile, 
              currentBlockId: blockId,
              lastActionTurn: data.currentTurn 
          });
      }
  };

  const advanceGlobalTurn = () => {
    if (!currentMap) return;
    
    const newBlocks = currentMap.blocks.map(block => {
        const occupants = players.filter(p => p.currentBlockId === block.id);
        const factionsPresent = new Set(occupants.map(p => p.factionId));
        let newBlock = { ...block };

        if (factionsPresent.size === 1) {
            const factionId = Array.from(factionsPresent)[0];
            if (block.ownerId !== factionId) {
                const currentProgress = block.occupationProgress || 0;
                const nextProgress = currentProgress + 1;
                if (nextProgress >= 3) {
                    newBlock.ownerId = factionId;
                    newBlock.occupationProgress = 0;
                } else {
                    newBlock.occupationProgress = nextProgress;
                }
            } else {
                 newBlock.occupationProgress = 0;
            }
        } else {
            newBlock.occupationProgress = 0;
        }
        return newBlock;
    });

    const newMap = { ...currentMap, blocks: newBlocks };
    const newMaps = data.maps.map(m => m.id === currentMapId ? newMap : m);
    const newTurn = (data.currentTurn || 1) + 1;
    const newData = { ...data, maps: newMaps, currentTurn: newTurn };
    setData(newData);

    if (networkMode === 'HOST') {
        broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: newData });
    }
  };

  // -- Combat Logic --
  
  const syncCombatState = (newState: CombatState) => {
      setCombatState(newState);
      if (networkMode === 'HOST') {
          broadcast({ type: 'SYNC_COMBAT_STATE', state: newState });
      } else {
          // If I am a client, I must tell the Host to update the state
          sendToHost({ type: 'SYNC_COMBAT_STATE', state: newState });
      }
  };

  const endCombat = (winnerFactionId: string | null, loserFactionId: string | null, reason: string) => {
      let finalLogs = [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `🏁 전투 종료! (${reason})`, type: 'SYSTEM' as const }];
      const winnerFaction = data.factions.find(f => f.id === winnerFactionId);
      const loserFaction = data.factions.find(f => f.id === loserFactionId);

      if (winnerFaction) {
          finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `🏆 승리: ${winnerFaction.name}`, type: 'SYSTEM' });
          const combatLocId = players.find(p => p.id === combatState.currentTurnPlayerId)?.currentBlockId;
          if (currentMap && combatLocId) {
              const newBlocks = currentMap.blocks.map(b => b.id === combatLocId ? { ...b, ownerId: winnerFactionId!, occupationProgress: 0 } : b);
              const newMap = { ...currentMap, blocks: newBlocks };
              updateMapData(data.maps.map(m => m.id === currentMapId ? newMap : m));
          }
      }

      if (loserFaction) {
           finalLogs.push({ id: generateId(), timestamp: Date.now(), text: `💀 패배: ${loserFaction.name}`, type: 'SYSTEM' });
           if (currentMap) {
               const unoccupiedBlocks = currentMap.blocks.filter(b => !b.ownerId);
               const targetPool = unoccupiedBlocks.length > 0 ? unoccupiedBlocks : currentMap.blocks;
               const losers = players.filter(p => p.factionId === loserFactionId);
               losers.forEach(loser => {
                   const randomBlock = targetPool[Math.floor(Math.random() * targetPool.length)];
                   broadcastProfileUpdate({ ...loser, currentBlockId: randomBlock.id });
               });
           }
      }
      const newState: CombatState = {
          isActive: false, currentTurnPlayerId: null, turnCount: 1, phase: 'ACTION', pendingAction: null, logs: finalLogs, factionDamage: {}, fledPlayerIds: []
      };
      syncCombatState(newState);
  };
  
  const checkCombatVictory = (currentState: CombatState) => {
      const combatants = players.filter(p => p.currentBlockId === players.find(x => x.id === currentState.currentTurnPlayerId)?.currentBlockId);
      const factionsInvolved = Array.from(new Set(combatants.map(p => p.factionId)));
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
          endCombat(winner.fid, loser?.fid || null, "적군 전멸/도주");
          return;
      }
      if (survivingFactions.length === 0) { endCombat(null, null, "무승부 (전원 불능)"); return; }
      if (currentState.turnCount > 5) {
          let minDamage = Infinity; let winnerId = null; let loserId = null;
          factionsInvolved.forEach(fid => {
               const dmg = currentState.factionDamage[fid] || 0;
               if (dmg < minDamage) { minDamage = dmg; winnerId = fid; } else { loserId = fid; }
          });
          if (winnerId) { endCombat(winnerId, loserId, "5턴 종료 (피해량 판정)"); } else { endCombat(null, null, "5턴 종료 (피해량 동점)"); }
      }
  };
  
  const toggleCombat = () => {
      let combatLocId: string | undefined;
      if (isAdmin && selectedPlayerId) {
          const targetPlayer = players.find(p => p.id === selectedPlayerId);
          combatLocId = targetPlayer?.currentBlockId;
      } else {
          combatLocId = myProfile?.currentBlockId;
      }

      if (!combatLocId) {
          alert("현재 맵 위에 있지 않습니다.");
          return;
      }

      const combatPlayers = players.filter(p => p.currentBlockId === combatLocId);
      if (combatPlayers.length === 0) return;
      const firstPlayerId = combatPlayers[0].id;
      const newState: CombatState = {
          isActive: !combatState.isActive, currentTurnPlayerId: !combatState.isActive ? firstPlayerId : null, turnCount: 1, phase: 'ACTION', pendingAction: null,
          logs: [{ id: generateId(), timestamp: Date.now(), text: !combatState.isActive ? "⚠️ 전투가 시작되었습니다!" : "🏁 전투가 중단되었습니다.", type: 'SYSTEM' }], factionDamage: {}, fledPlayerIds: []
      };
      syncCombatState(newState);
  };

  const nextTurn = () => {
      if (!combatState.isActive || players.length === 0) return;
      const combatLocId = players.find(p => p.id === combatState.currentTurnPlayerId)?.currentBlockId;
      const validPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0 && !combatState.fledPlayerIds.includes(p.id));
      if (validPlayers.length === 0) { endCombat(null, null, "전투원 없음"); return; }
      const currentIndex = validPlayers.findIndex(p => p.id === combatState.currentTurnPlayerId);
      const nextIndex = (currentIndex + 1) % validPlayers.length;
      const nextPlayer = validPlayers[nextIndex];
      const isNewRound = nextIndex === 0;
      const nextTurnCount = isNewRound ? combatState.turnCount + 1 : combatState.turnCount;
      const newState: CombatState = {
          ...combatState, currentTurnPlayerId: nextPlayer.id, turnCount: nextTurnCount, phase: 'ACTION', pendingAction: null,
          logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `⏩ ${nextPlayer.name}의 차례 (Round ${nextTurnCount})`, type: 'SYSTEM' as const }]
      };
      syncCombatState(newState);
      if (isNewRound && nextTurnCount > 5) { checkCombatVictory(newState); }
  };
  const addCombatLog = (text: string, type: 'ATTACK' | 'HEAL' | 'DEFEND' | 'SYSTEM' | 'FLEE') => {
      const newLog = { id: generateId(), timestamp: Date.now(), text, type };
      const newState = { ...combatState, logs: [...combatState.logs, newLog] };
      syncCombatState(newState);
  };

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
          } else { addCombatLog(`💦 [${source.name}] 치유 실패... (1D20=${checkRoll} ≤ ${checkThreshold})`, 'HEAL'); }
      } else if (type === 'ATTACK') {
          const { roll, maxDie } = rollFactionAttack(source.stats.attack);
          const newState: CombatState = {
              ...combatState, phase: 'RESPONSE', pendingAction: { type: 'ATTACK', sourceId: source.id, targetId: target.id, damageValue: roll, maxDie },
              logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: `⚔️ [${source.name}] 공격 ➔ [${target.name}] 데미지 ${roll} (1D${maxDie})! 대응하세요!`, type: 'ATTACK' }]
          };
          syncCombatState(newState);
      } else if (type === 'FLEE') {
          const { success, roll, threshold } = rollFactionFlee(combatState.turnCount);
          if (success) {
              addCombatLog(`💨 [${source.name}] 전투 이탈 성공! (1D20=${roll} > ${threshold})`, 'FLEE');
              const newState = { ...combatState, fledPlayerIds: [...combatState.fledPlayerIds, source.id] };
              syncCombatState(newState);
              checkCombatVictory(newState);
          } else { addCombatLog(`🚫 [${source.name}] 도주 실패... (1D20=${roll} ≤ ${threshold})`, 'FLEE'); }
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
      let damageUpdates: any = {};
      const applyDamage = (amount: number, targetProfile: FactionPlayerProfile) => {
           const dealt = Math.min(targetProfile.hp, amount);
           const newHp = targetProfile.hp - dealt;
           broadcastProfileUpdate({ ...targetProfile, hp: newHp });
           const fid = targetProfile.factionId;
           const currentTotal = combatState.factionDamage[fid] || 0;
           return { newHp, updatedDamage: { [fid]: currentTotal + dealt } };
      };

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
          const { success, checkRoll, healAmount } = rollFactionHeal(responder.stats.spirit);
          if (success) {
               const newHealTarget = { ...healTarget, hp: Math.min(healTarget.maxHp, healTarget.hp + healAmount) };
               if (healTarget.id === originalTarget.id) {
                   const afterDmg = Math.max(0, originalTarget.hp - finalDamage);
                   newHealTarget.hp = Math.min(healTarget.maxHp, afterDmg + healAmount);
               }
               broadcastProfileUpdate(newHealTarget);
               logText = `➕ [${responder.name}] 맞으면서 치유! [${originalTarget.name}] ${pending.damageValue} 피해. [${healTarget.name}] +${healAmount} 회복.`;
          } else { logText = `💦 [${responder.name}] 치유 시도했으나 실패. [${originalTarget.name}] ${pending.damageValue} 피해만 받음.`; }
          addCombatLog(logText, 'HEAL');
      } else if (type === 'FLEE') {
          const { success, roll, threshold } = rollFactionFlee(combatState.turnCount);
          if (success) {
              logText = `💨 [${responder.name}] 도주 성공! 공격을 회피했습니다. (1D20=${roll} > ${threshold})`;
              const newState = { ...combatState, fledPlayerIds: [...combatState.fledPlayerIds, responder.id] };
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
      const newFactionDamage = { ...combatState.factionDamage };
      Object.entries(damageUpdates).forEach(([fid, amt]) => { newFactionDamage[fid] = (newFactionDamage[fid] || 0) + (amt as number); });
      const resetState: CombatState = {
          ...combatState, phase: 'ACTION', pendingAction: null, factionDamage: newFactionDamage, logs: [...combatState.logs, { id: generateId(), timestamp: Date.now(), text: logText, type: 'SYSTEM' }]
      };
      syncCombatState(resetState);
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

        {/* Announcement Modal */}
        {announcement && (
            <Modal
                isOpen={true}
                title="📣 시스템 공지"
                onClose={() => setAnnouncement(null)}
                maxWidth="max-w-md"
                footer={<Button variant="primary" onClick={() => setAnnouncement(null)}>확인</Button>}
            >
                <div className="flex flex-col items-center text-center p-2">
                    <div className="bg-orange-900/30 p-4 rounded-full mb-4 border border-orange-500/50">
                        <Megaphone size={40} className="text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{announcement.title}</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{announcement.message}</p>
                </div>
            </Modal>
        )}

        {showCombatUI && (
            <FactionCombatUI 
                myProfile={myProfile}
                players={players}
                combatState={combatState}
                onAction={handleCombatAction}
                onResponse={handleCombatResponse}
                chatMessages={chatMessages}
                onSendMessage={handleSendMessage}
            />
        )}

        <FactionHUD 
            title={data.title}
            currentMap={currentMap}
            currentTurn={data.currentTurn || 1}
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

        {/* Main Content Area - Mobile Optimized */}
        <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
            {/* Scrollable Map Container */}
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                <FactionMapCanvas 
                    currentMap={currentMap} 
                    players={players}
                    isAdmin={isAdmin}
                    myProfile={myProfile} 
                    onBlockClick={handleBlockClick}
                    factions={data.factions}
                />
            </div>

            {/* Waiting For Next Turn Overlay */}
            {!isAdmin && isTurnFinished && !combatState.isActive && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in pointer-events-none">
                    <div className="bg-[#1e1e1e] p-6 rounded-2xl border border-[#444] shadow-2xl flex flex-col items-center max-w-xs text-center pointer-events-auto">
                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 animate-pulse">
                            <Lock size={24} className="text-gray-400" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">행동 완료</h2>
                            <p className="text-gray-400 text-sm mb-4">
                                다음 턴 대기 중...
                            </p>
                            <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-gray-700">
                            <Hourglass size={14} className="text-orange-400 animate-spin-slow" />
                            <span className="font-mono font-bold text-sm text-orange-400">TURN {data.currentTurn}</span>
                            </div>
                    </div>
                </div>
            )}
        </div>

        {/* Mobile Floating Buttons */}
        <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-2">
            <button 
                onClick={() => setIsLeftSidebarOpen(true)}
                className="bg-indigo-600 p-3 rounded-full shadow-lg text-white hover:bg-indigo-500 active:scale-95 transition-transform"
            >
                <Menu size={24} />
            </button>
        </div>
        <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
            <button 
                onClick={() => setIsRightSidebarOpen(true)}
                className="bg-orange-600 p-3 rounded-full shadow-lg text-white hover:bg-orange-500 active:scale-95 transition-transform relative"
            >
                <MessageSquare size={24} />
                {chatMessages.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1a1a]"></span>}
            </button>
        </div>

        {/* Mobile Sidebar Modals */}
        <Modal isOpen={isLeftSidebarOpen} onClose={() => setIsLeftSidebarOpen(false)} title="진영 현황" maxWidth="max-w-full">
             <div className="h-[60vh] flex flex-col">
                <FactionSidebar 
                    data={data}
                    players={players}
                    myProfile={myProfile}
                    isAdmin={isAdmin}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={(id) => { setSelectedPlayerId(id); setIsLeftSidebarOpen(false); if(isAdmin && id) setIsRightSidebarOpen(true); }}
                    onUpdateProfile={(updates) => myProfile && broadcastProfileUpdate({ ...myProfile, ...updates })}
                />
             </div>
        </Modal>

        <Modal isOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} title={isAdmin && selectedAdminPlayer ? "플레이어 관리" : "채팅"} maxWidth="max-w-full">
            <div className="h-[60vh] flex flex-col">
                {isAdmin && selectedAdminPlayer ? (
                     <FactionAdminPanel 
                        selectedPlayer={selectedAdminPlayer}
                        onClose={() => setSelectedPlayerId(null)}
                        onUpdatePlayer={updateAdminPlayer}
                        combatActive={combatState.isActive}
                        onToggleCombat={toggleCombat}
                        onNextTurn={nextTurn}
                        onAdvanceGlobalTurn={advanceGlobalTurn}
                        onSendAnnouncement={sendAdminAnnouncement}
                     />
                ) : (
                    <FactionChatSidebar 
                        data={data}
                        myProfile={myProfile}
                        isAdmin={isAdmin}
                        chatMessages={chatMessages}
                        onSendMessage={handleSendMessage}
                    />
                )}
            </div>
        </Modal>

    </div>
  );
};
