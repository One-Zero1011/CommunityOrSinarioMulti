import { GameData, ProbabilityProfile, MapScene } from '../types';

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