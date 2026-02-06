
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity, calculateBestBotMove } from './services/botService';
import { generateGameCommentary } from './services/geminiService';
import { SAFE_SPOTS, START_POSITIONS } from './constants';

const Dice3D: React.FC<{ value: number | null, isRolling: boolean, onClick?: () => void, disabled?: boolean }> = ({ value, isRolling, onClick, disabled }) => {
  return (
    <div 
      className={`dice-scene transition-all duration-300 ${!disabled && !isRolling ? 'dice-glow cursor-pointer' : ''}`} 
      onClick={!disabled && !isRolling ? onClick : undefined}
    >
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

const PlayerPanel: React.FC<{ player: Player, isActive: boolean, diceValue: number | null, isRolling: boolean, onRoll: () => void, isDiceRolled: boolean }> = ({ player, isActive, diceValue, isRolling, onRoll, isDiceRolled }) => {
  return (
    <div className={`flex flex-col items-center transition-all duration-500 ${isActive ? 'scale-105 z-20' : 'opacity-60 scale-90'}`}>
      <div 
        className={`flex items-center gap-4 p-2.5 rounded-[28px] border-2 backdrop-blur-md transition-all duration-300 ${isActive ? 'bg-white/15 border-white/40 shadow-[0_10px_30px_rgba(255,255,255,0.1)]' : 'bg-black/40 border-white/5'}`}
      >
        <div className={`relative p-1 rounded-2xl border-2 bg-slate-800 shadow-inner ${isActive ? 'border-yellow-400' : 'border-white/10'}`}>
          <img src={player.avatarUrl} className="w-14 h-14 rounded-xl object-cover" alt={player.name} />
          {isActive && !isDiceRolled && !isRolling && (
             <div className="absolute -top-1 -right-1 flex h-4 w-4">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
             </div>
          )}
        </div>
        <div className={`flex items-center justify-center min-w-[70px] transition-all ${isActive ? 'opacity-100' : 'opacity-20'}`}>
          <Dice3D value={diceValue} isRolling={isRolling} onClick={onRoll} disabled={!isActive || isDiceRolled} />
        </div>
      </div>
      <div className={`mt-3 px-5 py-1.5 rounded-full border border-white/10 bg-black/80 backdrop-blur-md shadow-xl transition-colors ${isActive ? 'border-yellow-400/50 ring-2 ring-yellow-400/10' : ''}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${isActive ? 'text-yellow-400' : 'text-white/40'}`}>{player.name}</p>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, onLogout: () => void }> = ({ isOpen, onClose, onLogout }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in">
      <div className="bg-[#1e293b] border border-white/10 p-10 rounded-[45px] w-full max-w-xs text-center shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-white mb-10 tracking-tighter">Settings</h2>
        <div className="space-y-4">
           <button onClick={() => { soundManager.toggleMute(); onClose(); }} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3">
             {soundManager.isMuted() ? '🔇 Unmute Sound' : '🔊 Mute Sound'}
           </button>
           <button 
             onClick={() => {
               soundManager.play('click');
               onLogout();
             }} 
             className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-600/20 active:scale-95 transition-all"
           >
             Logout
           </button>
           <button onClick={onClose} className="w-full mt-4 py-2 text-white/20 font-black uppercase text-[10px] tracking-widest">Close Menu</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'FINDING' | 'LOCAL_SETUP' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  
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
  const [findingTimer, setFindingTimer] = useState(6);
  const [foundPlayers, setFoundPlayers] = useState<any[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [commentary, setCommentary] = useState<string>("Welcome to the Ludo Arena! 🎲");
  const [adminTapCount, setAdminTapCount] = useState(0);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const refreshAdminData = useCallback(async () => {
    try {
      const [users, txs] = await Promise.all([
        databaseService.getUsers(),
        databaseService.getPendingTransactions()
      ]);
      setAllUsers(users);
      setPendingTransactions(txs);
    } catch (e) {
      console.error("Failed to refresh admin data", e);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('LUDO_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = await databaseService.getUserByPhone(parsed.phone);
        if (fresh && !fresh.isBlocked) {
          setUser(fresh);
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
    const interval = setInterval(() => setLoadingProgress(p => (p < 100 ? p + 4 : 100)), 30);
    return () => clearInterval(interval);
  }, []);

  // Handle auto-refresh when entering admin view
  useEffect(() => {
    if (view === 'ADMIN') {
      refreshAdminData();
    }
  }, [view, refreshAdminData]);

  const nextTurn = useCallback(() => {
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

  // Bot Logic
  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner && !isMoving && !isRolling) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.isBot) {
        const timer = setTimeout(() => {
          if (!gameState.isDiceRolled) {
            rollDice();
          } else {
            const val = gameState.diceValue!;
            const validTokens = currentPlayer.tokens.filter(t => 
              t.state !== TokenState.WIN && 
              (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56)
            );
            
            if (validTokens.length > 0) {
              const bestToken = calculateBestBotMove(validTokens, val, gameState.players, gameState.currentPlayerIndex);
              moveToken(bestToken);
            } else {
              setTimeout(() => nextTurn(), 800);
            }
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [view, gameState, isMoving, isRolling]);

  const rollDice = () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    setIsRolling(true);
    soundManager.play('dice');
    
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');
      
      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        
        if (val === 6 && prev.consecutiveSixes >= 2) {
           addCommentary("Triple Sixes! Turn Skipped.", player.name);
           setTimeout(() => nextTurn(), 1000);
           return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0 };
        }

        const canMove = player.tokens.some(t => 
          t.state !== TokenState.WIN && 
          (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56)
        );
        
        if (!canMove) {
          addCommentary("No moves available!", player.name);
          if (!player.isBot) {
            setTimeout(() => nextTurn(), 1500);
          }
        }
        
        if (val === 6) soundManager.play('six');
        return { 
          ...prev, 
          diceValue: val, 
          isDiceRolled: true, 
          consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 
        };
      });
    }, 600);
  };

  const moveToken = async (tokenData: Token) => {
    if (!gameState || !gameState.isDiceRolled || isMoving || gameState.winner) return;
    setIsMoving(true);
    
    const players = [...gameState.players];
    const playerIdx = gameState.currentPlayerIndex;
    const player = players[playerIdx];
    const tIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    const val = gameState.diceValue!;

    let killed = false;
    let reachedHome = false;

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
        await new Promise(r => setTimeout(r, 120));
      }
    }

    if (player.tokens[tIdx].distanceTraveled === 56) {
      player.tokens[tIdx].state = TokenState.WIN;
      soundManager.play('win');
      reachedHome = true;
    } else {
      const targetPos = (player.tokens[tIdx].distanceTraveled + START_POSITIONS[player.color]) % 52;
      if (!SAFE_SPOTS.includes(targetPos)) {
        players.forEach((otherP, otherPIdx) => {
          if (otherPIdx === playerIdx) return;
          otherP.tokens.forEach((otherT, otherTIdx) => {
            if (otherT.state === TokenState.PATH) {
              const otherAbsPos = (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52;
              if (otherAbsPos === targetPos) {
                otherP.tokens[otherTIdx].state = TokenState.HOME;
                otherP.tokens[otherTIdx].distanceTraveled = 0;
                soundManager.play('kill');
                killed = true;
              }
            }
          });
        });
      }
    }

    const won = player.tokens.every(t => t.state === TokenState.WIN);
    if (won) {
      setGameState(p => p ? { ...p, winner: player.color } : null);
      if (!isLocalMode && user) {
        const prize = selectedStake * (gameState.players.length - 0.2);
        databaseService.updateUser({ ...user, balance: user.balance + prize });
      }
    } else {
      const getExtra = val === 6 || killed || reachedHome;
      setTimeout(() => {
        setGameState(p => p ? { 
          ...p, isDiceRolled: false, diceValue: null, 
          currentPlayerIndex: getExtra ? p.currentPlayerIndex : (p.currentPlayerIndex + 1) % p.players.length,
          consecutiveSixes: getExtra && val === 6 ? p.consecutiveSixes : 0
        } : null);
        setIsMoving(false);
      }, 500);
    }
  };

  const handleAuth = async () => {
    if (!phone || !password) {
      setAuthError('Required information missing.');
      return;
    }
    setIsAuthLoading(true); setAuthError('');
    try {
      const normalized = phone.replace(/\D/g, '').slice(-10);
      const existing = await databaseService.getUserByPhone(normalized);
      if (isSignUp) {
        if (existing) {
          setAuthError('Phone already registered.');
          return;
        }
        const newUser: UserProfile = { 
          name: name || 'Player', 
          phone: normalized, 
          password, 
          balance: 0, 
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalized}`, 
          stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, 
          history: [] 
        };
        await databaseService.updateUser(newUser); 
        setUser(newUser);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser)); 
        setView('LOBBY');
      } else {
        if (!existing || existing.password !== password) {
          setAuthError('Invalid phone or password.');
        } else { 
          setUser(existing); 
          localStorage.setItem('LUDO_SESSION', JSON.stringify(existing)); 
          setView('LOBBY'); 
        }
      }
    } finally { setIsAuthLoading(false); }
  };

  const startFinding = () => {
    if (!user || user.balance < selectedStake) return alert("Insufficient balance.");
    setIsLocalMode(false);
    setView('FINDING');
    setFindingTimer(6);
    setFoundPlayers([{ name: user.name, avatar: user.avatar }]);
    const interval = setInterval(() => {
      setFindingTimer(t => {
        if (t <= 1) { clearInterval(interval); prepareGame(false); return 0; }
        if (t === 4 || t === 2) {
          const bot = getRandomBotIdentity();
          setFoundPlayers(p => [...p, { name: bot.name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}` }]);
        }
        return t - 1;
      });
    }, 1000);
  };

  const prepareGame = (local: boolean) => {
    const activeCount = local ? localPlayerCount : playerCount;
    const colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    const players: Player[] = [];
    
    for (let i = 0; i < activeCount; i++) {
      const color = activeCount === 2 ? (i === 0 ? PlayerColor.RED : PlayerColor.YELLOW) : colors[i];
      if (local) {
        players.push({ 
          id: `l-${i}`, name: localPlayerNames[i], country: 'BD', flag: '🇧🇩', color, 
          isBot: false, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Local${i}`, tokens: [] 
        });
      } else {
        if (i === 0) {
          players.push({ id: 'user', name: user!.name, country: 'BD', flag: '🇧🇩', color: PlayerColor.RED, isBot: false, avatarUrl: user!.avatar, tokens: [] });
          databaseService.updateUser({ ...user!, balance: user!.balance - selectedStake });
        } else {
          const bot = getRandomBotIdentity();
          players.push({ id: `bot-${i}`, name: bot.name, country: bot.country, flag: bot.flag, isBot: true, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}`, color, tokens: [] });
        }
      }
    }

    setGameState({
      players: players.map((p, i) => ({ ...p, tokens: [0, 1, 2, 3].map(tid => ({ id: (i * 4) + tid, color: p.color, state: TokenState.HOME, position: 0, distanceTraveled: 0 })) })),
      currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Started', consecutiveSixes: 0
    });
    setView('GAME');
    addCommentary(local ? "Local game started!" : `Battle for ৳${selectedStake} started!`, "Arena");
  };

  const addCommentary = async (evt: string, name: string) => {
    const text = await generateGameCommentary(evt, name);
    setCommentary(text);
  };

  const handleLogout = () => {
    localStorage.removeItem('LUDO_SESSION');
    setUser(null);
    setView('LOGIN');
    setSettingsOpen(false);
  };

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden bg-[#020617] text-white">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 onClick={() => setAdminTapCount(c => c + 1)} className="ludo-money-logo text-7xl mb-12 select-none tracking-tighter cursor-pointer">LUDO MONEY</h1>
          <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
          </div>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 to-indigo-950">
          <div className="bg-[#1c212e]/90 backdrop-blur-3xl p-10 rounded-[50px] w-full max-sm:max-w-xs border border-white/10 shadow-[0_25px_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500">
            <h1 onClick={() => setAdminTapCount(c => c + 1)} className="ludo-money-logo text-5xl mb-12 uppercase text-center tracking-tighter italic cursor-pointer">{isSignUp ? 'SIGNUP' : 'LUDO MONEY'}</h1>
            {authError && <p className="text-red-500 text-[10px] text-center mb-6 font-black uppercase tracking-widest bg-red-500/10 p-2 rounded-lg">{authError}</p>}
            <div className="space-y-4 mb-8">
              {isSignUp && <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-sm font-bold focus:border-yellow-400/50 transition-all" />}
              <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-sm font-bold focus:border-yellow-400/50 transition-all" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-sm font-bold focus:border-yellow-400/50 transition-all" />
            </div>
            <button onClick={handleAuth} disabled={isAuthLoading} className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 text-black py-5 rounded-2xl font-black uppercase shadow-xl active:translate-y-1 transition-all">
               {isAuthLoading ? 'PLEASE WAIT...' : 'ENTER ARENA'}
            </button>
            <button onClick={() => { soundManager.play('click'); setIsSignUp(!isSignUp); }} className="w-full mt-6 text-white/30 text-[10px] uppercase font-black tracking-[0.2em] hover:text-white transition-colors">{isSignUp ? 'Already a Member? Login' : 'New Player? Create Account'}</button>
          </div>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col animate-in fade-in overflow-y-auto no-scrollbar pb-24">
          <div className="flex justify-between items-center p-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl border-2 border-yellow-400 bg-slate-800 overflow-hidden shadow-lg shadow-yellow-400/10"><img src={user.avatar} className="w-full h-full object-cover" /></div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tighter">{user.name}</h3>
                <p className="text-[10px] text-yellow-400/50 font-bold uppercase tracking-widest">Global Rank #242</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { soundManager.play('click'); setWalletOpen(true); }} className="bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
                <span className="text-sm font-black text-yellow-400">৳{Math.floor(user.balance).toLocaleString()}</span>
                <span className="w-5 h-5 bg-yellow-400 text-black rounded-full flex items-center justify-center text-[10px] font-black">+</span>
              </button>
              <button onClick={() => { soundManager.play('click'); setSettingsOpen(true); }} className="bg-white/5 border border-white/10 p-3 rounded-full text-xl hover:bg-white/10 transition-colors">⚙️</button>
            </div>
          </div>

          <div className="px-6 mt-8 space-y-8">
            <div className="bg-[#2b64f3] rounded-[50px] border-[12px] border-[#1e4ccf] p-10 flex flex-col items-center shadow-2xl relative overflow-hidden group">
              <div className="bg-[#1e40af] p-1.5 rounded-full flex w-full max-w-[200px] mb-8 shadow-inner">
                <button onClick={() => { soundManager.play('click'); setPlayerCount(2); }} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-yellow-400 text-black shadow-lg' : 'text-white/40'}`}>2 Player</button>
                <button onClick={() => { soundManager.play('click'); setPlayerCount(4); }} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-yellow-400 text-black shadow-lg' : 'text-white/40'}`}>4 Player</button>
              </div>
              <h2 className="text-5xl font-black italic uppercase text-white mb-8 tracking-tighter drop-shadow-xl">Global Arena</h2>
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                {[50, 100, 500, 1000].map(s => (
                  <button key={s} onClick={() => { soundManager.play('click'); setSelectedStake(s); }} className={`px-5 py-3 rounded-2xl text-xs font-black border-2 transition-all ${selectedStake === s ? 'bg-yellow-400 border-yellow-300 text-black scale-110 shadow-xl' : 'bg-[#1e40af] border-transparent text-white/40 hover:bg-white/5'}`}>৳{s}</button>
                ))}
              </div>
              <button onClick={startFinding} className="w-full py-6 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[30px] font-black text-2xl uppercase italic text-black border-b-[6px] border-amber-950 active:translate-y-2 active:border-b-0 shadow-2xl transition-all">Battle Now</button>
            </div>

            <div className="bg-purple-700 rounded-[50px] border-[12px] border-purple-800 p-10 flex flex-col items-center shadow-2xl">
              <h2 className="text-3xl font-black italic uppercase text-white mb-8">Local Pass</h2>
              <button onClick={() => { soundManager.play('click'); setView('LOCAL_SETUP'); }} className="w-full py-5 bg-white text-purple-700 rounded-[30px] font-black text-xl uppercase italic shadow-xl border-b-[6px] border-slate-300 active:translate-y-2 transition-all">Play Friends</button>
            </div>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in bg-[#020617]">
           <div className="relative w-48 h-48 mb-16">
              <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full animate-ping"></div>
              <div className="absolute inset-4 border-4 border-yellow-400/40 rounded-full animate-ping [animation-delay:0.3s]"></div>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-7xl animate-bounce">🎲</span></div>
           </div>
           <h2 className="text-3xl font-black italic uppercase tracking-[0.2em] mb-4">Finding Rivals</h2>
           <p className="text-yellow-400 font-bold uppercase text-xs mb-12 tracking-widest animate-pulse">Arena Stake: ৳{selectedStake}</p>
           <div className="flex gap-4 mb-16">
              {foundPlayers.map((p, i) => (
                <div key={i} className="flex flex-col items-center animate-in zoom-in">
                   <img src={p.avatar} className="w-16 h-16 rounded-2xl border-2 border-yellow-400 bg-slate-800 shadow-xl" />
                   <span className="text-[10px] mt-2 font-bold uppercase text-white/60">{p.name}</span>
                </div>
              ))}
              {[...Array(Math.max(0, playerCount - foundPlayers.length))].map((_, i) => (
                <div key={i} className="w-16 h-16 rounded-2xl border-2 border-white/5 bg-white/5 flex items-center justify-center text-white/20 animate-pulse font-black">?</div>
              ))}
           </div>
           <button onClick={() => setView('LOBBY')} className="px-10 py-4 rounded-full border border-white/10 text-white/30 font-black uppercase text-xs hover:text-white transition-all">Cancel Match</button>
        </div>
      )}

      {view === 'LOCAL_SETUP' && (
        <div className="h-full flex flex-col bg-[#e6dbbf] animate-in slide-in-from-right duration-300">
           <div className="bg-[#2b64f3] p-6 flex items-center justify-between shadow-lg shrink-0">
              <button onClick={() => setView('LOBBY')} className="w-10 h-10 bg-[#fbbf24] rounded-full border-2 border-white flex items-center justify-center shadow-md active:scale-90 transition-transform">
                 <span className="text-black text-xl font-bold">◀</span>
              </button>
              <h2 className="text-4xl font-black uppercase text-white tracking-tight drop-shadow-md italic">Local</h2>
              <div className="w-10"></div>
           </div>
           <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto no-scrollbar">
              <div className="flex gap-1 bg-[#8d6e3c] p-1 rounded-2xl shadow-inner">
                 {[2, 3, 4].map(num => (
                   <button 
                     key={num} 
                     onClick={() => setLocalPlayerCount(num as any)}
                     className={`relative flex-1 py-4 rounded-xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${localPlayerCount === num ? 'bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] text-[#78350f] shadow-lg' : 'text-white/40'}`}
                   >
                     {num} Players
                   </button>
                 ))}
              </div>
              <div className="flex flex-col gap-6">
                 {[
                   { color: PlayerColor.RED, label: 'Player 1' },
                   { color: PlayerColor.GREEN, label: 'Player 2' },
                   { color: PlayerColor.YELLOW, label: 'Player 3' },
                   { color: PlayerColor.BLUE, label: 'Player 4' }
                 ].map((p, i) => {
                    const isDisabled = i >= localPlayerCount;
                    return (
                      <div key={p.color} className={`flex items-center gap-6 transition-all duration-300 ${isDisabled ? 'opacity-30 grayscale' : ''}`}>
                         <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-black/5 rounded-full blur-sm"></div>
                            <svg viewBox="0 0 100 100" className={`w-12 h-12 drop-shadow-lg ${isDisabled ? 'fill-gray-600' : p.color === PlayerColor.RED ? 'fill-red-500' : p.color === PlayerColor.YELLOW ? 'fill-yellow-400' : p.color === PlayerColor.GREEN ? 'fill-green-500' : 'fill-blue-500'}`}>
                               <path d="M50 10 C40 10 35 20 35 30 C35 38 42 45 45 50 L30 85 L70 85 L55 50 C58 45 65 38 65 30 C65 20 60 10 50 10 Z" />
                               <ellipse cx="50" cy="85" rx="25" ry="8" />
                            </svg>
                         </div>
                         <div className="flex-1 bg-white border-2 border-[#d4d4d8] rounded-2xl p-1 shadow-md flex items-center pr-4">
                            <input 
                              type="text" 
                              disabled={isDisabled}
                              value={localPlayerNames[i]} 
                              onChange={(e) => {
                                 const newNames = [...localPlayerNames];
                                 newNames[i] = e.target.value.slice(0, 15);
                                 setLocalPlayerNames(newNames);
                              }}
                              className="w-full bg-transparent px-5 py-4 font-black text-slate-800 outline-none text-lg"
                            />
                         </div>
                      </div>
                    );
                 })}
              </div>
              <div className="mt-auto pt-8">
                 <button onClick={() => { soundManager.play('click'); setIsLocalMode(true); prepareGame(true); }} className="w-full py-6 bg-gradient-to-b from-[#4ade80] to-[#16a34a] text-white rounded-[30px] font-black text-4xl uppercase italic shadow-[0_10px_0_#14532d] active:translate-y-2 active:shadow-[0_4px_0_#14532d] transition-all tracking-tighter">Start</button>
              </div>
           </div>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col relative animate-in fade-in p-2 select-none overflow-hidden bg-slate-950">
          <div className="absolute top-6 left-6 z-[100] flex items-center gap-4">
            <button 
              onClick={() => { soundManager.play('click'); setShowExitWarning(true); }} 
              className="bg-red-600 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg shadow-red-600/20 border-2 border-white/20 active:scale-90 transition-all text-white"
            >
              ✕
            </button>
            <span className="bg-white/5 backdrop-blur-md px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 text-yellow-400">
                {isLocalMode ? 'LOCAL MODE' : `ARENA • ৳${selectedStake}`}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center mt-12 mb-24">
             <div className="w-full max-w-[580px] aspect-square relative scale-[0.85] sm:scale-100 transition-transform">
                <LudoBoard 
                  players={gameState.players} 
                  onTokenClick={moveToken} 
                  validTokens={gameState.isDiceRolled && !isMoving ? gameState.players[gameState.currentPlayerIndex].tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56)).map(t => t.id) : []} 
                  currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} 
                />
                
                {gameState.players.map((p, i) => {
                  const isActive = gameState.currentPlayerIndex === i;
                  let posClass = ["top-[-120px] left-0", "top-[-120px] right-0", "bottom-[-120px] right-0", "bottom-[-120px] left-0"][i];
                  if (gameState.players.length === 2 && i === 1) posClass = "bottom-[-120px] right-0";
                  
                  return (
                    <div key={p.id} className={`absolute ${posClass}`}>
                       <PlayerPanel player={p} isActive={isActive} diceValue={gameState.diceValue} isRolling={isRolling} onRoll={rollDice} isDiceRolled={gameState.isDiceRolled} />
                    </div>
                  );
                })}
             </div>
          </div>

          <div className="fixed bottom-8 left-0 right-0 flex justify-center px-10 z-[150]">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-5 rounded-[40px] w-full max-w-sm h-14 flex items-center gap-4 shadow-2xl">
               <span className="text-xl">🎙️</span>
               <p className="text-[10px] font-black italic text-white/90 truncate uppercase tracking-widest leading-none">{commentary}</p>
            </div>
          </div>

          {showExitWarning && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in">
              <div className="bg-slate-900 p-10 rounded-[40px] border border-white/10 w-full max-w-xs text-center shadow-2xl">
                <h3 className="text-2xl font-black uppercase text-white mb-6 italic tracking-tight">Exit Game?</h3>
                <p className="text-white/60 text-sm mb-10 font-bold">Your progress will be lost. Are you sure?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { soundManager.play('click'); setView('LOBBY'); setShowExitWarning(false); setGameState(null); }} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase">Confirm Exit</button>
                  <button onClick={() => { soundManager.play('click'); setShowExitWarning(false); }} className="w-full bg-white/5 text-white/40 py-4 rounded-2xl font-black uppercase">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isWalletOpen && user && <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={async (tx) => { await databaseService.createTransaction(tx); setWalletOpen(false); alert("Request Sent!"); }} />}
      {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} onLogout={handleLogout} />}
      
      {adminTapCount >= 7 && (
        <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center p-8">
          <div className="bg-slate-900 p-10 rounded-[40px] w-full max-w-sm border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95">
            <h2 className="text-3xl font-black uppercase italic text-sky-400 mb-10 text-center">Admin Access</h2>
            <div className="space-y-6 mb-10">
              <input type="text" placeholder="ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-white/5 p-5 rounded-2xl outline-none border border-white/10 focus:border-sky-500 transition-all" />
              <input type="password" placeholder="Pass" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-white/5 p-5 rounded-2xl outline-none border border-white/10 focus:border-sky-500 transition-all" />
            </div>
            <button onClick={() => { if (adminId === 'emukhan580' && adminPass === 'Imran2015@!@!') { refreshAdminData().then(() => setView('ADMIN')); setAdminTapCount(0); } else alert('Denied'); }} className="w-full bg-sky-500 py-5 rounded-2xl font-black uppercase text-xl shadow-lg active:scale-95 transition-all">LOGIN ADMIN</button>
            <button onClick={() => setAdminTapCount(0)} className="w-full mt-4 text-[10px] font-bold text-white/20 uppercase tracking-widest text-center">Cancel</button>
          </div>
        </div>
      )}
      {view === 'ADMIN' && user && <AdminPortal user={user} allUsers={allUsers} onUpdateUsersDB={setAllUsers} pendingTransactions={pendingTransactions} liveMatches={[]} onUpdateUser={(u) => setAllUsers(allUsers.map(usr => usr.phone === u.phone ? u : usr))} onApproveTransaction={async (tx) => { const target = allUsers.find(u => u.phone === tx.userPhone); if (target) { const updated = { ...target, balance: target.balance + tx.amount }; await databaseService.updateUser(updated); await databaseService.updateTransactionStatus(tx.id, 'APPROVED'); setAllUsers(allUsers.map(u => u.phone === updated.phone ? updated : u)); setPendingTransactions(prev => prev.filter(p => p.id !== tx.id)); alert("Approved!"); } }} onRejectTransaction={async (txId) => { await databaseService.updateTransactionStatus(txId, 'REJECTED'); setPendingTransactions(prev => prev.filter(p => p.id !== txId)); }} onExit={() => setView('LOBBY')} onRefreshData={refreshAdminData} />}
    </div>
  );
};

export default App;
