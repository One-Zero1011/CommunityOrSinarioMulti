import { ProbabilityProfile, ResultType } from '../types';

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