
import React, { useState } from 'react';
import { CombatGameData, CombatStatDef, StatImpact, CombatRules, WeightedValue } from '../../types';
import { ArrowLeft, Plus, Save, Trash2, Sliders, Edit2, ChevronDown, ChevronUp, Table, Zap, Target, Settings, GitCompare, ShieldAlert, Shield, Sword, Users, Skull, BarChart2, X, PieChart, Wind, ToggleRight, ToggleLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { generateId } from '../../lib/utils';

interface CombatEditorProps {
    initialData: CombatGameData;
    onSave: (data: CombatGameData) => void;
    onBack: () => void;
}

export const CombatEditor: React.FC<CombatEditorProps> = ({ initialData, onSave, onBack }) => {
    const [data, setData] = useState<CombatGameData>(initialData);
    const [selectedStatId, setSelectedStatId] = useState<string | null>(null);
    const [showMapping, setShowMapping] = useState(false);
    const [showImpacts, setShowImpacts] = useState(false);
    const [activeTab, setActiveTab] = useState<'STATS' | 'RULES'>('STATS');
    
    // Mapping Modal State
    const [editingMapping, setEditingMapping] = useState<{ statId: string, level: number, entries: WeightedValue[] } | null>(null);

    const handleAddStat = () => {
        const newStat: CombatStatDef = {
            id: `stat_${generateId()}`,
            label: '새 스탯',
            min: 1,
            max: 5,
            defaultValue: 3,
            isValueLookup: false,
            valueMapping: {},
            impacts: []
        };
        const newData = { ...data, stats: [...data.stats, newStat] };
        setData(newData);
        setSelectedStatId(newStat.id);
        setShowMapping(false);
        setShowImpacts(false);
    };

    const handleUpdateStat = (id: string, updates: Partial<CombatStatDef>) => {
        setData(prev => ({
            ...prev,
            stats: prev.stats.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    };

    const handleDeleteStat = (id: string) => {
        if(confirm("정말 이 스탯을 삭제하시겠습니까?")) {
            setData(prev => ({
                ...prev,
                stats: prev.stats.filter(s => s.id !== id)
            }));
            setSelectedStatId(null);
        }
    };

    // Open Modal for Mapping
    const openMappingEditor = (statId: string, level: number) => {
        const stat = data.stats.find(s => s.id === statId);
        if (!stat) return;
        
        const currentEntries = stat.valueMapping?.[level] || [];
        setEditingMapping({ statId, level, entries: currentEntries.length > 0 ? currentEntries : [{ value: 0, weight: 1 }] });
    };

    const saveMapping = () => {
        if (!editingMapping) return;
        const stat = data.stats.find(s => s.id === editingMapping.statId);
        if (!stat) return;

        const newMapping = { ...(stat.valueMapping || {}) };
        const validEntries = editingMapping.entries.filter(e => e.weight > 0);
        
        if (validEntries.length > 0) {
            newMapping[editingMapping.level] = validEntries;
        } else {
            delete newMapping[editingMapping.level];
        }

        handleUpdateStat(editingMapping.statId, { valueMapping: newMapping });
        setEditingMapping(null);
    };

    const updateMappingEntry = (index: number, field: keyof WeightedValue, val: number) => {
        if (!editingMapping) return;
        const newEntries = [...editingMapping.entries];
        newEntries[index] = { ...newEntries[index], [field]: val };
        setEditingMapping({ ...editingMapping, entries: newEntries });
    };

    const addMappingEntry = () => {
        if (!editingMapping) return;
        setEditingMapping({ ...editingMapping, entries: [...editingMapping.entries, { value: 0, weight: 1 }] });
    };

    const removeMappingEntry = (index: number) => {
        if (!editingMapping) return;
        setEditingMapping({ ...editingMapping, entries: editingMapping.entries.filter((_, i) => i !== index) });
    };

    const handleAddImpact = (statId: string) => {
        const stat = data.stats.find(s => s.id === statId);
        if(!stat) return;
        
        const potentialTargets = data.stats.filter(s => s.id !== statId);
        if (potentialTargets.length === 0) {
            alert("영향을 줄 다른 스탯이 존재하지 않습니다. 스탯을 먼저 추가하세요.");
            return;
        }

        const newImpact: StatImpact = {
            targetStatId: potentialTargets[0].id,
            operation: 'SUBTRACT'
        };

        handleUpdateStat(statId, { impacts: [...(stat.impacts || []), newImpact] });
    };

    const handleRemoveImpact = (statId: string, index: number) => {
        const stat = data.stats.find(s => s.id === statId);
        if(!stat || !stat.impacts) return;
        
        const newImpacts = stat.impacts.filter((_, i) => i !== index);
        handleUpdateStat(statId, { impacts: newImpacts });
    };

    const handleUpdateImpact = (statId: string, index: number, field: keyof StatImpact, value: string) => {
        const stat = data.stats.find(s => s.id === statId);
        if(!stat || !stat.impacts) return;

        const newImpacts = stat.impacts.map((imp, i) => {
            if (i === index) {
                return { ...imp, [field]: value };
            }
            return imp;
        });
        handleUpdateStat(statId, { impacts: newImpacts });
    };

    const handleUpdateRules = (updates: Partial<CombatRules>) => {
        setData(prev => ({
            ...prev,
            rules: { 
                ...(prev.rules || { initiativeStatId: '', turnOrder: 'INDIVIDUAL', allowDefend: false, allowCounter: false, allowCover: false, allowDodge: false }), 
                ...updates 
            }
        }));
    };

    const handleSaveFile = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Combat_System_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const selectedStat = data.stats.find(s => s.id === selectedStatId);
    const mappingRange = selectedStat 
        ? Array.from({ length: (selectedStat.max - selectedStat.min) + 1 }, (_, i) => selectedStat.min + i)
        : [];

    return (
        <div className="flex h-screen bg-[#2e2e2e] text-gray-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-[#252525] border-r border-[#444] flex flex-col z-20 shadow-lg">
                <div className="p-4 border-b border-[#444] flex items-center gap-2 bg-[#222]">
                    <Button variant="ghost" onClick={onBack} className="p-1"><ArrowLeft size={16} /></Button>
                    <span className="font-bold text-sm">전투 시스템 제작</span>
                </div>
                
                <div className="flex border-b border-[#444]">
                    <button 
                        onClick={() => setActiveTab('STATS')}
                        className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'STATS' ? 'bg-[#333] text-white border-b-2 border-rose-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        스탯 설정
                    </button>
                    <button 
                        onClick={() => setActiveTab('RULES')}
                        className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'RULES' ? 'bg-[#333] text-white border-b-2 border-orange-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        전투 규칙
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {activeTab === 'STATS' && (
                        <>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">스탯 목록</span>
                                <button onClick={handleAddStat} className="text-emerald-400 hover:bg-[#333] p-1 rounded"><Plus size={16} /></button>
                            </div>
                            {data.stats.map(stat => (
                                <div 
                                    key={stat.id}
                                    onClick={() => { setSelectedStatId(stat.id); setShowMapping(false); setShowImpacts(false); }}
                                    className={`p-3 rounded border cursor-pointer flex justify-between items-center transition-all ${selectedStatId === stat.id ? 'bg-rose-900/40 border-rose-500 text-white' : 'bg-[#333] border-[#444] text-gray-400 hover:border-gray-300'}`}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{stat.label}</span>
                                        {stat.isValueLookup && <span className="text-[10px] text-rose-300 font-bold uppercase tracking-tighter">Value Lookup ON</span>}
                                    </div>
                                    <span className="text-xs bg-black/30 px-2 py-0.5 rounded">{stat.min} ~ {stat.max}</span>
                                </div>
                            ))}
                            {data.stats.length === 0 && <p className="text-gray-600 text-xs italic text-center py-4">스탯을 추가해주세요.</p>}
                        </>
                    )}

                    {activeTab === 'RULES' && (
                        <div className="text-sm text-gray-400 p-2 text-center italic">
                            우측 패널에서<br/>전투 진행 방식을 설정하세요.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#444] bg-[#222]">
                    <Button fullWidth onClick={handleSaveFile} variant="primary" icon={Save}>시스템 저장 (.json)</Button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 bg-[#1a1a1a] p-8 flex flex-col items-center justify-center overflow-y-auto">
                {activeTab === 'STATS' ? (
                    selectedStat ? (
                        <div className="w-full max-w-lg bg-[#252525] p-8 rounded-2xl border border-[#444] shadow-2xl animate-fade-in">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#444]">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-rose-400">
                                    <Sliders /> 스탯 설정
                                </h2>
                                <button onClick={() => handleDeleteStat(selectedStat.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                                        <Edit2 size={14} /> 스탯 이름
                                    </label>
                                    <input 
                                        type="text" 
                                        value={selectedStat.label}
                                        onChange={(e) => handleUpdateStat(selectedStat.id, { label: e.target.value })}
                                        className="w-full bg-[#333] border border-[#555] rounded px-4 py-3 text-lg font-bold text-white focus:border-rose-500 outline-none"
                                    />
                                </div>

                                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-900/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                                                <Target size={14}/> 값 변환 모드 (Value Lookup)
                                            </h4>
                                            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                                활성화 시, 캐릭터 생성 단계에서 선택한 스탯 수치가<br/>
                                                매핑된 실제 값으로 즉시 고정 변환됩니다. (예: HP)
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => handleUpdateStat(selectedStat.id, { isValueLookup: !selectedStat.isValueLookup })}
                                            className="focus:outline-none transition-transform active:scale-95"
                                        >
                                            {selectedStat.isValueLookup ? <ToggleRight size={40} className="text-rose-500" /> : <ToggleLeft size={40} className="text-gray-600" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">단계 범위 (Min)</label>
                                        <input 
                                            type="number" 
                                            value={selectedStat.min}
                                            onChange={(e) => handleUpdateStat(selectedStat.id, { min: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-[#333] border border-[#555] rounded px-3 py-2 text-center text-white focus:border-rose-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">단계 범위 (Max)</label>
                                        <input 
                                            type="number" 
                                            value={selectedStat.max}
                                            onChange={(e) => handleUpdateStat(selectedStat.id, { max: parseInt(e.target.value) || 100 })}
                                            className="w-full bg-[#333] border border-[#555] rounded px-3 py-2 text-center text-white focus:border-rose-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">기본 단계 (Default)</label>
                                    <div className="flex items-center gap-4">
                                        <input 
                                            type="range"
                                            min={selectedStat.min}
                                            max={selectedStat.max}
                                            value={selectedStat.defaultValue}
                                            onChange={(e) => handleUpdateStat(selectedStat.id, { defaultValue: parseInt(e.target.value) })}
                                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                        />
                                        <span className="w-12 text-center font-mono font-bold text-xl text-rose-400">{selectedStat.defaultValue}</span>
                                    </div>
                                </div>

                                {/* Value Mapping Section */}
                                <div className="border-t border-[#444] pt-4">
                                    <button 
                                        onClick={() => setShowMapping(!showMapping)}
                                        className="w-full flex items-center justify-between text-left text-sm font-bold text-gray-300 hover:text-white p-2 rounded hover:bg-[#333] transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Table size={14}/> 
                                            {selectedStat.isValueLookup ? '고정 값 매핑 설정 (Lookup Table)' : '확률/수치 매핑 설정 (Value Mapping)'}
                                        </span>
                                        {showMapping ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    </button>
                                    
                                    {showMapping && (
                                        <div className="mt-3 bg-[#1e1e1e] p-4 rounded border border-[#444] animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
                                            <p className="text-xs text-gray-500 mb-3 italic">
                                                {selectedStat.isValueLookup 
                                                    ? "각 단계별로 변환될 최종 고정값을 입력하세요."
                                                    : "스탯 수치별 결과값을 설정합니다. 그래프 버튼을 눌러 확률을 조정하세요."}
                                            </p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {mappingRange.map(val => {
                                                    const mappings = selectedStat.valueMapping?.[val] || [];
                                                    const display = mappings.length > 0 
                                                        ? mappings.map(m => `${m.value}`).join(', ') 
                                                        : "(미설정)";
                                                    
                                                    return (
                                                        <div key={val} className="flex items-center gap-2 bg-[#252525] p-2 rounded border border-[#333]">
                                                            <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center font-bold font-mono text-sm text-gray-400">{val}</div>
                                                            <div className="flex-1 text-xs text-gray-300 truncate">
                                                                ➔ <span className="font-mono font-bold text-white">{display}</span>
                                                                {mappings.length > 1 && !selectedStat.isValueLookup && <span className="text-gray-500 ml-2">({mappings.length}개 확률)</span>}
                                                            </div>
                                                            <button 
                                                                onClick={() => openMappingEditor(selectedStat.id, val)}
                                                                className={`p-1.5 rounded hover:bg-[#444] transition-colors ${mappings.length > 0 ? (selectedStat.isValueLookup ? 'text-rose-400' : 'text-indigo-400') : 'text-gray-600'}`}
                                                                title={selectedStat.isValueLookup ? "값 설정" : "확률 설정"}
                                                            >
                                                                {selectedStat.isValueLookup ? <Edit2 size={16} /> : <BarChart2 size={16} />}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Impact Section */}
                                <div className="border-t border-[#444] pt-4">
                                    <button 
                                        onClick={() => setShowImpacts(!showImpacts)}
                                        className="w-full flex items-center justify-between text-left text-sm font-bold text-gray-300 hover:text-white p-2 rounded hover:bg-[#333] transition-colors"
                                    >
                                        <span className="flex items-center gap-2"><Zap size={14}/> 다른 스탯에 미치는 영향 (Impacts)</span>
                                        {showImpacts ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    </button>
                                    
                                    {showImpacts && (
                                        <div className="mt-3 bg-[#1e1e1e] p-4 rounded border border-[#444] animate-fade-in">
                                            <div className="space-y-2">
                                                {(selectedStat.impacts || []).map((impact, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-[#252525] p-2 rounded border border-[#444]">
                                                        <Target size={14} className="text-gray-500" />
                                                        <select 
                                                            value={impact.targetStatId}
                                                            onChange={(e) => handleUpdateImpact(selectedStat.id, idx, 'targetStatId', e.target.value)}
                                                            className="flex-1 bg-[#333] text-xs text-white border border-[#555] rounded px-1 py-1"
                                                        >
                                                            {data.stats.filter(s => s.id !== selectedStat.id).map(s => (
                                                                <option key={s.id} value={s.id}>{s.label}</option>
                                                            ))}
                                                        </select>
                                                        <span className="text-xs text-gray-400">값을</span>
                                                        <select 
                                                            value={impact.operation}
                                                            onChange={(e) => handleUpdateImpact(selectedStat.id, idx, 'operation', e.target.value)}
                                                            className={`w-20 text-xs border rounded px-1 py-1 font-bold ${impact.operation === 'SUBTRACT' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}
                                                        >
                                                            <option value="SUBTRACT">감소 (-)</option>
                                                            <option value="ADD">증가 (+)</option>
                                                        </select>
                                                        <button onClick={() => handleRemoveImpact(selectedStat.id, idx)} className="text-gray-500 hover:text-red-400">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button 
                                                    onClick={() => handleAddImpact(selectedStat.id)}
                                                    className="w-full py-1.5 text-xs border border-dashed border-[#555] rounded text-gray-400 hover:text-white hover:bg-[#333] flex items-center justify-center gap-1"
                                                >
                                                    <Plus size={12} /> 영향 추가
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 flex flex-col items-center gap-4">
                            <Sliders size={64} className="opacity-20" />
                            <p className="text-lg">좌측 목록에서 스탯을 선택하거나 새로 추가하세요.</p>
                        </div>
                    )
                ) : (
                    // RULES TAB
                    <div className="w-full max-w-lg bg-[#252525] p-8 rounded-2xl border border-[#444] shadow-2xl animate-fade-in">
                        <div className="mb-6 pb-4 border-b border-[#444]">
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-orange-400">
                                <Settings /> 전투 규칙 설정
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">전투의 흐름과 턴 순서 방식을 정의합니다.</p>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                                    <Zap size={14}/> 선공 결정 스탯 (Initiative)
                                </label>
                                <select 
                                    value={data.rules?.initiativeStatId || ''}
                                    onChange={(e) => handleUpdateRules({ initiativeStatId: e.target.value })}
                                    className="w-full bg-[#333] border border-[#555] rounded px-4 py-3 text-white focus:border-orange-500 outline-none"
                                >
                                    <option value="">(없음 - 무작위)</option>
                                    {data.stats.map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                                    <Skull size={14}/> 사망 판정 스탯 (Death Condition)
                                </label>
                                <select 
                                    value={data.rules?.deathStatId || ''}
                                    onChange={(e) => handleUpdateRules({ deathStatId: e.target.value })}
                                    className="w-full bg-[#333] border border-[#555] rounded px-4 py-3 text-white focus:border-orange-500 outline-none"
                                >
                                    <option value="">(설정 안 함 - 죽음 없음)</option>
                                    {data.stats.filter(s => s.isValueLookup).map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">* '값 변환 모드'가 활성화된 스탯만 선택 가능합니다.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                                    <GitCompare size={14}/> 턴 순서 방식 (Turn Order)
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div 
                                        onClick={() => handleUpdateRules({ turnOrder: 'INDIVIDUAL' })}
                                        className={`p-4 rounded border cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${data.rules?.turnOrder !== 'TEAM_SUM' ? 'bg-orange-900/30 border-orange-500 text-white' : 'bg-[#333] border-[#555] text-gray-500'}`}
                                    >
                                        <span className="font-bold">개별 행동</span>
                                        <span className="text-[10px] opacity-70">모든 캐릭터가<br/>스탯 순서대로 행동</span>
                                    </div>
                                    <div 
                                        onClick={() => handleUpdateRules({ turnOrder: 'TEAM_SUM' })}
                                        className={`p-4 rounded border cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${data.rules?.turnOrder === 'TEAM_SUM' ? 'bg-orange-900/30 border-orange-500 text-white' : 'bg-[#333] border-[#555] text-gray-500'}`}
                                    >
                                        <span className="font-bold">팀 합산 우선</span>
                                        <span className="text-[10px] opacity-70">팀 스탯 총합이 높은<br/>팀 전원이 먼저 행동</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reaction Rules */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                                    <ShieldAlert size={14}/> 대응 규칙 (Reaction Rules)
                                </label>
                                <div className="bg-[#333] p-4 rounded border border-[#555] space-y-4">
                                    
                                    {/* Dodge */}
                                    <div className="space-y-2 border-b border-[#444] pb-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.rules?.allowDodge ? 'bg-emerald-600 border-emerald-500' : 'bg-[#222] border-[#555]'}`}>
                                                {data.rules?.allowDodge && <Wind size={12} className="text-white"/>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={data.rules?.allowDodge || false} onChange={(e) => handleUpdateRules({ allowDodge: e.target.checked })} />
                                            <span className="text-sm font-bold text-gray-200">회피 (Dodge)</span>
                                        </label>
                                        {data.rules?.allowDodge && (
                                            <select 
                                                value={data.rules?.dodgeStatId || ''}
                                                onChange={(e) => handleUpdateRules({ dodgeStatId: e.target.value })}
                                                className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white"
                                            >
                                                <option value="">(스탯 선택)</option>
                                                {data.stats.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        )}
                                        <p className="text-[10px] text-gray-500 pl-8">공격 판정 직후, 대응 선택 전에 판정합니다.</p>
                                    </div>

                                    {/* Defend */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.rules?.allowDefend ? 'bg-blue-600 border-blue-500' : 'bg-[#222] border-[#555]'}`}>
                                                {data.rules?.allowDefend && <Shield size={12} className="text-white"/>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={data.rules?.allowDefend || false} onChange={(e) => handleUpdateRules({ allowDefend: e.target.checked })} />
                                            <span className="text-sm font-bold text-gray-200">방어 (Defend)</span>
                                        </label>
                                        {data.rules?.allowDefend && (
                                            <select 
                                                value={data.rules?.defenseStatId || ''}
                                                onChange={(e) => handleUpdateRules({ defenseStatId: e.target.value })}
                                                className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white"
                                            >
                                                <option value="">(스탯 선택)</option>
                                                {data.stats.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        )}
                                    </div>

                                    {/* Counter */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.rules?.allowCounter ? 'bg-red-600 border-red-500' : 'bg-[#222] border-[#555]'}`}>
                                                {data.rules?.allowCounter && <Sword size={12} className="text-white"/>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={data.rules?.allowCounter || false} onChange={(e) => handleUpdateRules({ allowCounter: e.target.checked })} />
                                            <span className="text-sm font-bold text-gray-200">반격 (Counter)</span>
                                        </label>
                                        {data.rules?.allowCounter && (
                                            <select 
                                                value={data.rules?.counterStatId || ''}
                                                onChange={(e) => handleUpdateRules({ counterStatId: e.target.value })}
                                                className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white"
                                            >
                                                <option value="">(스탯 선택 - 없으면 공격 스탯 사용)</option>
                                                {data.stats.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        )}
                                    </div>

                                    {/* Cover */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.rules?.allowCover ? 'bg-yellow-600 border-yellow-500' : 'bg-[#222] border-[#555]'}`}>
                                                {data.rules?.allowCover && <Users size={12} className="text-white"/>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={data.rules?.allowCover || false} onChange={(e) => handleUpdateRules({ allowCover: e.target.checked })} />
                                            <span className="text-sm font-bold text-gray-200">대리 방어 (Cover)</span>
                                        </label>
                                        {data.rules?.allowCover && (
                                            <select 
                                                value={data.rules?.coverStatId || ''}
                                                onChange={(e) => handleUpdateRules({ coverStatId: e.target.value })}
                                                className="w-full bg-[#2a2a2a] border border-[#555] rounded px-2 py-1 text-xs text-white"
                                            >
                                                <option value="">(스탯 선택 - 없으면 방어 스탯 사용)</option>
                                                {data.stats.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Probability Mapping Modal */}
            <Modal
                isOpen={!!editingMapping}
                onClose={() => setEditingMapping(null)}
                title={selectedStat?.isValueLookup ? "고정 값 설정" : "확률/결과 매핑 설정"}
                maxWidth="max-w-xl"
                footer={<div className="flex gap-2"><Button variant="ghost" onClick={() => setEditingMapping(null)}>취소</Button><Button onClick={saveMapping}>저장</Button></div>}
            >
                {editingMapping && (() => {
                    const totalWeight = editingMapping.entries.reduce((sum, e) => sum + e.weight, 0);
                    return (
                        <div className="space-y-6 p-2">
                            <div className="flex items-center gap-2 mb-4 bg-black/30 p-2 rounded text-sm text-gray-300">
                                <span className="font-bold text-white">스탯 단계: {editingMapping.level}</span>
                                {selectedStat?.isValueLookup 
                                    ? " 일 때 변환될 값을 설정하세요." 
                                    : " 일 때 발생할 결과 확률을 설정하세요."}
                            </div>

                            <div className="space-y-2">
                                <div className="flex text-xs font-bold text-gray-500 px-2">
                                    <span className="w-24">결과값 (Value)</span>
                                    {!selectedStat?.isValueLookup && (
                                        <>
                                            <span className="w-24">가중치 (Weight)</span>
                                            <span className="flex-1">확률 (%)</span>
                                        </>
                                    )}
                                    <span className="w-8"></span>
                                </div>
                                {editingMapping.entries.map((entry, idx) => {
                                    const percent = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0;
                                    return (
                                        <div key={idx} className="flex items-center gap-3 bg-[#1e1e1e] p-2 rounded border border-[#444]">
                                            <input 
                                                type="number"
                                                value={entry.value}
                                                onChange={(e) => updateMappingEntry(idx, 'value', parseInt(e.target.value) || 0)}
                                                className="w-24 bg-[#333] border border-[#555] rounded px-2 py-1 text-white font-mono"
                                                placeholder="Value"
                                            />
                                            {!selectedStat?.isValueLookup && (
                                                <>
                                                    <input 
                                                        type="number"
                                                        value={entry.weight}
                                                        onChange={(e) => updateMappingEntry(idx, 'weight', Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-24 bg-[#333] border border-[#555] rounded px-2 py-1 text-white font-mono"
                                                        placeholder="Weight"
                                                    />
                                                    <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden relative">
                                                        <div 
                                                            className="h-full bg-indigo-600 transition-all"
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white drop-shadow-md">
                                                            {percent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            {(!selectedStat?.isValueLookup || editingMapping.entries.length > 1) && (
                                                <button onClick={() => removeMappingEntry(idx)} className="text-gray-500 hover:text-red-400">
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {!selectedStat?.isValueLookup && (
                                    <button 
                                        onClick={addMappingEntry}
                                        className="w-full py-2 border border-dashed border-[#555] rounded text-gray-400 hover:text-white hover:bg-[#333] flex items-center justify-center gap-1 text-xs"
                                    >
                                        <Plus size={14} /> 항목 추가
                                    </button>
                                )}
                            </div>

                            {/* Chart Visualization - Only for non-lookup */}
                            {!selectedStat?.isValueLookup && (
                                <div className="bg-[#1e1e1e] p-4 rounded border border-[#444]">
                                    <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><PieChart size={14}/> 확률 분포</h4>
                                    <div className="h-4 bg-gray-800 rounded-full flex overflow-hidden">
                                        {editingMapping.entries.map((entry, idx) => {
                                            const percent = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0;
                                            if (percent <= 0) return null;
                                            const hue = (idx * 137.5) % 360; 
                                            return (
                                                <div 
                                                    key={idx}
                                                    className="h-full transition-all flex items-center justify-center relative group"
                                                    style={{ width: `${percent}%`, backgroundColor: `hsl(${hue}, 60%, 50%)` }}
                                                    title={`Value: ${entry.value} (${percent.toFixed(1)}%)`}
                                                >
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {editingMapping.entries.map((entry, idx) => {
                                            const hue = (idx * 137.5) % 360;
                                            return (
                                                <div key={idx} className="flex items-center gap-1 text-[10px] text-gray-400">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${hue}, 60%, 50%)` }}></div>
                                                    <span>Val {entry.value}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};
