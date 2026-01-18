
import React, { useState, useRef, useMemo } from 'react';
import { GameData, Character, CustomStatDef } from '../../types';
import { User, Upload, Check, X, Shield, Activity, UserPlus, Heart } from 'lucide-react';
import { Button } from '../common/Button';
import { blobToBase64, generateId } from '../../lib/utils';

interface CharacterSetupModalProps {
    gameData: GameData;
    isOpen: boolean;
    onClose: () => void;
    onAdd: (character: Character) => void;
}

export const CharacterSetupModal: React.FC<CharacterSetupModalProps> = ({ gameData, isOpen, onAdd, onClose }) => {
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState<string | undefined>(undefined);
    const [stats, setStats] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        (gameData.customStats || []).forEach(s => {
            initial[s.id] = s.defaultValue;
        });
        return initial;
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived Max HP calculation
    const calculatedMaxHp = useMemo(() => {
        const base = gameData.baseHp ?? 100;
        const hpStatDef = (gameData.customStats || []).find(s => s.isHpBound);
        if (!hpStatDef) return base;

        const statValue = stats[hpStatDef.id] ?? 0;
        const weight = hpStatDef.hpWeight ?? 0;
        return base + (statValue * weight);
    }, [gameData.baseHp, gameData.customStats, stats]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const base64 = await blobToBase64(e.target.files[0]);
                setAvatar(base64);
            } catch (err) {
                console.error("Avatar convert error", err);
            }
        }
    };

    const handleStatChange = (id: string, value: number, min: number, max: number) => {
        const clamped = Math.max(min, Math.min(max, value));
        setStats(prev => ({ ...prev, [id]: clamped }));
    };

    const handleSubmit = () => {
        if (!name.trim()) {
            alert("탐사자 이름을 입력해주세요.");
            return;
        }

        const newChar: Character = {
            id: `char_${generateId()}`,
            name: name.trim(),
            hp: calculatedMaxHp,
            maxHp: calculatedMaxHp,
            inventory: [],
            avatar,
            stats,
            x: 100 + (Math.random() * 200),
            y: 300 + (Math.random() * 200),
            mapId: gameData.startMapId || gameData.maps[0]?.id
        };

        onAdd(newChar);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252525] border border-[#444] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                <div className="p-4 border-b border-[#444] bg-[#222] flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <UserPlus className="text-indigo-400" /> 탐사자 생성
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Basic Info */}
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="shrink-0 flex flex-col items-center gap-3">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-[#1a1a1a] border-2 border-dashed border-[#444] flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-all overflow-hidden relative group"
                            >
                                {avatar ? (
                                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={32} className="text-gray-600" />
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload size={20} className="text-white" />
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">프로필 이미지</span>
                        </div>

                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">탐사자 이름</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="이름을 입력하세요"
                                    className="w-full bg-[#1a1a1a] border border-[#444] rounded px-4 py-2 text-white focus:border-indigo-500 outline-none font-bold"
                                />
                            </div>
                            <div className="bg-[#1e1e1e] p-3 rounded border border-[#444] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Heart className="text-red-500" size={18} />
                                    <span className="text-sm font-bold text-gray-300">최대 체력 (Max HP)</span>
                                </div>
                                <span className="text-xl font-mono font-extrabold text-red-400">{calculatedMaxHp}</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed italic">
                                * 시나리오의 설정에 맞춰 캐릭터의 능력치를 설정해주세요. 특정 스탯은 체력에 영향을 줄 수 있습니다.
                            </p>
                        </div>
                    </div>

                    {/* Custom Stats Section */}
                    {gameData.customStats && gameData.customStats.length > 0 && (
                        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-[#444]">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase mb-4 flex items-center gap-2">
                                <Activity size={14}/> 능력치 (Stats)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                                {gameData.customStats.map((stat) => (
                                    <div key={stat.id} className={`space-y-2 p-3 rounded-lg border ${stat.isHpBound ? 'bg-red-900/10 border-red-500/30' : 'bg-black/20 border-transparent'}`}>
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <div className="flex items-center gap-2">
                                                <span className={stat.isHpBound ? 'text-red-400' : 'text-gray-300'}>{stat.label}</span>
                                                {stat.isHpBound && <Heart size={10} className="text-red-500 animate-pulse" />}
                                            </div>
                                            <span className={`font-mono bg-black/40 px-2 py-0.5 rounded ${stat.isHpBound ? 'text-red-400 border border-red-900/50' : 'text-white'}`}>{stats[stat.id]}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-600 font-bold w-4">{stat.min}</span>
                                            <input 
                                                type="range"
                                                min={stat.min}
                                                max={stat.max}
                                                value={stats[stat.id]}
                                                onChange={(e) => handleStatChange(stat.id, parseInt(e.target.value), stat.min, stat.max)}
                                                className={`flex-1 h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-indigo-500 ${stat.isHpBound ? 'accent-red-500' : ''}`}
                                            />
                                            <span className="text-[10px] text-gray-600 font-bold w-4">{stat.max}</span>
                                        </div>
                                        {stat.isHpBound && (
                                            <p className="text-[10px] text-red-400/60 font-medium">체력에 영향을 주는 스탯입니다. (가중치: {stat.hpWeight})</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#444] bg-[#222] flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose}>취소</Button>
                    <Button variant="primary" onClick={handleSubmit} icon={Check} className="px-8">탐사자 생성 완료</Button>
                </div>
            </div>
        </div>
    );
};
