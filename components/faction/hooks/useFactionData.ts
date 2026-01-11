
import { useState, useCallback } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionMap, FactionChatMessage, GlobalCombatState } from '../../../types';
import { generateId } from '../../../lib/utils';
import { useNetwork } from '../../../hooks/useNetwork';

interface UseFactionDataProps {
    initialData: FactionGameData;
    network: ReturnType<typeof useNetwork>;
    networkMode: 'SOLO' | 'HOST' | 'CLIENT';
}

export const useFactionData = ({ initialData, network, networkMode }: UseFactionDataProps) => {
    const { broadcast, sendToHost } = network;

    const [data, setData] = useState<FactionGameData>({
        ...initialData,
        currentTurn: initialData.currentTurn || 1
    });
    const [players, setPlayers] = useState<FactionPlayerProfile[]>([]);
    const [myProfile, setMyProfile] = useState<FactionPlayerProfile | null>(null);
    const [chatMessages, setChatMessages] = useState<FactionChatMessage[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentMapId, setCurrentMapId] = useState(initialData.maps[0]?.id || '');
    const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');
    const [announcement, setAnnouncement] = useState<{title: string, message: string} | null>(null);

    const currentMap = data.maps.find(m => m.id === currentMapId);

    // -- Helper Actions --

    const broadcastProfileUpdate = useCallback((profile: FactionPlayerProfile) => {
        setPlayers(prev => prev.map(p => p.id === profile.id ? profile : p));
        if (myProfile && myProfile.id === profile.id) setMyProfile(profile);
  
        if (networkMode === 'HOST') {
            broadcast({ type: 'UPDATE_PLAYER_PROFILE', profile });
        } else {
            sendToHost({ type: 'UPDATE_PLAYER_PROFILE', profile });
        }
    }, [myProfile, networkMode, broadcast, sendToHost]);

    const updateMapData = useCallback((newMaps: FactionMap[]) => {
        setData(prev => ({ ...prev, maps: newMaps }));
        if (networkMode === 'HOST') {
            broadcast({ type: 'SYNC_FACTION_MAP_DATA', maps: newMaps });
        }
    }, [networkMode, broadcast]);

    // -- User Actions --

    const handlePlayerJoin = (profile: FactionPlayerProfile) => {
        setMyProfile(profile);
        setPlayers(prev => [...prev, profile]);
        
        if (networkMode === 'CLIENT') {
            sendToHost({ type: 'JOIN_FACTION_GAME', profile });
        } else if (networkMode === 'HOST') {
             broadcast({ type: 'SYNC_PLAYERS', players: [...players, profile] });
        }
    };

    const handleAdminLogin = () => setIsAdmin(true);

    const handleMapChange = (mapId: string) => {
        setCurrentMapId(mapId);
        if (networkMode === 'HOST') broadcast({ type: 'CHANGE_FACTION_MAP', mapId });
    };

    const updateAdminPlayer = (targetId: string, updates: Partial<FactionPlayerProfile>) => {
        const target = players.find(p => p.id === targetId);
        if (!target) return;
        broadcastProfileUpdate({ ...target, ...updates });
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
        if (!myProfile) {
            if (isAdmin) alert("운영자 모드에서는 캐릭터로 참가해야 채팅을 사용할 수 있습니다.");
            return;
        }
        
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

    const handleBlockClick = (blockId: string, combatState: GlobalCombatState, selectedPlayerId: string | null) => {
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
        const myBlockId = myProfile.currentBlockId;
        if (myBlockId && combatState[myBlockId]?.isActive) {
            alert("전투 중에는 이동할 수 없습니다. '도주'를 사용하세요.");
            return;
        }
  
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

    // Advance Global Turn (Occupation Logic)
    const advanceGlobalMapTurn = () => {
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

    return {
        data, setData,
        players, setPlayers,
        myProfile, setMyProfile,
        chatMessages, setChatMessages,
        isAdmin, setIsAdmin,
        currentMapId, setCurrentMapId,
        isDataLoaded, setIsDataLoaded,
        announcement, setAnnouncement,
        currentMap,
        
        // Actions
        handlePlayerJoin,
        handleAdminLogin,
        handleMapChange,
        updateAdminPlayer,
        sendAdminAnnouncement,
        handleSendMessage,
        handleBlockClick,
        broadcastProfileUpdate,
        updateMapData,
        advanceGlobalMapTurn
    };
};
