
import React from 'react';
import { Lock, Hourglass } from 'lucide-react';

interface FactionTurnOverlayProps {
  isVisible: boolean;
  currentTurn: number;
}

export const FactionTurnOverlay: React.FC<FactionTurnOverlayProps> = ({ isVisible, currentTurn }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in pointer-events-none">
      <div className="bg-[#1e1e1e] p-8 rounded-2xl border border-[#444] shadow-2xl flex flex-col items-center max-w-sm text-center pointer-events-auto">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <Lock size={32} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">행동 완료</h2>
        <p className="text-gray-400 mb-6">
          이번 턴의 행동을 마쳤습니다.<br />
          운영자가 다음 턴을 진행할 때까지 대기하세요.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-gray-700">
          <Hourglass size={16} className="text-orange-400 animate-spin-slow" />
          <span className="font-mono font-bold text-lg text-orange-400">TURN {currentTurn}</span>
        </div>
      </div>
    </div>
  );
};
