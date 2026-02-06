
import { PlayerColor, CurrencyCode } from './types';

export const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

export const START_POSITIONS: Record<PlayerColor, number> = {
  [PlayerColor.RED]: 0,
  [PlayerColor.GREEN]: 13,
  [PlayerColor.YELLOW]: 26,
  [PlayerColor.BLUE]: 39
};

export const HOME_ENTRANCE: Record<PlayerColor, number> = {
  [PlayerColor.RED]: 50,
  [PlayerColor.GREEN]: 11,
  [PlayerColor.YELLOW]: 24,
  [PlayerColor.BLUE]: 37
};

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string, rate: number, label: string }> = {
  BDT: { symbol: '৳', rate: 1, label: 'Bangladeshi Taka' },
  USD: { symbol: '$', rate: 120, label: 'US Dollar (USDT)' },
  INR: { symbol: '₹', rate: 1.4, label: 'Indian Rupee' }
};

export const COLORS = {
  RED: {
    base: 'bg-red-500',
    dark: 'bg-red-700',
    border: 'border-red-600',
    text: 'text-red-500',
    bgLight: 'bg-red-100'
  },
  GREEN: {
    base: 'bg-green-500',
    dark: 'bg-green-700',
    border: 'border-green-600',
    text: 'text-green-500',
    bgLight: 'bg-green-100'
  },
  YELLOW: {
    base: 'bg-yellow-400',
    dark: 'bg-yellow-600',
    border: 'border-yellow-500',
    text: 'text-yellow-500',
    bgLight: 'bg-yellow-100'
  },
  BLUE: {
    base: 'bg-blue-500',
    dark: 'bg-blue-700',
    border: 'border-blue-600',
    text: 'text-blue-500',
    bgLight: 'bg-blue-100'
  }
};
