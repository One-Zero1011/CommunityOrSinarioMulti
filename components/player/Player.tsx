
import React, { useState, useEffect, useRef } from 'react';
import { GameData, MapObject, Character, ResultType, OutcomeDef, ChatMessage } from '../../types';
import { rollDice } from '../../lib/game-logic';
import { getShapeStyle as getShapeStyleLib } from '../../lib/styles';
import { generateId } from '../../lib/utils';
import { PlayerHUD } from './PlayerHUD';
import { PlayerSidebar } from './PlayerSidebar';
import { InteractionModal } from './InteractionModal';
import { Wifi, Copy, Check, User } from 'lucide-react';
import { usePlayerMovement } from '../../hooks/usePlayerMovement';
import { useNetwork } from '../../hooks/useNetwork';

interface PlayerProps {
  gameData: GameData;
  onExit: () => void;
  network: ReturnType<typeof useNetwork>;
}

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const CHAR_SIZE = 64;

export const Player: React.FC<PlayerProps> = ({ 
    gameData: initialGameData, 
    onExit,
    network
}) => {
  const { networkMode, connections, hostConnection, broadcast, sendToHost } = network;
  
  // -- State --
  const [gameData, setGameData] = useState<GameData>(initialGameData);
  const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');
  const [currentMapId, setCurrentMapId] = useState(initialGameData.startMapId || initialGameData.maps[0]?.id);
  const [characters, setCharacters] = useState<Character[]>([
    { 
        id: 'char_1', 
        name: '탐사자 1', 
        desc: '', 
        hp: 100, 
        maxHp: 100, 
        inventory: [],
        mapId: initialGameData.startMapId || initialGameData.maps[0]?.id,
        x: 100,
        y: 400
    }
  ]);
  const [activeCharId, setActiveCharId] = useState('char_1');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [interactionResult, setInteractionResult] = useState<{
    hasRoll: boolean;
    type?: ResultType;
    outcome?: OutcomeDef;
    description?: string;
    objectName: string;
    targetMapId?: string;
    targetMapName?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // -- Refs for Interpolation --
  const remoteTargets = useRef<Record<string, { x: number, y: number, mapId: string }>>({});

  // -- Derived Data --
  const currentMap = gameData.maps.find(m => m.id === currentMapId);
  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];
  const visibleCharacters = characters.filter(c => c.mapId === currentMapId || (!c.mapId && currentMapId === gameData.startMapId));

  // -- Hooks --
  
  usePlayerMovement({
      characters,
      activeCharId,
      currentMapId,
      networkMode,
      isModalOpen: !!interactionResult,
      setCharacters,
      onSendMoveAction: (charId, x, y, mapId) => {
          if (networkMode === 'CLIENT') {
            sendToHost({ type: 'REQUEST_MOVE_CHAR', charId, x, y, mapId });
          } else if (networkMode === 'HOST') {
            // Host Local Move -> Broadcast Delta
            broadcast({ type: 'ON_MOVE_CHAR', charId, x, y, mapId });
          }
      }
  });

  // -- Interpolation Loop --
  useEffect(() => {
      let animationFrameId: number;
      const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

      const loop = () => {
          setCharacters(prev => {
              let changed = false;
              const next = prev.map(c => {
                  // Skip active character (handled by input loop)
                  if (c.id === activeCharId) return c;

                  const target = remoteTargets.current[c.id];
                  if (!target) {
                      // Init target if missing
                      remoteTargets.current[c.id] = { x: c.x, y: c.y, mapId: c.mapId || '' };
                      return c;
                  }

                  // Check Map ID mismatch - Snap immediately
                  if (c.mapId !== target.mapId) {
                      changed = true;
                      return { ...c, x: target.x, y: target.y, mapId: target.mapId };
                  }

                  // Calculate distance
                  const dx = target.x - c.x;
                  const dy = target.y - c.y;
                  const dist = Math.sqrt(dx*dx + dy*dy);

                  // If very close, snap
                  if (dist < 1) {
                      if (c.x !== target.x || c.y !== target.y) {
                          changed = true;
                          return { ...c, x: target.x, y: target.y };
                      }
                      return c;
                  }

                  // Lerp (0.2 factor for smooth catchup)
                  changed = true;
                  return {
                      ...c,
                      x: lerp(c.x, target.x, 0.2),
                      y: lerp(c.y, target.y, 0.2)
                  };
              });
              return changed ? next : prev;
          });
          animationFrameId = requestAnimationFrame(loop);
      };
      
      animationFrameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationFrameId);
  }, [activeCharId]);

  // -- Network Logic Sync --

  // Host: Heartbeat Sync & Event-based Sync
  useEffect(() => {
    if (networkMode === 'HOST') {
        // Critical updates that need immediate full sync (Map change, Interaction, Chat)
        // Note: 'characters' removed to prevent movement flood
        broadcast({
            type: 'SYNC_STATE',
            payload: {
                currentMapId,
                characters,
                interactionResult,
                chatMessages
            }
        });
    }
  }, [currentMapId, interactionResult, chatMessages, networkMode, broadcast, connections.length]); 

  // Host: Heartbeat (Every 2s) to ensure eventual consistency
  useEffect(() => {
      if (networkMode === 'HOST') {
          const interval = setInterval(() => {
             broadcast({
                type: 'SYNC_STATE',
                payload: { currentMapId, characters, interactionResult, chatMessages }
            });
          }, 2000);
          return () => clearInterval(interval);
      }
  }, [networkMode, characters, currentMapId, interactionResult, chatMessages, broadcast]);

  // Host: Initial GameData Sync on connection
  useEffect(() => {
    if (networkMode === 'HOST') {
        broadcast({ type: 'SYNC_GAMEDATA', payload: gameData });
    }
  }, [networkMode, broadcast, connections.length, gameData]);


  // Client & Host: Handle Incoming Data
  useEffect(() => {
    const handleAction = (data: any) => {
        if (networkMode === 'HOST') {
            // Process Requests from Clients
            switch (data.type) {
                case 'REQUEST_ACTION':
                    if (data.action === 'CLICK_OBJECT') {
                        const obj = currentMap?.objects.find((o: any) => o.id === data.objectId);
                        if (obj) handleObjectClickLogic(obj);
                    } else if (data.action === 'MOVE_MAP') {
                        handleMoveLogic(data.targetMapId);
                    } else if (data.action === 'CLOSE_MODAL') {
                        setInteractionResult(null);
                    }
                    break;
                case 'REQUEST_CHAR_UPDATE':
                    // Critical Update -> Full Sync Triggered by State Change
                    setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, ...data.updates } : c));
                    break;
                case 'REQUEST_ADD_CHAR':
                    handleAddCharacterLogic();
                    break;
                case 'REQUEST_CHAT':
                    setChatMessages(prev => [...prev, {
                        id: generateId(),
                        senderName: data.senderName,
                        text: data.text,
                        timestamp: Date.now(),
                        isSystem: false
                    }]);
                    break;
                case 'REQUEST_MOVE_CHAR':
                    // Update Target Ref (Interpolated)
                    remoteTargets.current[data.charId] = { x: data.x, y: data.y, mapId: data.mapId };
                    // Broadcast Delta immediately to others
                    broadcast({ type: 'ON_MOVE_CHAR', charId: data.charId, x: data.x, y: data.y, mapId: data.mapId });
                    break;
            }
        } else if (networkMode === 'CLIENT') {
            // Process Sync from Host
            if (data.type === 'SYNC_STATE') {
                const { currentMapId: sMap, characters: sChars, interactionResult: sRes, chatMessages: sChat } = data.payload;
                setCurrentMapId(sMap);
                setCharacters(sChars); // Full sync overwrites
                
                // Sync Interpolation Targets
                sChars.forEach((c: Character) => {
                    remoteTargets.current[c.id] = { x: c.x, y: c.y, mapId: c.mapId || '' };
                });

                setInteractionResult(sRes);
                if (sChat) setChatMessages(sChat);
                setIsDataLoaded(true);
            } else if (data.type === 'ON_MOVE_CHAR') {
                // Delta Update for Movement (Interpolated)
                remoteTargets.current[data.charId] = { x: data.x, y: data.y, mapId: data.mapId };
            } else if (data.type === 'SYNC_GAMEDATA') {
                setGameData(data.payload);
                setIsDataLoaded(true);
            }
        }
    };

    if (networkMode === 'HOST') {
        connections.forEach(conn => {
            conn.off('data'); 
            conn.on('data', handleAction);
        });
    } else if (networkMode === 'CLIENT' && hostConnection) {
        hostConnection.off('data');
        hostConnection.on('data', handleAction);
    }
  }, [networkMode, connections, hostConnection, currentMap, characters, gameData]);


  // -- Logic Handlers --

  const handleAdminLogin = (key: string) => {
      if (gameData.adminKey && key === gameData.adminKey) {
          setIsAdmin(true);
          alert("운영자 권한을 획득했습니다.");
      } else {
          alert("운영자 키가 올바르지 않습니다.");
      }
  };

  const handleSendMessage = (text: string) => {
      const senderName = networkMode === 'HOST' ? (isAdmin ? 'GM (Host)' : 'Host') : (isAdmin ? 'GM' : activeChar.name);
      if (networkMode === 'CLIENT') {
          sendToHost({ type: 'REQUEST_CHAT', text, senderName });
      } else {
          setChatMessages(prev => [...prev, {
              id: generateId(),
              senderName,
              text,
              timestamp: Date.now(),
              isSystem: false
          }]);
      }
  };

  const handleMoveLogic = (mapId: string) => {
    const target = gameData.maps.find(m => m.id === mapId);
    if (target) {
        setCurrentMapId(mapId);
        setInteractionResult(null);
        // Reset positions slightly to avoid spawn trap
        setCharacters(prev => prev.map(c => ({...c, mapId: mapId, x: 100, y: 400})));
    }
  };

  const handleObjectClick = (obj: MapObject) => {
      if (networkMode === 'CLIENT') {
          sendToHost({ type: 'REQUEST_ACTION', action: 'CLICK_OBJECT', objectId: obj.id });
      } else {
          handleObjectClickLogic(obj);
      }
  };

  const handleObjectClickLogic = (obj: MapObject) => {
    const isDirectMove = (obj.type === 'MAP_LINK' || (!obj.useProbability && obj.targetMapId));
    
    if (isDirectMove && (!obj.description || obj.description.trim() === '')) {
      if (obj.targetMapId) {
        handleMoveLogic(obj.targetMapId);
        return;
      }
    }

    if (obj.type === 'OBJECT' || (obj.type as any) === 'MAP_LINK') { 
      let resultData: any = {
          objectName: obj.label,
          description: obj.description,
          hasRoll: false,
      };

      if (obj.useProbability && obj.data) {
          const resultType = rollDice(obj.data);
          const outcome = obj.data.outcomes[resultType];
          
          setCharacters(prev => prev.map(c => {
            if (c.id === activeCharId) {
              const newHp = Math.min(c.maxHp, c.hp + outcome.hpChange);
              const newInventory = outcome.itemDrop ? [...c.inventory, outcome.itemDrop] : c.inventory;
              return { ...c, hp: newHp, inventory: newInventory };
            }
            return c;
          }));

          resultData.hasRoll = true;
          resultData.type = resultType;
          resultData.outcome = outcome;
          
          if (outcome.targetMapId) resultData.targetMapId = outcome.targetMapId;
      } else {
          if (obj.targetMapId) resultData.targetMapId = obj.targetMapId;
      }

      if (resultData.targetMapId) {
          const targetMap = gameData.maps.find(m => m.id === resultData.targetMapId);
          if (targetMap) resultData.targetMapName = targetMap.name;
      }

      setInteractionResult(resultData);
    }
  };

  const handleAddCharacterLogic = () => {
    const newId = `char_${generateId()}`;
    const newChar: Character = {
      id: newId,
      name: `탐사자 ${characters.length + 1}`,
      desc: '',
      hp: 100,
      maxHp: 100,
      inventory: [],
      mapId: currentMapId,
      x: 100 + (characters.length * 50),
      y: 400
    };
    setCharacters(prev => [...prev, newChar]);
    if (networkMode === 'HOST') setActiveCharId(newId);
  };

  const handleDeleteCharacter = (id: string) => {
    if (networkMode === 'CLIENT') return;
    if (characters.length <= 1) {
        alert("최소 한 명의 캐릭터는 필요합니다.");
        return;
    }
    const newChars = characters.filter(c => c.id !== id);
    setCharacters(newChars);
    if (activeCharId === id) setActiveCharId(newChars[0].id);
  };

  // -- Render --

  if (!isDataLoaded) {
      return (
          <div className="flex h-screen items-center justify-center bg-[#2e2e2e] text-white flex-col gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p>호스트로부터 데이터를 동기화 중입니다...</p>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <PlayerHUD currentMapName={currentMap?.name || 'Unknown'} onExit={onExit} isAdmin={isAdmin} />
        
        {/* Network Status Bar */}
        {networkMode !== 'SOLO' && (
            <div className={`h-8 flex items-center justify-center gap-2 text-xs font-bold ${networkMode === 'HOST' ? 'bg-orange-900/50 text-orange-200' : 'bg-blue-900/50 text-blue-200'}`}>
                <Wifi size={14} />
                <span>{networkMode === 'HOST' ? 'HOST MODE' : 'CLIENT MODE'}</span>
                {networkMode === 'HOST' && network.peerId && (
                    <div 
                        className="flex items-center gap-2 ml-4 bg-black/30 px-2 py-0.5 rounded cursor-pointer hover:bg-black/50"
                        onClick={() => {
                            navigator.clipboard.writeText(network.peerId!);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                        }}
                    >
                        <span className="opacity-70">초대 코드:</span>
                        <span className="font-mono text-white select-all">{network.peerId}</span>
                        {copiedId ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </div>
                )}
            </div>
        )}
        
        <div className="flex-1 relative overflow-auto bg-[#252525] p-8 flex items-center justify-center">
            {currentMap ? (
                <div 
                className="relative shadow-2xl shrink-0"
                style={{ 
                    width: `${MAP_WIDTH}px`,
                    height: `${MAP_HEIGHT}px`,
                    backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#1a1a1a'
                }}
                >
                {/* Map Objects */}
                {currentMap.objects.map(obj => (
                    <button
                        key={obj.id}
                        onClick={() => handleObjectClick(obj)}
                        className={`absolute transition-all duration-200 hover:scale-105 active:scale-95 group`}
                        style={{
                            left: obj.x, 
                            top: obj.y,
                            width: obj.width,
                            height: obj.height,
                            backgroundColor: obj.type === 'DECORATION' ? 'transparent' : obj.color,
                            backgroundImage: obj.image ? `url(${obj.image})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            zIndex: 10,
                            ...getShapeStyleLib(obj.shape)
                        }}
                    >
                         {/* Labels and styling remain similar */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-600 z-50">
                        {obj.label} {obj.targetMapId && '➡'}
                        </div>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md pointer-events-none">
                            {obj.type !== 'DECORATION' && (
                                <span className="bg-black/40 px-1 rounded">{obj.label}</span>
                            )}
                        </span>
                        {obj.type !== 'DECORATION' && (
                        <div className="absolute inset-0 border-2 border-white/20 rounded-sm animate-pulse group-hover:border-emerald-400 pointer-events-none" style={getShapeStyleLib(obj.shape)}></div>
                        )}
                    </button>
                ))}

                {/* Characters */}
                {visibleCharacters.map(char => (
                    <div
                        key={char.id}
                        className={`absolute flex flex-col items-center justify-center pointer-events-none transition-transform will-change-transform`}
                        style={{ left: char.x, top: char.y, width: CHAR_SIZE, height: CHAR_SIZE, zIndex: 50 }}
                    >
                        <div className="absolute -top-6 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm border border-white/20 shadow-sm z-50">
                            {char.name}
                        </div>
                        <div className={`w-full h-full rounded-lg overflow-hidden bg-[#222] shadow-xl ${char.id === activeCharId ? 'ring-2 ring-yellow-400' : 'shadow-black/50'}`}>
                            {char.avatar ? <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-indigo-700 text-white"><User size={32} /></div>}
                        </div>
                        <div className="absolute -bottom-3 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden border border-black shadow-sm">
                            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(char.hp / char.maxHp) * 100}%` }} />
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <div className="text-gray-500">맵 데이터를 찾을 수 없습니다.</div>
            )}
        </div>
      </div>

      <PlayerSidebar 
        characters={characters}
        activeCharId={activeCharId}
        chatMessages={chatMessages}
        isAdmin={isAdmin}
        onSelectChar={setActiveCharId}
        onAddChar={() => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ADD_CHAR' }) : handleAddCharacterLogic()}
        onUpdateChar={(id, updates) => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_CHAR_UPDATE', charId: id, updates }) : setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))}
        onDeleteChar={handleDeleteCharacter}
        onSendMessage={handleSendMessage}
        onAdminLogin={handleAdminLogin}
      />

      {interactionResult && (
        <InteractionModal 
          data={interactionResult} 
          characterName={activeChar.name}
          onClose={() => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ACTION', action: 'CLOSE_MODAL' }) : setInteractionResult(null)}
          onMove={(mapId) => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ACTION', action: 'MOVE_MAP', targetMapId: mapId }) : handleMoveLogic(mapId)}
        />
      )}
    </div>
  );
};
