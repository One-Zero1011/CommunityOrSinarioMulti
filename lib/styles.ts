import React from 'react';
import { ShapeType } from '../types';

export const getShapeStyle = (shape: ShapeType | undefined): React.CSSProperties => {
  switch (shape) {
    case 'ROUNDED': return { borderRadius: '1rem' };
    case 'CIRCLE': return { borderRadius: '50%' };
    case 'TRIANGLE': return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' };
    case 'DIAMOND': return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
    case 'PENTAGON': return { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' };
    case 'HEXAGON': return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' };
    case 'OCTAGON': return { clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' };
    case 'STAR': return { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' };
    case 'CROSS': return { clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)' };
    case 'MESSAGE': return { clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)' };
    case 'ARROW': return { clipPath: 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' };
    case 'RECTANGLE':
    default: return { borderRadius: '0' };
  }
};