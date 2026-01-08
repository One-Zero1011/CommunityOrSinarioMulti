
import React, { useState } from 'react';
import { FactionPlayerProfile } from '../../../types';
import { User, ArrowLeft, Activity, Sword, Shield, Zap, Brain, Backpack, Plus, Trash2, Heart, Play, Square, Clock } from 'lucide-react';
import { StatInput } from '../common/StatInput';

interface FactionAdminPanelProps {
    selectedPlayer: FactionPlayerProfile | undefined;
    onClose: () => void;
    onUpdatePlayer: (updates: Partial<FactionPlayerProfile>) => void;
    
    // Combat Controls
    combatActive: boolean;
    onToggleCombat: () => void;
    onNextTurn: () => void;
    onAdvanceGlobalTurn: () => void;
}

export const FactionAdminPanel: React.FC<FactionAdminPanelProps> = ({ 
    selectedPlayer, onClose, onUpdatePlayer, combatActive, onToggleCombat, onNextTurn, onAdvanceGlobalTurn
}) => {
    const [newItemName, setNewItemName] = useState("");

    if (!selectedPlayer) return null;

    const addItemToPlayer = () => {
        if (!newItemName.trim()) return;
        const newInventory = [...selectedPlayer.inventory, newItemName.trim()];
        onUpdatePlayer({ inventory: newInventory });
        setNewItemName("");
    };
  
    const removeItemFromPlayer = (index: number) => {
        const newInventory = selectedPlayer.inventory.filter((_, i) => i !== index);
        onUpdatePlayer({ inventory: newInventory });
    };

    const handleStatHpChange = (newStatValue: number) => {
        const newMaxHp = 150 + (newStatValue * 10);
        onUpdatePlayer({ 
            stats: { ...selectedPlayer.stats, hp: newStatValue },
            maxHp: newMaxHp,
            hp: Math.min(selectedPlayer.hp, newMaxHp)
        });
    };

    return (
        <div className="w-80 bg-[#252525] border-l border-[#444] flex flex-col shadow-xl z-20 shrink-0">
            <div className="p-4 border-b border-[#444] flex items-center gap-3 bg-[#222]">
                <div className="w-12 h-12 rounded-lg bg-black border border-[#444] overflow-hidden shadow-inner">
                    {selectedPlayer.avatar ? (
                        <img src={selectedPlayer.avatar} className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-full h-full p-2 text-gray-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-lg truncate">{selectedPlayer.name}</h3>
                    <div className="text-xs text-orange-400 font-mono">ID: {selectedPlayer.id.substring(0,6)}...</div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white"><ArrowLeft size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Global Controls */}
                <div className="bg-[#383838] p-3 rounded border border-[#555]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Clock size={14} /> 전체 게임 진행
                    </h4>
                    <button 
                        onClick={onAdvanceGlobalTurn}
                        className="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-2 rounded font-bold text-xs border border-indigo-500 shadow-sm"
                    >
                        전체 턴 경과 (평화 점령 체크)
                    </button>
                    <p className="text-[10px] text-gray-400 mt-2">
                        * 전투가 없는 지역에서 특정 진영이 3턴 연속 머물 경우 점령됩니다.
                    </p>
                </div>

                {/* Combat Controls */}
                <div className="bg-orange-900/20 p-3 rounded border border-orange-500/30">
                    <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                        <Sword size={14} /> 전투 관리
                    </h4>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={onToggleCombat}
                            className={`w-full py-2 rounded font-bold text-sm flex items-center justify-center gap-2 ${combatActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        >
                            {combatActive ? <><Square size={14} fill="currentColor"/> 전투 종료</> : <><Play size={14} fill="currentColor"/> 전투 시작</>}
                        </button>
                        {combatActive && (
                            <button 
                                onClick={onNextTurn}
                                className="w-full bg-[#333] hover:bg-[#444] text-gray-200 py-2 rounded text-xs border border-[#555] shadow-sm active:scale-95 transition-transform"
                            >
                                다음 턴으로 강제 넘기기 (Force Next Turn)
                            </button>
                        )}
                        {combatActive && (
                            <p className="text-[10px] text-gray-400 mt-1">
                                * 턴을 넘기면 '대응 단계'가 초기화되고 다음 사람에게 턴이 넘어갑니다.
                            </p>
                        )}
                    </div>
                </div>

                {/* Current HP Editor */}
                <div className="bg-[#1e1e1e] p-3 rounded border border-[#444]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Heart size={14} className="text-green-500" /> 현재 체력 관리
                    </h4>
                    <div className="flex items-center gap-2 mb-2">
                         <span className="text-2xl font-bold text-green-400">{selectedPlayer.hp}</span>
                         <span className="text-sm text-gray-500">/ {selectedPlayer.maxHp}</span>
                    </div>
                    <input 
                        type="range"
                        min="0"
                        max={selectedPlayer.maxHp}
                        value={selectedPlayer.hp}
                        onChange={(e) => onUpdatePlayer({ hp: parseInt(e.target.value) })}
                        className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between mt-2 gap-2">
                         <button onClick={() => onUpdatePlayer({ hp: Math.max(0, selectedPlayer.hp - 10) })} className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-200 text-xs py-1 rounded border border-red-900/50">-10</button>
                         <button onClick={() => onUpdatePlayer({ hp: Math.min(selectedPlayer.maxHp, selectedPlayer.hp + 10) })} className="flex-1 bg-green-900/30 hover:bg-green-900/50 text-green-200 text-xs py-1 rounded border border-green-900/50">+10</button>
                    </div>
                </div>

                {/* Stats Editor */}
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Activity size={14} /> 스탯 수정
                    </h4>
                    <div className="space-y-1">
                        <StatInput label="체력 (HP)" value={selectedPlayer.stats.hp} onChange={handleStatHpChange} icon={Activity} color="bg-red-500" />
                        <StatInput label="공격력 (ATK)" value={selectedPlayer.stats.attack} onChange={(v) => onUpdatePlayer({ stats: { ...selectedPlayer.stats, attack: v } })} icon={Sword} color="bg-orange-500" />
                        <StatInput label="방어력 (DEF)" value={selectedPlayer.stats.defense} onChange={(v) => onUpdatePlayer({ stats: { ...selectedPlayer.stats, defense: v } })} icon={Shield} color="bg-blue-500" />
                        <StatInput label="민첩성 (AGI)" value={selectedPlayer.stats.agility} onChange={(v) => onUpdatePlayer({ stats: { ...selectedPlayer.stats, agility: v } })} icon={Zap} color="bg-yellow-500" />
                        <StatInput label="정신력 (SPI)" value={selectedPlayer.stats.spirit} onChange={(v) => onUpdatePlayer({ stats: { ...selectedPlayer.stats, spirit: v } })} icon={Brain} color="bg-purple-500" />
                    </div>
                </div>

                {/* Inventory Editor */}
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Backpack size={14} /> 인벤토리 지급
                    </h4>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="아이템 이름"
                            className="flex-1 bg-[#333] border border-[#555] rounded px-2 py-1.5 text-sm text-white focus:border-orange-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && addItemToPlayer()}
                        />
                        <button 
                            onClick={addItemToPlayer}
                            className="bg-orange-700 hover:bg-orange-600 text-white px-3 rounded flex items-center"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="space-y-1">
                        {selectedPlayer.inventory.length === 0 && <p className="text-xs text-gray-600 italic text-center py-2">인벤토리가 비어있습니다.</p>}
                        {selectedPlayer.inventory.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-2 rounded border border-[#333] group">
                                <span className="text-sm text-gray-300">{item}</span>
                                <button 
                                    onClick={() => removeItemFromPlayer(idx)}
                                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
