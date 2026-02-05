
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity, calculateBestBotMove } from './services/botService';
import { generateGameCommentary } from './services/geminiService';
import { SAFE_SPOTS, START_POSITIONS } from './constants';

const Dice3D: React.FC<{ value: number | null, isRolling: boolean, onClick?: () => void, disabled?: boolean, size?: number }> = ({ value, isRolling, onClick, disabled, size = 60 }) => {
  const scale = size / 70;
  return (
    <div 
      className={`relative ${isRolling ? 'dice-jump' : ''} ${disabled ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer active:scale-90 transition-transform'}`} 
      style={{ width: size, height: size, perspective: '600px' }}
      onClick={!disabled && !isRolling ? onClick : undefined}
    >
      <div className={`cube ${isRolling ? 'rolling' : `show-${value || 1}`}`} style={{ transformOrigin: 'center center', scale: scale.toString() }}>
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

const PlayerProfileOverlay: React.FC<{ player: Player, isActive: boolean, position: 'TL' | 'TR' | 'BL' | 'BR', diceValue: number | null, isRolling: boolean, onDiceRoll: () => void, isDiceRolled: boolean }> = ({ player, isActive, position, diceValue, isRolling, onDiceRoll, isDiceRolled }) => {
  const posClasses = { 
    TL: 'top-[-115px] left-[-25px]', 
    TR: 'top-[-115px] right-[-25px]', 
    BL: 'bottom-[-115px] left-[-25px]', 
    BR: 'bottom-[-115px] right-[-25px]' 
  };
  
  const borderColors = { 
    [PlayerColor.RED]: 'border-red-500', 
    [PlayerColor.GREEN]: 'border-green-500', 
    [PlayerColor.YELLOW]: 'border-yellow-400', 
    [PlayerColor.BLUE]: 'border-blue-500' 
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-500 ${isActive ? 'scale-110' : 'opacity-60 scale-90'}`}>
       <div className={`flex ${['TR', 'BR'].includes(position) ? 'flex-row-reverse' : 'flex-row'} items-center gap-4 mb-3`}>
          <div className={`relative p-1.5 rounded-3xl border-[4px] bg-slate-900/95 backdrop-blur-md ${isActive ? 'border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.6)]' : borderColors[player.color]}`}>
            <img src={player.avatarUrl} className="w-16 h-16 rounded-2xl object-cover bg-slate-800" />
            {isActive && !isDiceRolled && !isRolling && (
              <div className="absolute -top-5 -right-5 w-10 h-10 bg-yellow-400 rounded-full border-2 border-slate-900 flex items-center justify-center animate-bounce shadow-2xl z-20">
                <span className="text-xl">☝️</span>
              </div>
            )}
          </div>
          
          <div className="relative group">
            <div className={`bg-white rounded-[20px] p-2.5 shadow-[0_10px_25px_rgba(0,0,0,0.3)] border-[3px] transition-all duration-300 ${isActive ? 'border-yellow-400 scale-110 ring-4 ring-yellow-400/20' : 'border-slate-300 scale-90 opacity-40 grayscale'}`}>
               <Dice3D 
                  value={isActive ? diceValue : 1} 
                  isRolling={isActive && isRolling} 
                  onClick={onDiceRoll} 
                  disabled={!isActive || isDiceRolled} 
                  size={55}
               />
            </div>
            
            {isActive && isDiceRolled && !isRolling && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-900 px-5 py-2 rounded-2xl font-black text-2xl shadow-[0_5px_15px_rgba(251,191,36,0.4)] border-2 border-white animate-in zoom-in-75 duration-300 flex items-center justify-center">
                {diceValue}
              </div>
            )}
          </div>
       </div>

       <div className="bg-black/85 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-2xl flex flex-col items-center min-w-[110px]">
          <span className="text-[11px] font-black uppercase text-white tracking-tight leading-none mb-1">{player.name}</span>
          <div className="flex items-center gap-1.5 opacity-50">
             <span className="text-[9px]">{player.flag}</span>
             <span className="text-[7px] font-bold uppercase tracking-widest">{player.country}</span>
          </div>
       </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'ADMIN_AUTH' | 'LOBBY' | 'FINDING' | 'LOCAL_SETUP' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [localPlayerCount, setLocalPlayerCount] = useState<2 | 3 | 4>(2);
  const [localPlayerNames, setLocalPlayerNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [selectedStake, setSelectedStake] = useState(50);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [findingTimer, setFindingTimer] = useState(15);
  const [foundPlayers, setFoundPlayers] = useState<any[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [commentary, setCommentary] = useState<string>("Welcome to the arena! Best of luck. 🎲");
  const [turnTimer, setTurnTimer] = useState(10);

  const findingInterval = useRef<any>(null);
  const turnTimerInterval = useRef<any>(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [adminTapCount, setAdminTapCount] = useState(0);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  useEffect(() => {
    const unlock = () => {
      soundManager.unlock();
      ['click', 'touchstart', 'mousedown'].forEach(evt => window.removeEventListener(evt, unlock));
    };
    ['click', 'touchstart', 'mousedown'].forEach(evt => window.addEventListener(evt, unlock));
    return () => ['click', 'touchstart', 'mousedown'].forEach(evt => window.removeEventListener(evt, unlock));
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('LUDO_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = await databaseService.getUserByPhone(parsed.phone);
        if (fresh && !fresh.isBlocked) {
          setUser({ ...fresh, lastLogin: new Date().toISOString() });
          setTimeout(() => setView('LOBBY'), 1000);
        } else {
          localStorage.removeItem('LUDO_SESSION');
          setTimeout(() => setView('LOGIN'), 1000);
        }
      } else {
        setTimeout(() => setView('LOGIN'), 2500);
      }
    };
    init();
    const interval = setInterval(() => setLoadingProgress(p => (p < 100 ? p + 5 : 100)), 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user && view !== 'SPLASH' && view !== 'LOGIN') {
      const fetchUpdates = async () => {
        const [freshUser, freshAllUsers, freshTxs] = await Promise.all([
          databaseService.getUserByPhone(user.phone),
          user.phone === '01700000000' || view === 'ADMIN' ? databaseService.getUsers() : Promise.resolve([]),
          databaseService.getPendingTransactions()
        ]);
        if (freshUser) {
           setUser(prev => prev ? { ...prev, balance: freshUser.balance, isBlocked: freshUser.isBlocked } : null);
           if (freshUser.isBlocked) {
              localStorage.removeItem('LUDO_SESSION');
              window.location.reload();
           }
        }
        if (freshAllUsers.length > 0) setAllUsers(freshAllUsers);
        setPendingTransactions(freshTxs);
      };
      const interval = setInterval(fetchUpdates, 8000);
      fetchUpdates();
      return () => clearInterval(interval);
    }
  }, [user?.phone, view]);

  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner && !isMoving) {
        setTurnTimer(10);
        if (turnTimerInterval.current) clearInterval(turnTimerInterval.current);
        turnTimerInterval.current = setInterval(() => {
            setTurnTimer(prev => {
                if (prev <= 1) {
                    if (!isLocalMode) handleAutoTurn();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else if (turnTimerInterval.current) clearInterval(turnTimerInterval.current);
    return () => { if (turnTimerInterval.current) clearInterval(turnTimerInterval.current); };
  }, [view, gameState?.currentPlayerIndex, gameState?.isDiceRolled, isMoving, isLocalMode]);

  const handleAutoTurn = () => {
    if (isLocalMode || !gameState || isMoving || isRolling || gameState.winner) return;
    if (!gameState.isDiceRolled) rollDice();
    else {
        const player = gameState.players[gameState.currentPlayerIndex];
        const val = gameState.diceValue!;
        const validTokens = player.tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56));
        if (validTokens.length > 0) moveToken(calculateBestBotMove(validTokens, val, gameState.players, gameState.currentPlayerIndex));
        else nextTurn();
    }
  };

  const addCommentary = async (event: string, pName: string) => {
    const text = await generateGameCommentary(event, pName);
    setCommentary(text);
  };

  const handleLogoClick = () => {
    setAdminTapCount(prev => {
      const next = prev + 1;
      if (next === 5) { setView('ADMIN_AUTH'); return 0; }
      return next;
    });
  };

  const handleAdminAuth = () => {
    if (adminId === 'admin' && adminPass === 'ludo2025') setView('ADMIN');
    else alert('Wrong credentials');
  };

  const startFinding = () => {
    if (!user) return;
    if (user.balance < selectedStake) {
      alert("ব্যালেন্স পর্যাপ্ত নয়! দয়া করে ডিপোজিট করুন।");
      setWalletOpen(true);
      return;
    }
    soundManager.play('click');
    setIsLocalMode(false);
    setView('FINDING');
    setFindingTimer(6);
    setFoundPlayers([{ name: user.name, avatar: user.avatar, flag: user.flag || '🇧🇩' }]);
    if (findingInterval.current) clearInterval(findingInterval.current);
    findingInterval.current = setInterval(() => {
      setFindingTimer((prev) => {
        if (prev <= 1) { clearInterval(findingInterval.current); prepareGame(false); return 0; }
        if (prev === 4 || prev === 2) {
           const bot = getRandomBotIdentity();
           setFoundPlayers(p => [...p, { name: bot.name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}`, flag: bot.flag }]);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const rollDice = () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    setIsRolling(true);
    soundManager.play('dice');
    setTimeout(async () => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');
      if (val === 6) { soundManager.play('six'); addCommentary("Lucky SIX!", gameState.players[gameState.currentPlayerIndex].name); }
      setGameState(prev => {
        if (!prev) return null;
        if (val === 6 && prev.consecutiveSixes >= 2) {
           addCommentary("Triple sixes! Turn skipped.", prev.players[prev.currentPlayerIndex].name);
           setTimeout(() => nextTurn(), 800);
           return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0 };
        }
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56));
        if (!canMove) setTimeout(() => nextTurn(), 1500);
        return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 };
      });
    }, 600);
  };

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      return { ...prev, currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, diceValue: null, isDiceRolled: false, consecutiveSixes: 0 };
    });
  }, []);

  const moveToken = async (tokenData: Token) => {
    if (!gameState || !gameState.isDiceRolled || isMoving || gameState.winner) return;
    setIsMoving(true);
    const players = [...gameState.players];
    const playerIdx = gameState.currentPlayerIndex;
    const player = players[playerIdx];
    const tIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    const val = gameState.diceValue!;

    if (player.tokens[tIdx].state === TokenState.HOME && val === 6) {
      player.tokens[tIdx].state = TokenState.PATH;
      player.tokens[tIdx].distanceTraveled = 0;
      setGameState(p => p ? { ...p, players: [...players] } : null);
      soundManager.play('move');
    } else {
      for (let i = 1; i <= val; i++) {
        player.tokens[tIdx].distanceTraveled++;
        setGameState(p => p ? { ...p, players: [...players] } : null);
        soundManager.play('move');
        await new Promise(r => setTimeout(r, 150));
      }
    }

    let extraTurn = val === 6;
    if (player.tokens[tIdx].distanceTraveled === 56) {
      player.tokens[tIdx].state = TokenState.WIN;
      soundManager.play('win'); extraTurn = true;
      addCommentary("Reached home!", player.name);
    } else {
      const targetPos = (player.tokens[tIdx].distanceTraveled + START_POSITIONS[player.color]) % 52;
      const isSafe = SAFE_SPOTS.includes(targetPos);
      if (!isSafe) {
        players.forEach((otherP, otherPIdx) => {
          if (otherPIdx === playerIdx) return;
          otherP.tokens.forEach((otherT, otherTIdx) => {
            if (otherT.state === TokenState.PATH) {
              const otherAbsPos = (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52;
              if (otherAbsPos === targetPos) {
                otherP.tokens[otherTIdx].state = TokenState.HOME;
                otherP.tokens[otherTIdx].distanceTraveled = 0;
                soundManager.play('kill'); extraTurn = true;
                addCommentary(`KILL! ${player.name} knocked out ${otherP.name}!`, player.name);
              }
            }
          });
        });
      }
    }

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(p => p ? { ...p, winner: player.color } : null);
      if (!isLocalMode && user) {
        const winningAmount = selectedStake * (gameState.players.length - 0.2); 
        databaseService.updateUser({ ...user, balance: user.balance + winningAmount, stats: { ...user.stats, wins: user.stats.wins + 1, totalWinnings: user.stats.totalWinnings + winningAmount, totalGames: user.stats.totalGames + 1 } });
      }
    } else {
      setGameState(p => p ? { ...p, isDiceRolled: false, diceValue: null, currentPlayerIndex: extraTurn ? p.currentPlayerIndex : (p.currentPlayerIndex + 1) % p.players.length, consecutiveSixes: extraTurn && val !== 6 ? 0 : p.consecutiveSixes } : null);
    }
    setIsMoving(false);
  };

  const prepareGame = (local: boolean = false) => {
    const activeCount = local ? localPlayerCount : playerCount;
    const players: Player[] = [];
    const colors = [PlayerColor.RED, PlayerColor.YELLOW, PlayerColor.GREEN, PlayerColor.BLUE];
    for (let i = 0; i < activeCount; i++) {
      const color = activeCount === 2 ? (i === 0 ? PlayerColor.RED : PlayerColor.YELLOW) : colors[i];
      if (local) {
        players.push({ id: `local-${i}`, name: localPlayerNames[i], country: 'BD', flag: '🇧🇩', color, isBot: false, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Local${i}`, tokens: [] });
      } else {
        if (i === 0) {
           players.push({ id: 'user', name: user!.name, country: user!.country || 'BD', flag: user!.flag || '🇧🇩', color: PlayerColor.RED, isBot: false, avatarUrl: user!.avatar, tokens: [] });
           databaseService.updateUser({ ...user!, balance: user!.balance - selectedStake, stats: { ...user!.stats, totalGames: user!.stats.totalGames + 1 } });
        } else {
          const bot = getRandomBotIdentity();
          players.push({ id: `bot-${i}`, name: bot.name, country: bot.country, flag: bot.flag, isBot: true, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}`, color, tokens: [] });
        }
      }
    }
    const finalPlayers = players.map((p, i) => ({ ...p, tokens: [0, 1, 2, 3].map(tid => ({ id: (i * 4) + tid, color: p.color, state: TokenState.HOME, position: 0, distanceTraveled: 0 })) }));
    setGameState({ players: finalPlayers, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Started', consecutiveSixes: 0 });
    setView('GAME'); soundManager.play('six');
    setCommentary(local ? "Local Pass & Play. 🤝" : `Real Money Arena! Stake: ৳${selectedStake} 🔥`);
  };

  const handleAuth = async () => {
    if (!phone || !password) return setAuthError('Phone and password are required.');
    setIsAuthLoading(true); setAuthError('');
    try {
      const normalized = databaseService.normalizePhone(phone);
      const existing = await databaseService.getUserByPhone(normalized);
      if (isSignUp) {
        if (existing) { setAuthError('Registered already.'); setIsAuthLoading(false); return; }
        const newUser: UserProfile = { name: name || 'User', phone: normalized, password: password, balance: 0, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalized}`, createdAt: new Date().toISOString(), stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [] };
        await databaseService.updateUser(newUser); setUser(newUser);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser)); setView('LOBBY');
      } else {
        if (!existing || existing.password !== password) setAuthError('Invalid credentials.');
        else if (existing.isBlocked) setAuthError('Account blocked.');
        else { setUser(existing); localStorage.setItem('LUDO_SESSION', JSON.stringify(existing)); setView('LOBBY'); }
      }
    } catch (err) { setAuthError('Failed.'); } finally { setIsAuthLoading(false); }
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 onClick={handleLogoClick} className="ludo-money-logo text-7xl mb-12 cursor-pointer transition-all active:scale-95 select-none tracking-tighter">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full border border-white/10 p-0.5"><div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div></div>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
          <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 rounded-[50px] w-full max-w-[420px] border border-white/10 shadow-2xl">
            <h2 onClick={handleLogoClick} className="ludo-money-logo text-6xl mb-10 italic uppercase cursor-pointer select-none">{isSignUp ? 'SIGNUP' : 'LOGIN'}</h2>
            {authError && <div className="text-red-500 mb-6 text-xs font-bold text-center bg-red-500/10 p-2 rounded-xl border border-red-500/20">{authError}</div>}
            <div className="space-y-4 mb-8">
              {isSignUp && <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />}
              <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
            </div>
            <button onClick={handleAuth} disabled={isAuthLoading} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all disabled:opacity-50">{isAuthLoading ? 'Please wait...' : 'Enter Arena'}</button>
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="w-full mt-4 text-white/40 text-[10px] uppercase font-bold">{isSignUp ? 'Login instead' : 'Create Account'}</button>
          </div>
        </div>
      )}

      {view === 'ADMIN_AUTH' && (
          <div className="h-full flex flex-col items-center justify-center p-6 bg-[#020617] animate-in slide-in-from-bottom duration-500">
             <div className="bg-slate-900 p-10 rounded-[40px] border border-white/10 w-full max-w-sm shadow-2xl text-center">
                <h2 className="text-2xl font-black uppercase italic text-sky-400 mb-8 tracking-tighter">Admin Access</h2>
                <div className="space-y-4 mb-8">
                   <input type="text" placeholder="Admin ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none" />
                   <input type="password" placeholder="Passcode" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none" />
                </div>
                <button onClick={handleAdminAuth} className="w-full bg-sky-500 py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95">Authenticate</button>
             </div>
          </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col animate-in fade-in overflow-y-auto no-scrollbar pb-32">
          {/* Top Bar */}
          <div className="flex justify-between items-center p-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl border-2 border-yellow-500 bg-slate-800 overflow-hidden shadow-lg"><img src={user.avatar} className="w-full h-full object-cover" /></div>
              <div><h3 className="text-sm font-black uppercase italic leading-none">{user.name}</h3><p className="text-[8px] font-bold text-white/40 uppercase mt-1">Player Rank: Elite</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettingsOpen(true)} className="bg-slate-900/80 border border-white/10 p-2.5 rounded-full shadow-lg text-lg">⚙️</button>
              <button onClick={() => setWalletOpen(true)} className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                <span className="text-sm font-black text-yellow-500">৳ {Math.floor(user.balance).toLocaleString()}</span><span className="w-5 h-5 bg-yellow-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold">+</span>
              </button>
            </div>
          </div>

          {/* GLOBAL ARENA - EXACT UI FROM SCREENSHOT */}
          <div className="px-6 mt-6 mb-6">
            <div className="bg-[#2b64f3] rounded-[45px] border-[10px] border-[#1e4ccf] shadow-2xl flex flex-col items-center p-8 relative overflow-hidden min-h-[400px]">
              {/* Player Count Toggle */}
              <div className="bg-[#1e40af] p-1 rounded-[25px] flex w-full max-w-[200px] mb-8 shadow-inner">
                <button onClick={() => setPlayerCount(2)} className={`flex-1 py-2.5 rounded-[20px] text-[10px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-[#ffca28] text-slate-900 shadow-md' : 'text-white/40'}`}>2 Player</button>
                <button onClick={() => setPlayerCount(4)} className={`flex-1 py-2.5 rounded-[20px] text-[10px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-[#ffca28] text-slate-900 shadow-md' : 'text-white/40'}`}>4 Player</button>
              </div>

              <h2 className="text-4xl font-black italic uppercase text-white drop-shadow-xl tracking-tighter mb-8 text-center leading-none">Global<br/>Arena</h2>

              {/* Stake Selector */}
              <div className="flex flex-wrap justify-center gap-3 mb-10 w-full px-4">
                {[50, 100, 500, 1000].map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`px-4 py-3 min-w-[70px] rounded-xl font-black text-xs transition-all border-2 ${selectedStake === s ? 'bg-[#ffca28] border-[#f59e0b] text-slate-900 scale-105 shadow-xl' : 'bg-[#1e40af] border-white/5 text-white/40 hover:bg-[#2563eb]'}`}>৳{s}</button>
                ))}
              </div>

              {/* Battle Button */}
              <button onClick={startFinding} className="w-full py-6 bg-gradient-to-b from-[#ffca28] to-[#f59e0b] rounded-[30px] font-black text-2xl uppercase italic text-[#4a2e00] border-b-[6px] border-[#b45309] active:translate-y-2 active:border-b-0 shadow-2xl transition-all">Battle Now</button>
            </div>
          </div>

          {/* Local Mode Card */}
          <div className="px-6 mb-12">
            <div className="bg-[#7c3aed] rounded-[45px] border-[10px] border-[#6d28d9] shadow-2xl flex flex-col items-center p-8 relative overflow-hidden">
                <h2 className="text-3xl font-black italic uppercase text-white mb-6 drop-shadow-md">Local Board</h2>
                <button onClick={() => setView('LOCAL_SETUP')} className="w-full py-6 bg-white text-[#7c3aed] rounded-[30px] font-black text-2xl uppercase italic border-b-[8px] border-slate-300 active:translate-y-2 shadow-2xl transition-all">Pass & Play</button>
            </div>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center bg-[#020617] p-8 animate-in fade-in">
           <div className="relative w-48 h-48 mb-12">
              <div className="absolute inset-0 border-4 border-yellow-500/20 rounded-full animate-ping"></div>
              <div className="absolute inset-8 border-4 border-yellow-500/60 rounded-full animate-ping [animation-delay:0.4s]"></div>
              <div className="absolute inset-0 flex items-center justify-center"><div className="text-6xl animate-bounce">🎲</div></div>
           </div>
           <h2 className="text-3xl font-black italic uppercase tracking-widest text-white mb-2">Finding Rivals</h2>
           <p className="text-yellow-500 font-bold mb-12 animate-pulse uppercase">Stake: ৳{selectedStake}</p>
           <div className="flex gap-4 mb-12">
              {foundPlayers.map((p, i) => (
                <div key={i} className="flex flex-col items-center animate-in zoom-in">
                   <div className="w-16 h-16 rounded-2xl border-2 border-yellow-500 overflow-hidden bg-slate-800 shadow-xl"><img src={p.avatar} className="w-full h-full object-cover" /></div>
                   <span className="text-[8px] font-bold mt-2 uppercase text-white/60">{p.name}</span>
                </div>
              ))}
              {[...Array(Math.max(0, playerCount - foundPlayers.length))].map((_, i) => (
                <div key={`empty-${i}`} className="w-16 h-16 rounded-2xl border-2 border-white/5 bg-white/5 flex items-center justify-center opacity-40"><span className="text-xs animate-pulse">?</span></div>
              ))}
           </div>
           <button onClick={() => { if (findingInterval.current) clearInterval(findingInterval.current); setView('LOBBY'); }} className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all">Cancel Matchmaking</button>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col p-4 relative animate-in fade-in overflow-hidden">
          {/* Match Header */}
          <div className="absolute top-6 left-6 z-[110] flex items-center gap-4">
            <button onClick={() => setShowExitWarning(true)} className="bg-red-600 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-2xl border-2 border-white/20 active:scale-90 transition-transform">✕</button>
            <div className="flex flex-col">
              <span className="bg-black/40 backdrop-blur-xl px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 shadow-lg">
                {isLocalMode ? 'Local Pass & Play' : `Global Arena • ৳${selectedStake}`}
              </span>
              {!isLocalMode && <span className="text-[10px] font-black text-yellow-400 mt-1 uppercase tracking-widest">Prize: ৳{selectedStake * playerCount}</span>}
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-2 mt-24 mb-24">
            <div className="w-full max-w-[620px] aspect-square relative">
              <LudoBoard players={gameState.players} onTokenClick={moveToken} validTokens={gameState.isDiceRolled && !isMoving ? gameState.players[gameState.currentPlayerIndex].tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56)).map(t => t.id) : []} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} />
              {gameState.players.map((p, i) => (
                <PlayerProfileOverlay key={p.id} player={p} isActive={gameState.currentPlayerIndex === i} position={gameState.players.length === 2 ? (i === 0 ? 'TL' : 'BR') : (['TL', 'TR', 'BR', 'BL'] as any)[i]} diceValue={gameState.diceValue} isRolling={isRolling} onDiceRoll={rollDice} isDiceRolled={gameState.isDiceRolled} />
              ))}
            </div>
          </div>
          
          <div className="fixed bottom-10 left-0 right-0 flex justify-center px-8 z-[100]">
            <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 p-4 rounded-[30px] w-full max-w-[500px] h-16 flex items-center gap-4 shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden shrink-0">
               <div className="bg-sky-500 w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 shadow-lg animate-pulse">🎙️</div>
               <p className="text-xs font-black text-white/90 italic animate-in slide-in-from-right-full duration-1000 leading-snug truncate">{commentary}</p>
            </div>
          </div>

          {showExitWarning && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6 animate-in zoom-in-95">
               <div className="bg-slate-900 border-2 border-red-500 rounded-[50px] p-10 max-w-sm w-full text-center shadow-[0_0_60px_rgba(239,68,68,0.3)]">
                  <h3 className="text-2xl font-black uppercase text-white mb-4 tracking-tighter">Exit Match?</h3>
                  <p className="text-sm text-white/50 mb-10 font-bold leading-relaxed uppercase">{isLocalMode ? "মাঝপথে গেম ছেড়ে দিলে কোনো প্রগ্রেস সেভ হবে না।" : `এখন বের হলে আপনার ৳${selectedStake} লস হবে।`}</p>
                  <div className="flex flex-col gap-4">
                     <button onClick={() => setShowExitWarning(false)} className="w-full bg-green-500 text-black py-5 rounded-3xl font-black uppercase text-sm shadow-xl transition-all">Keep Playing</button>
                     <button onClick={() => { setShowExitWarning(false); setView('LOBBY'); }} className="w-full bg-white/5 border border-white/10 text-white/30 py-4 rounded-3xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">Yes, Quit</button>
                  </div>
               </div>
            </div>
          )}

          {gameState.winner && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
              <div className="bg-indigo-900 p-16 rounded-[70px] border-[6px] border-yellow-400 shadow-[0_0_80px_rgba(251,191,36,0.5)] text-center w-full max-w-md relative overflow-hidden">
                <h2 className="text-6xl font-black italic uppercase text-yellow-400 mb-4 drop-shadow-2xl">VICTORY!</h2>
                <p className="text-white font-black text-2xl uppercase mb-10 tracking-widest">{gameState.players.find(p => p.color === gameState.winner)?.name} Won</p>
                <button onClick={() => setView('LOBBY')} className="w-full bg-white text-indigo-900 py-6 rounded-[35px] font-black uppercase text-lg shadow-2xl active:translate-y-2 transition-all">Back to Lobby</button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {isWalletOpen && user && <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={async (tx) => { const res = await databaseService.createTransaction(tx); if (res.success) { alert("Request submitted!"); setWalletOpen(false); } else alert("Failed."); }} />}
      {view === 'ADMIN' && user && <AdminPortal user={user} allUsers={allUsers} onUpdateUsersDB={setAllUsers} pendingTransactions={pendingTransactions} liveMatches={liveMatches} onUpdateUser={(u) => setAllUsers(allUsers.map(usr => usr.phone === u.phone ? u : usr))} onApproveTransaction={async (tx) => { const target = allUsers.find(u => u.phone === tx.userPhone); if (target) { const updated = { ...target, balance: target.balance + tx.amount }; await databaseService.updateUser(updated); await databaseService.updateTransactionStatus(tx.id, 'APPROVED'); setAllUsers(allUsers.map(u => u.phone === updated.phone ? updated : u)); setPendingTransactions(pendingTransactions.filter(p => p.id !== tx.id)); alert("Approved!"); } }} onRejectTransaction={async (txId) => { await databaseService.updateTransactionStatus(txId, 'REJECTED'); setPendingTransactions(pendingTransactions.filter(p => p.id !== txId)); }} onExit={() => setView('LOBBY')} onRefreshData={async () => { const [users, txs] = await Promise.all([databaseService.getUsers(), databaseService.getPendingTransactions()]); setAllUsers(users); setPendingTransactions(txs); }} />}
    </div>
  );
};

export default App;
