
import React, { useState } from 'react';
import { FactionGameData, FactionMap, FactionBlock, Faction, FactionTeam } from '../../types';
import { generateId } from '../../lib/utils';
import { FactionEditorSidebar, SidebarTab } from './editor/FactionEditorSidebar';
import { FactionEditorCanvas } from './editor/FactionEditorCanvas';
import { FactionEditorProperties } from './editor/FactionEditorProperties';

interface FactionEditorProps {
  initialData: FactionGameData;
  onBack: () => void;
}

export const FactionEditor: React.FC<FactionEditorProps> = ({ initialData, onBack }) => {
  const [data, setData] = useState<FactionGameData>({
      ...initialData,
      factions: initialData.factions.map(f => ({...f, teams: f.teams || []})) // Ensure teams array exists
  });
  const [currentMapId, setCurrentMapId] = useState<string>(data.maps[0]?.id || '');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('MAPS');

  const currentMap = data.maps.find(m => m.id === currentMapId);
  const selectedBlock = currentMap?.blocks.find(b => b.id === selectedBlockId);

  // -- Map Helpers --

  const updateCurrentMap = (updater: (map: FactionMap) => FactionMap) => {
    if (!currentMap) return;
    const newMap = updater({ ...currentMap });
    setData(prev => ({
      ...prev,
      maps: prev.maps.map(m => m.id === currentMapId ? newMap : m)
    }));
  };

  const handleAddMap = () => {
    const newId = `fmap_${generateId()}`;
    const newMap: FactionMap = {
      id: newId,
      name: `새 전장 ${data.maps.length + 1}`,
      rows: 3,
      cols: 3,
      blocks: generateBlocks(3, 3)
    };
    setData(prev => ({ ...prev, maps: [...prev.maps, newMap] }));
    setCurrentMapId(newId);
  };

  const generateBlocks = (rows: number, cols: number): FactionBlock[] => {
      const blocks: FactionBlock[] = [];
      for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
              blocks.push({
                  id: `blk_${generateId()}_${r}_${c}`,
                  rowIndex: r,
                  colIndex: c,
                  label: `${(r * cols) + c + 1}`,
                  score: 10,
                  color: '#fae6cd' // Default beige
              });
          }
      }
      return blocks;
  };

  const handleGridResize = (rows: number, cols: number) => {
      if (!currentMap) return;
      if (confirm("그리드 크기를 변경하면 현재 배치가 초기화됩니다. 계속하시겠습니까?")) {
          updateCurrentMap(m => ({
              ...m,
              rows,
              cols,
              blocks: generateBlocks(rows, cols)
          }));
          setSelectedBlockId(null);
      }
  };

  const updateBlock = (id: string, updates: Partial<FactionBlock>) => {
      updateCurrentMap(m => ({
          ...m,
          blocks: m.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
      }));
  };

  // -- Faction & Team Helpers --

  const handleAddFaction = () => {
    const newFaction: Faction = {
        id: `fac_${generateId()}`,
        name: `신규 진영 ${data.factions.length + 1}`,
        color: '#ffffff',
        teams: []
    };
    setData(prev => ({ ...prev, factions: [...prev.factions, newFaction] }));
  };

  const handleUpdateFaction = (id: string, updates: Partial<Faction>) => {
      setData(prev => ({
          ...prev,
          factions: prev.factions.map(f => f.id === id ? { ...f, ...updates } : f)
      }));
  };

  const handleDeleteFaction = (id: string) => {
      if (data.factions.length <= 2) {
          alert("진영전에는 최소 2개의 진영이 필요합니다.");
          return;
      }
      if (confirm("정말 이 진영을 삭제하시겠습니까? 소속된 팀도 모두 삭제됩니다.")) {
          setData(prev => ({
              ...prev,
              factions: prev.factions.filter(f => f.id !== id)
          }));
      }
  };

  const handleAddTeam = (factionId: string) => {
      const faction = data.factions.find(f => f.id === factionId);
      if(!faction) return;

      const newTeam: FactionTeam = {
          id: `team_${generateId()}`,
          name: `팀 ${faction.teams.length + 1}`
      };
      
      handleUpdateFaction(factionId, { teams: [...faction.teams, newTeam] });
  };

  const handleUpdateTeam = (factionId: string, teamId: string, name: string) => {
      const faction = data.factions.find(f => f.id === factionId);
      if(!faction) return;
      
      const updatedTeams = faction.teams.map(t => t.id === teamId ? { ...t, name } : t);
      handleUpdateFaction(factionId, { teams: updatedTeams });
  };

  const handleDeleteTeam = (factionId: string, teamId: string) => {
      const faction = data.factions.find(f => f.id === factionId);
      if(!faction) return;

      if(confirm("이 팀을 삭제하시겠습니까?")) {
          const updatedTeams = faction.teams.filter(t => t.id !== teamId);
          handleUpdateFaction(factionId, { teams: updatedTeams });
      }
  };

  // -- Global --

  const handleSave = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Faction_Data_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-[#2e2e2e] text-gray-100 overflow-hidden font-sans">
        
        {/* Left Sidebar */}
        <FactionEditorSidebar 
            data={data}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentMapId={currentMapId}
            setCurrentMapId={setCurrentMapId}
            onAddMap={handleAddMap}
            onAddFaction={handleAddFaction}
            onUpdateFaction={handleUpdateFaction}
            onDeleteFaction={handleDeleteFaction}
            onAddTeam={handleAddTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onUpdateAdminKey={(key) => setData(prev => ({ ...prev, adminKey: key }))}
            onBack={onBack}
        />

        {/* Center: Canvas (Visible only when map is selected) */}
        <FactionEditorCanvas 
            currentMap={currentMap}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
            onSave={handleSave}
        />

        {/* Right Sidebar: Properties */}
        <FactionEditorProperties 
            currentMap={currentMap}
            selectedBlock={selectedBlock}
            onUpdateMapName={(name) => updateCurrentMap(m => ({ ...m, name }))}
            onResizeGrid={handleGridResize}
            onUpdateBlock={updateBlock}
        />
    </div>
  );
};
