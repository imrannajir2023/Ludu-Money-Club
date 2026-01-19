
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
  id: number;
  color: PlayerColor;
  state: TokenState;
  position: number;
  distanceTraveled: number;
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
  consecutiveSixes: number;
}

export interface PendingTransaction {
  id: string;
  userName: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  method: string;
  amount: number;
  phone: string;
  trxId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface UserProfile {
  name: string;
  phone?: string;
  password?: string;
  balance: number;
  avatar: string;
  stats: {
    totalGames: number;
    wins: number;
    totalWinnings: number;
  };
  history: PendingTransaction[];
}

export interface LiveMatch {
  matchId: string;
  players: { name: string, color: PlayerColor, score: number }[];
  currentPlayer: string;
  stake: number;
  startTime: string;
  nextRollOverride?: number | null;
  status: 'ACTIVE' | 'TERMINATED';
}
