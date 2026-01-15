
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameData, MapObject, Character, ChatMessage, ResultType, OutcomeDef } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { PlayerHUD } from '../player/PlayerHUD';
import { InteractionModal } from '../player/InteractionModal';
import { PlayerSidebar } from '../player/PlayerSidebar'; 
import { rollDice } from '../../lib/game-logic';
import { getShapeStyle as getShapeStyleLib } from '../../lib/styles';
import { generateId } from '../../lib/utils';
import { Menu, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { Modal } from '../common/Modal';

interface MobilePlayerProps {
  gameData: GameData;
  onExit: () => void;
  network: ReturnType<typeof useNetwork>;
}

const CHAR_SIZE = 64;
const MOVE_SPEED = 5;

// Robust Button Component for D-Pad
const DPadButton = ({ icon: Icon, onPress, onRelease }: { icon: any, onPress: () => void, onRelease: () => void }) => (
    <button 
       className="w-14 h-14 bg-white/10 active:bg-white/40 active:scale-95 transition-all rounded-xl flex items-center justify-center border border-white/10 touch-none select-none outline-none"
       onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
       onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onPress(); }}
       onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onRelease(); }}
       onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); onRelease(); }}
       onMouseDown={(e) => { e.preventDefault(); onPress(); }}
       onMouseUp={(e) => { e.preventDefault(); onRelease(); }}
       onMouseLeave={(e) => { e.preventDefault(); onRelease(); }}
    >
        <Icon size={28} />
    </button>
);

export const MobilePlayer: React.FC<MobilePlayerProps> = ({ 
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
    { id: 'char_1', name: '탐사자 1', hp: 100, maxHp: 100, inventory: [], mapId: initialGameData.startMapId, x: 100, y: 400 }
  ]);
  const [activeCharId, setActiveCharId] = useState('char_1');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [interactionResult, setInteractionResult] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);

  // -- Refs --
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ w: false, a: false, s: false, d: false });
  const requestRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(0);
  const stateRef = useRef({ characters, activeCharId, currentMapId });

  // -- Derived Data --
  const currentMap = gameData.maps.find(m => m.id === currentMapId);
  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];
  const visibleCharacters = characters.filter(c => c.mapId === currentMapId || (!c.mapId && currentMapId === gameData.startMapId));

  // -- Sync StateRef --
  useEffect(() => {
      stateRef.current = { characters, activeCharId, currentMapId };
  }, [characters, activeCharId, currentMapId]);

  // -- Responsive Map Scaling --
  useEffect(() => {
    const updateScale = () => {
        if (mapContainerRef.current) {
            const { width, height } = mapContainerRef.current.getBoundingClientRect();
            const scaleX = width / 1200;
            const scaleY = height / 800;
            setScale(Math.min(scaleX, scaleY, 1));
        }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // -- Network Logic --
  useEffect(() => {
    if (networkMode === 'HOST') {
        // Only trigger full sync for non-movement changes automatically
        // 'characters' is excluded from dependency to prevent movement flood
        broadcast({ type: 'SYNC_GAMEDATA', payload: gameData });
        broadcast({ type: 'SYNC_STATE', payload: { currentMapId, characters, interactionResult, chatMessages } });
    }
  }, [currentMapId, interactionResult, chatMessages, networkMode, broadcast, connections.length]);

  // Host Heartbeat (2s)
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


  useEffect(() => {
    const handleAction = (data: any) => {
        if (networkMode === 'HOST') {
            switch (data.type) {
                case 'REQUEST_ACTION':
                    if (data.action === 'CLICK_OBJECT') {
                        const obj = currentMap?.objects.find((o: any) => o.id === data.objectId);
                        if (obj) handleObjectClickLogic(obj);
                    } else if (data.action === 'MOVE_MAP') handleMoveLogic(data.targetMapId);
                    else if (data.action === 'CLOSE_MODAL') setInteractionResult(null);
                    break;
                case 'REQUEST_CHAR_UPDATE':
                    setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, ...data.updates } : c));
                    break;
                case 'REQUEST_ADD_CHAR': handleAddCharacterLogic(); break;
                case 'REQUEST_CHAT':
                    setChatMessages(prev => [...prev, { id: generateId(), senderName: data.senderName, text: data.text, timestamp: Date.now() }]);
                    break;
                case 'REQUEST_MOVE_CHAR':
                    // Update Local
                    setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, x: data.x, y: data.y, mapId: data.mapId } : c));
                    // Broadcast Delta
                    broadcast({ type: 'ON_MOVE_CHAR', charId: data.charId, x: data.x, y: data.y, mapId: data.mapId });
                    break;
            }
        } else if (networkMode === 'CLIENT') {
            if (data.type === 'SYNC_STATE') {
                const { currentMapId: sMap, characters: sChars, interactionResult: sRes, chatMessages: sChat } = data.payload;
                setCurrentMapId(sMap);
                setCharacters(sChars);
                setInteractionResult(sRes);
                if (sChat) setChatMessages(sChat);
                setIsDataLoaded(true);
            } else if (data.type === 'ON_MOVE_CHAR') {
                // Delta Update
                setCharacters(prev => prev.map(c => 
                    c.id === data.charId ? { ...c, x: data.x, y: data.y, mapId: data.mapId } : c
                ));
            } else if (data.type === 'SYNC_GAMEDATA') {
                setGameData(data.payload);
                setIsDataLoaded(true);
            }
        }
    };

    if (networkMode === 'HOST') connections.forEach(conn => { conn.off('data'); conn.on('data', handleAction); });
    else if (networkMode === 'CLIENT' && hostConnection) { hostConnection.off('data'); hostConnection.on('data', handleAction); }
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
      if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_CHAT', text, senderName });
      else setChatMessages(prev => [...prev, { id: generateId(), senderName, text, timestamp: Date.now() }]);
  };

  const handleMoveLogic = (mapId: string) => {
    if (gameData.maps.find(m => m.id === mapId)) {
        setCurrentMapId(mapId);
        setInteractionResult(null);
        setCharacters(prev => prev.map(c => ({...c, mapId: mapId, x: 100, y: 400})));
    }
  };

  const handleObjectClickLogic = (obj: MapObject) => {
    const isDirectMove = (obj.type === 'MAP_LINK' || (!obj.useProbability && obj.targetMapId));
    if (isDirectMove && (!obj.description || obj.description.trim() === '')) {
      if (obj.targetMapId) { handleMoveLogic(obj.targetMapId); return; }
    }
    
    let resultData: any = { objectName: obj.label, description: obj.description, hasRoll: false };
    if (obj.useProbability && obj.data) {
        const resultType = rollDice(obj.data);
        const outcome = obj.data.outcomes[resultType];
        setCharacters(prev => prev.map(c => {
          if (c.id === activeCharId) {
            return { ...c, hp: Math.min(c.maxHp, c.hp + outcome.hpChange), inventory: outcome.itemDrop ? [...c.inventory, outcome.itemDrop] : c.inventory };
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
    if (resultData.targetMapId) resultData.targetMapName = gameData.maps.find(m => m.id === resultData.targetMapId)?.name;
    setInteractionResult(resultData);
  };

  const handleObjectClick = (obj: MapObject) => {
      if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_ACTION', action: 'CLICK_OBJECT', objectId: obj.id });
      else handleObjectClickLogic(obj);
  };

  const handleAddCharacterLogic = () => {
    const newId = `char_${generateId()}`;
    const newChar: Character = { id: newId, name: `탐사자 ${characters.length + 1}`, hp: 100, maxHp: 100, inventory: [], mapId: currentMapId, x: 100, y: 400 };
    setCharacters(prev => [...prev, newChar]);
    if (networkMode === 'HOST') setActiveCharId(newId);
  };

  // -- Animation Loop --
  const animate = useCallback(() => {
      if (interactionResult) {
          requestRef.current = requestAnimationFrame(animate);
          return;
      }
      
      const inputs = inputRef.current;
      if (inputs.w || inputs.a || inputs.s || inputs.d) {
          const { characters: currentChars, activeCharId: currentActiveId, currentMapId: currentMap } = stateRef.current;
          
          const charIndex = currentChars.findIndex(c => c.id === currentActiveId);
          if (charIndex !== -1) {
              const char = currentChars[charIndex];
              let dx = 0;
              let dy = 0;
              
              if (inputs.w) dy -= MOVE_SPEED;
              if (inputs.s) dy += MOVE_SPEED;
              if (inputs.a) dx -= MOVE_SPEED;
              if (inputs.d) dx += MOVE_SPEED;

              if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

              if (dx !== 0 || dy !== 0) {
                  const newX = Math.max(0, Math.min(1200 - CHAR_SIZE, char.x + dx));
                  const newY = Math.max(0, Math.min(800 - CHAR_SIZE, char.y + dy));
                  
                  if (newX !== char.x || newY !== char.y) {
                      const newChars = [...currentChars];
                      newChars[charIndex] = { ...char, x: newX, y: newY, mapId: currentMap };
                      
                      setCharacters(newChars);
                      stateRef.current.characters = newChars;

                      const now = Date.now();
                      if (now - lastSyncTime.current > 100) {
                          if (networkMode === 'CLIENT') {
                              sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: currentActiveId, x: newX, y: newY, mapId: currentMap });
                          } else if (networkMode === 'HOST') {
                              // Host Local Move -> Broadcast Delta
                              broadcast({ type: 'ON_MOVE_CHAR', charId: currentActiveId, x: newX, y: newY, mapId: currentMap });
                          }
                          lastSyncTime.current = now;
                      }
                  }
              }
          }
      }
      requestRef.current = requestAnimationFrame(animate);
  }, [interactionResult, networkMode, sendToHost, broadcast]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const setInput = (key: 'w'|'a'|'s'|'d', val: boolean) => {
      inputRef.current[key] = val;
  };

  // -- Render --
  if (!isDataLoaded) return <div className="flex h-screen items-center justify-center bg-[#2e2e2e] text-white">데이터 로딩 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden select-none">
      <PlayerHUD currentMapName={currentMap?.name || ''} onExit={onExit} isAdmin={isAdmin} />
      
      {/* Map Container */}
      <div ref={mapContainerRef} className="flex-1 relative overflow-hidden bg-[#1a1a1a] flex items-center justify-center">
         {currentMap ? (
            <div 
                className="relative shadow-2xl transition-transform duration-200 ease-out origin-center will-change-transform"
                style={{ 
                    width: '1200px', 
                    height: '800px',
                    transform: `scale(${scale})`,
                    backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundColor: '#1a1a1a',
                    flexShrink: 0
                }}
            >
                {/* Objects */}
                {currentMap.objects.map(obj => (
                    <div
                        key={obj.id}
                        onClick={() => handleObjectClick(obj)}
                        className="absolute active:opacity-70"
                        style={{
                            left: obj.x, top: obj.y, width: obj.width, height: obj.height,
                            backgroundColor: obj.type === 'DECORATION' ? 'transparent' : obj.color,
                            backgroundImage: obj.image ? `url(${obj.image})` : undefined,
                            backgroundSize: 'cover',
                            ...getShapeStyleLib(obj.shape)
                        }}
                    >
                         {obj.type !== 'DECORATION' && (
                             <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md bg-black/30">
                                 {obj.label}
                             </span>
                         )}
                    </div>
                ))}
                {/* Characters */}
                {visibleCharacters.map(char => (
                    <div key={char.id} className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ left: char.x, top: char.y, width: CHAR_SIZE, height: CHAR_SIZE, zIndex: 50 }}>
                         <div className="absolute -top-5 bg-black/50 text-white text-[9px] px-1 rounded whitespace-nowrap">{char.name}</div>
                         <div className={`w-full h-full rounded-lg overflow-hidden bg-[#222] ${char.id === activeCharId ? 'ring-4 ring-yellow-400' : ''}`}>
                            {char.avatar ? <img src={char.avatar} className="w-full h-full object-cover" /> : <User size={24} className="m-auto mt-2"/>}
                         </div>
                    </div>
                ))}
            </div>
         ) : <div className="p-10 text-center">맵 데이터 없음</div>}
      </div>

      {/* Floating UI: Menu */}
      <div className="fixed bottom-6 left-6 z-50">
        <button onClick={() => setIsSidebarOpen(true)} className="bg-indigo-600 p-3 rounded-full shadow-lg text-white hover:bg-indigo-500 active:scale-95 transition-transform">
            <Menu size={24} />
        </button>
      </div>

      {/* Virtual D-Pad */}
      <div className="fixed bottom-6 right-6 z-50 select-none touch-none">
         <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-full backdrop-blur-sm border border-white/10 shadow-xl">
             <div></div>
             <DPadButton icon={ArrowUp} onPress={() => setInput('w', true)} onRelease={() => setInput('w', false)} />
             <div></div>
             
             <DPadButton icon={ArrowLeft} onPress={() => setInput('a', true)} onRelease={() => setInput('a', false)} />
             <DPadButton icon={ArrowDown} onPress={() => setInput('s', true)} onRelease={() => setInput('s', false)} />
             <DPadButton icon={ArrowRight} onPress={() => setInput('d', true)} onRelease={() => setInput('d', false)} />
         </div>
      </div>

      {/* Menu Drawer */}
      <Modal isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} title="메뉴" maxWidth="max-w-full">
         <div className="h-[60vh] flex flex-col">
            <PlayerSidebar 
                characters={characters}
                activeCharId={activeCharId}
                chatMessages={chatMessages}
                isAdmin={isAdmin}
                onSelectChar={(id) => { setActiveCharId(id); setIsSidebarOpen(false); }}
                onAddChar={() => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ADD_CHAR' }) : handleAddCharacterLogic()}
                onUpdateChar={(id, updates) => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_CHAR_UPDATE', charId: id, updates }) : setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))}
                onDeleteChar={(id) => { if(networkMode !== 'CLIENT') { setCharacters(prev => prev.filter(c => c.id !== id)); } }}
                onSendMessage={handleSendMessage}
                onAdminLogin={handleAdminLogin}
            />
         </div>
      </Modal>

      {/* Interaction */}
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
