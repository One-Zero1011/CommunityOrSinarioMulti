
import { GameData, ProbabilityProfile, MapScene, FactionGameData, FactionMap } from '../types';

export const DEFAULT_PROBABILITY: ProbabilityProfile = {
  criticalSuccess: 10,
  success: 40,
  failure: 40,
  criticalFailure: 10,
  outcomes: {
    CRITICAL_SUCCESS: { text: "중요한 단서를 발견하고 체력을 회복했습니다.", hpChange: 10, itemDrop: "중요 단서" },
    SUCCESS: { text: "유용한 무언가를 발견했습니다.", hpChange: 0 },
    FAILURE: { text: "아무것도 발견하지 못했습니다.", hpChange: 0 },
    CRITICAL_FAILURE: { text: "조사 도중 부상을 입었습니다.", hpChange: -10, itemDrop: "가벼운 부상" },
  }
};

export const DEFAULT_MAP: MapScene = {
  id: 'map_001',
  name: '입구',
  objects: [],
};

export const INITIAL_GAME_DATA: GameData = {
  title: "새로운 조사",
  maps: [DEFAULT_MAP],
  startMapId: 'map_001'
};

// -- Faction Data --

const DEFAULT_FACTION_MAP: FactionMap = {
    id: 'fmap_001',
    name: '점령전 맵 1',
    rows: 3,
    cols: 3,
    blocks: Array.from({ length: 9 }).map((_, i) => ({
        id: `blk_${i}`,
        rowIndex: Math.floor(i / 3),
        colIndex: i % 3,
        label: `${i + 1}`,
        score: (i === 4) ? 70 : (i % 2 === 0 ? 30 : 50), // Center 70, Corners 30, others 50
        color: (i === 4) ? '#f6ad55' : (i % 2 === 0 ? '#fae6cd' : '#fbd38d') // Simple pattern
    }))
};

export const INITIAL_FACTION_DATA: FactionGameData = {
    title: "나만의 진영전",
    maps: [DEFAULT_FACTION_MAP],
    factions: [
        { id: 'faction_1', name: '레드 진영', color: '#f87171', teams: [] },
        { id: 'faction_2', name: '블루 진영', color: '#60a5fa', teams: [] }
    ]
};
