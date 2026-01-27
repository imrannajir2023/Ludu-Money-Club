
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity } from './services/botService';
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
    TL: 'top-[-85px] left-[-15px]', 
    TR: 'top-[-85px] right-[-15px]', 
    BL: 'bottom-[-85px] left-[-15px]', 
    BR: 'bottom-[-85px] right-[-15px]' 
  };
  
  const borderColors = { 
    [PlayerColor.RED]: 'border-red-500', 
    [PlayerColor.GREEN]: 'border-green-500', 
    [PlayerColor.YELLOW]: 'border-yellow-400', 
    [PlayerColor.BLUE]: 'border-blue-500' 
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-500 ${isActive ? 'scale-110' : 'opacity-70 scale-90'}`}>
       <div className={`relative p-1 rounded-2xl border-[3px] bg-slate-900/80 backdrop-blur-md ${isActive ? 'border-yellow-400 shadow-[0_0_20px_#fbbf24]' : borderColors[player.color]}`}>
          <img src={player.avatarUrl} className="w-14 h-14 rounded-xl object-cover bg-slate-800" />
          {isActive && (
            <div className="absolute -top-3 -right-3 w-7 h-7 bg-yellow-400 rounded-full border-2 border-[#0f172a] flex items-center justify-center animate-bounce shadow-lg">
              <span className="text-[10px] text-black font-black">🎲</span>
            </div>
          )}
       </div>
       <div className="mt-2 flex flex-col items-center bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
          <span className="text-[9px] font-black uppercase text-white leading-none truncate max-w-[80px]">{player.name}</span>
          <div className="flex items-center gap-1 mt-0.5">
             <span className="text-[8px]">{player.flag}</span>
             <span className="text-[7px] font-bold text-white/50 uppercase tracking-widest">{player.country}</span>
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
  
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [selectedStake, setSelectedStake] = useState(50);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isChangePassOpen, setChangePassOpen] = useState(false);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [findingTimer, setFindingTimer] = useState(30);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const findingInterval = useRef<any>(null);
  const adminSyncInterval = useRef<any>(null);
  const balanceSyncInterval = useRef<any>(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [adminTapCount, setAdminTapCount] = useState(0);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.unlock();
      window.removeEventListener('click', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('LUDO_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = await databaseService.getUserByPhone(parsed.phone);
        if (fresh && !fresh.isBlocked) {
          const updated = { ...fresh, lastLogin: new Date().toISOString() };
          setUser(updated);
          databaseService.updateUser(updated);
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
    const interval = setInterval(() => {
      setLoadingProgress(p => (p < 100 ? p + 5 : 100));
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const refreshAdminData = useCallback(async () => {
    try {
      const users = await databaseService.getUsers();
      const txs = await databaseService.getPendingTransactions();
      setAllUsers(users);
      setPendingTransactions(txs);
      
      if (user) {
          const freshMe = users.find(u => u.phone === databaseService.normalizePhone(user.phone));
          if (freshMe) {
            if (Math.floor(freshMe.balance) !== Math.floor(user.balance)) {
                setUser(freshMe);
                localStorage.setItem('LUDO_SESSION', JSON.stringify(freshMe));
            }
          }
      }
    } catch (err) {
      console.error("Refresh Logic Failed:", err);
    }
  }, [user]);

  // Player balance poller - fast sync (5s)
  useEffect(() => {
    if (user && view !== 'GAME' && view !== 'SPLASH') {
        const checkBalance = async () => {
           const fresh = await databaseService.getUserByPhone(user.phone);
           if (fresh && Math.floor(fresh.balance) !== Math.floor(user.balance)) {
               setUser(fresh);
               localStorage.setItem('LUDO_SESSION', JSON.stringify(fresh));
           }
        };
        balanceSyncInterval.current = setInterval(checkBalance, 5000);
    }
    return () => {
        if (balanceSyncInterval.current) clearInterval(balanceSyncInterval.current);
    }
  }, [user?.phone, user?.balance, view]);

  useEffect(() => {
    if (view === 'ADMIN' || isWalletOpen) {
      refreshAdminData();
      adminSyncInterval.current = setInterval(refreshAdminData, 5000);
    } else {
      if (adminSyncInterval.current) clearInterval(adminSyncInterval.current);
    }
    return () => {
      if (adminSyncInterval.current) clearInterval(adminSyncInterval.current);
    };
  }, [view, isWalletOpen, refreshAdminData]);

  const handleHiddenAdminTap = () => {
    setAdminTapCount(prev => {
      const next = prev + 1;
      if (next >= 7) {
        setView('ADMIN_AUTH');
        soundManager.play('click');
        return 0;
      }
      return next;
    });
  };

  const handleAdminAuth = () => {
    setAuthError('');
    if (adminId === 'emukhan580' && adminPass === 'Imran2015@!@!') {
      const adminProfile: UserProfile = { 
        name: 'System Admin', phone: '0000', balance: 99999, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin', 
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [], isBlocked: false 
      };
      setUser(adminProfile);
      setView('ADMIN');
      soundManager.play('win');
    } else {
      setAuthError('Invalid Admin Credentials');
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    if (!phone || !password || (isSignUp && !name)) return setAuthError('Please fill all fields');
    
    setIsAuthLoading(true);
    try {
      if (isSignUp) {
        const normalizedPhone = databaseService.normalizePhone(phone);
        const exists = await databaseService.getUserByPhone(normalizedPhone);
        if (exists) {
          setAuthError('Phone already registered');
          setIsAuthLoading(false);
          return;
        }

        const newUser: UserProfile = { 
          name, 
          phone: normalizedPhone,
          password, 
          balance: 50, 
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`, 
          stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, 
          history: [], 
          isBlocked: false 
        };

        const result = await databaseService.updateUser(newUser);
        if (!result.success) {
          setAuthError('Failed: ' + (result.message || 'Check database setup'));
          setIsAuthLoading(false);
          return;
        }

        setUser(newUser);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
        setView('LOBBY');
        soundManager.play('win');
      } else {
        const found = await databaseService.getUserByPhone(phone);
        if (found && found.password === password) {
            if (found.isBlocked) return setAuthError('Account suspended');
            setUser(found);
            localStorage.setItem('LUDO_SESSION', JSON.stringify(found));
            setView('LOBBY');
        } else {
          setAuthError('Invalid phone or password');
        }
      }
    } catch (err: any) {
      setAuthError('Connection problem: ' + err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 4) return alert("Password too short");
    if (!user) return;
    const updated = { ...user, password: newPassword };
    const result = await databaseService.updateUser(updated);
    if (result.success) {
        setUser(updated);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(updated));
        setChangePassOpen(false);
        alert("Password updated!");
    }
  };

  const startFinding = async () => {
    if (!user || user.balance < selectedStake) return alert("Insufficient balance");
    soundManager.play('click');
    const updatedUser = { ...user, balance: user.balance - selectedStake, stats: { ...user.stats, totalGames: user.stats.totalGames + 1 } };
    setUser(updatedUser);
    await databaseService.updateUser(updatedUser);
    
    setView('FINDING');
    setFindingTimer(15);
    
    findingInterval.current = setInterval(() => {
      setFindingTimer(t => {
        if (t <= 1) {
          clearInterval(findingInterval.current);
          fillWithBots();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const fillWithBots = () => {
    const players: Player[] = [
      { id: 'user', name: user!.name, country: user!.country || 'BD', flag: user!.flag || '🇧🇩', color: PlayerColor.RED, isBot: false, avatarUrl: user!.avatar, tokens: [] }
    ];
    
    for (let i = 1; i < playerCount; i++) {
      const botIdentity = getRandomBotIdentity();
      const color = playerCount === 2 ? PlayerColor.YELLOW : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE][i];
      players.push({
        id: `bot-${i}`, name: botIdentity.name, country: botIdentity.country, flag: botIdentity.flag,
        isBot: true, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botIdentity.name}`,
        color, tokens: []
      } as Player);
    }

    const finalPlayers = players.map((p, i) => ({
      ...p,
      tokens: [0, 1, 2, 3].map(tid => ({ id: (i * 4) + tid, color: p.color, state: TokenState.HOME, position: 0, distanceTraveled: 0 }))
    }));

    setGameState({ players: finalPlayers, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Started', consecutiveSixes: 0 });
    setView('GAME');
    soundManager.play('six');
  };

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
        if (val === 6 && prev.consecutiveSixes >= 2) {
           setTimeout(() => nextTurn(), 800);
           return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0 };
        }
        
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56));
        if (!canMove) {
          setTimeout(() => nextTurn(), 1000);
        }

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
    const player = players[gameState.currentPlayerIndex];
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

    if (player.tokens[tIdx].distanceTraveled === 56) {
      player.tokens[tIdx].state = TokenState.WIN;
      soundManager.play('win');
    } else {
      const targetPos = (player.tokens[tIdx].distanceTraveled + START_POSITIONS[player.color]) % 52;
      const isSafe = SAFE_SPOTS.includes(targetPos);
      
      if (!isSafe) {
        players.forEach((otherP, otherPIdx) => {
          if (otherPIdx === gameState.currentPlayerIndex) return;
          otherP.tokens.forEach((otherT, otherTIdx) => {
            if (otherT.state === TokenState.PATH) {
              const otherAbsPos = (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52;
              if (otherAbsPos === targetPos) {
                otherP.tokens[otherTIdx].state = TokenState.HOME;
                otherP.tokens[otherTIdx].distanceTraveled = 0;
                soundManager.play('kill');
              }
            }
          });
        });
      }
    }

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(p => p ? { ...p, winner: player.color } : null);
      if (player.id === 'user') {
        const reward = selectedStake * playerCount;
        const updated = { ...user!, balance: user!.balance + reward, stats: { ...user!.stats, wins: user!.stats.wins + 1, totalWinnings: user!.stats.totalWinnings + reward } };
        setUser(updated);
        await databaseService.updateUser(updated);
      }
    } else {
      setGameState(p => p ? { ...p, isDiceRolled: false, diceValue: null, currentPlayerIndex: val === 6 ? p.currentPlayerIndex : (p.currentPlayerIndex + 1) % p.players.length } : null);
    }
    setIsMoving(false);
  };

  const handleTransactionRequest = async (tx: PendingTransaction) => {
    if (tx.type === 'WITHDRAW' && user) {
        if (user.balance < tx.amount) {
            alert("Insufficient balance for withdrawal!");
            return;
        }
        const updatedUser = { ...user, balance: user.balance - Number(tx.amount) };
        setUser(updatedUser);
        await databaseService.updateUser(updatedUser);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(updatedUser));
    }

    const result = await databaseService.createTransaction(tx); 
    if (result.success) {
        alert(tx.type === 'DEPOSIT' ? "ডিপোজিট অনুরোধ পাঠানো হয়েছে!" : "উইথড্র রিকোয়েস্ট পাঠানো হয়েছে!");
        refreshAdminData(); 
    } else {
        if (tx.type === 'WITHDRAW' && user) {
            const refundedUser = { ...user, balance: user.balance + Number(tx.amount) };
            setUser(refundedUser);
            await databaseService.updateUser(refundedUser);
        }
        alert("এরর: " + (result.message || "ট্রানজ্যাকশন ব্যর্থ হয়েছে।"));
    }
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-7xl mb-12">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full border border-white/10 p-0.5">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
          </div>
        </div>
      )}

      {view === 'ADMIN_AUTH' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18]">
          <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 rounded-[50px] w-full max-w-[420px] border border-sky-500/30 shadow-2xl">
            <h2 className="ludo-money-logo text-6xl mb-10 italic uppercase text-sky-400">ADMIN</h2>
            {authError && <div className="text-red-500 mb-6 text-xs font-bold text-center">{authError}</div>}
            <div className="space-y-4 mb-8">
              <input type="text" placeholder="Admin ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
              <input type="password" placeholder="Admin Key" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
            </div>
            <button onClick={handleAdminAuth} className="w-full bg-sky-500 text-white py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all">Authorize</button>
            <button onClick={() => setView('LOGIN')} className="w-full mt-4 text-white/40 text-[10px] uppercase font-bold">Back to Player Login</button>
          </div>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
          <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 rounded-[50px] w-full max-w-[420px] border border-white/10 shadow-2xl">
            <h2 className="ludo-money-logo text-6xl mb-10 italic uppercase">{isSignUp ? 'SIGNUP' : 'LOGIN'}</h2>
            {authError && <div className="text-red-500 mb-6 text-xs font-bold text-center bg-red-500/10 p-2 rounded-xl border border-red-500/20">{authError}</div>}
            <div className="space-y-4 mb-8">
              {isSignUp && <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />}
              <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl outline-none" />
            </div>
            <button onClick={handleAuth} disabled={isAuthLoading} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all disabled:opacity-50">
               {isAuthLoading ? 'Please wait...' : 'Enter Arena'}
            </button>
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="w-full mt-4 text-white/40 text-[10px] uppercase font-bold">{isSignUp ? 'Login instead' : 'Create Account'}</button>
          </div>
          <button onClick={handleHiddenAdminTap} className="absolute bottom-10 text-white/5 text-[9px] font-black uppercase tracking-[0.2em]">VER 1.0.8 PRO</button>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col animate-in fade-in overflow-y-auto no-scrollbar pb-32">
          {/* Header */}
          <div className="flex justify-between items-center p-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl border-2 border-yellow-500 bg-slate-800 overflow-hidden shadow-lg">
                <img src={user.avatar} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-black uppercase italic leading-none">{user.name}</h3>
                <p className="text-[8px] font-bold text-white/40 uppercase mt-1">Player Rank: Gold</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettingsOpen(true)} className="bg-slate-900/80 border border-white/10 p-2.5 rounded-full shadow-lg">⚙️</button>
              <button onClick={() => setWalletOpen(true)} className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                <span className="text-xs font-black text-yellow-500">৳ {Math.floor(user.balance).toLocaleString()}</span>
                <span className="w-5 h-5 bg-yellow-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold">+</span>
              </button>
            </div>
          </div>

          <div className="bg-yellow-500 py-1 flex items-center gap-2 overflow-hidden shrink-0">
             <span className="pl-6 shrink-0">📢</span>
             <div className="animate-scroll-text whitespace-nowrap flex items-center gap-8">
               <span className="text-[10px] font-black text-black uppercase">Tournament starting in 5 mins! Join now!</span>
               <span className="text-[10px] font-black text-black uppercase">🏆 Oliver just withdrew ৳500 to Rocket! 🏆</span>
               <span className="text-[10px] font-black text-black uppercase">Tournament starting in 5 mins! Join now!</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 mt-4 shrink-0">
             <div className="bg-indigo-600 rounded-3xl p-4 flex items-center gap-3 shadow-xl border border-white/10">
                <span className="text-2xl">🎁</span>
                <div>
                   <p className="text-[7px] font-black text-white/50 uppercase leading-none">Daily Reward</p>
                   <p className="text-[10px] font-black text-white uppercase mt-0.5">Claim ৳50</p>
                </div>
             </div>
             <div className="bg-orange-600 rounded-3xl p-4 flex items-center gap-3 shadow-xl border border-white/10">
                <span className="text-2xl">🔥</span>
                <div>
                   <p className="text-[7px] font-black text-white/50 uppercase leading-none">Hot Event</p>
                   <p className="text-[10px] font-black text-white uppercase mt-0.5">2X Points</p>
                </div>
             </div>
          </div>

          <div className="px-6 mt-6 mb-8">
            <div className="bg-blue-600 rounded-[40px] border-[10px] border-white/5 shadow-2xl flex flex-col items-center p-6 relative overflow-hidden min-h-[400px]">
              <div className="bg-black/20 p-1.5 rounded-3xl flex w-full max-w-[200px] mb-6">
                <button onClick={() => setPlayerCount(2)} className={`flex-1 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-yellow-400 text-black' : 'text-white/40'}`}>2 Player</button>
                <button onClick={() => setPlayerCount(4)} className={`flex-1 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-yellow-400 text-black' : 'text-white/40'}`}>4 Player</button>
              </div>

              <div className="w-24 h-24 bg-yellow-500 rounded-[25px] flex items-center justify-center shadow-xl border-4 border-amber-600 mb-4 transform rotate-12 shrink-0">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                    <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                 </div>
              </div>

              <h2 className="text-3xl font-black italic uppercase text-white drop-shadow-lg tracking-tighter mb-6 shrink-0 text-center">Global Arena</h2>

              <div className="w-full flex flex-wrap justify-between gap-2 mb-8 shrink-0">
                {[50, 100, 500, 1000].map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`flex-1 min-w-[70px] py-3 rounded-xl font-black text-[10px] transition-all border-2 ${selectedStake === s ? 'bg-yellow-400 border-yellow-300 text-black scale-105 shadow-xl' : 'bg-blue-800 border-white/5 text-white/40'}`}>৳{s}</button>
                ))}
              </div>

              <button onClick={startFinding} className="w-full py-5 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[25px] font-black text-xl uppercase italic text-black border-b-8 border-amber-800 active:translate-y-2 active:border-b-0 shadow-xl transition-all">Start Battle</button>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-white/10 flex justify-around p-4 z-50">
             <button className="flex flex-col items-center gap-1 group">
                <div className="p-2 bg-yellow-400 rounded-xl transition-transform"><span className="text-lg">🏠</span></div>
                <span className="text-[8px] font-black uppercase text-yellow-400">Home</span>
             </button>
             <button className="flex flex-col items-center gap-1 group opacity-40">
                <div className="p-2 bg-slate-800 rounded-xl transition-transform"><span className="text-lg">🏆</span></div>
                <span className="text-[8px] font-black uppercase text-white/40">Rank</span>
             </button>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-[#020617] animate-in fade-in">
           <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[8px] border-white/5 shadow-inner"></div>
              <div className="absolute inset-0 rounded-full border-[8px] border-sky-500 border-t-transparent animate-spin"></div>
              <div className="flex flex-col items-center justify-center z-10"><span className="text-7xl font-black text-yellow-500 italic">{findingTimer}</span></div>
           </div>
           <h2 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter">Finding Players</h2>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col p-4 relative animate-in fade-in">
          <div className="absolute top-4 left-4 z-[110]"><button onClick={() => setView('LOBBY')} className="bg-red-600 px-5 py-2 rounded-full font-black uppercase italic text-[9px] shadow-lg">Exit</button></div>
          <div className="flex-1 flex items-center justify-center p-2 mt-20">
            <div className="w-full max-w-[600px] aspect-square relative">
              <LudoBoard players={gameState.players} onTokenClick={moveToken} validTokens={gameState.currentPlayerIndex === 0 && gameState.isDiceRolled && !isMoving ? gameState.players[0].tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56)).map(t => t.id) : []} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} />
              {gameState.players.map((p, i) => <PlayerProfileOverlay key={p.id} player={p} isActive={gameState.currentPlayerIndex === i} position={playerCount === 2 ? (i === 0 ? 'TL' : 'BR') : (['TL', 'TR', 'BR', 'BL'] as any)[i]} />)}
            </div>
          </div>
          <div className="h-32 flex flex-col items-center justify-center bg-slate-900/90 rounded-t-[50px] border-t border-white/10 mt-4 shadow-2xl">
            <button onClick={rollDice} disabled={gameState.currentPlayerIndex !== 0 || gameState.isDiceRolled || isRolling} className={`transition-all ${gameState.currentPlayerIndex === 0 && !gameState.isDiceRolled ? 'scale-110' : 'opacity-40 grayscale pointer-events-none'}`}>
               <Dice3D value={gameState.diceValue} isRolling={isRolling} />
            </button>
          </div>
          {gameState.winner && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
              <div className="bg-indigo-900 p-12 rounded-[60px] border-4 border-yellow-500 shadow-2xl text-center w-full max-w-sm">
                <h2 className="text-4xl font-black italic uppercase text-yellow-400 mb-8">VICTORY!</h2>
                <button onClick={() => setView('LOBBY')} className="w-full bg-white text-black py-5 rounded-[25px] font-black uppercase text-sm shadow-xl">Back to Lobby</button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'ADMIN' && user && (
        <AdminPortal 
          user={user} 
          allUsers={allUsers} 
          onUpdateUsersDB={setAllUsers} 
          pendingTransactions={pendingTransactions} 
          liveMatches={[]} 
          onUpdateUser={(u) => { setAllUsers(prev => prev.map(usr => usr.phone === u.phone ? u : usr)); }} 
          onApproveTransaction={async (tx) => { 
            const ok = await databaseService.updateTransactionStatus(tx.id, 'APPROVED'); 
            if (ok) {
                if (tx.type === 'DEPOSIT') {
                    const normalizedTargetPhone = databaseService.normalizePhone(tx.userPhone);
                    const targetUser = await databaseService.getUserByPhone(normalizedTargetPhone);
                    if (targetUser) {
                        const amount = Number(tx.amount) || 0;
                        const updateResult = await databaseService.updateUser({
                            ...targetUser,
                            balance: Number(targetUser.balance) + amount
                        });
                        if (updateResult.success) {
                            alert(`ডিপোজিট এপ্রুভ এবং ৳${amount} যোগ হয়েছে!`);
                        } else {
                            alert("ব্যালেন্স আপডেট করতে সমস্যা হয়েছে: " + updateResult.message);
                        }
                    } else {
                        alert("সতর্কতা: ইউজার (" + tx.userPhone + ") খুঁজে পাওয়া যায়নি! ব্যালেন্স যোগ করা যায়নি।");
                    }
                } else {
                    alert("উইথড্র এপ্রুভ হয়েছে!");
                }
                refreshAdminData();
            }
          }} 
          onRejectTransaction={async (id) => { 
            const tx = pendingTransactions.find(t => t.id === id);
            const ok = await databaseService.updateTransactionStatus(id, 'REJECTED'); 
            if (ok) {
                if (tx && tx.type === 'WITHDRAW') {
                    const normalizedTargetPhone = databaseService.normalizePhone(tx.userPhone);
                    const targetUser = await databaseService.getUserByPhone(normalizedTargetPhone);
                    if (targetUser) {
                        const amount = Number(tx.amount) || 0;
                        await databaseService.updateUser({
                            ...targetUser,
                            balance: Number(targetUser.balance) + amount
                        });
                        alert(`উইথড্র রিজেক্ট এবং ৳${amount} রিফান্ড হয়েছে!`);
                    }
                } else {
                    alert("ডিপোজিট রিজেক্ট হয়েছে!");
                }
                refreshAdminData();
            }
          }} 
          onExit={() => setView('LOBBY')}
          onRefreshData={refreshAdminData}
        />
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in zoom-in-95">
          <div className="bg-[#1e293b] rounded-[40px] w-full max-w-sm border border-white/10 p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-10"><h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Settings</h3><button onClick={() => setSettingsOpen(false)} className="text-white/40 text-2xl">✕</button></div>
            <div className="space-y-4">
              <button onClick={() => { soundManager.toggleMute(); setSettingsOpen(false); setSettingsOpen(true); }} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl flex justify-between items-center font-black uppercase text-xs"><span>Game Sound</span><span className={soundManager.isMuted() ? 'text-red-500' : 'text-green-500'}>{soundManager.isMuted() ? 'MUTED' : 'ENABLED'}</span></button>
              <button onClick={() => { setChangePassOpen(true); setSettingsOpen(false); }} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-left font-black uppercase text-xs">Change Password</button>
              <button onClick={() => { localStorage.removeItem('LUDO_SESSION'); window.location.reload(); }} className="w-full bg-red-600/10 border border-red-500/20 p-5 rounded-3xl text-red-500 font-black uppercase text-xs text-center">Log Out</button>
            </div>
          </div>
        </div>
      )}

      {isChangePassOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95">
          <div className="bg-[#1e293b] rounded-[40px] w-full max-w-sm border border-white/10 p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black uppercase italic text-white">New Password</h3><button onClick={() => setChangePassOpen(false)} className="text-white/40">✕</button></div>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none mb-6" />
            <button onClick={handleUpdatePassword} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black uppercase text-sm shadow-xl transition-transform active:scale-95">Update Now</button>
          </div>
        </div>
      )}

      {isWalletOpen && user && (
        <WalletModal 
          isOpen={isWalletOpen} 
          onClose={() => setWalletOpen(false)} 
          user={user} 
          onSubmitTransaction={handleTransactionRequest} 
        />
      )}
    </div>
  );
};

export default App;
