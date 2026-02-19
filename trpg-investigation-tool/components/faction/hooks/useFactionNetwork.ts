
import React, { useEffect } from 'react';
import { useNetwork } from '../../../hooks/useNetwork';
import { FactionGameData, FactionPlayerProfile, GlobalCombatState, FactionChatMessage } from '../../../types';

interface UseFactionNetworkProps {
    network: ReturnType<typeof useNetwork>;
    networkMode: 'SOLO' | 'HOST' | 'CLIENT';
    data: FactionGameData;
    combatState: GlobalCombatState;
    players: FactionPlayerProfile[];
    myProfile: FactionPlayerProfile | null;
    currentMapId: string;
    
    // Setters
    setData: React.Dispatch<React.SetStateAction<FactionGameData>>;
    setPlayers: React.Dispatch<React.SetStateAction<FactionPlayerProfile[]>>;
    setMyProfile: (p: FactionPlayerProfile | null) => void;
    setChatMessages: React.Dispatch<React.SetStateAction<FactionChatMessage[]>>;
    setCombatState: (state: GlobalCombatState) => void;
    setCurrentMapId: (id: string) => void;
    setIsDataLoaded: (v: boolean) => void;
    setAnnouncement: (v: {title: string, message: string} | null) => void;
    broadcast: (action: any) => void;
}

export const useFactionNetwork = ({
    network, networkMode, data, combatState, players, myProfile, currentMapId,
    setData, setPlayers, setMyProfile, setChatMessages, setCombatState, setCurrentMapId, setIsDataLoaded, setAnnouncement, broadcast
}: UseFactionNetworkProps) => {
    
    const { connections, hostConnection } = network;

    // HOST: Broadcast Sync Loop
    useEffect(() => {
        if (networkMode === 'HOST') {
            const interval = setInterval(() => {
                broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: data });
                broadcast({ type: 'SYNC_COMBAT_STATE', state: combatState });
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [networkMode, broadcast, data, combatState]);

    // Listener
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
};
