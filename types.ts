
export type ResultType = 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_FAILURE';

export type ObjectType = 'MAP_LINK' | 'OBJECT' | 'DECORATION' | 'SPAWN_POINT';

export type ShapeType = 'RECTANGLE' | 'ROUNDED' | 'CIRCLE' | 'TRIANGLE' | 'DIAMOND' | 'PENTAGON' | 'HEXAGON' | 'OCTAGON' | 'STAR' | 'CROSS' | 'MESSAGE' | 'ARROW';

export type StatMethod = 'SIMPLE' | 'ADDITIVE' | 'VARIABLE_DICE' | 'DIFFICULTY' | 'THRESHOLD';

export interface DiceRange {
  threshold: number; // Stat value up to this point
  dice: number;      // Dice sides (e.g. 6 for D6)
}

export interface OutcomeDef {
  text: string;
  hpChange: number;
  itemDrop?: string;
  targetMapId?: string;
  revealObjectId?: string; // ID of object to show
  hideObjectId?: string;   // ID of object to hide
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
  
  // Investigation Logic
  useProbability?: boolean;
  statMethod?: StatMethod;
  targetStatId?: string;
  difficultyValue?: number; // Used for DIFFICULTY method
  successTargetValue?: number; // Used for VARIABLE_DICE method
  
  targetMapId?: string;
  revealObjectId?: string; // For non-dice interaction
  hideObjectId?: string;   // For non-dice interaction
  data?: ProbabilityProfile;
  hidden?: boolean; // Visibility control
  isSolid?: boolean; // Physical collision blocking player movement
  zIndex?: number; // Layer order (higher = front)
}

export interface MapScene {
  id: string;
  name: string;
  description?: string; // Map Description (Narrative)
  width?: number;  // Custom Map Width
  height?: number; // Custom Map Height
  bgImage?: string;
  objects: MapObject[];
  bgm?: string;
}

export interface CustomStatDef {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  isHpBound?: boolean; // Whether this stat determines Max HP
  hpWeight?: number;   // How much HP per stat point
  
  // Method B settings
  diceRanges?: DiceRange[];
}

export interface GameData {
  title: string;
  maps: MapScene[];
  startMapId: string;
  adminKey?: string; 
  customStats?: CustomStatDef[]; // Definitions for custom character stats
  baseHp?: number; // Base HP for character creation logic
}

// ... Rest of Faction/Combat types remains same
export interface FactionTeam { id: string; name: string; factionId?: string; }
export interface Faction { id: string; name: string; color: string; teams: FactionTeam[]; }
export interface FactionBlock { id: string; rowIndex: number; colIndex: number; label: string; score: number; color: string; ownerId?: string; occupationProgress?: number; }
export interface FactionMap { id: string; name: string; rows: number; cols: number; blocks: FactionBlock[]; }
export interface FactionGameData { title: string; maps: FactionMap[]; factions: Faction[]; adminKey?: string; currentTurn?: number; }
export interface FactionStats { hp: number; attack: number; defense: number; agility: number; spirit: number; }
export interface FactionPlayerProfile { id: string; name: string; avatar?: string; factionId: string; teamId: string; stats: FactionStats; hp: number; maxHp: number; inventory: string[]; currentBlockId?: string; lastActionTurn?: number; }
export interface StatImpact { targetStatId: string; operation: 'SUBTRACT' | 'ADD'; }
export interface WeightedValue { value: number; weight: number; }
export interface CombatStatDef { 
  id: string; 
  label: string; 
  min: number; 
  max: number; 
  defaultValue: number; 
  isValueLookup?: boolean; // New: Toggles whether the value is resolved upon initialization
  valueMapping?: Record<number, WeightedValue[]>; 
  impacts?: StatImpact[]; 
}
export interface CombatRules { initiativeStatId: string; deathStatId?: string; turnOrder: 'INDIVIDUAL' | 'TEAM_SUM'; allowDodge: boolean; dodgeStatId?: string; allowDefend: boolean; defenseStatId?: string; allowCounter: boolean; counterStatId?: string; allowCover: boolean; coverStatId?: string; }
export interface CombatGameData { title: string; stats: CombatStatDef[]; rules?: CombatRules; }
export interface CombatEntity { id: string; name: string; team: 'A' | 'B'; stats: Record<string, number>; hp?: number; }
export interface CombatLogEntry { id: string; timestamp: number; text: string; type: 'ATTACK' | 'HEAL' | 'DEFEND' | 'SYSTEM' | 'FLEE'; }
export type CombatPhase = 'ACTION' | 'RESPONSE';
export interface PendingCombatAction { type: 'ATTACK'; sourceId: string; targetId: string; damageValue: number; maxDie: number; }
export interface CombatSession { isActive: boolean; currentTurnPlayerId: string | null; combatBlockId: string; turnCount: number; phase: CombatPhase; pendingAction: PendingCombatAction | null; logs: CombatLogEntry[]; factionDamage: Record<string, number>; fledPlayerIds: string[]; turnOrder: string[]; }
export type GlobalCombatState = Record<string, CombatSession>;
export interface Character { id: string; name: string; desc?: string; avatar?: string; hp: number; maxHp: number; inventory: string[]; mapId?: string; x: number; y: number; stats?: Record<string, number>; }
export interface LogEntry { id: string; timestamp: number; characterName: string; action: string; resultType: ResultType; systemText: string; userText: string; }
export interface ChatMessage { id: string; senderName: string; text: string; timestamp: number; isSystem?: boolean; }
export interface FactionChatMessage { id: string; senderName: string; senderId: string; senderFactionId: string; text: string; timestamp: number; channel: 'TEAM' | 'BLOCK'; targetId: string; }
export type NetworkMode = 'SOLO' | 'HOST' | 'CLIENT';
export interface SyncStatePayload { currentMapId: string; characters: Character[]; interactionResult: any | null; chatMessages: ChatMessage[]; }
export type NetworkAction = | { type: 'SYNC_STATE'; payload: SyncStatePayload } | { type: 'SYNC_GAMEDATA'; payload: GameData } | { type: 'SYNC_FACTION_GAMEDATA'; payload: FactionGameData } | { type: 'WELCOME'; msg: string } | { type: 'REQUEST_ACTION'; action: 'CLICK_OBJECT'; objectId: string } | { type: 'REQUEST_ACTION'; action: 'MOVE_MAP'; targetMapId: string } | { type: 'REQUEST_ACTION'; action: 'CLOSE_MODAL' } | { type: 'REQUEST_CHAR_UPDATE'; charId: string; updates: Partial<Character> } | { type: 'REQUEST_ADD_CHAR'; character: Character } | { type: 'REQUEST_CHAT'; text: string; senderName: string } | { type: 'REQUEST_MOVE_CHAR'; charId: string; x: number; y: number; mapId: string } | { type: 'ON_MOVE_CHAR'; charId: string; x: number; y: number; mapId: string } | { type: 'REQUEST_TOGGLE_OBJECT_VISIBILITY'; mapId: string; objectId: string; hidden: boolean } | { type: 'JOIN_FACTION_GAME'; profile: FactionPlayerProfile } | { type: 'SYNC_PLAYERS'; players: FactionPlayerProfile[] } | { type: 'UPDATE_PLAYER_PROFILE'; profile: FactionPlayerProfile } | { type: 'CHANGE_FACTION_MAP'; mapId: string } | { type: 'SYNC_COMBAT_STATE'; state: GlobalCombatState } | { type: 'SYNC_FACTION_MAP_DATA'; maps: FactionMap[] } | { type: 'REQUEST_FACTION_CHAT'; message: FactionChatMessage } | { type: 'SYNC_FACTION_CHAT'; messages: FactionChatMessage[] } | { type: 'ADMIN_ANNOUNCEMENT'; targetId: string | null; title: string; message: string };
