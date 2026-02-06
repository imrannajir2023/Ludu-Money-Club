
export enum PlayerColor {
  RED = 'RED',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  BLUE = 'BLUE'
}

export enum TokenState {
  HOME = 'HOME',
  PATH = 'PATH',
  WIN = 'WIN'
}

export type CurrencyCode = 'BDT' | 'USD' | 'INR';

export interface Token {
  id: number;
  color: PlayerColor;
  state: TokenState;
  position: number;
  distanceTraveled: number;
}

export interface Player {
  id: string;
  name: string;
  country: string;
  flag: string;
  color: PlayerColor;
  tokens: Token[];
  isBot: boolean;
  avatarUrl: string;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  isDiceRolled: boolean;
  winner: PlayerColor | null;
  log: string[];
  lastAction: string;
  consecutiveSixes: number;
}

export interface PendingTransaction {
  id: string;
  userName: string;
  userPhone: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  method: string;
  amount: number;
  currency: CurrencyCode;
  phone: string;
  trxId?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface UserProfile {
  name: string;
  phone: string;
  password?: string;
  balance: number; // Stored in base currency (BDT)
  preferredCurrency?: CurrencyCode;
  avatar: string;
  country?: string;
  address?: string;
  flag?: string;
  isBlocked?: boolean;
  createdAt?: string;
  lastLogin?: string;
  stats: {
    totalGames: number;
    wins: number;
    totalWinnings: number;
  };
  history: PendingTransaction[];
}

export interface LiveMatch {
  matchId: string;
  inviteCode?: string; 
  isPrivate?: boolean;
  players: { name: string, color: PlayerColor, score: number, avatar: string, isBot: boolean, flag: string }[];
  currentPlayer: string;
  stake: number;
  startTime: string;
  nextRollOverride?: number | null;
  status: 'WAITING' | 'ACTIVE' | 'TERMINATED';
}
