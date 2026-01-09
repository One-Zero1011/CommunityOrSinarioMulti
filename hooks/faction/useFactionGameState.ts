
import { useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionChatMessage, FactionMap } from '../../types';
import { useNetwork } from '../useNetwork';
import { generateId } from '../../lib/utils';

export const useFactionGameState = (
  initialData: FactionGameData,
  network: ReturnType<typeof useNetwork>
) => {
  const { networkMode, connections, hostConnection, broadcast, sendToHost } = network;

  const [data, setData] = useState<FactionGameData>({
    ...initialData,
    currentTurn: initialData.currentTurn || 1
  });
  const [players, setPlayers] = useState<FactionPlayerProfile[]>([]);
  const [chatMessages, setChatMessages] = useState<FactionChatMessage[]>([]);
  const [myProfile, setMyProfile] = useState<FactionPlayerProfile | null>(null);
  const [currentMapId, setCurrentMapId] = useState(initialData.maps[0]?.id || '');
  const [isDataLoaded, setIsDataLoaded] = useState(networkMode !== 'CLIENT');
  const [announcement, setAnnouncement] = useState<{ title: string, message: string } | null>(null);

  // Network Sync Logic
  useEffect(() => {
    if (networkMode === 'HOST') {
      const interval = setInterval(() => {
        broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [networkMode, broadcast, data]);

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
        }
      } else if (networkMode === 'CLIENT') {
        if (msg.type === 'SYNC_FACTION_GAMEDATA') {
          setData(msg.payload);
          setIsDataLoaded(true);
          if (!currentMapId && msg.payload.maps.length > 0) {
            setCurrentMapId(msg.payload.maps[0].id);
          }
        } else if (msg.type === 'SYNC_GAMEDATA') { // Fallback
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
  }, [networkMode, connections, hostConnection, currentMapId, myProfile]);

  // Actions
  const handlePlayerJoin = (profile: FactionPlayerProfile) => {
    setMyProfile(profile);
    setPlayers(prev => [...prev, profile]);
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

  const handleSendMessage = (text: string, channel: 'TEAM' | 'BLOCK', isAdmin: boolean) => {
    if (!myProfile) {
        if (isAdmin) alert("운영자 모드 채팅은 추후 지원됩니다.");
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

  const handleMapChange = (mapId: string) => {
    setCurrentMapId(mapId);
    if (networkMode === 'HOST') broadcast({ type: 'CHANGE_FACTION_MAP', mapId });
  };

  const updateMapData = (newMaps: FactionMap[]) => {
    setData(prev => ({ ...prev, maps: newMaps }));
    if (networkMode === 'HOST') {
      broadcast({ type: 'SYNC_FACTION_MAP_DATA', maps: newMaps });
    }
  };

  const sendAdminAnnouncement = (targetId: string | null, title: string, message: string) => {
    if (networkMode === 'HOST') {
      broadcast({ type: 'ADMIN_ANNOUNCEMENT', targetId, title, message });
      if (targetId === null) setAnnouncement({ title, message });
    }
  };

  return {
    data,
    setData,
    players,
    chatMessages,
    myProfile,
    setMyProfile,
    currentMapId,
    setCurrentMapId,
    isDataLoaded,
    announcement,
    setAnnouncement,
    handlePlayerJoin,
    broadcastProfileUpdate,
    handleSendMessage,
    handleMapChange,
    updateMapData,
    sendAdminAnnouncement
  };
};
