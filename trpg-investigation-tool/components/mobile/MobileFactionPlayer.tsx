
import React, { useState, useEffect } from 'react';
import { FactionGameData } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { FactionSetupModal } from '../faction/player/FactionSetupModal';
import { FactionHUD } from '../faction/player/FactionHUD';
import { FactionMapCanvas } from '../faction/player/FactionMapCanvas';
import { FactionCombatUI } from '../faction/player/FactionCombatUI';
import { MobileFactionUI } from './faction/MobileFactionUI';

// Reuse common hooks
import { useFactionData } from '../faction/hooks/useFactionData';
import { useCombatSystem } from '../faction/hooks/useCombatSystem';
import { useFactionNetwork } from '../faction/hooks/useFactionNetwork';

interface MobileFactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const MobileFactionPlayer: React.FC<MobileFactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  const { networkMode, peerId, startHost, broadcast } = network;
  
  // 1. Core Data & Game State Logic
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

  // 2. Combat System Logic
  const {
      combatState, setCombatState,
      setAdminCombatViewOpen,
      activeSession, isCombatActiveInRelevantBlock, showCombatUI,
      toggleCombat, handleCombatAction, handleCombatResponse, resolveTurn, resumeCombatsOnGlobalTurn
  } = useCombatSystem({
      network, players, myProfile, isAdmin, selectedAdminPlayer: players.find(p => p.id === (null as any)), // Temporary placeholder
      broadcastProfileUpdate, updateMapData, data, currentMap
  });

  // UI Local State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);

  // 3. Network Synchronization
  useFactionNetwork({
      network, networkMode, data, combatState, players, myProfile, currentMapId,
      setData, setPlayers, setMyProfile, setChatMessages, setCombatState, setCurrentMapId, setIsDataLoaded, setAnnouncement, broadcast
  });

  useEffect(() => {
    if (networkMode === 'SOLO') startHost();
  }, [networkMode, startHost]);

  const handleGlobalTurnAdvance = () => {
    advanceGlobalMapTurn();
    resumeCombatsOnGlobalTurn();
  };

  const isTurnFinished = myProfile?.lastActionTurn === data.currentTurn;

  if (networkMode === 'CLIENT' && !isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white">
        데이터 로딩 중...
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

      {/* Main Map Content */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
          <FactionMapCanvas 
            currentMap={currentMap} 
            players={players}
            isAdmin={isAdmin}
            myProfile={myProfile} 
            onBlockClick={(bid) => handleBlockClick(bid, combatState, selectedPlayerId)}
            factions={data.factions}
          />
        </div>

        {/* Mobile Specific UI Layer */}
        <MobileFactionUI 
          isLeftSidebarOpen={isLeftSidebarOpen}
          setIsLeftSidebarOpen={setIsLeftSidebarOpen}
          isRightSidebarOpen={isRightSidebarOpen}
          setIsRightSidebarOpen={setIsRightSidebarOpen}
          data={data}
          players={players}
          myProfile={myProfile}
          isAdmin={isAdmin}
          selectedPlayerId={selectedPlayerId}
          setSelectedPlayerId={setSelectedPlayerId}
          broadcastProfileUpdate={broadcastProfileUpdate}
          chatMessages={chatMessages}
          handleSendMessage={handleSendMessage}
          selectedAdminPlayer={selectedAdminPlayer}
          combatState={combatState}
          toggleCombat={toggleCombat}
          resolveTurn={resolveTurn}
          handleGlobalTurnAdvance={handleGlobalTurnAdvance}
          sendAdminAnnouncement={sendAdminAnnouncement}
          announcement={announcement}
          setAnnouncement={setAnnouncement}
          isTurnFinished={!!isTurnFinished}
          isCombatActiveInRelevantBlock={isCombatActiveInRelevantBlock}
        />
      </div>
    </div>
  );
};
