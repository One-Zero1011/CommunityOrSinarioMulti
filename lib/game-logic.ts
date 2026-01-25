
import { ProbabilityProfile, ResultType, WeightedValue, MapObject, CustomStatDef, Character } from '../types';

export interface RollDetails {
    method: string;
    statLabel: string;
    statValue: number;
    diceType: string;
    rollResult: number;
    targetValue: number;
    isSuccess: boolean;
}

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

export const rollStatChallenge = (
    obj: MapObject, 
    char: Character, 
    statDefs: CustomStatDef[]
): { result: ResultType, details: RollDetails } => {
    const statId = obj.targetStatId || '';
    const statDef = statDefs.find(s => s.id === statId);
    const statValue = char.stats?.[statId] ?? (statDef?.defaultValue || 0);
    const method = obj.statMethod || 'SIMPLE';
    const profile = obj.data!;

    let isSuccess = false;
    let details: RollDetails = {
        method: method,
        statLabel: statDef?.label || 'Unknown',
        statValue: statValue,
        diceType: '1D100',
        rollResult: 0,
        targetValue: 0,
        isSuccess: false
    };

    switch (method) {
        case 'ADDITIVE': {
            // Success chance = Base profile success% + Stat
            const baseSuccessChance = profile.criticalSuccess + profile.success;
            const finalChance = Math.min(99, baseSuccessChance + statValue);
            const roll = Math.floor(Math.random() * 100) + 1;
            isSuccess = roll <= finalChance;
            details = { ...details, rollResult: roll, targetValue: finalChance };
            break;
        }
        case 'VARIABLE_DICE': {
            // Find dice by range
            const sortedRanges = [...(statDef?.diceRanges || [])].sort((a, b) => a.threshold - b.threshold);
            let diceSides = 100; // Fallback
            for (const range of sortedRanges) {
                if (statValue <= range.threshold) {
                    diceSides = range.dice;
                    break;
                }
            }
            if (sortedRanges.length > 0 && statValue > sortedRanges[sortedRanges.length - 1].threshold) {
                diceSides = sortedRanges[sortedRanges.length - 1].dice;
            }
            
            const target = obj.successTargetValue || 10;
            const roll = Math.floor(Math.random() * diceSides) + 1;
            isSuccess = roll >= target;
            details = { ...details, diceType: `1D${diceSides}`, rollResult: roll, targetValue: target };
            break;
        }
        case 'DIFFICULTY': {
            // Success if 1D100 <= (Difficulty - Stat)
            const difficulty = obj.difficultyValue || 100;
            const target = Math.max(1, difficulty - statValue);
            const roll = Math.floor(Math.random() * 100) + 1;
            isSuccess = roll <= target;
            details = { ...details, rollResult: roll, targetValue: target };
            break;
        }
        case 'THRESHOLD': {
            // Traditional TRPG: 1D100 <= Stat
            const target = statValue;
            const roll = Math.floor(Math.random() * 100) + 1;
            isSuccess = roll <= target;
            details = { ...details, rollResult: roll, targetValue: target };
            break;
        }
        case 'SIMPLE':
        default: {
            const roll = Math.random() * 100;
            const successThreshold = profile.criticalSuccess + profile.success;
            isSuccess = roll <= successThreshold;
            details = { ...details, rollResult: Math.floor(roll), targetValue: successThreshold };
            break;
        }
    }

    details.isSuccess = isSuccess;
    
    // Convert boolean success to ResultType based on profile weights
    // (Critical calculation simplified: top/bottom 5% of the success/failure range)
    let finalResult: ResultType = isSuccess ? 'SUCCESS' : 'FAILURE';
    
    // Rough critical logic for stat rolls
    if (isSuccess && details.rollResult <= Math.max(1, details.targetValue * 0.1)) finalResult = 'CRITICAL_SUCCESS';
    if (!isSuccess && details.rollResult >= 95) finalResult = 'CRITICAL_FAILURE';

    return { result: finalResult, details };
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

export const resolveWeightedStatValue = (statValue: number, mapping?: Record<number, WeightedValue[]>): number => {
    if (!mapping) return statValue;
    let entries = mapping[statValue];
    if (!entries) {
        // @ts-ignore
        entries = mapping[String(statValue)];
    }
    if (!entries || entries.length === 0) return statValue;
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return entries[0].value;
    let random = Math.random() * totalWeight;
    for (const entry of entries) {
        if (random < entry.weight) return entry.value;
        random -= entry.weight;
    }
    return entries[entries.length - 1].value;
};

export const rollFactionAttack = (atkStat: number): { roll: number, maxDie: number } => {
    const safeStat = Math.max(1, Math.min(5, atkStat));
    const maxDie = 15 + (safeStat * 5);
    const roll = Math.floor(Math.random() * maxDie) + 1;
    return { roll, maxDie };
};

export const rollFactionDefend = (defStat: number): { roll: number, maxDie: number } => {
    const safeStat = Math.max(1, Math.min(5, defStat));
    const maxDie = 15 + (safeStat * 5);
    const roll = Math.floor(Math.random() * maxDie) + 1;
    return { roll, maxDie };
};

export const rollFactionHeal = (spiStat: number): { success: boolean, checkRoll: number, checkThreshold: number, healAmount: number, healDie: number } => {
    const safeStat = Math.max(1, Math.min(5, spiStat));
    const checkThreshold = 20 - (safeStat * 2);
    const checkRoll = Math.floor(Math.random() * 20) + 1;
    const success = checkRoll > checkThreshold;
    let healAmount = 0;
    const healDies = [5, 8, 10, 13, 15];
    const healDie = healDies[safeStat - 1];
    if (success) healAmount = Math.floor(Math.random() * healDie) + 1;
    return { success, checkRoll, checkThreshold, healAmount, healDie };
};

export const rollFactionFlee = (turnCount: number): { success: boolean, roll: number, threshold: number } => {
    const effectiveTurn = Math.min(5, Math.max(1, turnCount));
    const threshold = 20 - (effectiveTurn * 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return { success: roll > threshold, roll, threshold };
};
