
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameData, MapObject, Character, ChatMessage, ResultType, OutcomeDef } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { PlayerHUD } from '../player/PlayerHUD';
import { InteractionModal } from '../player/InteractionModal';
import { PlayerSidebar } from '../player/PlayerSidebar'; 
import { rollDice } from '../../lib/game-logic';
import { getShapeStyle as getShapeStyleLib } from '../../lib/styles';
import { generateId } from '../../lib/utils';
import { Menu, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User, Megaphone, Check } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface MobilePlayerProps {
  gameData: GameData;
  onExit: () => void;
  network: ReturnType<typeof useNetwork>;
}

const CHAR_SIZE = 64;
const MOVE_SPEED = 5;

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

export const MobilePlayer: React.FC<MobilePlayerProps> = ({ gameData: initialGameData, onExit, network }) => {
  const { networkMode, connections, hostConnection, broadcast, sendToHost } = network;
  const [gameData, setGameData] = useState<GameData>(initialGameData);
  const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');
  const [currentMapId, setCurrentMapId] = useState(initialGameData.startMapId || initialGameData.maps[0]?.id);
  const [characters, setCharacters] = useState<Character[]>([{ id: 'char_1', name: '탐사자 1', desc: '', hp: 100, maxHp: 100, inventory: [], mapId: initialGameData.startMapId, x: 100, y: 400 }]);
  const [activeCharId, setActiveCharId] = useState('char_1');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [interactionResult, setInteractionResult] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [announcement, setAnnouncement] = useState<{title: string, message: string} | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ w: false, a: false, s: false, d: false });
  const requestRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(0);
  const stateRef = useRef({ characters, activeCharId, currentMapId, interactionResult, chatMessages, gameData });
  const remoteTargets = useRef<Record<string, { x: number, y: number, mapId: string }>>({});

  useEffect(() => { stateRef.current = { characters, activeCharId, currentMapId, interactionResult, chatMessages, gameData }; }, [characters, activeCharId, currentMapId, interactionResult, chatMessages, gameData]);

  const currentMap = gameData.maps.find(m => m.id === currentMapId);
  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];
  const visibleCharacters = characters.filter(c => c.mapId === currentMapId || (!c.mapId && currentMapId === gameData.startMapId));
  const visibleObjects = currentMap?.objects.filter(obj => isAdmin || !obj.hidden) || [];

  // Map Dimensions
  const mapW = currentMap?.width || 1200;
  const mapH = currentMap?.height || 800;

  const renderList = useMemo(() => {
    const list: (({ type: 'OBJ', data: MapObject }) | ({ type: 'CHAR', data: Character }))[] = [];
    visibleObjects.forEach(obj => list.push({ type: 'OBJ', data: obj }));
    visibleCharacters.forEach(char => list.push({ type: 'CHAR', data: char }));
    
    return list.sort((a, b) => {
        const zA = a.type === 'OBJ' ? (a.data.zIndex ?? 10) : 50;
        const zB = b.type === 'OBJ' ? (b.data.zIndex ?? 10) : 50;
        return zA - zB;
    });
  }, [visibleObjects, visibleCharacters]);

  useEffect(() => { if (activeChar && activeChar.mapId && activeChar.mapId !== currentMapId) setCurrentMapId(activeChar.mapId); }, [activeChar?.mapId, activeCharId, currentMapId]);

  useEffect(() => {
    const updateScale = () => {
        if (mapContainerRef.current) {
            const { width, height } = mapContainerRef.current.getBoundingClientRect();
            // Calculate scale based on current map dimensions
            setScale(Math.min(width / mapW, height / mapH, 1));
        }
    };
    updateScale(); window.addEventListener('resize', updateScale); return () => window.removeEventListener('resize', updateScale);
  }, [mapW, mapH]);

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
        if (networkMode === 'HOST') {
            switch (data.type) {
                case 'REQUEST_ACTION':
                    if (data.action === 'CLICK_OBJECT') {
                        const obj = currentState.gameData.maps.find(m => m.id === currentState.currentMapId)?.objects.find(o => o.id === data.objectId);
                        if (obj && (isAdmin || !obj.hidden)) handleObjectClickLogic(obj);
                    } else if (data.action === 'MOVE_MAP') handleMoveLogic(data.targetMapId);
                    else if (data.action === 'CLOSE_MODAL') setInteractionResult(null);
                    break;
                case 'REQUEST_TOGGLE_OBJECT_VISIBILITY': handleToggleVisibilityLogic(data.mapId, data.objectId, data.hidden); break;
                case 'REQUEST_CHAR_UPDATE':
                    setCharacters(prev => {
                        const newChars = prev.map(c => c.id === data.charId ? { ...c, ...data.updates } : c);
                        broadcast({ type: 'SYNC_STATE', payload: { ...currentState, characters: newChars } });
                        return newChars;
                    });
                    break;
                case 'REQUEST_ADD_CHAR':
                    setCharacters(prev => {
                        const newChars = [...prev, data.character];
                        broadcast({ type: 'SYNC_STATE', payload: { ...currentState, characters: newChars } });
                        return newChars;
                    });
                    break;
                case 'REQUEST_CHAT':
                    setChatMessages(prev => [...prev, { id: generateId(), senderName: data.senderName, text: data.text, timestamp: Date.now(), isSystem: false }]);
                    break;
                case 'REQUEST_MOVE_CHAR':
                    remoteTargets.current[data.charId] = { x: data.x, y: data.y, mapId: data.mapId };
                    setCharacters(prev => prev.map(c => c.id === data.charId ? { ...c, x: data.x, y: data.y, mapId: data.mapId } : c));
                    broadcast({ type: 'ON_MOVE_CHAR', charId: data.charId, x: data.x, y: data.y, mapId: data.mapId });
                    break;
            }
        } else if (networkMode === 'CLIENT') {
            if (data.type === 'SYNC_STATE') {
                setCharacters(data.payload.characters);
                data.payload.characters.forEach((c: any) => remoteTargets.current[c.id] = { x: c.x, y: c.y, mapId: c.mapId || '' });
                setInteractionResult(data.payload.interactionResult); setChatMessages(data.payload.chatMessages); setIsDataLoaded(true);
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

  const handleAdminLogin = (key: string) => { if (gameData.adminKey && key === gameData.adminKey) { setIsAdmin(true); alert("운영자 권한 획득"); } else alert("오답"); };
  const handleSendMessage = (text: string) => {
      const sender = networkMode === 'HOST' ? (isAdmin ? 'GM' : 'Host') : (isAdmin ? 'GM' : activeChar.name);
      if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_CHAT', text, senderName: sender });
      else { const msg = { id: generateId(), senderName: sender, text, timestamp: Date.now(), isSystem: false }; setChatMessages(prev => [...prev, msg]); if (networkMode === 'HOST') broadcast({ type: 'REQUEST_CHAT', ...msg }); }
  };
  const handleToggleVisibilityLogic = (mapId: string, objectId: string, hidden: boolean) => {
      setGameData(prev => {
          const newMaps = prev.maps.map(m => m.id === mapId ? { ...m, objects: m.objects.map(obj => obj.id === objectId ? { ...obj, hidden } : obj) } : m);
          const newData = { ...prev, maps: newMaps };
          if (networkMode === 'HOST') broadcast({ type: 'SYNC_GAMEDATA', payload: newData });
          return newData;
      });
  };
  const handleSummonPlayer = (targetId: string | 'ALL') => {
      if (!isAdmin) return;
      const pos = getSpawnPosition(currentMapId);
      const exe = (charId: string) => {
          if (networkMode === 'HOST') { setCharacters(prev => prev.map(c => c.id === charId ? { ...c, mapId: currentMapId, x: pos.x, y: pos.y } : c)); broadcast({ type: 'ON_MOVE_CHAR', charId, x: pos.x, y: pos.y, mapId: currentMapId }); }
          else sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: charId, x: pos.x, y: pos.y, mapId: currentMapId });
      };
      if (targetId === 'ALL') characters.forEach(c => exe(targetId)); else exe(targetId);
  };
  const handleMoveLogic = (mapId: string) => {
    if (stateRef.current.gameData.maps.find(m => m.id === mapId)) {
        setCurrentMapId(mapId); setInteractionResult(null); 
        const pos = getSpawnPosition(mapId);
        setCharacters(prev => prev.map(c => c.id === activeCharId ? {...c, mapId: mapId, x: pos.x, y: pos.y} : c));
        if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: activeCharId, x: pos.x, y: pos.y, mapId: mapId });
        else broadcast({ type: 'ON_MOVE_CHAR', charId: activeCharId, x: pos.x, y: pos.y, mapId: mapId });
    }
  };
  const handleObjectClickLogic = (obj: MapObject) => {
    if (obj.type === 'SPAWN_POINT') return;
    
    // Single Use Check
    if (obj.isSingleUse && activeChar && activeChar.interactedObjectIds?.includes(obj.id)) {
        return; 
    }

    if ((obj.type === 'MAP_LINK' || (!obj.useProbability && obj.targetMapId)) && (!obj.description || obj.description.trim() === '')) { if (obj.targetMapId) { handleMoveLogic(obj.targetMapId); return; } }
    let res: any = { objectName: obj.label, description: obj.description, hasRoll: false };
    if (obj.useProbability && obj.data) {
        const type = rollDice(obj.data); const outcome = obj.data.outcomes[type];
        setCharacters(prev => prev.map(c => c.id === activeCharId ? { 
            ...c, 
            hp: Math.min(c.maxHp, c.hp + outcome.hpChange), 
            inventory: outcome.itemDrop ? [...c.inventory, outcome.itemDrop] : c.inventory,
            interactedObjectIds: obj.isSingleUse ? [...(c.interactedObjectIds || []), obj.id] : c.interactedObjectIds
        } : c));
        res = { ...res, hasRoll: true, type, outcome };
        if (outcome.targetMapId) res.targetMapId = outcome.targetMapId;
    } else {
        if (obj.targetMapId) res.targetMapId = obj.targetMapId;
        if (obj.isSingleUse) {
             setCharacters(prev => prev.map(c => c.id === activeCharId ? { 
                ...c, 
                interactedObjectIds: [...(c.interactedObjectIds || []), obj.id] 
            } : c));
        }
    }
    if (res.targetMapId) res.targetMapName = stateRef.current.gameData.maps.find(m => m.id === res.targetMapId)?.name;
    setInteractionResult(res);
  };

  const handleObjectClick = (obj: MapObject) => {
    if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_ACTION', action: 'CLICK_OBJECT', objectId: obj.id });
    else handleObjectClickLogic(obj);
  };

  const handleAddCharacterLogic = () => {
    const pos = getSpawnPosition(stateRef.current.currentMapId);
    const newChar: Character = { 
        id: `char_${generateId()}`, 
        name: `탐사자 ${stateRef.current.characters.length + 1}`, 
        desc: '', 
        hp: 100, 
        maxHp: 100, 
        inventory: [], 
        mapId: stateRef.current.currentMapId, 
        x: pos.x, 
        y: pos.y,
        interactedObjectIds: []
    };
    setCharacters(prev => [...prev, newChar]);
    if (networkMode === 'HOST') { 
        setActiveCharId(newChar.id); 
        broadcast({ type: 'SYNC_STATE', payload: { ...stateRef.current, characters: [...stateRef.current.characters, newChar] } }); 
    } else if (networkMode === 'CLIENT') {
        setActiveCharId(newChar.id);
        sendToHost({ type: 'REQUEST_ADD_CHAR', character: newChar });
    }
  };

  const sendAdminAnnouncement = (targetId: string | null, title: string, message: string) => {
    if (isAdmin && networkMode === 'HOST') {
        broadcast({ type: 'ADMIN_ANNOUNCEMENT', targetId, title, message });
        if (targetId === null || targetId === activeCharId) setAnnouncement({ title, message });
    }
  };

  const handleToggleVisibility = (mapId: string, objectId: string, hidden: boolean) => {
    if (!isAdmin) return;
    if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_TOGGLE_OBJECT_VISIBILITY', mapId, objectId, hidden });
    else handleToggleVisibilityLogic(mapId, objectId, hidden);
  };

  const checkCollision = (x: number, y: number, objs: MapObject[]) => {
    return objs.some(obj => {
        if (!obj.isSolid || obj.hidden) return false;
        return (
            x < obj.x + obj.width &&
            x + CHAR_SIZE > obj.x &&
            y < obj.y + obj.height &&
            y + CHAR_SIZE > obj.y
        );
    });
  };

  const animate = useCallback(() => {
      const { characters: currentChars, activeCharId: activeId, currentMapId: mapId, gameData } = stateRef.current;
      const currentMap = gameData.maps.find(m => m.id === mapId);
      const objects = currentMap?.objects || [];
      const mWidth = currentMap?.width || 1200;
      const mHeight = currentMap?.height || 800;

      const lerp = (s: number, e: number, t: number) => s + (e - s) * t;
      let changed = false;
      const inputs = inputRef.current; const charIdx = currentChars.findIndex(c => c.id === activeId);
      
      if (charIdx !== -1 && (inputs.w || inputs.a || inputs.s || inputs.d)) {
          const char = currentChars[charIdx]; let dx = 0, dy = 0;
          if (inputs.w) dy -= MOVE_SPEED; if (inputs.s) dy += MOVE_SPEED; if (inputs.a) dx -= MOVE_SPEED; if (inputs.d) dx += MOVE_SPEED;
          if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
          
          let nx = Math.max(0, Math.min(mWidth - CHAR_SIZE, char.x + dx)); 
          let ny = Math.max(0, Math.min(mHeight - CHAR_SIZE, char.y + dy));

          // Collision check
          if (checkCollision(nx, char.y, objects)) nx = char.x;
          if (checkCollision(nx, ny, objects)) ny = char.y;

          if (nx !== char.x || ny !== char.y) {
              currentChars[charIdx] = { ...char, x: nx, y: ny, mapId }; changed = true;
              if (Date.now() - lastSyncTime.current > 50) {
                  if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_MOVE_CHAR', charId: activeId, x: nx, y: ny, mapId });
                  else if (networkMode === 'HOST') broadcast({ type: 'ON_MOVE_CHAR', charId: activeId, x: nx, y: ny, mapId });
                  lastSyncTime.current = Date.now();
              }
          }
      }
      currentChars.forEach((c, i) => { if (c.id === activeId) return; const t = remoteTargets.current[c.id]; if (!t) return; if (c.mapId !== t.mapId) { currentChars[i] = { ...c, x: t.x, y: t.y, mapId: t.mapId }; changed = true; return; } const dx = t.x - c.x, dy = t.y - c.y; if (Math.sqrt(dx*dx + dy*dy) > 0.1) { currentChars[i] = { ...c, x: lerp(c.x, t.x, 0.2), y: lerp(c.y, t.y, 0.2) }; changed = true; } });
      if (changed) setCharacters([...currentChars]); requestRef.current = requestAnimationFrame(animate);
  }, [networkMode]);

  useEffect(() => { requestRef.current = requestAnimationFrame(animate); return () => cancelAnimationFrame(requestRef.current); }, [animate]);

  if (!isDataLoaded) return <div className="flex h-screen items-center justify-center bg-[#2e2e2e] text-white">로딩 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden select-none">
      <PlayerHUD currentMapName={currentMap?.name || ''} onExit={onExit} isAdmin={isAdmin} />
      <div ref={mapContainerRef} className="flex-1 relative overflow-hidden bg-[#1a1a1a] flex items-center justify-center">
         {currentMap ? (
            <div className="relative shadow-2xl transition-transform duration-200 ease-out origin-center" style={{ width: `${mapW}px`, height: `${mapH}px`, transform: `scale(${scale})`, backgroundImage: currentMap.bgImage ? `url(${currentMap.bgImage})` : 'none', backgroundSize: 'cover', backgroundColor: '#1a1a1a', flexShrink: 0 }}>
                {renderList.map((item, idx) => {
                  if (item.type === 'OBJ') {
                    const obj = item.data;
                    if (obj.type === 'SPAWN_POINT') {
                       if (isAdmin) {
                           return (
                               <div key={obj.id} className="absolute opacity-50 pointer-events-none" style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, zIndex: obj.zIndex ?? 5 }}>
                                   <div className="w-full h-full border-2 border-dashed border-violet-500 rounded-full flex items-center justify-center bg-violet-500/20">
                                       <span className="text-[8px] text-violet-300 font-bold">START</span>
                                   </div>
                               </div>
                           );
                       }
                       return null;
                    }
                    
                    const isUsed = obj.isSingleUse && activeChar && activeChar.interactedObjectIds?.includes(obj.id);

                    return (
                      <div key={obj.id} onClick={() => !isUsed && handleObjectClick(obj)} className={`absolute active:opacity-70 ${obj.hidden ? 'opacity-40 grayscale' : ''} ${isUsed ? 'opacity-50 grayscale' : ''}`} style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, backgroundColor: obj.type === 'DECORATION' ? 'transparent' : obj.color, backgroundImage: obj.image ? `url(${obj.image})` : undefined, backgroundSize: 'cover', zIndex: obj.zIndex ?? 10, ...getShapeStyleLib(obj.shape) }}>
                           {obj.type !== 'DECORATION' && (
                               <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md bg-black/30 ${isUsed ? 'line-through text-gray-400' : ''}`}>
                                   {isUsed && <Check size={8} className="mr-1 text-emerald-400"/>}
                                   {obj.label}
                               </span>
                           )}
                           {obj.hidden && <div className="absolute top-0 right-0 bg-black/80 px-1 rounded text-[7px] text-orange-400 border border-orange-400/50">H</div>}
                      </div>
                    );
                  } else {
                    const char = item.data;
                    return (
                      <div key={char.id} className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ left: char.x, top: char.y, width: CHAR_SIZE, height: CHAR_SIZE, zIndex: 50 }}>
                           <div className="absolute -top-5 bg-black/50 text-white text-[9px] px-1 rounded whitespace-nowrap">{char.name}</div>
                           <div className={`w-full h-full rounded-lg overflow-hidden bg-[#222] ${char.id === activeCharId ? 'ring-4 ring-yellow-400' : ''}`}>{char.avatar ? <img src={char.avatar} className="w-full h-full object-cover" /> : <User size={24} className="m-auto mt-2"/>}</div>
                      </div>
                    );
                  }
                })}
            </div>
         ) : <div className="p-10 text-center">데이터 없음</div>}
      </div>
      <div className="fixed bottom-6 left-6 z-50"><button onClick={() => setIsSidebarOpen(true)} className="bg-indigo-600 p-3 rounded-full shadow-lg text-white"><Menu size={24} /></button></div>
      <div className="fixed bottom-6 right-6 z-50 select-none touch-none"><div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-full backdrop-blur-sm border border-white/10 shadow-xl"><div></div><DPadButton icon={ArrowUp} onPress={() => inputRef.current.w=true} onRelease={() => inputRef.current.w=false} /><div></div><DPadButton icon={ArrowLeft} onPress={() => inputRef.current.a=true} onRelease={() => inputRef.current.a=false} /><DPadButton icon={ArrowDown} onPress={() => inputRef.current.s=true} onRelease={() => inputRef.current.s=false} /><DPadButton icon={ArrowRight} onPress={() => inputRef.current.d=true} onRelease={() => inputRef.current.d=false} /></div></div>
      <Modal isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} title="메뉴" maxWidth="max-w-full"><div className="h-[60vh] flex flex-col"><PlayerSidebar characters={characters} activeCharId={activeCharId} chatMessages={chatMessages} isAdmin={isAdmin} onSelectChar={(id) => { setActiveCharId(id); setIsSidebarOpen(false); }} onAddChar={handleAddCharacterLogic} onUpdateChar={(id, updates) => { setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); if (networkMode === 'CLIENT') sendToHost({ type: 'REQUEST_CHAR_UPDATE', charId: id, updates }); }} onDeleteChar={(id) => { if(networkMode !== 'CLIENT') setCharacters(prev => prev.filter(c => c.id !== id)); }} onSendMessage={handleSendMessage} onAdminLogin={handleAdminLogin} onSendAnnouncement={sendAdminAnnouncement} onSummonPlayer={handleSummonPlayer} currentMapObjects={currentMap?.objects || []} onToggleVisibility={handleToggleVisibility} currentMapId={currentMapId} /></div></Modal>
      {interactionResult && <InteractionModal data={interactionResult} characterName={activeChar.name} onClose={() => networkMode === 'CLIENT' ? sendToHost({ type: 'REQUEST_ACTION', action: 'CLOSE_MODAL' }) : setInteractionResult(null)} onMove={handleMoveLogic} />}
      {announcement && <Modal isOpen={true} title="📣 공지" onClose={() => setAnnouncement(null)} maxWidth="max-w-md" footer={<Button variant="primary" onClick={() => setAnnouncement(null)}>확인</Button>}><div className="flex flex-col items-center text-center p-2"><Megaphone size={40} className="text-orange-500 mb-4" /><h3 className="text-xl font-bold mb-2">{announcement.title}</h3><p className="text-gray-300">{announcement.message}</p></div></Modal>}
    </div>
  );
};
