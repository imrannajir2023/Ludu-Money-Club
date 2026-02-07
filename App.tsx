
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, CurrencyCode } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity, calculateBestBotMove } from './services/botService';
import { generateGameCommentary } from './services/geminiService';
import { SAFE_SPOTS, START_POSITIONS, CURRENCY_CONFIG, COLORS } from './constants';

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
  const [currency, setCurrency] = useState<CurrencyCode>('BDT');
  
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
  
  // Admin Secrets
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const formatBalance = (bal: number) => {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT'];
    const converted = bal / config.rate;
    return `${config.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: currency === 'BDT' ? 0 : 2, maximumFractionDigits: 2 })}`;
  };

  const getStakesByCurrency = () => {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT'];
    if (currency === 'BDT') return [50, 100, 500, 1000];
    if (currency === 'USD') return [1, 5, 10, 50];
    if (currency === 'INR') return [50, 100, 500, 1000];
    return [50, 100, 500, 1000];
  };

  const updateCurrency = async (newCurr: CurrencyCode) => {
    soundManager.play('click');
    setCurrency(newCurr);
    
    // Update selected stake to first valid stake of new currency to avoid sync issues
    const stakes = newCurr === 'USD' ? [1, 5, 10, 50] : [50, 100, 500, 1000];
    setSelectedStake(stakes[0]);
    
    // Persist to DB for the user
    if (user) {
      const updated = { ...user, preferredCurrency: newCurr };
      setUser(updated);
      await databaseService.updateUser(updated);
    }
  };

  const detectAutoCurrency = async (): Promise<{ code: CurrencyCode, country: string }> => {
    try {
      const resp = await fetch('https://ipapi.co/json/');
      const data = await resp.json();
      if (data.country_code === 'BD') return { code: 'BDT', country: 'Bangladesh' };
      if (data.country_code === 'IN') return { code: 'INR', country: 'India' };
      return { code: 'USD', country: data.country_name || 'Global' };
    } catch (e) {
      console.warn("Currency detection failed, defaulting to USD");
      return { code: 'USD', country: 'Global' };
    }
  };

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

  // Admin Auto-Refresh Interval
  useEffect(() => {
    let interval: any;
    if (view === 'ADMIN') {
      refreshAdminData();
      interval = setInterval(refreshAdminData, 30000); // 30 sec auto refresh
    }
    return () => interval && clearInterval(interval);
  }, [view, refreshAdminData]);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('LUDO_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = await databaseService.getUserByPhone(parsed.phone);
        if (fresh && !fresh.isBlocked) {
          setUser(fresh);
          if (fresh.preferredCurrency && CURRENCY_CONFIG[fresh.preferredCurrency]) {
            setCurrency(fresh.preferredCurrency);
          }
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
    const progressInterval = setInterval(() => setLoadingProgress(p => (p < 100 ? p + 4 : 100)), 30);
    return () => clearInterval(progressInterval);
  }, []);

  // Admin tap logic
  useEffect(() => {
    if (adminTapCount >= 7) {
      setShowAdminLogin(true);
      setAdminTapCount(0);
    }
  }, [adminTapCount]);

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
      
      if (player.tokens[tIdx].distanceTraveled <= 50 && !SAFE_SPOTS.includes(targetPos)) {
        players.forEach((otherP, otherPIdx) => {
          if (otherPIdx === playerIdx) return;
          otherP.tokens.forEach((otherT, otherTIdx) => {
            if (otherT.state === TokenState.PATH && otherT.distanceTraveled <= 50) {
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
        const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT'];
        
        // Calculate commission in the original currency
        const commissionInOriginal = (selectedStake * gameState.players.length) * 0.05;
        const prizeInOriginal = (selectedStake * gameState.players.length) - commissionInOriginal;
        
        // Convert prize to base balance (BDT) for user storage
        const prizeInBase = prizeInOriginal * config.rate;
        const updatedUser = { ...user, balance: user.balance + prizeInBase };
        
        databaseService.updateUser(updatedUser);
        // Track commission specifically for the currency used
        databaseService.addCommission(commissionInOriginal, currency);
        setUser(updatedUser);
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
      setAuthError('সব তথ্য পূরণ করুন।');
      return;
    }
    setIsAuthLoading(true); setAuthError('');
    try {
      const normalized = phone.replace(/\D/g, '').slice(-10);
      const existing = await databaseService.getUserByPhone(normalized);
      
      const { code: autoCurrency, country: autoCountry } = await detectAutoCurrency();

      if (isSignUp) {
        if (existing) {
          setAuthError('এই মোবাইল নম্বর দিয়ে অ্যাকাউন্ট খোলা আছে।');
          return;
        }
        const newUser: UserProfile = { 
          name: name || 'Player', 
          phone: normalized, 
          password, 
          balance: 0, 
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalized}`, 
          preferredCurrency: autoCurrency,
          country: autoCountry,
          stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, 
          history: [] 
        };
        await databaseService.updateUser(newUser); 
        setUser(newUser);
        setCurrency(autoCurrency);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser)); 
        setView('LOBBY');
      } else {
        if (!existing || existing.password !== password) {
          setAuthError('ভুল পাসওয়ার্ড বা মোবাইল নম্বর।');
        } else { 
          let finalUser = existing;
          if (!existing.preferredCurrency) {
            finalUser = { ...existing, preferredCurrency: autoCurrency, country: autoCountry };
            await databaseService.updateUser(finalUser);
          }
          setUser(finalUser); 
          setCurrency(finalUser.preferredCurrency || 'USD');
          localStorage.setItem('LUDO_SESSION', JSON.stringify(finalUser)); 
          setView('LOBBY'); 
        }
      }
    } finally { setIsAuthLoading(false); }
  };

  const handleAdminLogin = async () => {
    if (adminId === 'emukhan580' && adminPass === 'Imran2015@!@!') {
      await refreshAdminData();
      setView('ADMIN');
      setShowAdminLogin(false);
      setAdminId('');
      setAdminPass('');
    } else {
      alert('ভুল অ্যাডমিন আইডি অথবা পাসওয়ার্ড।');
    }
  };

  const startFinding = () => {
    const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT'];
    const baseStake = selectedStake * config.rate;
    if (!user || user.balance < baseStake) return alert("ব্যালেন্স নেই, দয়া করে রিচার্জ করুন।");
    
    setIsLocalMode(false);
    setView('FINDING');
    setFindingTimer(6);
    setFoundPlayers([{ name: user.name, avatar: user.avatar }]);
    
    const interval = setInterval(() => {
      setFindingTimer(t => {
        if (t <= 1) { 
          clearInterval(interval); 
          prepareGame(false); 
          return 0; 
        }
        if (playerCount === 2) {
          if (t === 4 && foundPlayers.length < 2) {
            const bot = getRandomBotIdentity();
            setFoundPlayers(p => [...p, { name: bot.name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}` }]);
          }
        } else if (playerCount === 4) {
          if ((t === 5 || t === 3 || t === 2) && foundPlayers.length < 4) {
            const bot = getRandomBotIdentity();
            setFoundPlayers(p => [...p, { name: bot.name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}` }]);
          }
        }
        return t - 1;
      });
    }, 1000);
  };

  const prepareGame = (local: boolean) => {
    const activeCount = local ? localPlayerCount : playerCount;
    const colors = [PlayerColor.BLUE, PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW];
    const players: Player[] = [];
    
    for (let i = 0; i < activeCount; i++) {
      const color = activeCount === 2 ? (i === 0 ? PlayerColor.BLUE : PlayerColor.GREEN) : colors[i];
      if (local) {
        players.push({ 
          id: `l-${i}`, name: localPlayerNames[i] || `Player ${i + 1}`, country: 'BD', flag: '🇧🇩', color, 
          isBot: false, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Local${i}`, tokens: [] 
        });
      } else {
        if (i === 0) {
          const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT'];
          const baseStake = selectedStake * config.rate;
          players.push({ id: 'user', name: user!.name, country: 'BD', flag: '🇧🇩', color, isBot: false, avatarUrl: user!.avatar, tokens: [] });
          const updatedUser = { ...user!, balance: user!.balance - baseStake };
          databaseService.updateUser(updatedUser);
          setUser(updatedUser);
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
    setIsLocalMode(local);
    setView('GAME');
    addCommentary(local ? "Local game started!" : `Battle for ${(CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT']).symbol}${selectedStake} started!`, "Arena");
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

  const onSubmitTransaction = async (tx: PendingTransaction) => {
    if (tx.type === 'WITHDRAW' && user) {
      const config = CURRENCY_CONFIG[tx.currency] || CURRENCY_CONFIG['BDT'];
      const baseAmount = tx.amount * config.rate;
      if (user.balance < baseAmount) {
        alert("আপনার ব্যালেন্স পর্যাপ্ত নয়!");
        return;
      }
      const updatedUser = { ...user, balance: user.balance - baseAmount };
      const updateResult = await databaseService.updateUser(updatedUser);
      if (updateResult.success) setUser(updatedUser);
      else return alert("ব্যালেন্স আপডেট করতে ব্যর্থ হয়েছে।");
    }
    
    const result = await databaseService.createTransaction(tx);
    if (result.success) {
      setWalletOpen(false);
      alert("আপনার অনুরোধটি পাঠানো হয়েছে!");
      if (view === 'ADMIN') refreshAdminData(); 
    } else {
      if (tx.type === 'WITHDRAW' && user) {
        const config = CURRENCY_CONFIG[tx.currency] || CURRENCY_CONFIG['BDT'];
        const baseAmount = tx.amount * config.rate;
        const refundUser = { ...user, balance: user.balance + baseAmount };
        await databaseService.updateUser(refundUser);
        setUser(refundUser);
      }
      alert("লেনদেন সফল হয়নি: " + result.message);
    }
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
        <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[#0f172a] relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="w-full max-sm z-10 flex flex-col items-center">
            <div className="relative mb-10 flex flex-col items-center animate-in zoom-in-95 duration-700">
               <div className="w-32 h-32 bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-wrap p-2 rotate-12 relative">
                  <div className="w-1/2 h-1/2 bg-red-500 rounded-tl-xl rounded-br-sm border-2 border-white"></div>
                  <div className="w-1/2 h-1/2 bg-green-500 rounded-tr-xl rounded-bl-sm border-2 border-white"></div>
                  <div className="w-1/2 h-1/2 bg-blue-500 rounded-bl-xl rounded-tr-sm border-2 border-white"></div>
                  <div className="w-1/2 h-1/2 bg-yellow-400 rounded-br-xl rounded-tl-sm border-2 border-white"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-12 h-12 bg-white rounded-xl shadow-xl border-2 border-slate-200 flex items-center justify-center -rotate-12">
                        <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                     </div>
                  </div>
               </div>
               <h1 onClick={() => setAdminTapCount(c => c + 1)} className="ludo-money-logo text-5xl mt-6 uppercase tracking-tighter italic drop-shadow-lg cursor-pointer">Ludo Money</h1>
            </div>

            <div className="w-full bg-slate-900/80 backdrop-blur-3xl p-8 rounded-[40px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-12 duration-500">
              <div className="flex bg-black/40 p-1.5 rounded-[24px] mb-8 border border-white/5">
                 <button onClick={() => setIsSignUp(false)} className={`flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase transition-all ${!isSignUp ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>লগইন</button>
                 <button onClick={() => setIsSignUp(true)} className={`flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase transition-all ${isSignUp ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>নিবন্ধন</button>
              </div>

              {authError && <div className="text-red-400 text-[10px] text-center mb-6 font-black uppercase tracking-widest bg-red-500/10 p-3 rounded-2xl border border-red-500/20">{authError}</div>}
              
              <div className="space-y-4 mb-10">
                {isSignUp && (
                  <div className="relative group">
                    <input type="text" placeholder="পূর্ণ নাম" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/20 border border-white/10 p-5 pl-14 rounded-3xl outline-none text-sm font-bold text-white placeholder:text-white/20 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 transition-all" />
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30">👤</span>
                  </div>
                )}
                <div className="relative group">
                  <input type="tel" placeholder="মোবাইল নম্বর" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/20 border border-white/10 p-5 pl-14 rounded-3xl outline-none text-sm font-bold text-white placeholder:text-white/20 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 transition-all" />
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30">📱</span>
                </div>
                <div className="relative group">
                  <input type="password" placeholder="পাসওয়ার্ড" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/20 border border-white/10 p-5 pl-14 rounded-3xl outline-none text-sm font-bold text-white placeholder:text-white/20 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 transition-all" />
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30">🔑</span>
                </div>
              </div>

              <button 
                onClick={handleAuth} 
                disabled={isAuthLoading} 
                className="w-full bg-gradient-to-b from-yellow-300 to-amber-600 text-black py-5 rounded-[28px] font-black uppercase tracking-tight shadow-[0_10px_30px_rgba(245,158,11,0.3)] border-b-[6px] border-amber-900 active:translate-y-1 active:border-b-0 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isAuthLoading ? (
                  <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <span>{isSignUp ? 'অ্যাকাউন্ট খুলুন' : 'প্রবেশ করুন'}</span>
                )}
              </button>
            </div>
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
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Global Rank #242</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { soundManager.play('click'); setWalletOpen(true); }} className="bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-white/10 transition-all">
                <span className="text-sm font-black text-yellow-400">{formatBalance(user.balance)}</span>
                <span className="w-5 h-5 bg-yellow-400 text-black rounded-full flex items-center justify-center text-[10px] font-black">+</span>
              </button>
              <button onClick={() => { soundManager.play('click'); setSettingsOpen(true); }} className="bg-white/5 border border-white/10 p-3 rounded-full text-xl hover:bg-white/10 transition-colors">⚙️</button>
            </div>
          </div>

          <div className="px-6 mt-8 space-y-8">
            <div className="bg-[#2b64f3] rounded-[50px] border-[12px] border-[#1e4ccf] p-10 flex flex-col items-center shadow-2xl relative overflow-hidden group">
              {/* Game Mode Toggles */}
              <div className="flex bg-[#1e40af] p-1.5 rounded-full w-full max-w-[200px] mb-4 shadow-inner">
                <button onClick={() => { soundManager.play('click'); setPlayerCount(2); }} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-yellow-400 text-black shadow-lg' : 'text-white/40'}`}>2 Player</button>
                <button onClick={() => { soundManager.play('click'); setPlayerCount(4); }} className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-yellow-400 text-black shadow-lg' : 'text-white/40'}`}>4 Player</button>
              </div>

              {/* Currency Toggles (Golden Premium Style) */}
              <div className="flex bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-1 rounded-full mb-8 border border-amber-600/30 shadow-[0_4px_15px_rgba(245,158,11,0.2)]">
                {(['BDT', 'USD', 'INR'] as CurrencyCode[]).map(c => (
                  <button 
                    key={c} 
                    onClick={() => updateCurrency(c)}
                    className={`px-7 py-2.5 rounded-full text-[10px] font-black uppercase transition-all duration-300 ${currency === c ? 'bg-black/80 text-white shadow-lg scale-105' : 'text-black/40 hover:text-black/60'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <h2 className="text-5xl font-black italic uppercase text-white mb-8 tracking-tighter drop-shadow-xl">Global Arena</h2>
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                {getStakesByCurrency().map(s => (
                  <button key={s} onClick={() => { soundManager.play('click'); setSelectedStake(s); }} className={`px-5 py-3 rounded-2xl text-xs font-black border-2 transition-all ${selectedStake === s ? 'bg-yellow-400 border-yellow-300 text-black scale-110 shadow-xl' : 'bg-[#1e40af] border-transparent text-white/40 hover:bg-white/5'}`}>{(CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT']).symbol}{s}</button>
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

      {view === 'LOCAL_SETUP' && (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-900 to-indigo-950 animate-in fade-in">
           <div className="w-full max-sm bg-black/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[40px] shadow-2xl">
              <h2 className="text-4xl font-black italic uppercase text-white text-center mb-10 tracking-tighter">Match Setup</h2>
              <div className="mb-10">
                 <p className="text-[10px] font-black uppercase text-purple-400 mb-4 tracking-widest text-center">Select Player Count</p>
                 <div className="flex gap-2 p-1.5 bg-black/40 rounded-[28px] border border-white/5">
                    {[2, 3, 4].map(n => (
                      <button 
                        key={n} 
                        onClick={() => { soundManager.play('click'); setLocalPlayerCount(n as any); }} 
                        className={`flex-1 py-4 rounded-[22px] font-black text-lg transition-all ${localPlayerCount === n ? 'bg-purple-500 text-white shadow-lg scale-105' : 'text-white/20'}`}
                      >
                        {n}P
                      </button>
                    ))}
                 </div>
              </div>
              <div className="space-y-4 mb-10 max-h-[240px] overflow-y-auto no-scrollbar pr-1">
                 {[...Array(localPlayerCount)].map((_, i) => (
                    <div key={i} className="relative">
                       <input 
                         type="text" 
                         placeholder={`Player ${i+1} Name`}
                         value={localPlayerNames[i]}
                         onChange={e => {
                            const newNames = [...localPlayerNames];
                            newNames[i] = e.target.value;
                            setLocalPlayerNames(newNames);
                         }}
                         className="w-full bg-white/5 border border-white/10 p-5 pl-14 rounded-3xl outline-none text-sm font-bold text-white focus:border-purple-400/50 transition-all" 
                       />
                       <span className={`absolute left-6 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${[COLORS.RED.base, COLORS.GREEN.base, COLORS.YELLOW.base, COLORS.BLUE.base][i]}`}></span>
                    </div>
                 ))}
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={() => prepareGame(true)} className="w-full py-6 bg-gradient-to-b from-purple-400 to-indigo-600 text-white rounded-[30px] font-black text-2xl uppercase italic border-b-[6px] border-indigo-950 active:translate-y-2 active:border-b-0 shadow-2xl transition-all">Start Game</button>
                 <button onClick={() => setView('LOBBY')} className="w-full py-4 text-white/20 font-black uppercase text-[10px] tracking-widest text-center">Back to Lobby</button>
              </div>
           </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in bg-[#050a18]">
           <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
              <div className="absolute inset-0 border-[2px] border-white/5 rounded-full"></div>
              <div className="bg-white w-16 h-16 rounded-xl shadow-2xl border-2 border-slate-200 flex flex-wrap p-2 rotate-12 relative animate-pulse">
                <div className="w-1/2 h-1/2 bg-white flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                <div className="w-1/2 h-1/2 bg-white flex items-center justify-center"></div>
                <div className="w-1/2 h-1/2 bg-white flex items-center justify-center"></div>
                <div className="w-1/2 h-1/2 bg-white flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 bg-red-600 rounded-full"></div></div>
              </div>
           </div>
           <div className="text-center space-y-2 mb-16">
              <h2 className="text-4xl font-black italic uppercase tracking-[0.15em] text-white">FINDING RIVALS</h2>
              <p className="text-[#fbbf24] font-black uppercase text-[10px] tracking-[0.2em]">ARENA STAKE: {(CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT']).symbol}{selectedStake}</p>
           </div>
           <div className="flex gap-6 mb-20 min-h-[100px] items-start justify-center">
              {foundPlayers.map((p, i) => (
                <div key={i} className="flex flex-col items-center animate-in zoom-in duration-300">
                   <div className="p-1 rounded-2xl border-2 border-[#fbbf24] bg-slate-800 shadow-xl mb-3 overflow-hidden">
                      <img src={p.avatar} className="w-16 h-16 object-cover rounded-xl" />
                   </div>
                   <span className="text-[10px] font-black uppercase text-white/60 tracking-tighter whitespace-nowrap">{p.name.split(' ')[0]}</span>
                </div>
              ))}
              {[...Array(playerCount - foundPlayers.length)].map((_, i) => (
                <div key={i} className="flex flex-col items-center opacity-10 animate-pulse">
                   <div className="w-[72px] h-[72px] rounded-2xl border-2 border-white/20 bg-white/5 flex items-center justify-center mb-3">
                      <span className="text-xl font-black text-white/20">?</span>
                   </div>
                   <span className="text-[10px] font-black uppercase text-white/10 tracking-tighter">SEARCHING</span>
                </div>
              ))}
           </div>
           <button 
             onClick={() => setView('LOBBY')} 
             className="px-12 py-4 rounded-full border border-white/10 text-white/30 font-black uppercase text-[10px] tracking-widest hover:text-white hover:border-white/30 transition-all duration-300 active:scale-95"
           >
             CANCEL MATCH
           </button>
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
                {isLocalMode ? 'LOCAL MODE' : `ARENA • ${(CURRENCY_CONFIG[currency] || CURRENCY_CONFIG['BDT']).symbol}${selectedStake}`}
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
                  const panelPositions: Record<PlayerColor, string> = {
                    [PlayerColor.RED]: "top-[-120px] left-0",
                    [PlayerColor.GREEN]: "top-[-120px] right-0",
                    [PlayerColor.YELLOW]: "bottom-[-120px] right-0",
                    [PlayerColor.BLUE]: "bottom-[-120px] left-0"
                  };
                  let posClass = panelPositions[p.color];
                  if (gameState.players.length === 2) {
                    posClass = p.color === PlayerColor.BLUE ? "bottom-[-120px] left-0" : "top-[-120px] right-0";
                  }
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

      {showAdminLogin && (
        <div className="fixed inset-0 bg-[#020617] backdrop-blur-2xl z-[1000] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-[#0f172a] p-12 rounded-[50px] w-full max-sm border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col items-center">
            <div className="w-24 h-24 bg-[#1e293b] rounded-3xl border border-sky-500/20 flex items-center justify-center mb-8">
               <div className="w-12 h-12 flex items-center justify-center bg-white rounded-full overflow-hidden p-1.5">
                  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E" alt="Shield Icon" />
               </div>
            </div>
            <h2 className="text-3xl font-black italic uppercase text-[#42dbff] tracking-tight mb-1">ADMIN PORTAL</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-12">INTERNAL ACCESS ONLY</p>
            <div className="w-full space-y-4 mb-10">
               <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30 text-sky-400">🆔</span>
                  <input type="text" placeholder="Admin ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-[#050a18] border border-white/5 p-5 pl-14 rounded-2xl outline-none text-sm font-bold text-white placeholder:text-white/20 focus:border-sky-500/50 transition-all" />
               </div>
               <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30 text-yellow-400">🔑</span>
                  <input type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-[#050a18] border border-white/5 p-5 pl-14 rounded-2xl outline-none text-sm font-bold text-white placeholder:text-white/20 focus:border-sky-500/50 transition-all" />
               </div>
            </div>
            <button onClick={handleAdminLogin} className="w-full py-6 bg-gradient-to-r from-[#20bdff] to-[#4c66f5] rounded-3xl font-black uppercase text-xl shadow-[0_10px_30px_rgba(76,102,245,0.3)] active:scale-95 transition-all mb-8">ACCESS SYSTEM</button>
            <button onClick={() => setShowAdminLogin(false)} className="text-[10px] font-black uppercase text-white/20 hover:text-white transition-colors tracking-[0.2em]">CANCEL LOGIN</button>
          </div>
        </div>
      )}

      {isWalletOpen && user && <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={onSubmitTransaction} />}
      {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} onLogout={handleLogout} />}
      
      {view === 'ADMIN' && (
        <div className="fixed inset-0 z-[2000] bg-black">
          <AdminPortal 
            user={user || { name: 'Admin', phone: '000', balance: 0, avatar: '', stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [] }} 
            allUsers={allUsers} 
            onUpdateUsersDB={setAllUsers} 
            pendingTransactions={pendingTransactions} 
            liveMatches={[]} 
            onUpdateUser={(u) => setAllUsers(allUsers.map(usr => usr.phone === u.phone ? u : usr))} 
            onApproveTransaction={async (tx) => { 
              const target = allUsers.find(u => u.phone === tx.userPhone); 
              if (target) { 
                const config = CURRENCY_CONFIG[tx.currency] || CURRENCY_CONFIG['BDT'];
                const baseAmount = tx.amount * config.rate;
                if (tx.type === 'DEPOSIT') {
                  const updated = { ...target, balance: target.balance + baseAmount }; 
                  await databaseService.updateUser(updated); 
                  setAllUsers(allUsers.map(u => u.phone === updated.phone ? updated : u)); 
                }
                await databaseService.updateTransactionStatus(tx.id, 'APPROVED'); 
                refreshAdminData(); 
              } 
            }} 
            onRejectTransaction={async (txId) => { 
              const tx = await databaseService.getTransactionById(txId);
              if (tx && tx.type === 'WITHDRAW') {
                const target = allUsers.find(u => u.phone === tx.userPhone);
                if (target) {
                  const config = CURRENCY_CONFIG[tx.currency] || CURRENCY_CONFIG['BDT'];
                  const baseAmount = tx.amount * config.rate;
                  const updated = { ...target, balance: target.balance + baseAmount };
                  await databaseService.updateUser(updated);
                  setAllUsers(allUsers.map(u => u.phone === updated.phone ? updated : u));
                }
              }
              await databaseService.updateTransactionStatus(txId, 'REJECTED'); 
              refreshAdminData(); 
            }} 
            onExit={() => setView('LOBBY')} 
            onRefreshData={refreshAdminData} 
          />
        </div>
      )}
    </div>
  );
};

export default App;
