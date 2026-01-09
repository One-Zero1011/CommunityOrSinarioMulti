
import React, { useState, useEffect } from 'react';
import { FactionGameData, CombatState } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { useFactionGameState } from '../../hooks/faction/useFactionGameState';
import { useFactionCombat } from '../../hooks/faction/useFactionCombat';

// Components
import { FactionSetupModal } from './player/FactionSetupModal';
import { FactionHUD } from './player/FactionHUD';
import { FactionSidebar } from './player/FactionSidebar';
import { FactionChatSidebar } from './player/FactionChatSidebar';
import { FactionMapCanvas } from './player/FactionMapCanvas';
import { FactionAdminPanel } from './player/FactionAdminPanel';
import { FactionCombatUI } from './player/FactionCombatUI';
import { FactionLoading } from './ui/FactionLoading';
import { FactionAnnouncement } from './ui/FactionAnnouncement';
import { FactionTurnOverlay } from './ui/FactionTurnOverlay';

interface FactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const FactionPlayer: React.FC<FactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  // 1. Core State & Network Logic
  const {
    data, setData, players, chatMessages, myProfile, setMyProfile,
    currentMapId, setCurrentMapId, isDataLoaded, announcement, setAnnouncement,
    handlePlayerJoin, broadcastProfileUpdate, handleSendMessage, handleMapChange,
    updateMapData, sendAdminAnnouncement
  } = useFactionGameState(initialData, network);

  // 2. Combat Logic
  const {
    activeCombats, toggleCombat, resolveTurn, handleCombatAction, handleCombatResponse
  } = useFactionCombat(network, players, data, myProfile, updateMapData, broadcastProfileUpdate);

  // 3. UI State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [adminCombatViewOpen, setAdminCombatViewOpen] = useState(false);

  // 4. Derived State
  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);
  const isTurnFinished = myProfile && myProfile.lastActionTurn === data.currentTurn;

  // Determine Combat Visibility
  let combatToDisplay: CombatState | undefined;
  if (isAdmin && selectedPlayerId) {
    const target = players.find(p => p.id === selectedPlayerId);
    if (target?.currentBlockId) combatToDisplay = activeCombats[target.currentBlockId];
  } else if (myProfile?.currentBlockId) {
    combatToDisplay = activeCombats[myProfile.currentBlockId];
  }
  const isCombatActiveForView = combatToDisplay?.isActive || false;

  // Auto-open Admin Combat View
  useEffect(() => {
    if (combatToDisplay?.isActive && isAdmin) {
      if (combatToDisplay.turnCount === 1 && combatToDisplay.logs.length <= 1) {
        setAdminCombatViewOpen(true);
      }
    }
  }, [combatToDisplay?.isActive, isAdmin, combatToDisplay?.turnCount]);

  const showCombatUI = isCombatActiveForView && ((isAdmin && adminCombatViewOpen) || (!isAdmin));

  // 5. Logic Handlers (Movement & Admin)
  const handleAdminLogin = () => { setIsAdmin(true); setIsSetupOpen(false); };

  const updateAdminPlayer = (updates: Partial<typeof selectedAdminPlayer>) => {
    if (!selectedAdminPlayer) return;
    broadcastProfileUpdate({ ...selectedAdminPlayer, ...updates });
  };

  const handleBlockClick = (blockId: string) => {
    if (!currentMap) return;

    if (isAdmin) {
      if (selectedPlayerId) {
        const targetPlayer = players.find(p => p.id === selectedPlayerId);
        if (targetPlayer) broadcastProfileUpdate({ ...targetPlayer, currentBlockId: blockId });
      } else if (myProfile) {
        broadcastProfileUpdate({ ...myProfile, currentBlockId: blockId });
      }
      return;
    }

    if (!myProfile) return;
    if (activeCombats[myProfile.currentBlockId || '']?.isActive) {
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

  const advanceGlobalTurn = () => {
    if (!currentMap) return;
    const newBlocks = currentMap.blocks.map(block => {
      if (activeCombats[block.id]?.isActive) return block;
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

    if (network.networkMode === 'HOST') {
      network.broadcast({ type: 'SYNC_FACTION_GAMEDATA', payload: newData });
    }
  };

  // 6. Render
  if (!isDataLoaded) return <FactionLoading />;

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 overflow-hidden font-sans relative">
      
      {isSetupOpen && (
        <FactionSetupModal
          data={data}
          onClose={onExit}
          onJoin={(p) => { handlePlayerJoin(p); setIsSetupOpen(false); }}
          onAdminLogin={handleAdminLogin}
        />
      )}

      <FactionAnnouncement 
        announcement={announcement} 
        onClose={() => setAnnouncement(null)} 
      />

      {showCombatUI && combatToDisplay && (
        <FactionCombatUI
          myProfile={myProfile}
          players={players}
          combatState={combatToDisplay}
          onAction={handleCombatAction}
          onResponse={handleCombatResponse}
          chatMessages={chatMessages}
          onSendMessage={(txt, ch) => handleSendMessage(txt, ch, isAdmin)}
          isAdmin={isAdmin}
          onClose={() => setAdminCombatViewOpen(false)}
        />
      )}

      <FactionHUD
        title={data.title}
        currentMap={currentMap}
        currentTurn={data.currentTurn || 1}
        networkMode={network.networkMode}
        peerId={network.peerId}
        copiedId={copiedId}
        setCopiedId={setCopiedId}
        isAdmin={isAdmin}
        myProfile={myProfile}
        onExit={onExit}
        mapList={data.maps}
        onChangeMap={handleMapChange}
        combatActive={!!combatToDisplay?.isActive}
        onWatchCombat={() => setAdminCombatViewOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
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

        <div className="flex-1 relative flex flex-col">
          <FactionMapCanvas
            currentMap={currentMap}
            players={players}
            isAdmin={isAdmin}
            myProfile={myProfile}
            onBlockClick={handleBlockClick}
            factions={data.factions}
          />

          {!isAdmin && !isCombatActiveForView && (
            <FactionTurnOverlay isVisible={!!isTurnFinished} currentTurn={data.currentTurn || 1} />
          )}
        </div>

        <div className="hidden md:flex z-20">
          {isAdmin && selectedAdminPlayer ? (
            <FactionAdminPanel
              selectedPlayer={selectedAdminPlayer}
              onClose={() => setSelectedPlayerId(null)}
              onUpdatePlayer={updateAdminPlayer}
              combatActive={!!(selectedAdminPlayer.currentBlockId && activeCombats[selectedAdminPlayer.currentBlockId]?.isActive)}
              onToggleCombat={() => toggleCombat(selectedAdminPlayer.currentBlockId, true, selectedPlayerId)}
              onNextTurn={() => resolveTurn(selectedAdminPlayer.currentBlockId || '')}
              onAdvanceGlobalTurn={advanceGlobalTurn}
              onSendAnnouncement={sendAdminAnnouncement}
            />
          ) : (
            <FactionChatSidebar
              data={data}
              myProfile={myProfile}
              isAdmin={isAdmin}
              chatMessages={chatMessages}
              onSendMessage={(txt, ch) => handleSendMessage(txt, ch, isAdmin)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
