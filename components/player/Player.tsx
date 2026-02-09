
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameData, MapObject, Character, ResultType, OutcomeDef, ChatMessage } from '../../types';
import { rollStatChallenge, getResultColor, getResultLabel, RollDetails, checkGlobalConditions, applyGlobalOperations } from '../../lib/game-logic';
import { getShapeStyle as getShapeStyleLib } from '../../lib/styles';
import { generateId } from '../../lib/utils';
import { PlayerHUD } from './PlayerHUD';
import { PlayerSidebar } from './PlayerSidebar';
import { InteractionModal } from './InteractionModal';
import { ActionSelectionModal } from './ActionSelectionModal';
import { CharacterSetupModal } from './CharacterSetupModal';
import { Wifi, Copy, Check, User, Megaphone, EyeOff } from 'lucide-react';
import { usePlayerMovement } from '../../hooks/usePlayerMovement';
import { useNetwork } from '../../hooks/useNetwork';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface PlayerProps {
  gameData: GameData;
  onExit: () => void;
  network: ReturnType<typeof useNetwork>;
}

const CHAR_SIZE = 64;

export const Player: React.FC<PlayerProps> = ({ 
    gameData: initialGameData, 
    onExit,
    network
}) => {
  const { networkMode, connections, hostConnection, broadcast, sendToHost } = network;
  const [gameData, setGameData] = useState<GameData>(initialGameData);
  const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');
  const [currentMapId, setCurrentMapId] = useState(initialGameData.startMapId || initialGameData.maps[0]?.id);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharId, setActiveCharId] = useState('');
  const [isCharSetupOpen, setIsCharSetupOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [interactionResult, setInteractionResult] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcement, setAnnouncement] = useState<{title: string, message: string} | null>(null);
  
  // New: Selection Modal State
  const [selectionObject, setSelectionObject] = useState<MapObject | null>(null);

  const remoteTargets = useRef<Record<string, { x: number, y: number, mapId: string }>>({});
  const stateRef = useRef({ characters, currentMapId, interactionResult, chatMessages, gameData, activeCharId });
  useEffect(() => { stateRef.current = { characters, currentMapId, interactionResult, chatMessages, gameData, activeCharId }; }, [characters, currentMapId, interactionResult, chatMessages, gameData, activeCharId]);

  const currentMap = gameData.maps.find(m => m.id === currentMapId);
  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];
  const visibleCharacters = characters.filter(c => c.mapId === currentMapId || (!c.mapId && currentMapId === gameData.startMapId));
  const visibleObjects = currentMap?.objects.filter(obj => isAdmin || !obj.hidden) || [];

  const renderList = useMemo(() => {
    const list: (({ type: 'OBJ', data: MapObject }) | ({ type: 'CHAR', data: Character }))[] = [];
    visibleObjects.forEach(obj => list.push({ type: 'OBJ', data: obj }));
    visibleCharacters.forEach(char => list.push({ type: 'CHAR', data: char }));
    return list.sort((a, b) => (a.type === 'OBJ' ? (a.data.zIndex ?? 10) : 50) - (b.type === 'OBJ' ? (b.data.zIndex ?? 10) : 50));
  }, [visibleObjects, visibleCharacters]);

  usePlayerMovement({ 
      characters, 
      activeCharId, 
      currentMapId, 
      networkMode, 
      isModalOpen: !!interactionResult || isCharSetupOpen || !!selectionObject, 
      objects: currentMap?.objects || [], 
      mapWidth: currentMap?.width, 
      mapHeight: currentMap?.height, 
      setCharacters, 
      onSendMoveAction: (charId, x, y, mapId) => { 
          if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_MOVE_CHAR', charId, x, y, mapId }); 
          else if (networkMode === 'HOST') broadcast({ type: 'ON_MOVE_CHAR', charId, x, y, mapId }); 
      } 
  });

  const getSpawnPosition = (mapId: string) => {
      const map = stateRef.current.gameData.maps.find(m => m.id === mapId);
      if (!map) return { x: 100, y: 400 };
      const spawn = map.objects.find(o => o.type === 'SPAWN_POINT');
      if (spawn) return { x: spawn.x, y: spawn.y };
      return { x: 100, y: 400 };
  };

  useEffect(() => {
    const handleAction = (data: any) => {
        const currentState = stateRef.current;
        const currentMap = currentState.gameData.maps.find(m => m.id === currentState.currentMapId);
        if (networkMode === 'HOST') {
            switch (data.type) {
                case 'REQUEST_ACTION':
                    if (data.action === 'CLICK_OBJECT') {
                        // Standard Roll/Move/Basic Request
                        const obj = currentMap?.objects.find((o: any) => o.id === data.objectId);
                        if (obj && (!obj.hidden || isAdmin)) handleInteractionLogic(obj, 'INSPECT');
                    } else if (data.action === 'MOVE_MAP') {
                        handleMoveLogic(data.targetMapId);
                    } else if (data.action === 'CLOSE_MODAL') {
                        setInteractionResult(null);
                    }
                    break;
                case 'REQUEST_SUB_ACTION':
                    // Custom Sub-Action Request
                    const obj = currentMap?.objects.find((o: any) => o.id === data.objectId);
                    if (obj) handleInteractionLogic(obj, 'CUSTOM', data.subActionId);
                    break;
                case 'REQUEST_TOGGLE_OBJECT_VISIBILITY': handleToggleVisibilityLogic(data.mapId, data.objectId, data.hidden); break;
                case 'REQUEST_CHAR_UPDATE': setCharacters(prev => { const newChars = prev.map(c => c.id === data.charId ? { ...c, ...data.updates } : c); broadcast({ type: 'SYNC_STATE', payload: { ...currentState, characters: newChars } }); return newChars; }); break;
                case 'REQUEST_ADD_CHAR': setCharacters(prev => { const newChars = [...prev, data.character]; broadcast({ type: 'SYNC_STATE', payload: { ...currentState, characters: newChars } }); return newChars; }); break;
                case 'REQUEST_CHAT': setChatMessages(prev => [...prev, { id: generateId(), senderName: data.senderName, text: data.text, timestamp: Date.now(), isSystem: false }]); break;
                case 'REQUEST_MOVE_CHAR': remoteTargets.current[data.charId] = { x: data.x, y: data.y, mapId: data.mapId }; setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, x: data.x, y: data.y, mapId: data.mapId } : c)); broadcast({ type: 'ON_MOVE_CHAR', charId: data.charId, x: data.x, y: data.y, mapId: data.mapId }); break;
            }
        } else if (networkMode === 'CLIENT') {
            if (data.type === 'SYNC_STATE') {
                const { characters: sChars, interactionResult: sRes, chatMessages: sChat } = data.payload;
                setCharacters(sChars); sChars.forEach((c: Character) => { remoteTargets.current[c.id] = { x: c.x, y: c.y, mapId: c.mapId || '' }; });
                setInteractionResult(sRes); if (sChat) setChatMessages(sChat); setIsDataLoaded(true);
            } else if (data.type === 'ON_MOVE_CHAR') {
                remoteTargets.current[data.charId] = { x: data.x, y: data.y, mapId: data.mapId };
                setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, x: data.x, y: data.y, mapId: data.mapId } : c));
            } else if (data.type === 'SYNC_GAMEDATA') { setGameData(data.payload); setIsDataLoaded(true); }
            else if (data.type === 'ADMIN_ANNOUNCEMENT' && (data.targetId === null || data.targetId === currentState.activeCharId)) setAnnouncement({ title: data.title, message: data.message });
        }
    };
    if (networkMode === 'HOST') connections.forEach(conn => { conn.off('data'); conn.on('data', handleAction); });
    else if (networkMode === 'CLIENT' && hostConnection) { hostConnection.off('data'); hostConnection.on('data', handleAction); }
  }, [networkMode, connections, hostConnection, isAdmin]);

  const handleAdminLogin = (key: string) => { if (gameData.adminKey && key === gameData.adminKey) { setIsAdmin(true); alert("운영자 권한을 획득했습니다."); } else alert("운영자 키가 올바르지 않습니다."); };
  const handleSendMessage = (text: string) => { const senderName = networkMode === 'HOST' ? (isAdmin ? 'GM (Host)' : 'Host') : (isAdmin ? 'GM' : (activeChar?.name || '익명')); if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_CHAT', text, senderName }); else { const newMsg = { id: generateId(), senderName, text, timestamp: Date.now(), isSystem: false }; setChatMessages(prev => [...prev, newMsg]); if (networkMode === 'HOST') broadcast({ type: 'REQUEST_CHAT', ...newMsg }); } };
  const handleToggleVisibility = (mapId: string, objectId: string, hidden: boolean) => { if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_TOGGLE_OBJECT_VISIBILITY', mapId, objectId, hidden }); else handleToggleVisibilityLogic(mapId, objectId, hidden); };
  const handleToggleVisibilityLogic = (mapId: string, objectId: string, hidden: boolean) => { setGameData(prev => { const newMaps = prev.maps.map(m => m.id === mapId ? { ...m, objects: m.objects.map(obj => obj.id === objectId ? { ...obj, hidden } : obj) } : m); const newData = { ...prev, maps: newMaps }; if (networkMode === 'HOST') broadcast({ type: 'SYNC_GAMEDATA', payload: newData }); return newData; }); };
  
  const handleSummonPlayer = (targetId: string | 'ALL') => { 
      if (!isAdmin) return; 
      const pos = getSpawnPosition(currentMapId);
      const executeSummon = (charId: string) => { 
          if (networkMode === 'HOST') { 
              setCharacters(prev => prev.map(c => c.id === charId ? { ...c, mapId: currentMapId, x: pos.x, y: pos.y } : c)); 
              broadcast({ type: 'ON_MOVE_CHAR', charId: charId, x: pos.x, y: pos.y, mapId: currentMapId }); 
          } else {
              sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: charId, x: pos.x, y: pos.y, mapId: currentMapId }); 
          }
      }; 
      if (targetId === 'ALL') characters.forEach(c => executeSummon(c.id)); else executeSummon(targetId); 
  };
  
  const handleMoveLogic = (mapId: string) => { 
      if (stateRef.current.gameData.maps.find(m => m.id === mapId)) { 
          setCurrentMapId(mapId); 
          setInteractionResult(null); 
          const pos = getSpawnPosition(mapId);
          setCharacters(prev => prev.map(c => c.id === activeCharId ? {...c, mapId: mapId, x: pos.x, y: pos.y} : c)); 
          if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: activeCharId, x: pos.x, y: pos.y, mapId: mapId }); 
          else broadcast({ type: 'ON_MOVE_CHAR', charId: activeCharId, x: pos.x, y: pos.y, mapId: mapId }); 
      } 
  };

  // Helper to sync global variables across network
  const syncGlobalVariables = (newData: GameData) => {
      setGameData(newData);
      if (networkMode === 'HOST') {
          broadcast({ type: 'SYNC_GAMEDATA', payload: newData });
      }
  };

  // 1. Initial Click Handler (Determines if menu is needed)
  const handleObjectClick = (obj: MapObject) => { 
      if (obj.type === 'SPAWN_POINT') return;
      if (obj.isSingleUse && activeChar && activeChar.interactedObjectIds?.includes(obj.id)) { return; }

      // Check for available actions
      const hasInspect = obj.useProbability;
      const hasDescription = !!obj.description && obj.description.trim() !== "";
      const hasSubActions = obj.subActions && obj.subActions.length > 0;
      const hasMove = !!obj.targetMapId && !hasInspect; // Pure move object

      // Count options
      let optionCount = 0;
      if (hasInspect) optionCount++;
      if (hasDescription) optionCount++;
      if (hasSubActions) optionCount += obj.subActions!.length;
      if (hasMove) optionCount++;

      // If multiple options, show menu locally (no network yet)
      if (optionCount > 1 || hasSubActions) {
          setSelectionObject(obj);
      } else {
          // If only one option, execute immediately
          // Default to INSPECT if available, else BASIC/MOVE
          if (hasInspect) executeInteraction(obj, 'INSPECT');
          else if (hasDescription) executeInteraction(obj, 'BASIC');
          else if (hasMove) executeInteraction(obj, 'MOVE');
          else executeInteraction(obj, 'BASIC'); // Fallback
      }
  };

  // 2. Execute Specific Interaction (Sends Network Request)
  const executeInteraction = (obj: MapObject, type: 'INSPECT' | 'BASIC' | 'MOVE' | 'CUSTOM', subActionId?: string) => {
      setSelectionObject(null); // Close menu if open

      if (type === 'MOVE') {
          if (obj.targetMapId) handleMoveLogic(obj.targetMapId);
          return;
      }

      if (networkMode === 'CLIENT') {
          if (type === 'CUSTOM' && subActionId) {
              sendToHost({ type: 'REQUEST_SUB_ACTION', objectId: obj.id, subActionId });
          } else {
              if (type === 'INSPECT' || (type === 'BASIC' && !obj.useProbability)) {
                  sendToHost({ type: 'REQUEST_ACTION', action: 'CLICK_OBJECT', objectId: obj.id });
              } else if (type === 'BASIC') {
                  // Basic interaction check happens on client for immediate feedback if solo, but logic is on host usually.
                  // However, for pure description viewing, simple check is ok.
                  // But we need to check variables. Client might not have latest state if not synced perfectly?
                  // Better to request from host to ensure consistency.
                  sendToHost({ type: 'REQUEST_ACTION', action: 'CLICK_OBJECT', objectId: obj.id });
              }
          }
      } else {
          // HOST
          handleInteractionLogic(obj, type, subActionId);
      }
  };

  // 3. Logic Processor (Host Side)
  const handleInteractionLogic = (obj: MapObject, type: 'INSPECT' | 'BASIC' | 'MOVE' | 'CUSTOM', subActionId?: string) => {
    
    const applyVisibilityTriggers = (revealId?: string, hideId?: string) => { if (revealId) handleToggleVisibility(currentMapId, revealId, false); if (hideId) handleToggleVisibility(currentMapId, hideId, true); };

    // Move Logic
    if (type === 'MOVE') {
        if (obj.targetMapId) handleMoveLogic(obj.targetMapId);
        return;
    }

    const currentState = stateRef.current;
    const globalVars = currentState.gameData.globalVariables || [];

    // Custom Sub Action Logic
    if (type === 'CUSTOM' && subActionId) {
        const subAction = obj.subActions?.find(a => a.id === subActionId);
        if (subAction) {
            // Check Requirements
            const check = checkGlobalConditions(globalVars, subAction.reqConditions);
            if (!check.passed) {
                alert(`조건 불충족: ${check.reason}`);
                return;
            }

            // Check for PROBABILITY or BASIC sub-action
            if (subAction.actionType === 'PROBABILITY' && subAction.data) {
                // Perform Roll Logic for Sub Action
                if (!activeChar) { alert("탐사자를 먼저 생성해주세요."); return; }
                
                const tempObj = { 
                    ...obj, // Base properties
                    useProbability: true,
                    statMethod: subAction.statMethod,
                    targetStatId: subAction.targetStatId,
                    difficultyValue: subAction.difficultyValue,
                    successTargetValue: subAction.successTargetValue,
                    data: subAction.data
                };

                const { result: resultType, details } = rollStatChallenge(tempObj, activeChar, gameData.customStats || []);
                const outcome = subAction.data.outcomes[resultType];
                
                // Apply Effects
                applyVisibilityTriggers(outcome.revealObjectId, outcome.hideObjectId);
                
                // Variable Operations (Outcome)
                const newVars = applyGlobalOperations(globalVars, outcome.operations);
                if (newVars !== globalVars) syncGlobalVariables({ ...currentState.gameData, globalVariables: newVars });

                setCharacters(prev => prev.map(c => c.id === activeCharId ? { 
                    ...c, 
                    hp: Math.min(c.maxHp, c.hp + outcome.hpChange), 
                    inventory: outcome.itemDrop ? [...c.inventory, outcome.itemDrop] : c.inventory
                } : c));

                const resultData: any = { 
                    objectName: subAction.label, // Use sub-action label 
                    description: `[${subAction.label}]\n(판정 결과)`, 
                    hasRoll: true, 
                    type: resultType, 
                    outcome, 
                    rollDetails: details,
                    targetMapId: outcome.targetMapId
                };
                
                if (resultData.targetMapId) resultData.targetMapName = stateRef.current.gameData.maps.find(m => m.id === resultData.targetMapId)?.name;
                setInteractionResult(resultData);

            } else {
                // Basic Action
                applyVisibilityTriggers(subAction.revealObjectId, subAction.hideObjectId);
                
                // Variable Operations (Basic)
                const newVars = applyGlobalOperations(globalVars, subAction.operations);
                if (newVars !== globalVars) syncGlobalVariables({ ...currentState.gameData, globalVariables: newVars });

                const resultData: any = { 
                    objectName: obj.label, 
                    description: `[${subAction.label}]\n${subAction.text || ''}`, 
                    hasRoll: false,
                    targetMapId: subAction.targetMapId
                };
                
                if (resultData.targetMapId) resultData.targetMapName = stateRef.current.gameData.maps.find(m => m.id === resultData.targetMapId)?.name;
                setInteractionResult(resultData);
            }
        }
        return;
    }

    // Main Object Requirement Check
    const mainCheck = checkGlobalConditions(globalVars, obj.reqConditions);
    if (!mainCheck.passed) {
        alert(`조건 불충족: ${mainCheck.reason}`);
        return;
    }

    // Basic Logic (Just Description)
    if (type === 'BASIC') {
        // Variable Operations (Basic Main Object)
        const newVars = applyGlobalOperations(globalVars, obj.operations);
        if (newVars !== globalVars) syncGlobalVariables({ ...currentState.gameData, globalVariables: newVars });

        setInteractionResult({ objectName: obj.label, description: obj.description, hasRoll: false });
        return;
    }

    // Inspect Logic (Roll) - Main Object
    let resultData: {
        objectName: string;
        description?: string;
        hasRoll: boolean;
        type?: ResultType;
        outcome?: OutcomeDef;
        rollDetails?: RollDetails;
        targetMapId?: string;
        targetMapName?: string;
    } = { objectName: obj.label, description: obj.description, hasRoll: false };

    if (obj.useProbability && obj.data) {
        if (!activeChar) { alert("탐사자를 먼저 생성해주세요."); return; }
        const { result: resultType, details } = rollStatChallenge(obj, activeChar, gameData.customStats || []);
        const outcome = obj.data.outcomes[resultType];
        applyVisibilityTriggers(outcome.revealObjectId, outcome.hideObjectId);
        
        // Variable Operations (Outcome)
        const newVars = applyGlobalOperations(globalVars, outcome.operations);
        if (newVars !== globalVars) syncGlobalVariables({ ...currentState.gameData, globalVariables: newVars });

        // Update character state
        setCharacters(prev => prev.map(c => c.id === activeCharId ? { 
            ...c, 
            hp: Math.min(c.maxHp, c.hp + outcome.hpChange), 
            inventory: outcome.itemDrop ? [...c.inventory, outcome.itemDrop] : c.inventory,
            interactedObjectIds: obj.isSingleUse ? [...(c.interactedObjectIds || []), obj.id] : c.interactedObjectIds 
        } : c));

        resultData = { ...resultData, hasRoll: true, type: resultType, outcome, rollDetails: details };
        if (outcome.targetMapId) resultData.targetMapId = outcome.targetMapId;
    } else {
        // Fallback for non-prob object treated as Inspect (shouldn't happen often)
        applyVisibilityTriggers(obj.revealObjectId, obj.hideObjectId);
        // Basic operations applied here if somehow reached
        const newVars = applyGlobalOperations(globalVars, obj.operations);
        if (newVars !== globalVars) syncGlobalVariables({ ...currentState.gameData, globalVariables: newVars });

        if (obj.targetMapId) resultData.targetMapId = obj.targetMapId;
        if (obj.isSingleUse) {
             setCharacters(prev => prev.map(c => c.id === activeCharId ? { 
                ...c, 
                interactedObjectIds: [...(c.interactedObjectIds || []), obj.id] 
            } : c));
        }
    }
    
    if (resultData.targetMapId) resultData.targetMapName = stateRef.current.gameData.maps.find(m => m.id === resultData.targetMapId)?.name;
    setInteractionResult(resultData);
  };

  const handleAddCharacterLogic = (character: Character) => { 
      const pos = getSpawnPosition(character.mapId || currentMapId);
      const newChar = { ...character, x: pos.x, y: pos.y };
      setCharacters(prev => [...prev, newChar]); 
      if (networkMode === 'HOST') { 
          setActiveCharId(newChar.id); 
          broadcast({ type: 'SYNC_STATE', payload: { ...stateRef.current, characters: [...stateRef.current.characters, newChar] } }); 
      } else if (networkMode === 'CLIENT') { 
          setActiveCharId(newChar.id); 
          sendToHost({ type: 'REQUEST_ADD_CHAR', character: newChar }); 
      } 
  };

  if (!isDataLoaded) return <div className="flex h-screen items-center justify-center bg-[#2e2e2e] text-white flex-col gap-4"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div><p>데이터 동기화 중...</p></div>;

  return (
    <div className="flex h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <PlayerHUD currentMapName={currentMap?.name || 'Unknown'} onExit={onExit} isAdmin={isAdmin} />
        <div className="flex-1 relative overflow-auto bg-[#252525] p-8 flex items-center justify-center">
            {currentMap ? (
                <div 
                    className="relative shadow-2xl shrink-0 transition-all duration-300" 
                    style={{ 
                        width: `${currentMap.width || 1200}px`, 
                        height: `${currentMap.height || 800}px`, 
                        backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none', 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center', 
                        backgroundColor: '#1a1a1a' 
                    }}
                >
                  {renderList.map((item, idx) => {
                    if (item.type === 'OBJ') {
                      const obj = item.data;
                      if (obj.type === 'SPAWN_POINT') {
                          if (isAdmin) {
                              return (
                                  <div key={obj.id} className="absolute opacity-50 pointer-events-none" style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, zIndex: obj.zIndex ?? 5 }}>
                                      <div className="w-full h-full border-2 border-dashed border-violet-500 rounded-full flex items-center justify-center bg-violet-500/20">
                                          <span className="text-[10px] text-violet-300 font-bold">START</span>
                                      </div>
                                  </div>
                              );
                          }
                          return null;
                      }
                      
                      const isUsed = obj.isSingleUse && activeChar && activeChar.interactedObjectIds?.includes(obj.id);

                      return (
                        <button 
                            key={obj.id} 
                            onClick={() => !isUsed && handleObjectClick(obj)} 
                            className={`absolute transition-all duration-200 group ${obj.hidden ? 'opacity-40 grayscale-[0.5]' : ''} ${isUsed ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`} 
                            style={{ 
                                left: obj.x, top: obj.y, width: obj.width, height: obj.height, 
                                backgroundColor: obj.type === 'DECORATION' ? 'transparent' : obj.color, 
                                backgroundImage: obj.image ? `url(${obj.image})` : undefined, 
                                backgroundSize: 'cover', 
                                zIndex: obj.zIndex ?? 10, 
                                ...getShapeStyleLib(obj.shape) 
                            }}
                            disabled={!!isUsed}
                        >
                            {obj.hidden && <div className="absolute top-1 right-1 bg-black/80 p-0.5 rounded text-[8px] text-orange-400 border border-orange-400/50 z-50">HIDDEN</div>}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-600 z-50">
                                {obj.label} {obj.targetMapId && '➡'} {isUsed && '(완료)'}
                            </div>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md pointer-events-none">
                                {obj.type !== 'DECORATION' && (
                                    <span className={`bg-black/40 px-1 rounded flex items-center gap-1 ${isUsed ? 'line-through text-gray-400' : ''}`}>
                                        {isUsed && <Check size={10} className="text-emerald-400"/>}
                                        {obj.label}
                                    </span>
                                )}
                            </span>
                        </button>
                      );
                    } else {
                      const char = item.data;
                      return (
                        <div key={char.id} className={`absolute flex flex-col items-center justify-center pointer-events-none transition-transform will-change-transform`} style={{ left: char.x, top: char.y, width: CHAR_SIZE, height: CHAR_SIZE, zIndex: 50 }}>
                            <div className="absolute -top-6 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm border border-white/20 shadow-sm z-50">{char.name}</div>
                            <div className={`w-full h-full rounded-lg overflow-hidden bg-[#222] shadow-xl ${char.id === activeCharId ? 'ring-2 ring-yellow-400' : 'shadow-black/50'}`}>{char.avatar ? <img src={char.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-indigo-700 text-white"><User size={32} /></div>}</div>
                            <div className="absolute -bottom-3 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden border border-black shadow-sm"><div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(char.hp / char.maxHp) * 100}%` }} /></div>
                        </div>
                      );
                    }
                  })}
                </div>
            ) : <div className="text-gray-500">맵 데이터 없음</div>}
        </div>
      </div>
      <PlayerSidebar characters={characters} activeCharId={activeCharId} chatMessages={chatMessages} isAdmin={isAdmin} onSelectChar={setActiveCharId} onAddChar={() => setIsCharSetupOpen(true)} onUpdateChar={(id, updates) => { setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_CHAR_UPDATE', charId: id, updates }); }} onDeleteChar={(id) => { if(networkMode !== 'CLIENT') { const nextChars = characters.filter(c => c.id !== id); setCharacters(nextChars); if(activeCharId === id) setActiveCharId(nextChars[0]?.id || ''); } }} onSendMessage={handleSendMessage} onAdminLogin={handleAdminLogin} onSendAnnouncement={(tid, t, m) => { if (isAdmin && networkMode === 'HOST') broadcast({ type: 'ADMIN_ANNOUNCEMENT', targetId: tid, title: t, message: m }); if (tid === null || tid === activeCharId) setAnnouncement({ title: t, message: m }); }} onSummonPlayer={handleSummonPlayer} currentMapObjects={currentMap?.objects || []} onToggleVisibility={handleToggleVisibility} currentMapId={currentMapId} customStats={gameData.customStats} />
      
      {/* Interaction Result Modal */}
      {interactionResult && <InteractionModal data={interactionResult} characterName={activeChar?.name || '익명'} onClose={() => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ACTION', action: 'CLOSE_MODAL' }) : setInteractionResult(null)} onMove={handleMoveLogic} />}
      
      {/* Selection Modal */}
      {selectionObject && <ActionSelectionModal object={selectionObject} onClose={() => setSelectionObject(null)} onSelect={(type, subId) => executeInteraction(selectionObject, type, subId)} />}

      {announcement && <Modal isOpen={true} title="📣 시스템 공지" onClose={() => setAnnouncement(null)} maxWidth="max-w-md" footer={<Button variant="primary" onClick={() => setAnnouncement(null)}>확인</Button>}><div className="flex flex-col items-center text-center p-2"><div className="bg-orange-900/30 p-4 rounded-full mb-4 border border-orange-500/50"><Megaphone size={40} className="text-orange-500" /></div><h3 className="text-xl font-bold text-white mb-2">{announcement.title}</h3><p className="text-gray-300 whitespace-pre-wrap">{announcement.message}</p></div></Modal>}
      <CharacterSetupModal gameData={gameData} isOpen={isCharSetupOpen} onClose={() => setIsCharSetupOpen(false)} onAdd={handleAddCharacterLogic} />
    </div>
  );
};
