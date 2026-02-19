
import React, { useState } from 'react';
import { FactionGameData } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { FactionSetupModal } from './player/FactionSetupModal';
import { FactionHUD } from './player/FactionHUD';
import { FactionSidebar } from './player/FactionSidebar';
import { FactionChatSidebar } from './player/FactionChatSidebar';
import { FactionMapCanvas } from './player/FactionMapCanvas';
import { FactionAdminPanel } from './player/FactionAdminPanel';
import { FactionCombatUI } from './player/FactionCombatUI';
import { Lock, Hourglass, Megaphone } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

// Hooks
import { useFactionData } from './hooks/useFactionData';
import { useCombatSystem } from './hooks/useCombatSystem';
import { useFactionNetwork } from './hooks/useFactionNetwork';

interface FactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const FactionPlayer: React.FC<FactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  const { networkMode, peerId, startHost, broadcast } = network;
  
  // 1. Core Data & Game State Hook
  const { 
      data, setData, 
      players, setPlayers, 
      myProfile, setMyProfile, 
      chatMessages, setChatMessages, 
      isAdmin, setIsAdmin, 
      currentMapId, setCurrentMapId, 
      isDataLoaded, setIsDataLoaded, 
      announcement, setAnnouncement, 
      currentMap, 
      handlePlayerJoin, handleAdminLogin, handleMapChange, 
      updateAdminPlayer, sendAdminAnnouncement, handleSendMessage, handleBlockClick, 
      broadcastProfileUpdate, updateMapData, advanceGlobalMapTurn
  } = useFactionData({ initialData, network, networkMode });

  // UI Local State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);

  // 2. Combat System Hook
  const {
      combatState, setCombatState,
      setAdminCombatViewOpen,
      activeSession, isCombatActiveInRelevantBlock, showCombatUI,
      toggleCombat, handleCombatAction, handleCombatResponse, resolveTurn, resumeCombatsOnGlobalTurn
  } = useCombatSystem({
      network, players, myProfile, isAdmin, selectedAdminPlayer,
      broadcastProfileUpdate, updateMapData, data, currentMap
  });

  // 3. Network Synchronization Hook
  useFactionNetwork({
      network, networkMode, data, combatState, players, myProfile, currentMapId,
      setData, setPlayers, setMyProfile, setChatMessages, setCombatState, setCurrentMapId, setIsDataLoaded, setAnnouncement, broadcast
  });

  // Start Host on Solo
  React.useEffect(() => {
    if (networkMode === 'SOLO') startHost();
  }, [networkMode, startHost]);

  // Combined Global Turn Logic (Map Occupation + Combat Resume)
  const handleGlobalTurnAdvance = () => {
      advanceGlobalMapTurn();
      resumeCombatsOnGlobalTurn();
  };

  const isTurnFinished = myProfile && myProfile.lastActionTurn === data.currentTurn;

  // -- Render --

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
                onJoin={(p) => { handlePlayerJoin(p); setIsSetupOpen(false); }}
                onAdminLogin={() => { handleAdminLogin(); setIsSetupOpen(false); }}
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

        {showCombatUI && activeSession && (
            <FactionCombatUI 
                myProfile={myProfile}
                players={players}
                combatSession={activeSession}
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
            copiedId={false}
            setCopiedId={() => {}}
            isAdmin={isAdmin}
            myProfile={myProfile}
            onExit={onExit}
            mapList={data.maps}
            onChangeMap={handleMapChange}
            combatActive={isCombatActiveInRelevantBlock}
            onWatchCombat={() => setAdminCombatViewOpen(true)}
        />

        <div className="flex-1 flex overflow-hidden relative">
            {/* Left Sidebar: Player List */}
            <div className="hidden md:flex">
                <FactionSidebar 
                    data={data}
                    players={players}
                    myProfile={myProfile}
                    isAdmin={isAdmin}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                    onUpdateProfile={(updates) => myProfile && broadcastProfileUpdate({ ...myProfile, ...updates })}
                />
            </div>

            {/* Center: Map */}
            <div className="flex-1 relative flex flex-col">
                <FactionMapCanvas 
                    currentMap={currentMap} 
                    players={players}
                    isAdmin={isAdmin}
                    myProfile={myProfile}
                    onBlockClick={(bid) => handleBlockClick(bid, combatState, selectedPlayerId)}
                    factions={data.factions}
                />

                {/* Waiting For Next Turn Overlay */}
                {!isAdmin && isTurnFinished && !isCombatActiveInRelevantBlock && (
                    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
                        <div className="bg-[#1e1e1e] p-8 rounded-2xl border border-[#444] shadow-2xl flex flex-col items-center max-w-sm text-center">
                             <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <Lock size={32} className="text-gray-400" />
                             </div>
                             <h2 className="text-2xl font-bold mb-2">행동 완료</h2>
                             <p className="text-gray-400 mb-6">
                                 이번 턴의 행동을 마쳤습니다.<br/>
                                 운영자가 다음 턴을 진행할 때까지 대기하세요.
                             </p>
                             <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-gray-700">
                                <Hourglass size={16} className="text-orange-400 animate-spin-slow" />
                                <span className="font-mono font-bold text-lg text-orange-400">TURN {data.currentTurn}</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Chat or Admin Panel */}
            <div className="hidden md:flex z-20">
                {isAdmin && selectedAdminPlayer ? (
                     <FactionAdminPanel 
                        selectedPlayer={selectedAdminPlayer}
                        onClose={() => setSelectedPlayerId(null)}
                        onUpdatePlayer={(updates) => updateAdminPlayer(selectedAdminPlayer.id, updates)}
                        combatActive={!!(selectedAdminPlayer.currentBlockId && combatState[selectedAdminPlayer.currentBlockId]?.isActive)}
                        onToggleCombat={toggleCombat}
                        onNextTurn={() => resolveTurn(selectedAdminPlayer.currentBlockId)}
                        onAdvanceGlobalTurn={handleGlobalTurnAdvance}
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
        </div>
    </div>
  );
};
