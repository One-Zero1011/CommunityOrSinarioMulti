









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
  image?: string; 
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

// --- Faction Mode Types ---

export interface FactionTeam {
  id: string;
  name: string;
  factionId?: string; // Optional back-reference if needed
}

export interface Faction {
  id: string;
  name: string;
  color: string;
  teams: FactionTeam[];
}

export interface FactionBlock {
  id: string;
  rowIndex: number;
  colIndex: number;
  label: string;
  score: number;
  color: string;
  ownerId?: string; // Faction ID owning this block
  occupationProgress?: number; // 0 to 3 for peaceful occupation
}

export interface FactionMap {
  id: string;
  name: string;
  rows: number;
  cols: number;
  blocks: FactionBlock[];
}

export interface FactionGameData {
  title: string;
  maps: FactionMap[];
  factions: Faction[];
  adminKey?: string;
  currentTurn?: number;
}

export interface FactionStats {
  hp: number;      // 1-5 (Affects MaxHP: 160, 170, 180, 190, 200)
  attack: number;  // 1-5
  defense: number; // 1-5
  agility: number; // 1-5
  spirit: number;  // 1-5
}

export interface FactionPlayerProfile {
  id: string;
  name: string;
  avatar?: string;
  factionId: string;
  teamId: string;
  stats: FactionStats;
  hp: number;      // Current HP
  maxHp: number;   // Calculated Max HP
  inventory: string[];
  currentBlockId?: string; // Current location on the FactionMap
  lastActionTurn?: number; // The turn number when the last move occurred
}

// Combat Types
export interface CombatLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'ATTACK' | 'HEAL' | 'DEFEND' | 'SYSTEM' | 'FLEE';
}

export type CombatPhase = 'ACTION' | 'RESPONSE';

export interface PendingCombatAction {
  type: 'ATTACK';
  sourceId: string;
  targetId: string;
  damageValue: number;
  maxDie: number;
}

export interface CombatState {
  isActive: boolean;
  currentTurnPlayerId: string | null;
  combatBlockId?: string; // Add Block ID to anchor combat to a location
  turnCount: number; // Track turns for Flee mechanics
  phase: CombatPhase;
  pendingAction: PendingCombatAction | null;
  logs: CombatLogEntry[];
  factionDamage: Record<string, number>; // factionId -> total damage taken
  fledPlayerIds: string[]; // List of players who fled
  turnOrder: string[]; // Strict turn order based on Initiative
}

// --------------------------

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

export interface FactionChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  senderFactionId: string;
  text: string;
  timestamp: number;
  channel: 'TEAM' | 'BLOCK';
  targetId: string; // factionId for TEAM, blockId for BLOCK
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
  | { type: 'SYNC_FACTION_GAMEDATA'; payload: FactionGameData }
  | { type: 'WELCOME'; msg: string }
  | { type: 'REQUEST_ACTION'; action: 'CLICK_OBJECT'; objectId: string }
  | { type: 'REQUEST_ACTION'; action: 'MOVE_MAP'; targetMapId: string }
  | { type: 'REQUEST_ACTION'; action: 'CLOSE_MODAL' }
  | { type: 'REQUEST_CHAR_UPDATE'; charId: string; updates: Partial<Character> }
  | { type: 'REQUEST_ADD_CHAR' }
  | { type: 'REQUEST_CHAT'; text: string; senderName: string }
  | { type: 'REQUEST_MOVE_CHAR'; charId: string; x: number; y: number; mapId: string }
  | { type: 'ON_MOVE_CHAR'; charId: string; x: number; y: number; mapId: string }
  // Faction Mode Actions
  | { type: 'JOIN_FACTION_GAME'; profile: FactionPlayerProfile }
  | { type: 'SYNC_PLAYERS'; players: FactionPlayerProfile[] }
  | { type: 'UPDATE_PLAYER_PROFILE'; profile: FactionPlayerProfile }
  | { type: 'CHANGE_FACTION_MAP'; mapId: string }
  | { type: 'SYNC_COMBAT_STATE'; combats: Record<string, CombatState> }
  | { type: 'SYNC_FACTION_MAP_DATA'; maps: FactionMap[] }
  | { type: 'REQUEST_FACTION_CHAT'; message: FactionChatMessage }
  | { type: 'SYNC_FACTION_CHAT'; messages: FactionChatMessage[] }
  | { type: 'ADMIN_ANNOUNCEMENT'; targetId: string | null; title: string; message: string };