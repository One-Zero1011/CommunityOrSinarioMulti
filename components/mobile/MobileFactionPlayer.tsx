
import React, { useState, useEffect } from 'react';
import { FactionGameData, CombatState } from '../../types';
import { useNetwork } from '../../hooks/useNetwork';
import { useFactionGameState } from '../../hooks/faction/useFactionGameState';
import { useFactionCombat } from '../../hooks/faction/useFactionCombat';

// Components
import { FactionSetupModal } from '../faction/player/FactionSetupModal';
import { FactionHUD } from '../faction/player/FactionHUD';
import { FactionSidebar } from '../faction/player/FactionSidebar';
import { FactionChatSidebar } from '../faction/player/FactionChatSidebar';
import { FactionMapCanvas } from '../faction/player/FactionMapCanvas';
import { FactionAdminPanel } from '../faction/player/FactionAdminPanel';
import { FactionCombatUI } from '../faction/player/FactionCombatUI';
import { FactionLoading } from '../faction/ui/FactionLoading';
import { FactionAnnouncement } from '../faction/ui/FactionAnnouncement';
import { FactionTurnOverlay } from '../faction/ui/FactionTurnOverlay';

// Icons & UI
import { Menu, MessageSquare, Lock, Hourglass } from 'lucide-react';
import { Modal } from '../common/Modal';

interface MobileFactionPlayerProps {
  data: FactionGameData;
  network: ReturnType<typeof useNetwork>;
  onExit: () => void;
}

export const MobileFactionPlayer: React.FC<MobileFactionPlayerProps> = ({ data: initialData, network, onExit }) => {
  // 1. Core State & Network Logic (Shared Hook)
  const {
    data, setData, players, chatMessages, myProfile, setMyProfile,
    currentMapId, setCurrentMapId, isDataLoaded, announcement, setAnnouncement,
    handlePlayerJoin, broadcastProfileUpdate, handleSendMessage, handleMapChange,
    updateMapData, sendAdminAnnouncement
  } = useFactionGameState(initialData, network);

  // 2. Combat Logic (Shared Hook)
  const {
    activeCombats, toggleCombat, resolveTurn, handleCombatAction, handleCombatResponse
  } = useFactionCombat(network, players, data, myProfile, updateMapData, broadcastProfileUpdate);

  // 3. Local UI State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  
  // Mobile Specific UI State
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false); // Player List
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); // Chat or Admin
  const [adminCombatViewOpen, setAdminCombatViewOpen] = useState(false);

  // 4. Derived State
  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedAdminPlayer = players.find(p => p.id === selectedPlayerId);
  const isTurnFinished = myProfile && myProfile.lastActionTurn === data.currentTurn;

  // Determine Combat Visibility
  let combatToDisplay: CombatState | undefined;
  if (isAdmin && selectedPlayerId) {
      const target = players.find(p => p.id === selectedPlayerId);
      if (target?.currentBlockId) {
          combatToDisplay = activeCombats[target.currentBlockId];
      }
  } else if (myProfile?.currentBlockId) {
      combatToDisplay = activeCombats[myProfile.currentBlockId];
  }

  const isCombatActiveForView = combatToDisplay?.isActive || false;
  
  // Auto-open Admin Combat View (Optional for mobile, maybe less intrusive?)
  useEffect(() => {
      if (combatToDisplay?.isActive && isAdmin) {
          if (combatToDisplay.turnCount === 1 && combatToDisplay.logs.length <= 1) {
              setAdminCombatViewOpen(true);
          }
      }
  }, [combatToDisplay?.isActive, isAdmin, combatToDisplay?.turnCount]);

  const showCombatUI = isCombatActiveForView && (
      (isAdmin && adminCombatViewOpen) || 
      (!isAdmin)
  );

  // 5. Logic Handlers
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

        {/* Main Content Area - Mobile Optimized */}
        <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
            {/* Scrollable Map Container */}
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                <FactionMapCanvas 
                    currentMap={currentMap} 
                    players={players}
                    isAdmin={isAdmin}
                    myProfile={myProfile} 
                    onBlockClick={handleBlockClick}
                    factions={data.factions}
                />
            </div>

            {/* Waiting For Next Turn Overlay */}
            {!isAdmin && !isCombatActiveForView && (
                <FactionTurnOverlay isVisible={!!isTurnFinished} currentTurn={data.currentTurn || 1} />
            )}
        </div>

        {/* Mobile Floating Buttons */}
        <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-2">
            <button 
                onClick={() => setIsLeftSidebarOpen(true)}
                className="bg-indigo-600 p-3 rounded-full shadow-lg text-white hover:bg-indigo-500 active:scale-95 transition-transform"
            >
                <Menu size={24} />
            </button>
        </div>
        <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
            <button 
                onClick={() => setIsRightSidebarOpen(true)}
                className="bg-orange-600 p-3 rounded-full shadow-lg text-white hover:bg-orange-500 active:scale-95 transition-transform relative"
            >
                <MessageSquare size={24} />
                {chatMessages.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1a1a]"></span>}
            </button>
        </div>

        {/* Mobile Sidebar Modals */}
        <Modal isOpen={isLeftSidebarOpen} onClose={() => setIsLeftSidebarOpen(false)} title="진영 현황" maxWidth="max-w-full">
             <div className="h-[60vh] flex flex-col">
                <FactionSidebar 
                    data={data}
                    players={players}
                    myProfile={myProfile}
                    isAdmin={isAdmin}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={(id) => { 
                        setSelectedPlayerId(id); 
                        setIsLeftSidebarOpen(false); 
                        if(isAdmin && id) setIsRightSidebarOpen(true); 
                    }}
                    onUpdateProfile={(updates) => myProfile && broadcastProfileUpdate({ ...myProfile, ...updates })}
                />
             </div>
        </Modal>

        <Modal isOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} title={isAdmin && selectedAdminPlayer ? "플레이어 관리" : "채팅"} maxWidth="max-w-full">
            <div className="h-[60vh] flex flex-col">
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
        </Modal>

    </div>
  );
};
