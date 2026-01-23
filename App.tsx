
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity } from './services/botService';
import { generateGameCommentary } from './services/geminiService';
import { SAFE_SPOTS, START_POSITIONS } from './constants';

const Dice3D: React.FC<{ value: number | null, isRolling: boolean }> = ({ value, isRolling }) => {
  return (
    <div className={`dice-scene ${isRolling ? 'dice-jump' : ''}`}>
      <div className={`cube ${isRolling ? 'rolling' : `show-${value || 1}`}`}>
        <div className="cube-face face-1"><div className="dot row-start-2 col-start-2"></div></div>
        <div className="cube-face face-2"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        <div className="cube-face face-3"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-2 col-start-2"></div><div className="dot row-start-3 col-start-3"></div></div>
        <div className="cube-face face-4"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        <div className="cube-face face-5"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-2 col-start-2"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        <div className="cube-face face-6"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-2 col-start-1"></div><div className="dot row-start-2 col-start-3"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
      </div>
    </div>
  );
};

const PlayerProfileOverlay: React.FC<{ player: Player, isActive: boolean, position: 'TL' | 'TR' | 'BL' | 'BR' }> = ({ player, isActive, position }) => {
  const posClasses = {
    TL: 'top-[-85px] left-0',
    TR: 'top-[-85px] right-0',
    BL: 'bottom-[-85px] left-0',
    BR: 'bottom-[-85px] right-0'
  };

  const borderColors = {
    [PlayerColor.RED]: 'border-red-500',
    [PlayerColor.GREEN]: 'border-green-500',
    [PlayerColor.YELLOW]: 'border-yellow-400',
    [PlayerColor.BLUE]: 'border-blue-500'
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-60 scale-90'}`}>
       <div className={`relative p-1 rounded-2xl border-4 ${isActive ? 'border-yellow-500 shadow-[0_0_25px_#fbbf24]' : borderColors[player.color]}`}>
          <img src={player.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`} className="w-16 h-16 rounded-xl object-cover bg-slate-800 shadow-lg" />
          {isActive && <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full border-2 border-[#0f172a] animate-bounce"></div>}
       </div>
       <div className="mt-1 flex flex-col items-center bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
          <span className="text-[10px] font-black uppercase tracking-tighter italic text-white leading-none whitespace-nowrap">{player?.name || 'Player'}</span>
          <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">{player?.flag || '🚩'} {player?.country || 'Global'}</span>
       </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'ADMIN_AUTH' | 'LOBBY' | 'FINDING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [commentary, setCommentary] = useState<string>('Welcome to Ludo Money Arena!');

  const botActionTimeout = useRef<any>(null);
  const autoForwardTimeout = useRef<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const users = await databaseService.getUsers();
        setAllUsers(users);
        const saved = localStorage.getItem('LUDO_SESSION');
        if (saved) {
          const parsed = JSON.parse(saved);
          const fresh = users.find(u => u.phone === parsed.phone);
          setUser(fresh || parsed);
        }
      } catch(e) { console.error(e); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(p => {
          if (p >= 100) { clearInterval(interval); return 100; }
          return p + 5;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'SPLASH' && loadingProgress >= 100) {
      setTimeout(() => setView(user ? 'LOBBY' : 'LOGIN'), 500);
    }
  }, [loadingProgress, view, user]);

  const handleAuth = async () => {
    setAuthError('');
    if (!phone || !password) return setAuthError('Please fill all fields');
    if (isSignUp && !name) return setAuthError('Please enter name');

    if (isSignUp) {
      const exists = allUsers.find(u => u.phone === phone);
      if (exists) return setAuthError('User already exists');
      const newUser: UserProfile = {
        name, phone, password, balance: 50,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name + Math.random()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
        history: []
      };
      await databaseService.updateUser(newUser);
      setUser(newUser);
      localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
      setView('LOBBY');
    } else {
      const found = allUsers.find(u => u.phone === phone && u.password === password);
      if (found) {
        setUser(found);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(found));
        setView('LOBBY');
      } else {
        setAuthError('Invalid credentials');
      }
    }
  };

  const handleAdminAuth = () => {
    setAuthError('');
    if (adminId === 'admin' && adminPass === 'admin123') {
      setView('ADMIN');
      setAdminId('');
      setAdminPass('');
    } else {
      setAuthError('Invalid Admin Credentials');
    }
  };

  const startFinding = async (count: 2 | 4) => {
    if (!user) return;
    if (user.balance < selectedStake) return alert("Insufficient Balance!");
    
    const updatedUser = { ...user, balance: user.balance - selectedStake };
    setUser(updatedUser);
    await databaseService.updateUser(updatedUser);

    setPlayerCount(count);
    setView('FINDING');
    setFoundPlayers([]);
    soundManager.play('click');

    const playersToFind = count - 1;
    let found = 0;
    const colors = [PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    const bots: Player[] = [];
    const searchInterval = setInterval(() => {
      if (found < playersToFind) {
        const botIden = getRandomBotIdentity();
        const newBot: Player = {
          id: `bot-${found}`,
          name: botIden.name,
          country: botIden.country,
          flag: botIden.flag,
          color: colors[found],
          isBot: true,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botIden.name + Math.random()}`,
          tokens: []
        };
        bots.push(newBot);
        setFoundPlayers([...bots]);
        found++;
        soundManager.play('click');
      } else {
        clearInterval(searchInterval);
        setTimeout(() => initGame(count, bots), 1000);
      }
    }, 1200 + Math.random() * 1500);
  };

  const initGame = (count: number, bots: Player[]) => {
    if (!user) return;
    const colors = count === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    const players: Player[] = colors.map((color, i) => {
      const isUser = i === 0;
      const botIdentity = isUser ? null : bots[i-1];
      return {
        id: isUser ? 'user' : `bot-${i}`,
        name: isUser ? user.name : (botIdentity?.name || 'Bot Player'),
        country: isUser ? 'Bangladesh' : (botIdentity?.country || 'Global'),
        flag: isUser ? '🇧🇩' : (botIdentity?.flag || '🚩'),
        color, isBot: !isUser,
        avatarUrl: isUser ? user.avatar : (botIdentity?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=Bot${i}`),
        tokens: Array(4).fill(null).map((_, ti) => ({
          id: (i * 10) + ti, color, state: TokenState.HOME, position: 0, distanceTraveled: 0
        }))
      };
    });

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false,
      winner: null, log: ['Game Started'], lastAction: 'Roll Dice', consecutiveSixes: 0
    });
    setView('GAME');
    soundManager.play('six');
    setCommentary('Good luck everyone! Let the battle begin.');
  };

  const nextTurn = useCallback(() => {
    if (autoForwardTimeout.current) {
        clearTimeout(autoForwardTimeout.current);
        autoForwardTimeout.current = null;
    }
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      return { 
        ...prev, 
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, 
        diceValue: null, 
        isDiceRolled: false,
        consecutiveSixes: 0 
      };
    });
  }, []);

  const rollDice = async () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    
    setIsRolling(true);
    soundManager.play('dice');
    
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');

      setGameState(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          diceValue: val, 
          isDiceRolled: true, 
          consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 
        };
      });
    }, 800);
  };

  const moveToken = async (tokenData: Token) => {
    if (autoForwardTimeout.current) {
        clearTimeout(autoForwardTimeout.current);
        autoForwardTimeout.current = null;
    }
    if (!gameState || !gameState.isDiceRolled || isRolling || gameState.winner) return;
    
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    if (!player) return;

    const tokenIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    if (tokenIdx === -1) return;

    const token = { ...player.tokens[tokenIdx] };
    const val = gameState.diceValue!;

    if (token.state === TokenState.WIN) return;
    if (token.state === TokenState.HOME && val !== 6) return;
    if (token.state === TokenState.PATH && token.distanceTraveled + val > 56) return;

    let capturedToken = false;

    if (token.state === TokenState.HOME && val === 6) {
      token.state = TokenState.PATH;
      token.distanceTraveled = 0;
    } else if (token.state === TokenState.PATH) {
      token.distanceTraveled += val;
      if (token.distanceTraveled === 56) {
        token.state = TokenState.WIN;
        soundManager.play('win');
      } else {
        const startPos = START_POSITIONS[token.color];
        const absolutePos = (token.distanceTraveled + startPos) % 52;
        const isSafe = SAFE_SPOTS.includes(absolutePos);

        if (!isSafe) {
          players.forEach((otherPlayer, pIdx) => {
            if (pIdx !== gameState.currentPlayerIndex) {
              otherPlayer.tokens.forEach((otherToken) => {
                if (otherToken.state === TokenState.PATH) {
                  const otherStart = START_POSITIONS[otherToken.color];
                  const otherAbsolute = (otherToken.distanceTraveled + otherStart) % 52;
                  if (otherAbsolute === absolutePos) {
                    otherToken.state = TokenState.HOME;
                    otherToken.distanceTraveled = 0;
                    capturedToken = true;
                  }
                }
              });
            }
          });
        }
      }
    }
    
    player.tokens[tokenIdx] = token;
    soundManager.play('move');

    if (capturedToken) {
      soundManager.play('kill');
      const comment = await generateGameCommentary("just executed a brilliant capture!", player.name);
      setCommentary(comment);
    }

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(prev => prev ? { ...prev, players, winner: player.color } : null);
      if (player.id === 'user' && user) {
        const prize = Math.floor(selectedStake * 1.8);
        const updatedUser = { ...user, balance: user.balance + prize };
        setUser(updatedUser);
        await databaseService.updateUser(updatedUser);
      }
      return;
    }

    const continueTurn = val === 6 || capturedToken;
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        players,
        isDiceRolled: false,
        diceValue: null,
        currentPlayerIndex: continueTurn ? prev.currentPlayerIndex : (prev.currentPlayerIndex + 1) % prev.players.length
      };
    });
  };

  useEffect(() => {
    if (!gameState || gameState.winner || isRolling) return;
    
    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    if (!activePlayer) return;

    if (activePlayer.isBot) {
        if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
        
        botActionTimeout.current = setTimeout(() => {
            if (!gameState.isDiceRolled) {
                rollDice();
            } else {
                const val = gameState.diceValue!;
                const valid = activePlayer.tokens.filter(t => {
                    if (t.state === TokenState.WIN) return false;
                    if (t.state === TokenState.HOME) return val === 6;
                    return t.distanceTraveled + val <= 56;
                });

                if (valid.length > 0) {
                    let bestToken = valid[0];
                    const captureToken = valid.find(t => {
                        const start = START_POSITIONS[t.color];
                        const dist = t.state === TokenState.HOME ? 0 : t.distanceTraveled + val;
                        const abs = (dist + start) % 52;
                        if (SAFE_SPOTS.includes(abs)) return false;
                        return gameState.players.some((other, pIdx) => {
                            if (pIdx === gameState.currentPlayerIndex) return false;
                            return other.tokens.some(ot => ot.state === TokenState.PATH && (ot.distanceTraveled + START_POSITIONS[ot.color]) % 52 === abs);
                        });
                    });

                    if (captureToken) bestToken = captureToken;
                    else {
                        const nearingWin = valid.find(t => t.distanceTraveled > 40);
                        const outFromHome = valid.find(t => t.state === TokenState.HOME);
                        if (nearingWin) bestToken = nearingWin;
                        else if (outFromHome) bestToken = outFromHome;
                    }
                    moveToken(bestToken);
                } else {
                    nextTurn();
                }
            }
        }, 1500 + Math.random() * 1000);
    } else {
        if (gameState.isDiceRolled && !autoForwardTimeout.current) {
            const val = gameState.diceValue!;
            const hasValidMove = activePlayer.tokens.some(t => {
                if (t.state === TokenState.WIN) return false;
                if (t.state === TokenState.HOME) return val === 6;
                return t.distanceTraveled + val <= 56;
            });

            if (!hasValidMove) {
                setCommentary("No valid moves! Skipping in 2s...");
                autoForwardTimeout.current = setTimeout(() => {
                    autoForwardTimeout.current = null;
                    nextTurn();
                }, 2000);
            } else {
                if (val === 6) setCommentary("You got a SIX! Roll again after move.");
                else setCommentary(`You rolled a ${val}. Please select a token.`);
            }
        }
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled, isRolling]);

  return (
    <div className="h-screen w-full bg-[#050a18] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-7xl mb-12">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.5)] rounded-full transition-all duration-300" style={{width: `${loadingProgress}%`}}></div>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.5em] text-white/20">Loading Arena</p>
        </div>
      )}

      {(view === 'LOGIN' || view === 'ADMIN_AUTH') && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
           <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-600/10 to-transparent"></div>
           <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 py-12 rounded-[50px] w-full max-w-[420px] border border-white/10 flex flex-col items-center shadow-[0_30px_60px_rgba(0,0,0,0.5)] animate-in zoom-in-95 z-10">
              <h2 className="ludo-money-logo text-6xl mb-12 uppercase font-black italic tracking-tight scale-110">
                {view === 'ADMIN_AUTH' ? 'ADMIN' : (isSignUp ? 'SIGNUP' : 'LOGIN')}
              </h2>
              {authError && <div className="text-red-500 mb-6 text-[11px] font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">{authError}</div>}
              
              <div className="w-full space-y-5 mb-10">
                 {view === 'LOGIN' && isSignUp && (
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-white/20 ml-5 tracking-widest">Display