
import React from 'react';
import { ArrowLeft, MapPin, Unlock } from 'lucide-react';

interface PlayerHUDProps {
  currentMapName: string;
  onExit: () => void;
  isAdmin?: boolean;
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({ 
  currentMapName, onExit, isAdmin
}) => {
  return (
    <div className="h-12 bg-[#252525] border-b border-[#444] flex items-center justify-between px-4 z-10 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onExit} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors">
           <ArrowLeft size={16} /> 종료
        </button>
        <div className="h-4 w-px bg-[#444]"></div>
        <div className="flex items-center gap-2 text-gray-200">
           <MapPin size={16} className="text-indigo-400" />
           <span className="font-bold text-sm">{currentMapName}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isAdmin && (
            <div className="bg-yellow-600 border border-yellow-500 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg shadow-yellow-900/20">
                <Unlock size={12} /> ADMIN
            </div>
        )}
        <div className="text-xs text-gray-500 font-mono hidden md:block">
            TRPG INVESTIGATION TOOL
        </div>
      </div>
    </div>
  );
};