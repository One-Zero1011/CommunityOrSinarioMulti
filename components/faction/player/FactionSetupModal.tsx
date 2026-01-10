
import React, { useState, useRef } from 'react';
import { FactionGameData, FactionPlayerProfile, FactionStats } from '../../../types';
import { Crown, Shield, Users, User, Upload, Lock, Activity, Sword, Shield as ShieldIcon, Zap, Brain, Loader2 } from 'lucide-react';
import { Button } from '../../common/Button';
import { StatInput } from '../common/StatInput';
import { generateId, blobToBase64 } from '../../../lib/utils';
import { ArrowLeft } from 'lucide-react';

interface FactionSetupModalProps {
    data: FactionGameData;
    onClose: () => void; // Used for "Exit"
    onJoin: (profile: FactionPlayerProfile) => void;
    onAdminLogin: () => void;
}

export const FactionSetupModal: React.FC<FactionSetupModalProps> = ({ data, onClose, onJoin, onAdminLogin }) => {
    const [setupTab, setSetupTab] = useState<'PLAYER' | 'ADMIN'>('PLAYER');
    
    // Player Setup State
    const [setupFactionId, setSetupFactionId] = useState<string>('');
    const [setupTeamId, setSetupTeamId] = useState<string>('');
    const [setupName, setSetupName] = useState('');
    const [setupAvatar, setSetupAvatar] = useState<string | undefined>(undefined);
    const [setupStats, setSetupStats] = useState<FactionStats>({ hp: 3, attack: 3, defense: 3, agility: 3, spirit: 3 });
  
    // Admin Setup State
    const [adminKeyInput, setAdminKeyInput] = useState('');
    
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const selectedFaction = data.factions.find(f => f.id === setupFactionId);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const base64 = await blobToBase64(e.target.files[0]);
                setSetupAvatar(base64);
            } catch (err) {
                console.error("Image convert error", err);
            }
        }
    };
  
    const handlePlayerJoin = () => {
        if (!setupFactionId) { alert("진영을 선택해주세요."); return; }
        if (!setupTeamId) { alert("팀을 선택해주세요."); return; }
        if (!setupName.trim()) { alert("캐릭터 이름을 입력해주세요."); return; }
  
        const calculatedMaxHp = 150 + (setupStats.hp * 10);

        const profile: FactionPlayerProfile = {
            id: generateId(),
            name: setupName,
            avatar: setupAvatar,
            factionId: setupFactionId,
            teamId: setupTeamId,
            stats: setupStats,
            hp: calculatedMaxHp,
            maxHp: calculatedMaxHp,
            inventory: []
        };
        onJoin(profile);
    };
  
    const handleAdminLogin = () => {
        if (data.adminKey && adminKeyInput === data.adminKey) {
            onAdminLogin();
        } else {
            alert("운영자 키가 올바르지 않습니다.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#252525] border border-[#444] rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-[#444] bg-[#222] flex justify-between items-center shrink-0">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Crown className="text-yellow-500" /> 게임 시작 설정
                    </h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setSetupTab('PLAYER')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${setupTab === 'PLAYER' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-[#333] text-gray-400 hover:text-white'}`}
                        >
                            플레이어 참가
                        </button>
                        <button 
                            onClick={() => setSetupTab('ADMIN')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${setupTab === 'ADMIN' ? 'bg-orange-700 text-white shadow-lg' : 'bg-[#333] text-gray-400 hover:text-white'}`}
                        >
                            운영자 로그인
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex">
                    {setupTab === 'PLAYER' && (
                        <div className="flex-1 flex flex-col md:flex-row h-full">
                            {/* Left: Faction & Team Selection */}
                            <div className="w-full md:w-1/3 border-r border-[#444] p-4 flex flex-col bg-[#1e1e1e] overflow-y-auto">
                                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                    <Shield size={16}/> 1. 진영 선택
                                </h3>
                                <div className="space-y-3 mb-6">
                                    {data.factions.length === 0 && (
                                        <div className="flex flex-col items-center py-10 text-gray-500">
                                            <Loader2 size={24} className="animate-spin mb-2" />
                                            <p className="text-xs">진영 정보를 불러오는 중...</p>
                                        </div>
                                    )}
                                    {data.factions.map(f => (
                                        <div 
                                            key={f.id}
                                            onClick={() => { setSetupFactionId(f.id); setSetupTeamId(''); }}
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden ${setupFactionId === f.id ? 'border-white bg-[#333]' : 'border-transparent bg-[#2a2a2a] hover:bg-[#333]'}`}
                                            style={{ borderColor: setupFactionId === f.id ? f.color : 'transparent' }}
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: f.color }}></div>
                                                <span className="font-bold text-lg">{f.name}</span>
                                            </div>
                                            <div className="absolute top-0 right-0 w-16 h-full opacity-20 transform skew-x-12" style={{ backgroundColor: f.color }}></div>
                                        </div>
                                    ))}
                                </div>

                                {setupFactionId && selectedFaction && (
                                    <div className="animate-fade-in">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                            <Users size={16}/> 2. 팀 선택
                                        </h3>
                                        <div className="space-y-2">
                                            {(!selectedFaction.teams || selectedFaction.teams.length === 0) ? (
                                                <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded text-center">
                                                    <p className="text-orange-200 text-xs font-bold mb-1">팀 정보가 없습니다.</p>
                                                    <p className="text-[10px] text-gray-400 italic">호스트가 팀을 설정하지 않았거나 동기화 중입니다.</p>
                                                </div>
                                            ) : (
                                                selectedFaction.teams.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setSetupTeamId(t.id)}
                                                        className={`w-full text-left p-3 rounded border transition-all ${setupTeamId === t.id ? 'bg-indigo-900/40 border-indigo-500 text-white font-bold' : 'bg-[#2a2a2a] border-[#333] text-gray-300 hover:bg-[#333]'}`}
                                                    >
                                                        {t.name}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Character Stats */}
                            <div className="flex-1 p-6 overflow-y-auto bg-[#252525]">
                                <div className={`transition-opacity duration-300 ${(!setupFactionId || !setupTeamId) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                                        <User size={16}/> 3. 캐릭터 설정
                                    </h3>

                                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                                        {/* Avatar Upload */}
                                        <div className="shrink-0 flex flex-col items-center gap-2">
                                            <div 
                                                onClick={() => avatarInputRef.current?.click()}
                                                className="w-32 h-32 rounded-xl bg-[#1a1a1a] border-2 border-dashed border-[#444] flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-[#222] transition-all overflow-hidden relative group"
                                            >
                                                {setupAvatar ? (
                                                    <img src={setupAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-gray-500 flex flex-col items-center">
                                                        <User size={32} className="mb-1"/>
                                                        <span className="text-xs">이미지 업로드</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Upload className="text-white" />
                                                </div>
                                            </div>
                                            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                        </div>

                                        {/* Name Input */}
                                        <div className="flex-1">
                                            <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">캐릭터 이름</label>
                                            <input 
                                                type="text" 
                                                value={setupName}
                                                onChange={(e) => setSetupName(e.target.value)}
                                                placeholder="이름을 입력하세요"
                                                className="w-full bg-[#1a1a1a] border border-[#444] rounded px-4 py-3 text-lg font-bold focus:border-indigo-500 outline-none mb-4"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#444]">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">스탯 설정 (1-5)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                            <StatInput label="체력 (HP)" value={setupStats.hp} onChange={(v) => setSetupStats({...setupStats, hp: v})} icon={Activity} color="bg-red-500" />
                                            <StatInput label="공격력 (ATK)" value={setupStats.attack} onChange={(v) => setSetupStats({...setupStats, attack: v})} icon={Sword} color="bg-orange-500" />
                                            <StatInput label="방어력 (DEF)" value={setupStats.defense} onChange={(v) => setSetupStats({...setupStats, defense: v})} icon={ShieldIcon} color="bg-blue-500" />
                                            <StatInput label="민첩성 (AGI)" value={setupStats.agility} onChange={(v) => setSetupStats({...setupStats, agility: v})} icon={Zap} color="bg-yellow-500" />
                                            <StatInput label="정신력 (SPI)" value={setupStats.spirit} onChange={(v) => setSetupStats({...setupStats, spirit: v})} icon={Brain} color="bg-purple-500" />
                                        </div>
                                        <div className="mt-4 p-2 bg-black/20 rounded text-center text-xs text-gray-400">
                                            * 체력 스탯 1당 최대 체력이 10씩 증가합니다 (기본 150).<br/>
                                            현재 설정된 최대 체력: <span className="text-green-400 font-bold">{150 + (setupStats.hp * 10)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {setupTab === 'ADMIN' && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#252525]">
                            <div className="bg-[#1e1e1e] p-8 rounded-2xl border border-[#444] shadow-xl max-w-md w-full">
                                <div className="w-16 h-16 bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/50">
                                    <Lock className="text-orange-500" size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">운영자 인증</h3>
                                <p className="text-gray-400 text-sm mb-6">
                                    시나리오 제작 시 설정한 운영자 암호를 입력하세요.
                                </p>
                                <input 
                                    type="password"
                                    value={adminKeyInput}
                                    onChange={(e) => setAdminKeyInput(e.target.value)}
                                    placeholder="암호 입력"
                                    className="w-full bg-[#333] border border-[#555] rounded px-4 py-3 text-white focus:border-orange-500 outline-none mb-4 text-center tracking-widest"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                                />
                                <Button fullWidth onClick={handleAdminLogin} variant="host">
                                    로그인 및 시작
                                </Button>
                            </div>
                            </div>
                    )}
                </div>

                {/* Footer Actions */}
                {setupTab === 'PLAYER' && (
                    <div className="p-4 border-t border-[#444] bg-[#222] flex justify-between items-center shrink-0">
                        <button onClick={onClose} className="text-gray-500 hover:text-white flex items-center gap-1 font-bold text-sm">
                            <ArrowLeft size={16}/> 나가기
                        </button>
                        <Button 
                            onClick={handlePlayerJoin} 
                            disabled={!setupFactionId || !setupTeamId || !setupName.trim()}
                            variant="primary"
                            className="px-8"
                        >
                            게임 참가
                        </Button>
                    </div>
                )}
                    {setupTab === 'ADMIN' && (
                    <div className="p-4 border-t border-[#444] bg-[#222] flex justify-start items-center shrink-0">
                        <button onClick={onClose} className="text-gray-500 hover:text-white flex items-center gap-1 font-bold text-sm">
                            <ArrowLeft size={16}/> 나가기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
