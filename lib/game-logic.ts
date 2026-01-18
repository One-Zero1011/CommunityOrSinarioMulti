
import { ProbabilityProfile, ResultType, WeightedValue } from '../types';

export const rollDice = (profile: ProbabilityProfile): ResultType => {
  const roll = Math.random() * 100;
  
  let threshold = profile.criticalSuccess;
  if (roll < threshold) return 'CRITICAL_SUCCESS';
  
  threshold += profile.success;
  if (roll < threshold) return 'SUCCESS';
  
  threshold += profile.failure;
  if (roll < threshold) return 'FAILURE';
  
  return 'CRITICAL_FAILURE';
};

export const getResultColor = (type: ResultType): string => {
  switch (type) {
    case 'CRITICAL_SUCCESS': return 'text-yellow-400';
    case 'SUCCESS': return 'text-green-400';
    case 'FAILURE': return 'text-gray-400';
    case 'CRITICAL_FAILURE': return 'text-red-500';
    default: return 'text-white';
  }
};

export const getResultLabel = (type: ResultType): string => {
   switch (type) {
    case 'CRITICAL_SUCCESS': return '대성공';
    case 'SUCCESS': return '성공';
    case 'FAILURE': return '실패';
    case 'CRITICAL_FAILURE': return '대실패';
    default: return '';
  }
};

// --- Combat Logic Helper ---

export const resolveWeightedStatValue = (statValue: number, mapping?: Record<number, WeightedValue[]>): number => {
    // 1. If no mapping exists for this value, return the stat value itself (Default behavior)
    if (!mapping) return statValue;

    // 2. Check if specific mapping exists for this stat level
    // Handle both number and string keys robustly
    let entries = mapping[statValue];
    if (!entries) {
        // @ts-ignore
        entries = mapping[String(statValue)];
    }

    if (!entries || entries.length === 0) return statValue; // Fallback if mapping exists but empty for this level

    // 3. Weighted Random Selection
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return entries[0].value; // Safety fallback

    let random = Math.random() * totalWeight;
    for (const entry of entries) {
        if (random < entry.weight) {
            return entry.value;
        }
        random -= entry.weight;
    }

    return entries[entries.length - 1].value;
};

// --- Faction Combat Logic ---

// Attack: 1->1D20, 2->1D25, 3->1D30, 4->1D35, 5->1D40
export const rollFactionAttack = (atkStat: number): { roll: number, maxDie: number } => {
    const safeStat = Math.max(1, Math.min(5, atkStat));
    const maxDie = 15 + (safeStat * 5); // 20, 25, 30, 35, 40
    const roll = Math.floor(Math.random() * maxDie) + 1;
    return { roll, maxDie };
};

// Defense: 1->1D20, 2->1D25, 3->1D30, 4->1D35, 5->1D40
export const rollFactionDefend = (defStat: number): { roll: number, maxDie: number } => {
    const safeStat = Math.max(1, Math.min(5, defStat));
    const maxDie = 15 + (safeStat * 5); // 20, 25, 30, 35, 40
    const roll = Math.floor(Math.random() * maxDie) + 1;
    return { roll, maxDie };
};

// Heal Check:
// 1: >18 (1D5)
// 2: >16 (1D8)
// 3: >14 (1D10)
// 4: >12 (1D13)
// 5: >10 (1D15)
export const rollFactionHeal = (spiStat: number): { success: boolean, checkRoll: number, checkThreshold: number, healAmount: number, healDie: number } => {
    const safeStat = Math.max(1, Math.min(5, spiStat));
    
    // Threshold Calculation: 20 - (stat * 2) => 18, 16, 14, 12, 10
    const checkThreshold = 20 - (safeStat * 2);
    const checkRoll = Math.floor(Math.random() * 20) + 1; // 1D20
    const success = checkRoll > checkThreshold;

    let healAmount = 0;
    
    // Heal Die Mapping: 5, 8, 10, 13, 15
    const healDies = [5, 8, 10, 13, 15];
    const healDie = healDies[safeStat - 1];

    if (success) {
        healAmount = Math.floor(Math.random() * healDie) + 1;
    }

    return { success, checkRoll, checkThreshold, healAmount, healDie };
};

// Flee Check:
// Turn 1: >18
// Turn 2: >16
// Turn 3: >14
// Turn 4: >12
// Turn 5+: >10
export const rollFactionFlee = (turnCount: number): { success: boolean, roll: number, threshold: number } => {
    const effectiveTurn = Math.min(5, Math.max(1, turnCount));
    const threshold = 20 - (effectiveTurn * 2); // 18, 16, 14, 12, 10
    const roll = Math.floor(Math.random() * 20) + 1;
    return { success: roll > threshold, roll, threshold };
};
