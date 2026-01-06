

export type ResultType = 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_FAILURE';

export type ObjectType = 'MAP_LINK' | 'OBJECT' | 'DECORATION';

export type ShapeType = 'RECTANGLE' | 'ROUNDED' | 'CIRCLE' | 'TRIANGLE' | 'DIAMOND' | 'PENTAGON' | 'HEXAGON' | 'OCTAGON' | 'STAR' | 'CROSS' | 'MESSAGE' | 'ARROW';

export interface OutcomeDef {
  text: string;
  hpChange: number;
  itemDrop?: string;
  targetMapId?: string;
}

export interface ProbabilityProfile {
  criticalSuccess: number;
  success: number;
  failure: number;
  criticalFailure: number;
  outcomes: {
    CRITICAL_SUCCESS: OutcomeDef;
    SUCCESS: OutcomeDef;
    FAILURE: OutcomeDef;
    CRITICAL_FAILURE: OutcomeDef;
  };
}

export interface MapObject {
  id: string;
  type: ObjectType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  image?: string; // Added image property
  shape?: ShapeType;
  description?: string;
  useProbability?: boolean;
  targetMapId?: string;
  data?: ProbabilityProfile;
}

export interface MapScene {
  id: string;
  name: string;
  bgImage?: string;
  objects: MapObject[];
  bgm?: string;
}

export interface GameData {
  title: string;
  maps: MapScene[];
  startMapId: string;
}

export interface Character {
  id: string;
  name: string;
  desc?: string;
  avatar?: string;
  hp: number;
  maxHp: number;
  inventory: string[];
  mapId?: string;
  x: number;
  y: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  characterName: string;
  action: string;
  resultType: ResultType;
  systemText: string;
  userText: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

// Network Types
export type NetworkMode = 'SOLO' | 'HOST' | 'CLIENT';

export interface SyncStatePayload {
  currentMapId: string;
  characters: Character[];
  interactionResult: any | null;
  chatMessages: ChatMessage[];
}

export type NetworkAction = 
  | { type: 'SYNC_STATE'; payload: SyncStatePayload }
  | { type: 'SYNC_GAMEDATA'; payload: GameData }
  | { type: 'WELCOME'; msg: string }
  | { type: 'REQUEST_ACTION'; action: 'CLICK_OBJECT'; objectId: string }
  | { type: 'REQUEST_ACTION'; action: 'MOVE_MAP'; targetMapId: string }
  | { type: 'REQUEST_ACTION'; action: 'CLOSE_MODAL' }
  | { type: 'REQUEST_CHAR_UPDATE'; charId: string; updates: Partial<Character> }
  | { type: 'REQUEST_ADD_CHAR' }
  | { type: 'REQUEST_CHAT'; text: string; senderName: string }
  | { type: 'REQUEST_MOVE_CHAR'; charId: string; x: number; y: number; mapId: string };
