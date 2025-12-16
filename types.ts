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

export interface Token {
  id: number; // 0-3
  color: PlayerColor;
  state: TokenState;
  position: number; // 0-51 for main path, 52-57 for home stretch
  distanceTraveled: number; // To calculate home entry
}

export interface Player {
  id: string;
  name: string;
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
}

export interface WalletTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'GAME_FEE' | 'GAME_WIN';
  amount: number;
  date: string;
  status: 'COMPLETED' | 'PENDING';
}

export interface UserProfile {
  name: string;
  balance: number;
  transactions: WalletTransaction[];
}