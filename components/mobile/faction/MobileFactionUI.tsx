
import React from 'react';
import { Menu, MessageSquare, Lock, Hourglass, Megaphone } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { FactionSidebar } from '../../faction/player/FactionSidebar';
import { FactionChatSidebar } from '../../faction/player/FactionChatSidebar';
import { FactionAdminPanel } from '../../faction/player/FactionAdminPanel';
import { FactionPlayerProfile, FactionGameData, FactionChatMessage, GlobalCombatState } from '../../../types';

interface MobileFactionUIProps {
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (v: boolean) => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (v: boolean) => void;
  data: FactionGameData;
  players: FactionPlayerProfile[];
  myProfile: FactionPlayerProfile | null;
  isAdmin: boolean;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  broadcastProfileUpdate: (updates: Partial<FactionPlayerProfile>) => void;
  chatMessages: FactionChatMessage[];
  handleSendMessage: (text: string, channel: 'TEAM' | 'BLOCK') => void;
  selectedAdminPlayer?: FactionPlayerProfile;
  combatState: GlobalCombatState;
  toggleCombat: () => void;
  resolveTurn: (blockId?: string) => void;
  handleGlobalTurnAdvance: () => void;
  sendAdminAnnouncement: (targetId: string | null, title: string, message: string) => void;
  announcement: { title: string, message: string } | null;
  setAnnouncement: (v: null) => void;
  isTurnFinished: boolean;
  isCombatActiveInRelevantBlock: boolean;
}

export const MobileFactionUI: React.FC<MobileFactionUIProps> = ({
  isLeftSidebarOpen, setIsLeftSidebarOpen,
  isRightSidebarOpen, setIsRightSidebarOpen,
  data, players, myProfile, isAdmin,
  selectedPlayerId, setSelectedPlayerId,
  broadcastProfileUpdate,
  chatMessages, handleSendMessage,
  selectedAdminPlayer,
  combatState, toggleCombat, resolveTurn, handleGlobalTurnAdvance, sendAdminAnnouncement,
  announcement, setAnnouncement,
  isTurnFinished, isCombatActiveInRelevantBlock
}) => {
  return (
    <>
      {/* 1. Floating Action Buttons */}
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

      {/* 2. Side Modals (Left: Player List / Profile) */}
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

      {/* 3. Side Modals (Right: Chat or Admin Panel) */}
      <Modal isOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} title={isAdmin && selectedAdminPlayer ? "플레이어 관리" : "채팅"} maxWidth="max-w-full">
        <div className="h-[60vh] flex flex-col">
          {isAdmin && selectedAdminPlayer ? (
            <FactionAdminPanel 
              selectedPlayer={selectedAdminPlayer}
              onClose={() => setSelectedPlayerId(null)}
              onUpdatePlayer={(updates) => broadcastProfileUpdate({ ...selectedAdminPlayer, ...updates })}
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
      </Modal>

      {/* 4. Global Overlays (Waiting) */}
      {!isAdmin && isTurnFinished && !isCombatActiveInRelevantBlock && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in pointer-events-none">
          <div className="bg-[#1e1e1e] p-6 rounded-2xl border border-[#444] shadow-2xl flex flex-col items-center max-w-xs text-center pointer-events-auto">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 animate-pulse">
              <Lock size={24} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">행동 완료</h2>
            <p className="text-gray-400 text-sm mb-4">다음 턴 대기 중...</p>
            <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-gray-700">
              <Hourglass size={14} className="text-orange-400 animate-spin-slow" />
              <span className="font-mono font-bold text-sm text-orange-400">TURN {data.currentTurn}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. System Announcements */}
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
    </>
  );
};
