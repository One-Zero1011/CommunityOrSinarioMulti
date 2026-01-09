import React, { useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, CombatState, FactionMap, FactionChatMessage, CombatLogEntry } from '../../types';
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
  
  // Active Combats State (Key: Block ID)
  const [activeCombats, setActiveCombats] = useState<Record<string, CombatState>>({});
  
  // Admin View State
  const [adminCombatViewOpen, setAdminCombatViewOpen] = useState(false);

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
  let combatToDisplay: CombatState | undefined;
  
  if (isAdmin && selectedPlayerId) {
      const target = players.find(p => p.id === selectedPlayerId);
      if (target?.currentBlockId) {
          combatToDisplay = activeCombats[target.currentBlockId];
      }
  } else if (myProfile?.currentBlockId) {
      combatToDisplay = activeCombats[myProfile.currentBlockId];
  }

  const isCombatActiveForView = combatToDisplay?.isActive || false;
  
  // Admin Combat View Logic
  useEffect(() => {
      if (combatToDisplay?.isActive && isAdmin) {
          if (combatToDisplay.turnCount === 1 && combatToDisplay.logs.length <= 1) {
              setAdminCombatViewOpen(true);
          }
      }
  }, [combatToDisplay?.isActive, isAdmin, combatToDisplay?.turnCount]);

  const showCombatUI = isCombatActiveForView && (
      (isAdmin && adminCombatViewOpen) || 
      (!isAdmin)
  );

  // -- Network Logic --

  useEffect(() => {
    if (networkMode === 'SOLO') startHost();
  }, [networkMode, startHost]);

  useEffect(() => {
    if (networkMode === 'HOST') {
        const interval = setInterval(() => {
            broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
            if (Object.keys(activeCombats).length > 0) {
                broadcast({ type: 'SYNC_COMBAT_STATE', combats: activeCombats });
            }
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [networkMode, broadcast, data, activeCombats]);

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
                setActiveCombats(msg.combats);
                broadcast({ type: 'SYNC_COMBAT_STATE', combats: msg.combats });
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
                setActiveCombats(msg.combats);
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

      // Restrict movement if in combat
      if (activeCombats[myProfile.currentBlockId || '']?.isActive) {
          alert("전투 중에는 이동할 수 없습니다. '도주'를 사용하세요.");
          return;
      }

      const targetBlock = currentMap.blocks.find(b => b.id === blockId);
      if (!targetBlock) return;

      if (myProfile.lastActionTurn === data.currentTurn) {
          return;
      }

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
        // Skip blocks with active combat
        if (activeCombats[block.id]?.isActive) {
            return block;
        }

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

  // -- Combat Logic (Multi-instance) --
  
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
          if (currentMap) {
              const newBlocks = currentMap.blocks.map(b => b.id === blockId ? { ...b, ownerId: winnerFactionId!, occupationProgress: 0 } : b);
              const newMap = { ...currentMap, blocks: newBlocks };
              updateMapData(data.maps.map(m => m.id === currentMapId ? newMap : m));
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
  
  const toggleCombat = (targetBlockId?: string) => {
      let combatLocId = targetBlockId;
      
      // Determine location if not provided
      if (!combatLocId) {
          if (isAdmin && selectedPlayerId) {
              const targetPlayer = players.find(p => p.id === selectedPlayerId);
              combatLocId = targetPlayer?.currentBlockId;
          } else {
              combatLocId = myProfile?.currentBlockId;
          }
      }

      if (!combatLocId) {
          alert("유효한 전투 위치가 아닙니다.");
          return;
      }

      const combatPlayers = players.filter(p => p.currentBlockId === combatLocId && p.hp > 0);
      if (combatPlayers.length === 0) return;

      const existingCombat = activeCombats[combatLocId];

      if (!existingCombat) {
          // Start Combat
          const factionsInvolved = Array.from(new Set(combatPlayers.map(p => p.factionId))) as string[];
          
          const factionInitiative = factionsInvolved.map(fid => {
              const members = combatPlayers.filter(p => p.factionId === fid);
              const totalAgility = members.reduce((sum, p) => sum + p.stats.agility, 0);
              const sortedMembers = [...members].sort((a, b) => b.stats.agility - a.stats.agility);
              return { fid, totalAgility, members: sortedMembers };
          });

          factionInitiative.sort((a, b) => b.totalAgility - a.totalAgility);
          const turnOrder = factionInitiative.flatMap(f => f.members.map(p => p.id));
          const firstPlayerId = turnOrder[0];

          const newState: CombatState = {
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
          updateCombatState(combatLocId, newState);
      } else {
          // Stop Combat
          // Just remove it or mark as inactive? Removing is cleaner for "Stop"
          // If we want to keep logs, we could keep it but set isActive: false. 
          // For now, let's remove it to clear the state fully.
          updateCombatState(combatLocId, undefined);
      }
  };

  const resolveTurn = (targetBlockId?: string, extraLogs: CombatLogEntry[] = [], damageUpdates: Record<string, number> = {}) => {
      const blockId = targetBlockId || combatToDisplay?.combatBlockId;
      if (!blockId) return;
      
      const currentCombat = activeCombats[blockId];
      if (!currentCombat || !currentCombat.isActive) return;

      const { turnOrder } = currentCombat;
      if (turnOrder.length === 0) return;

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
      // Find which combat this belongs to (My location)
      const blockId = myProfile?.currentBlockId;
      if (!blockId || !activeCombats[blockId]) return;
      const combat = activeCombats[blockId];

      const source = myProfile;
      const target = players.find(p => p.id === targetId);
      if (!target && type !== 'FLEE') return; // Flee targets self effectively

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
          const newLog: CombatLogEntry = { id: generateId(), timestamp: Date.now(), text: logText, type: 'HEAL' };
          resolveTurn(blockId, [newLog]);

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
          let logText = "";
          let extraLog: CombatLogEntry;
          
          if (success) {
              logText = `💨 [${source!.name}] 전투 이탈 성공! (1D20=${roll} > ${threshold})`;
              extraLog = { id: generateId(), timestamp: Date.now(), text: logText, type: 'FLEE' };
              
              // Local update for immediate check
              const updatedCombat = { ...combat, fledPlayerIds: [...combat.fledPlayerIds, source!.id] };
              updateCombatState(blockId, updatedCombat); // Sync flee state
              resolveTurn(blockId, [extraLog]);
          } else { 
              logText = `🚫 [${source!.name}] 도주 실패... (1D20=${roll} ≤ ${threshold})`; 
              extraLog = { id: generateId(), timestamp: Date.now(), text: logText, type: 'FLEE' };
              resolveTurn(blockId, [extraLog]);
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
          logText = `🛡️ [${responder!.name}] 대리 방어! [${originalTarget.name}] 대신 맞음. (1D${maxDie}=${roll}) ➔ ${finalDamage} 피해.`;
          
      } else if (type === 'HEAL') {
          finalDamage = pending.damageValue;
          const res1 = applyDamage(finalDamage, originalTarget);
          damageUpdates[res1.fid] = (damageUpdates[res1.fid] || 0) + res1.damageDealt;
          
          const healTarget = players.find(p => p.id === responseTargetId) || responder;
          const { success, checkRoll, healAmount } = rollFactionHeal(responder!.stats.spirit);
          if (success) {
               const newHealTarget = { ...healTarget!, hp: Math.min(healTarget!.maxHp, healTarget!.hp + healAmount) };
               if (healTarget!.id === originalTarget.id) {
                   const afterDmg = Math.max(0, originalTarget.hp - finalDamage);
                   newHealTarget.hp = Math.min(healTarget!.maxHp, afterDmg + healAmount);
               }
               broadcastProfileUpdate(newHealTarget);
               logText = `➕ [${responder!.name}] 맞으면서 치유! [${originalTarget.name}] ${pending.damageValue} 피해. [${healTarget!.name}] +${healAmount} 회복.`;
          } else { 
              logText = `💦 [${responder!.name}] 치유 시도했으나 실패. [${originalTarget.name}] ${pending.damageValue} 피해만 받음.`; 
          }
          
      } else if (type === 'FLEE') {
          const { success, roll, threshold } = rollFactionFlee(combat.turnCount);
          if (success) {
              logText = `💨 [${responder!.name}] 도주 성공! 공격을 회피했습니다. (1D20=${roll} > ${threshold})`;
              // Update local state temporarily for flee
              combat.fledPlayerIds.push(responder!.id);
          } else {
              finalDamage = pending.damageValue;
              const res = applyDamage(finalDamage, responder!);
              damageUpdates[res.fid] = (damageUpdates[res.fid] || 0) + res.damageDealt;
              logText = `🚫 [${responder!.name}] 도주 실패! 붙잡혀서 ${pending.damageValue} 피해 받음. (1D20=${roll} ≤ ${threshold})`;
          }
      }

      // Auto-advance
      const newLog: CombatLogEntry = { id: generateId(), timestamp: Date.now(), text: logText, type: type === 'COUNTER' ? 'ATTACK' : (type === 'HEAL' ? 'HEAL' : (type === 'FLEE' ? 'FLEE' : 'DEFEND')) };
      resolveTurn(blockId, [newLog], damageUpdates);
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

        {showCombatUI && combatToDisplay && (
            <FactionCombatUI 
                myProfile={myProfile}
                players={players}
                combatState={combatToDisplay}
                onAction={handleCombatAction}
                onResponse={handleCombatResponse}
                chatMessages={chatMessages}
                onSendMessage={handleSendMessage}
                isAdmin={isAdmin}
                onClose={() => setAdminCombatViewOpen(false)}
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
            combatActive={!!combatToDisplay?.isActive}
            onWatchCombat={() => setAdminCombatViewOpen(true)}
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
            {!isAdmin && isTurnFinished && !isCombatActiveForView && (
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
                        combatActive={!!(selectedAdminPlayer.currentBlockId && activeCombats[selectedAdminPlayer.currentBlockId]?.isActive)}
                        onToggleCombat={() => toggleCombat(selectedAdminPlayer.currentBlockId)}
                        onNextTurn={() => resolveTurn(selectedAdminPlayer.currentBlockId)}
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