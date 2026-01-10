
import { useState, useEffect } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionChatMessage, FactionMap } from '../../types';
import { useNetwork } from '../useNetwork';
import { generateId } from '../../lib/utils';

export const useFactionGameState = (
  initialData: FactionGameData,
  network: ReturnType<typeof useNetwork>
) => {
  const { networkMode, connections, hostConnection, broadcast, sendToHost } = network;

  // 1. 내부 데이터 상태 관리
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

  // 2. [Host Only] 상위 컴포넌트(App.tsx)에서 파일 로드 등으로 initialData가 변경되면 내부 상태 동기화
  useEffect(() => {
    if (networkMode === 'HOST' && initialData) {
      setData(prev => ({
        ...prev,
        ...initialData,
        currentTurn: prev.currentTurn || initialData.currentTurn || 1
      }));
      if (!currentMapId && initialData.maps.length > 0) {
        setCurrentMapId(initialData.maps[0].id);
      }
    }
  }, [initialData, networkMode]);

  // 3. [Host Only] 데이터 동기화 브로드캐스트 (즉시 전송 + 주기적 전송)
  useEffect(() => {
    if (networkMode === 'HOST') {
      // 데이터가 변경되거나 새로운 접속자(connections.length)가 생기면 즉시 전송
      broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
      broadcast({ type: 'SYNC_PLAYERS', players: players });
      broadcast({ type: 'SYNC_FACTION_CHAT', messages: chatMessages });

      const interval = setInterval(() => {
        broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [networkMode, broadcast, data, connections.length]); // connections.length를 추가하여 신규 접속 시 즉시 대응

  // 4. 네트워크 액션 핸들러
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
  }, [networkMode, connections, hostConnection, currentMapId, myProfile, players, chatMessages, data]);

  // Actions
  const handlePlayerJoin = (profile: FactionPlayerProfile) => {
    setMyProfile(profile);
    setPlayers(prev => {
        const next = [...prev.filter(p => p.id !== profile.id), profile];
        if (networkMode === 'HOST') broadcast({ type: 'SYNC_PLAYERS', players: next });
        return next;
    });
    if (networkMode === 'CLIENT') {
      sendToHost({ type: 'JOIN_FACTION_GAME', profile });
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
