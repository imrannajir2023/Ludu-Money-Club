
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
  // Adjusted offsets to sit closer to the board bases as seen in high-end ludo games
  const posClasses = { 
    TL: 'top-[-75px] left-[-10px]', 
    TR: 'top-[-75px] right-[-10px]', 
    BL: 'bottom-[-75px] left-[-10px]', 
    BR: 'bottom-[-75px] right-[-10px]' 
  };
  
  const borderColors = { 
    [PlayerColor.RED]: 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]', 
    [PlayerColor.GREEN]: 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]', 
    [PlayerColor.YELLOW]: 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]', 
    [PlayerColor.BLUE]: 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-500 ${isActive ? 'scale-110' : 'opacity-70 scale-90'}`}>
       <div className={`relative p-1 rounded-2xl border-[3px] bg-slate-900/80 backdrop-blur-md ${isActive ? 'border-yellow-400 shadow-[0_0_25px_#fbbf24] ring-4 ring-yellow-400/20' : borderColors[player.color]}`}>
          <img src={player.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-slate-800" />
          {isActive && (
            <div className="absolute -top-3 -right-3 w-7 h-7 bg-yellow-400 rounded-full border-2 border-[#0f172a] flex items-center justify-center animate-bounce shadow-lg">
              <span className="text-[10px] text-black font-black">🎲</span>
            </div>
          )}
       </div>
       <div className="mt-2 flex flex-col items-center bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
          <span className="text-[9px] font-black uppercase tracking-tighter italic text-white leading-none truncate max-w-[80px]">{player?.name || 'Player'}</span>
          <div className="flex items-center gap-1 mt-0.5">
             <span className="text-[8px]">{player?.flag || '🚩'}</span>
             <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest">{player?.country || 'Global'}</span>
          </div>
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
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [findingTimer, setFindingTimer] = useState(30);
  const [commentary, setCommentary] = useState<string>('Welcome to Ludo Money Arena!');
  
  const botActionTimeout = useRef<any>(null);
  const autoForwardTimeout = useRef<any>(null);
  const autoMoveTimeout = useRef<any>(null);
  const findingInterval = useRef<any>(null);
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const handleHiddenAdminTap = () => {
    setAdminTapCount(prev => {
      const next = prev + 1;
      if (next >= 10) {
        setView('ADMIN_AUTH');
        return 0;
      }
      return next;
    });
  };

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
        name, phone, password, balance: 50, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name + Math.random()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [], country: 'Bangladesh'
      };
      await databaseService.updateUser(newUser);
      setUser(newUser);
      localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
      setView('LOBBY');
    } else {
      const found = allUsers.find(u => u.phone === phone && u.password === password);
      if (found) { setUser(found); localStorage.setItem('LUDO_SESSION', JSON.stringify(found)); setView('LOBBY'); } else { setAuthError('Invalid credentials'); }
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('LUDO_SESSION', JSON.stringify(updatedUser));
    await databaseService.updateUser(updatedUser);
  };

  const startFinding = async (count: 2 | 4) => {
    if (!user || user.balance < selectedStake) {
      alert("Insufficient balance!");
      return;
    }
    
    soundManager.play('click');
    const updatedUser = { ...user, balance: user.balance - selectedStake, stats: { ...user.stats, totalGames: user.stats.totalGames + 1 } };
    handleUpdateProfile(updatedUser);
    
    setView('FINDING');
    setFindingTimer(30);
    setFoundPlayers([]);

    if (findingInterval.current) clearInterval(findingInterval.current);
    
    findingInterval.current = setInterval(() => {
      setFindingTimer(t => {
        if (t <= 1) {
          clearInterval(findingInterval.current);
          connectBots(count);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const connectBots = async (count: 2 | 4) => {
    if (viewRef.current !== 'FINDING') return;

    const simulatedBots: Player[] = [];
    // Red=TL, Green=TR, Yellow=BR, Blue=BL
    const opponentColors = count === 2 ? [PlayerColor.YELLOW] : [PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    for (const color of opponentColors) {
      const botIdentity = getRandomBotIdentity();
      const bot: Player = {
        id: `bot-${color}-${Date.now()}`,
        name: botIdentity.name, country: botIdentity.country, flag: botIdentity.flag, color: color, isBot: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botIdentity.name + Math.random()}`, tokens: []
      };
      simulatedBots.push(bot);
      setFoundPlayers([...simulatedBots]);
      soundManager.play('click');
      await new Promise(r => setTimeout(r, 400));
    }

    const gamePlayers: Player[] = [];
    const allColors = count === 2 ? [PlayerColor.RED, PlayerColor.YELLOW] : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    allColors.forEach((color, i) => {
      let p: Player;
      if (color === PlayerColor.RED) {
        p = { id: 'user', name: user!.name, country: user!.country || 'Bangladesh', flag: user!.flag || '🇧🇩', color: PlayerColor.RED, isBot: false, avatarUrl: user!.avatar, tokens: [] };
      } else {
        const simBot = simulatedBots.find(b => b.color === color) || simulatedBots[0];
        p = { ...simBot };
      }
      p.tokens = [0, 1, 2, 3].map(id => ({ id: (i * 4) + id, color: p.color, state: TokenState.HOME, position: 0, distanceTraveled: 0 }));
      gamePlayers.push(p);
    });

    setGameState({ players: gamePlayers, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Battle Started', consecutiveSixes: 0 });
    setView('GAME');
    soundManager.play('six');
    setCommentary(`Tournament started! Total Pool: ৳${selectedStake * count}`);
  };

  const rollDice = async () => {
    if (!gameState || isRolling || isMoving || gameState.isDiceRolled || gameState.winner) return;
    setIsRolling(true);
    soundManager.play('dice');
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');
      setGameState(prev => {
        if (!prev) return null;
        const newConsecSixes = val === 6 ? prev.consecutiveSixes + 1 : 0;
        if (newConsecSixes === 3) {
           setCommentary("Oh no! 3 Sixes in a row. Turn skipped!");
           setTimeout(nextTurn, 1000);
           return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 3 };
        }
        return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: newConsecSixes };
      });
    }, 800);
  };

  const nextTurn = useCallback(() => {
    if (autoForwardTimeout.current) { clearTimeout(autoForwardTimeout.current); autoForwardTimeout.current = null; }
    if (autoMoveTimeout.current) { clearTimeout(autoMoveTimeout.current); autoMoveTimeout.current = null; }
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      return { ...prev, currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, diceValue: null, isDiceRolled: false, consecutiveSixes: 0 };
    });
  }, []);

  const moveToken = async (tokenData: Token) => {
    if (!gameState || !gameState.isDiceRolled || isRolling || isMoving || gameState.winner || gameState.consecutiveSixes === 3) return;
    
    setIsMoving(true);
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const tokenIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    const val = gameState.diceValue!;

    let currentToken = { ...player.tokens[tokenIdx] };
    if (currentToken.state === TokenState.WIN) { setIsMoving(false); return; }
    if (currentToken.state === TokenState.HOME && val !== 6) { setIsMoving(false); return; }
    if (currentToken.state === TokenState.PATH && currentToken.distanceTraveled + val > 56) { setIsMoving(false); return; }

    if (currentToken.state === TokenState.HOME && val === 6) {
      currentToken.state = TokenState.PATH;
      currentToken.distanceTraveled = 0;
      player.tokens[tokenIdx] = currentToken;
      setGameState(prev => prev ? { ...prev, players: [...players] } : null);
      soundManager.play('move');
      await new Promise(r => setTimeout(r, 200));
    } else {
      const targetDistance = currentToken.distanceTraveled + val;
      for (let d = currentToken.distanceTraveled + 1; d <= targetDistance; d++) {
          currentToken.distanceTraveled = d;
          player.tokens[tokenIdx] = { ...currentToken };
          setGameState(prev => prev ? { ...prev, players: [...players] } : null);
          soundManager.play('move');
          await new Promise(r => setTimeout(r, 200)); 
      }
    }

    let capturedToken = false;
    let finishedToken = false;
    
    if (currentToken.distanceTraveled === 56) {
        currentToken.state = TokenState.WIN;
        soundManager.play('win');
        finishedToken = true;
    } else if (currentToken.distanceTraveled < 51) {
        const startPos = START_POSITIONS[currentToken.color];
        const absolutePos = (currentToken.distanceTraveled + startPos) % 52;
        const isSafe = SAFE_SPOTS.includes(absolutePos);
        
        if (!isSafe) {
            players.forEach((otherP, pIdx) => {
                if (pIdx !== gameState.currentPlayerIndex) {
                    otherP.tokens.forEach((otherT) => {
                        if (otherT.state === TokenState.PATH && otherT.distanceTraveled < 51) {
                            const oStart = START_POSITIONS[otherT.color];
                            if ((otherT.distanceTraveled + oStart) % 52 === absolutePos) {
                                otherT.state = TokenState.HOME;
                                otherT.distanceTraveled = 0;
                                capturedToken = true;
                            }
                        }
                    });
                }
            });
        }
    }

    player.tokens[tokenIdx] = currentToken;
    if (capturedToken) {
      soundManager.play('kill');
      const comment = await generateGameCommentary("just knocked an opponent back to base!", player.name);
      setCommentary(comment);
    } else if (finishedToken) {
      const comment = await generateGameCommentary("reached home! Bonus turn granted.", player.name);
      setCommentary(comment);
    }

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(prev => {
         if (!prev) return null;
         if (player.color === PlayerColor.RED) {
             const pool = selectedStake * players.length;
             handleUpdateProfile({ 
                 balance: (user?.balance || 0) + pool,
                 stats: { ...user!.stats, wins: user!.stats.wins + 1, totalWinnings: user!.stats.totalWinnings + pool } 
             });
         }
         return { ...prev, players, winner: player.color };
      });
      setIsMoving(false);
      return;
    }

    const continueTurn = val === 6 || capturedToken || finishedToken;
    setGameState(prev => prev ? { 
        ...prev, players: [...players], isDiceRolled: false, diceValue: null, 
        currentPlayerIndex: continueTurn ? prev.currentPlayerIndex : (prev.currentPlayerIndex + 1) % prev.players.length 
    } : null);
    setIsMoving(false);
  };

  const getBestBotMove = (player: Player, diceVal: number): Token | null => {
    const validMoves = player.tokens.filter(t => 
      t.state !== TokenState.WIN && 
      (t.state === TokenState.HOME ? diceVal === 6 : t.distanceTraveled + diceVal <= 56)
    );

    if (validMoves.length === 0) return null;

    for (const t of validMoves) {
      if (t.state === TokenState.PATH && t.distanceTraveled + diceVal < 51) {
        const startPos = START_POSITIONS[t.color];
        const targetPos = (t.distanceTraveled + diceVal + startPos) % 52;
        if (!SAFE_SPOTS.includes(targetPos)) {
          for (const otherP of gameState!.players) {
            if (otherP.color !== player.color) {
              for (const otherT of otherP.tokens) {
                if (otherT.state === TokenState.PATH && otherT.distanceTraveled < 51) {
                  const oStart = START_POSITIONS[otherT.color];
                  if ((otherT.distanceTraveled + oStart) % 52 === targetPos) return t; 
                }
              }
            }
          }
        }
      }
    }

    const winningMove = validMoves.find(t => t.distanceTraveled + diceVal === 56);
    if (winningMove) return winningMove;
    const baseExit = validMoves.find(t => t.state === TokenState.HOME && diceVal === 6);
    if (baseExit) return baseExit;
    return validMoves.sort((a, b) => b.distanceTraveled - a.distanceTraveled)[0];
  };

  useEffect(() => {
    if (view !== 'GAME' || !gameState || gameState.winner || isRolling || isMoving) return;
    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    if (!activePlayer) return;

    if (activePlayer.isBot) {
        if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
        botActionTimeout.current = setTimeout(() => {
            if (!gameState.isDiceRolled) rollDice();
            else {
                const bestToken = getBestBotMove(activePlayer, gameState.diceValue!);
                if (bestToken) moveToken(bestToken); else nextTurn();
            }
        }, 1000);
    } else {
        if (autoMoveTimeout.current) clearTimeout(autoMoveTimeout.current);
        autoMoveTimeout.current = setTimeout(() => {
            if (!gameState.isDiceRolled) rollDice();
            else {
                const val = gameState.diceValue!;
                const valid = activePlayer.tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56));
                if (valid.length > 0) moveToken(valid[0]); else nextTurn();
            }
        }, 15000); 
    }

    return () => {
      if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
      if (autoMoveTimeout.current) clearTimeout(autoMoveTimeout.current);
    };
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled, isRolling, isMoving, view]);

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-7xl mb-12">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5"><div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg rounded-full transition-all duration-300" style={{width: `${loadingProgress}%`}}></div></div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.5em] text-white/20">Loading Arena</p>
        </div>
      )}

      {(view === 'LOGIN' || view === 'ADMIN_AUTH') && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
           <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 py-12 rounded-[50px] w-full max-w-[420px] border border-white/10 flex flex-col items-center shadow-2xl animate-in zoom-in-95 z-10">
              <h2 className="ludo-money-logo text-6xl mb-12 italic font-black uppercase">{view === 'ADMIN_AUTH' ? 'ADMIN' : (isSignUp ? 'SIGNUP' : 'LOGIN')}</h2>
              {authError && <div className="text-red-500 mb-6 text-[10px] font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">{authError}</div>}
              <div className="w-full space-y-5 mb-10">
                 {view === 'LOGIN' && isSignUp && <input type="text" placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />}
                 <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />
                 <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />
              </div>
              <button onClick={view === 'ADMIN_AUTH' ? async () => { if (adminId === 'admin' && adminPass === 'admin123') setView('ADMIN'); else setAuthError('Invalid Admin Credentials'); } : handleAuth} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all">Enter</button>
              {view === 'LOGIN' && <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-white/40 text-[10px] font-black uppercase tracking-widest">{isSignUp ? 'Login instead' : 'Create Account'}</button>}
           </div>
           {view === 'LOGIN' && <button onClick={handleHiddenAdminTap} className="absolute bottom-10 text-white/10 text-[10px] font-black uppercase tracking-widest">VER 1.0.6 PRO</button>}
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="flex-1 flex flex-col animate-in fade-in overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center p-6 pb-2">
            <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all" onClick={() => setProfileOpen(true)}>
              <div className="w-12 h-12 rounded-xl border-2 border-yellow-500 bg-slate-800 overflow-hidden relative shadow-lg">
                <img src={user.avatar} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none">{user.name}</h3>
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Player Rank: Gold</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={() => setSettingsOpen(true)} className="bg-slate-900/80 border border-red-600/50 p-2.5 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-90 transition-transform">
                   <span className="text-lg">⚙️</span>
                </button>
                <button onClick={() => setWalletOpen(true)} className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg active:scale-95 transition-transform">
                    <span className="bg-yellow-500 text-black w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black">৳</span>
                    <span className="text-xs font-black text-yellow-500">{user.balance.toLocaleString()}</span>
                </button>
            </div>
          </div>

          <div className="bg-yellow-400 h-8 flex items-center overflow-hidden border-y border-yellow-600 shadow-md">
            <div className="animate-scroll-text whitespace-nowrap flex items-center gap-10">
              <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🏆 INTERNATIONAL TOURNAMENT STARTING NOW 🏆</span>
              <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🎲 {user.name} IS READY FOR THE BATTLE! 🎲</span>
            </div>
          </div>

          <div className="p-6 pt-4 space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-[30px] border border-indigo-400/30 flex items-center gap-3 shadow-xl active:scale-95 transition-all relative overflow-hidden group">
                  <span className="text-3xl">🎁</span>
                  <div><p className="text-[8px] font-black uppercase text-indigo-300">Daily Reward</p><h4 className="text-[11px] font-black uppercase italic">Claim ৳৫০</h4></div>
               </div>
               <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-4 rounded-[30px] border border-orange-400/30 flex items-center gap-3 shadow-xl active:scale-95 transition-all relative overflow-hidden group">
                  <span className="text-3xl">🔥</span>
                  <div><p className="text-[8px] font-black uppercase text-orange-200">Hot Event</p><h4 className="text-[11px] font-black uppercase italic">2X Points</h4></div>
               </div>
            </div>

            <div className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 rounded-[50px] p-8 border-4 border-blue-400/20 shadow-2xl flex flex-col items-center justify-between relative overflow-hidden">
               <div className="bg-[#1c2e63] p-1.5 rounded-3xl flex w-full max-w-[280px] z-10 shadow-inner">
                  <button onClick={() => setPlayerCount(2)} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-center ${playerCount === 2 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40'}`}>2 Player</button>
                  <button onClick={() => setPlayerCount(4)} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-center ${playerCount === 4 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40'}`}>4 Player</button>
               </div>
               
               <div className="flex flex-col items-center gap-4 py-6 z-10">
                  <div className="w-32 h-32 bg-yellow-400 rounded-[35px] flex items-center justify-center shadow-2xl border-b-8 border-yellow-600 active:translate-y-1">
                     <div className="w-16 h-16 bg-white rounded-xl rotate-12 flex items-center justify-center shadow-lg border-b-4 border-slate-300">
                        <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                     </div>
                  </div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.2)] text-center">Global Arena</h2>
               </div>

               <div className="w-full grid grid-cols-4 gap-2 z-10">
                  {[50, 100, 500, 1000].map(stake => (
                    <button key={stake} onClick={() => setSelectedStake(stake)} className={`py-3 rounded-xl font-black text-[10px] border-2 transition-all ${selectedStake === stake ? 'bg-yellow-400 border-yellow-300 text-black scale-105 shadow-md' : 'bg-[#0f1d44] border-white/5 text-white/40'}`}>৳{stake}</button>
                  ))}
               </div>
               
               <button onClick={() => startFinding(playerCount)} className="w-full mt-6 py-5 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[30px] font-black text-xl uppercase italic text-black border-b-8 border-amber-800 active:translate-y-2 transition-all shadow-xl z-10">Start Battle</button>
            </div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-xl border-t border-white/5 flex justify-around p-4 shrink-0">
             <button className="flex flex-col items-center gap-1 group">
                <div className="w-6 h-6 bg-yellow-400 rounded-md flex items-center justify-center text-xs shadow-md">🏠</div>
                <span className="text-[8px] font-black uppercase text-yellow-400 tracking-widest">Home</span>
             </button>
             <button className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-6 h-6 flex items-center justify-center text-xl">🏆</div>
                <span className="text-[8px] font-black uppercase tracking-widest">Rank</span>
             </button>
             <button className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-6 h-6 flex items-center justify-center text-xl">🛡️</div>
                <span className="text-[8px] font-black uppercase tracking-widest">Shop</span>
             </button>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-[#020617] animate-in fade-in overflow-hidden">
           <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[6px] border-white/5 shadow-inner"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-sky-500 border-t-transparent animate-[spin_2s_linear_infinite] shadow-[0_0_20px_rgba(14,165,233,0.3)]"></div>
              <div className="flex flex-col items-center justify-center z-10">
                 <span className="text-7xl font-black text-yellow-500 italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{findingTimer}</span>
                 <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em] mt-2">Searching</span>
              </div>
           </div>
           
           <h2 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter">Finding Players</h2>
           <p className="text-sky-400 font-bold uppercase text-[10px] tracking-widest mb-12 text-center max-w-[260px] leading-relaxed">
              Connecting to the nearest available match in Global Arena...
           </p>
           
           <div className="flex items-center gap-6 mb-16">
              <div className="flex flex-col items-center gap-3">
                 <div className="w-16 h-16 rounded-2xl border-2 border-yellow-500 overflow-hidden shadow-xl bg-slate-800"><img src={user?.avatar} className="w-full h-full object-cover" /></div>
                 <span className="text-[10px] font-black uppercase text-white/60 tracking-tighter">{user?.name}</span>
              </div>
              <div className="text-2xl animate-pulse text-white/20 italic">VS</div>
              <div className="flex flex-col items-center gap-3">
                 {foundPlayers.length > 0 ? (
                    <div className="flex flex-col items-center gap-3 animate-in zoom-in">
                       <div className="w-16 h-16 rounded-2xl border-2 border-green-500 overflow-hidden shadow-xl bg-slate-800"><img src={foundPlayers[0].avatarUrl} className="w-full h-full object-cover" /></div>
                       <span className="text-[10px] font-black uppercase text-white/60 tracking-tighter">{foundPlayers[0].name}</span>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center gap-3 opacity-30">
                       <div className="w-16 h-16 rounded-2xl border-2 border-white/20 bg-white/5 flex items-center justify-center text-3xl">?</div>
                       <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter">Waiting...</span>
                    </div>
                 )}
              </div>
           </div>
           <button onClick={() => { if(findingInterval.current) clearInterval(findingInterval.current); setView('LOBBY'); }} className="text-white/20 font-black uppercase text-[10px] tracking-[0.3em] hover:text-red-500 transition-colors border-b border-transparent hover:border-red-500 pb-1">Cancel Search</button>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col p-4 relative animate-in fade-in">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-auto min-w-[200px] bg-[#1c212e]/95 backdrop-blur-2xl px-6 py-2.5 rounded-full border border-white/10 z-[120] flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-in slide-in-from-top-10">
             <div className="bg-yellow-500/20 p-1.5 rounded-full border border-yellow-500/30 flex items-center justify-center shrink-0">
                <span className="text-sm animate-pulse">🎙️</span>
             </div>
             <p className="text-[9px] sm:text-[10px] font-black text-sky-400 italic leading-tight text-center uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
                {commentary}
             </p>
          </div>

          <div className="absolute top-4 left-4 z-[110]">
             <button onClick={() => setIsExitModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full border-b-4 border-red-900 shadow-[0_4px_15px_rgba(220,38,38,0.4)] active:translate-y-1 active:border-b-0 transition-all font-black uppercase italic text-[9px] tracking-tighter">Exit</button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 mt-28 sm:mt-32">
            <div className="w-full max-w-[500px] aspect-square relative">
              <LudoBoard players={gameState.players} onTokenClick={moveToken} validTokens={(() => { if (gameState.currentPlayerIndex !== 0 || gameState.consecutiveSixes === 3 || isMoving) return []; const player = gameState.players[0]; const val = gameState.diceValue; if (!val || !gameState.isDiceRolled) return []; return player.tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56)).map(t => t.id); })()} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} />
              
              {/* CORRECTED POSITIONING LOGIC TO MATCH LUDOBOARD.TSX BASES */}
              {gameState.players.map((p, i) => { 
                // Red=TL, Green=TR, Yellow=BR, Blue=BL according to LudoBoard.tsx rendering
                const positionsMap: ('TL' | 'TR' | 'BR' | 'BL')[] = playerCount === 2 
                  ? ['TL', 'BR'] // 2-player: Player 1 (Red) Top-Left, Player 2 (Yellow) Bottom-Right
                  : ['TL', 'TR', 'BR', 'BL']; // 4-player: R-TL, G-TR, Y-BR, B-BL
                
                return <PlayerProfileOverlay 
                  key={p.id} 
                  player={p} 
                  isActive={gameState.currentPlayerIndex === i} 
                  position={positionsMap[i]} 
                />; 
              })}
            </div>
          </div>
          
          <div className="h-44 flex flex-col items-center justify-center gap-4 bg-[#020617]/90 rounded-t-[50px] border-t border-white/10 backdrop-blur-2xl mt-4 shrink-0 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
             <button onClick={rollDice} disabled={gameState.currentPlayerIndex !== 0 || gameState.isDiceRolled || isRolling || isMoving} className={`group flex flex-col items-center gap-4 transition-all ${gameState.currentPlayerIndex === 0 && !gameState.isDiceRolled && !isMoving ? 'scale-100 opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                <div className="relative w-28 h-28 rounded-[35px] border-[4px] border-yellow-500 shadow-2xl flex items-center justify-center bg-slate-800 group-active:scale-90 transition-transform">
                    <Dice3D value={gameState.diceValue} isRolling={isRolling} />
                </div>
                <div className="flex flex-col items-center gap-2">
                   <span className="text-xs font-black uppercase italic tracking-tighter text-yellow-400">Roll the dice!</span>
                   <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <div className={`h-full bg-gradient-to-r from-yellow-400 to-amber-600 shadow-[0_0_10px_#fbbf24] rounded-full ${!gameState.isDiceRolled && gameState.currentPlayerIndex === 0 && !isMoving ? 'animate-[timer_12s_linear_forwards]' : 'w-0'}`}></div>
                   </div>
                </div>
             </button>
          </div>

          {isExitModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in zoom-in-95">
               <div className="bg-[#1c212e] border-4 border-red-600/30 rounded-[50px] p-10 text-center shadow-2xl max-w-sm w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
                  <div className="text-6xl mb-6">⚠️</div>
                  <h2 className="text-3xl font-black italic text-white mb-4 uppercase tracking-tighter leading-none">Caution!</h2>
                  <p className="text-white/70 text-sm font-medium mb-10 leading-relaxed px-2">Are you sure you want to exit? If you leave now, you will lose your stake of <b>৳{selectedStake}</b>.</p>
                  <div className="space-y-4">
                     <button onClick={() => { setIsExitModalOpen(false); setView('LOBBY'); }} className="w-full bg-red-600 text-white py-5 rounded-[25px] font-black uppercase text-sm shadow-[0_5px_20px_rgba(220,38,38,0.4)] active:scale-95 transition-all">Yes, Exit Anyway</button>
                     <button onClick={() => setIsExitModalOpen(false)} className="w-full bg-white/5 text-white/40 py-5 rounded-[25px] font-black uppercase text-[10px] tracking-widest hover:text-white transition-all border border-white/10">Stay in Game</button>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Profile, Wallet & Settings Modals */}
      {isProfileOpen && user && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in zoom-in-95">
           <div className="bg-[#1e293b] rounded-[40px] w-full max-w-sm border border-white/10 overflow-hidden shadow-2xl relative">
              <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-900 flex justify-between items-center"><h2 className="text-xl font-black uppercase italic tracking-tighter">My Profile</h2><button onClick={() => setProfileOpen(false)} className="text-white/40 hover:text-white transition-colors">✕</button></div>
              <div className="p-8 space-y-6">
                 <div className="flex flex-col items-center gap-4">
                    <div className="relative group"><div className="w-28 h-28 rounded-[35px] border-4 border-yellow-500 overflow-hidden shadow-xl bg-slate-800"><img src={user.avatar} className="w-full h-full object-cover" /></div><button onClick={() => handleUpdateProfile({ avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name + Math.random()}` })} className="absolute -bottom-2 -right-2 bg-yellow-500 text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">📷</button></div>
                    <div className="text-center"><h3 className="text-2xl font-black text-white italic tracking-tighter leading-none">{user.name}</h3><p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mt-1">{user.phone}</p></div>
                 </div>
                 <div className="space-y-4">
                    <input type="text" defaultValue={user.name} onBlur={(e) => handleUpdateProfile({ name: e.target.value })} placeholder="Full Name" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl font-bold text-white focus:border-yellow-500 outline-none transition-all" />
                    <input type="text" defaultValue={user.country || 'Global'} onBlur={(e) => handleUpdateProfile({ country: e.target.value })} placeholder="Country" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl font-bold text-white focus:border-yellow-500 outline-none transition-all" />
                 </div>
                 <button onClick={() => setProfileOpen(false)} className="w-full py-5 bg-yellow-500 text-black rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all mt-4">Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {isSettingsOpen && user && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in zoom-in-95">
           <div className="bg-[#1e293b] rounded-[40px] w-full max-w-sm border border-white/10 overflow-hidden shadow-2xl relative">
              <div className="p-6 bg-gradient-to-r from-slate-700 to-slate-900 flex justify-between items-center"><h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Settings</h2><button onClick={() => setSettingsOpen(false)} className="text-white/40 hover:text-white transition-colors">✕</button></div>
              <div className="p-8 space-y-6">
                 <input type="tel" defaultValue={user.phone} onBlur={(e) => handleUpdateProfile({ phone: e.target.value })} placeholder="New Phone" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl font-bold text-white outline-none" />
                 <input type="password" defaultValue={user.password} onBlur={(e) => handleUpdateProfile({ password: e.target.value })} placeholder="Update Password" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl font-bold text-white outline-none" />
                 <button onClick={() => setSettingsOpen(false)} className="w-full py-5 bg-sky-500 text-white rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all mt-4">Update Account</button>
                 <button onClick={() => { localStorage.removeItem('LUDO_SESSION'); window.location.reload(); }} className="w-full text-red-500 font-black uppercase text-[10px] tracking-widest mt-2 opacity-60">Logout Account</button>
              </div>
           </div>
        </div>
      )}

      {view === 'ADMIN' && user && (
        <AdminPortal user={user} allUsers={allUsers} onUpdateUsersDB={setAllUsers} pendingTransactions={pendingTransactions} liveMatches={[]} onUpdateUser={async (u) => { const updated = allUsers.map(usr => usr.phone === u.phone ? u : usr); setAllUsers(updated); await databaseService.updateUser(u); }} onApproveTransaction={async (tx) => { const u = allUsers.find(usr => usr.name === tx.userName); if (u) { const updatedUser = { ...u, balance: tx.type === 'DEPOSIT' ? u.balance + tx.amount : u.balance - tx.amount, history: u.history.map(h => h.id === tx.id ? { ...h, status: 'APPROVED' as const } : h) }; await databaseService.updateUser(updatedUser); setAllUsers(allUsers.map(usr => usr.phone === updatedUser.phone ? updatedUser : usr)); setPendingTransactions(prev => prev.filter(p => p.id !== tx.id)); } }} onRejectTransaction={async (txId) => { setPendingTransactions(prev => prev.filter(p => p.id !== txId)); }} onExit={() => setView('LOBBY')} />
      )}

      {isWalletOpen && user && (
        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={(tx) => { setPendingTransactions(prev => [...prev, tx]); const updatedUser = { ...user, history: [...(user.history || []), tx] }; setUser(updatedUser); databaseService.updateUser(updatedUser); }} />
      )}
    </div>
  );
};

export default App;
