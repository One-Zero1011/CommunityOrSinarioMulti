
import React from 'react';
import { FactionGameData, FactionMap } from '../../../types';
import { Map as MapIcon, Users, Key, Plus, Trash2, X as XIcon, UserPlus, Flag, ArrowLeft } from 'lucide-react';
import { Button } from '../../common/Button';

export type SidebarTab = 'MAPS' | 'FACTIONS' | 'SETTINGS';

interface FactionEditorSidebarProps {
    data: FactionGameData;
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    currentMapId: string;
    setCurrentMapId: (id: string) => void;
    onAddMap: () => void;
    onAddFaction: () => void;
    onUpdateFaction: (id: string, updates: any) => void;
    onDeleteFaction: (id: string) => void;
    onAddTeam: (factionId: string) => void;
    onUpdateTeam: (factionId: string, teamId: string, name: string) => void;
    onDeleteTeam: (factionId: string, teamId: string) => void;
    onUpdateAdminKey: (key: string) => void;
    onBack: () => void;
}

export const FactionEditorSidebar: React.FC<FactionEditorSidebarProps> = ({
    data, activeTab, setActiveTab, currentMapId, setCurrentMapId, 
    onAddMap, onAddFaction, onUpdateFaction, onDeleteFaction, 
    onAddTeam, onUpdateTeam, onDeleteTeam, onUpdateAdminKey, onBack
}) => {
    return (
        <div className="w-80 bg-[#252525] border-r border-[#444] flex flex-col z-20 shadow-lg">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-[#444] shrink-0">
                <button 
                    onClick={() => setActiveTab('MAPS')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'MAPS' ? 'bg-[#383838] text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <MapIcon size={16} /> 맵 목록
                </button>
                <button 
                    onClick={() => setActiveTab('FACTIONS')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'FACTIONS' ? 'bg-[#383838] text-white border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Users size={16} /> 진영
                </button>
                <button 
                    onClick={() => setActiveTab('SETTINGS')} 
                    className={`flex-0.5 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'SETTINGS' ? 'bg-[#383838] text-white border-b-2 border-gray-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Key size={16} />
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                
                {/* Map List Tab */}
                {activeTab === 'MAPS' && (
                    <div className="p-2 space-y-2">
                         <div className="p-2 flex justify-between items-center text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                            <span>보유한 맵 ({data.maps.length})</span>
                            <button onClick={onAddMap} className="p-1 hover:bg-[#444] rounded text-emerald-400 transition-colors"><Plus size={16} /></button>
                        </div>
                        {data.maps.map(m => (
                            <div 
                                key={m.id}
                                onClick={() => setCurrentMapId(m.id)}
                                className={`p-3 rounded cursor-pointer flex items-center gap-2 transition-all ${currentMapId === m.id ? 'bg-indigo-700 text-white shadow-md' : 'hover:bg-[#383838] text-gray-400'}`}
                            >
                                <MapIcon size={16} />
                                <span className="truncate">{m.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Faction List Tab */}
                {activeTab === 'FACTIONS' && (
                    <div className="p-4 space-y-4">
                        <div className="text-xs text-gray-400 leading-relaxed bg-[#1e1e1e] p-3 rounded border border-[#444]">
                            <p className="font-bold mb-1 flex items-center gap-1 text-orange-400"><Flag size={12}/> 진영 및 팀 관리</p>
                             각 진영에 소속된 팀을 추가할 수 있습니다. 플레이어는 팀 중 하나를 선택하여 게임에 참여합니다.
                        </div>

                        <div className="space-y-4">
                            {data.factions.map((faction) => (
                                <div key={faction.id} className="bg-[#303030] rounded border border-[#444] shadow-sm flex flex-col overflow-hidden">
                                    {/* Faction Header */}
                                    <div className="p-3 bg-[#383838] flex items-center gap-2 border-b border-[#444]">
                                        <input 
                                            type="color" 
                                            value={faction.color}
                                            onChange={(e) => onUpdateFaction(faction.id, { color: e.target.value })}
                                            className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                                            title="진영 색상"
                                        />
                                        <input 
                                            type="text" 
                                            value={faction.name}
                                            onChange={(e) => onUpdateFaction(faction.id, { name: e.target.value })}
                                            className="flex-1 bg-transparent border-none focus:ring-1 focus:ring-orange-500 rounded px-1 text-sm text-gray-100 font-bold"
                                            placeholder="진영 이름"
                                        />
                                        <button 
                                            onClick={() => onDeleteFaction(faction.id)}
                                            className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                                            title="진영 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    
                                    {/* Teams List */}
                                    <div className="p-3 bg-[#2a2a2a] space-y-2">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex justify-between items-center">
                                            <span>소속 팀 목록</span>
                                        </div>
                                        
                                        {faction.teams.length === 0 && (
                                            <p className="text-xs text-gray-600 italic py-1">등록된 팀이 없습니다.</p>
                                        )}

                                        {faction.teams.map((team) => (
                                            <div key={team.id} className="flex items-center gap-2 pl-2 border-l-2 border-[#444]">
                                                <Users size={12} className="text-gray-500" />
                                                <input 
                                                    type="text"
                                                    value={team.name}
                                                    onChange={(e) => onUpdateTeam(faction.id, team.id, e.target.value)}
                                                    className="flex-1 bg-transparent border-b border-[#444] focus:border-indigo-500 text-xs text-gray-300 px-1 py-0.5 outline-none"
                                                    placeholder="팀 이름"
                                                />
                                                <button 
                                                    onClick={() => onDeleteTeam(faction.id, team.id)}
                                                    className="text-gray-600 hover:text-red-400"
                                                >
                                                    <XIcon size={12} />
                                                </button>
                                            </div>
                                        ))}

                                        <button 
                                            onClick={() => onAddTeam(faction.id)}
                                            className="w-full mt-2 text-xs py-1.5 border border-dashed border-[#555] rounded text-gray-400 hover:text-indigo-400 hover:border-indigo-500 hover:bg-[#333] transition-all flex items-center justify-center gap-1"
                                        >
                                            <UserPlus size={12} /> 팀 추가
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button fullWidth onClick={onAddFaction} variant="secondary" className="text-xs py-2 mt-2">
                            <Plus size={14} /> 새 진영 추가
                        </Button>
                        
                        {data.factions.length < 2 && (
                            <p className="text-red-400 text-xs font-bold text-center animate-pulse mt-2">
                                * 최소 2개의 진영이 필요합니다.
                            </p>
                        )}
                    </div>
                )}

                {/* Settings Tab (Admin Key) */}
                {activeTab === 'SETTINGS' && (
                    <div className="p-6 space-y-4">
                         <div className="text-xs text-gray-400 leading-relaxed bg-[#1e1e1e] p-3 rounded border border-[#444] mb-4">
                            <p className="font-bold mb-1 flex items-center gap-1 text-gray-200"><Key size={12}/> 운영자 키 (Admin Key)</p>
                             게임을 진행할 때 운영자 권한을 얻기 위한 암호를 설정합니다.
                        </div>

                        <div>
                            <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">운영자 암호</label>
                            <input 
                                type="text"
                                value={data.adminKey || ''}
                                onChange={(e) => onUpdateAdminKey(e.target.value)}
                                placeholder="암호 입력"
                                className="w-full bg-[#383838] border border-[#555] rounded px-3 py-2 text-sm text-gray-200 focus:border-orange-500 outline-none"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">* 비워두면 운영자 키 없이 진행됩니다.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-[#444] bg-[#222] shrink-0">
                <Button fullWidth onClick={onBack} variant="ghost" icon={ArrowLeft} className="text-sm">나가기</Button>
            </div>
        </div>
    );
};
