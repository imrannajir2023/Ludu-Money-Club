
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
    TL: 'top-[-85px] left-[-15px]', 
    TR: 'top-[-85px] right-[-15px]', 
    BL: 'bottom-[-85px] left-[-15px]', 
    BR: 'bottom-[-85px] right-[-15px]' 
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
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  
  const botActionTimeout = useRef<any>(null);
  const autoForwardTimeout = useRef<any>(null);
  const autoMoveTimeout = useRef<any>(null);
  const findingInterval = useRef<any>(null);
  const adminPollingRef = useRef<any>(null);
  const viewRef = useRef(view);

  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.unlock();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Real-time Polling for Admin
  useEffect(() => {
    if (view === 'ADMIN') {
      const refreshAdminData = async () => {
        try {
          const [users, txs] = await Promise.all([
            databaseService.getUsers(),
            databaseService.getPendingTransactions()
          ]);
          setAllUsers(users);
          if (txs.length > pendingTransactions.length) {
              soundManager.play('six');
          }
          setPendingTransactions(txs);
        } catch (e) {
          console.error("Admin Refresh Error:", e);
        }
      };
      refreshAdminData();
      adminPollingRef.current = setInterval(refreshAdminData, 5000);
    } else {
      if (adminPollingRef.current) clearInterval(adminPollingRef.current);
    }
    return () => {
      if (adminPollingRef.current) clearInterval(adminPollingRef.current);
    };
  }, [view, pendingTransactions.length]);

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
          if (fresh?.isBlocked) {
              localStorage.removeItem('LUDO_SESSION');
              setUser(null);
          } else {
              setUser(fresh || parsed);
          }
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
    const users = await databaseService.getUsers();
    setAllUsers(users);

    if (isSignUp) {
      const exists = users.find(u => u.phone === phone);
      if (exists) return setAuthError('User already exists');
      const newUser: UserProfile = {
        name, phone, password, balance: 50, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name + Math.random()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [], country: 'Bangladesh', isBlocked: false
      };
      await databaseService.updateUser(newUser);
      setUser(newUser);
      localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
      setView('LOBBY');
    } else {
      const found = users.find(u => u.phone === phone && u.password === password);
      if (found) { 
          if (found.isBlocked) {
              setAuthError('Your account has been suspended by Admin.');
              soundManager.play('kill');
              return;
          }
          setUser(found); 
          localStorage.setItem('LUDO_SESSION', JSON.stringify(found)); 
          setView('LOBBY'); 
      } else { 
          setAuthError('Invalid credentials'); 
      }
    }
  };

  const handleAdminLogin = async () => {
    setAuthError('');
    if (adminId === 'emukhan580' && adminPass === 'Imran2015@!@!') {
      const adminProfile: UserProfile = {
        name: 'System Admin', balance: 0, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: []
      };
      setUser(adminProfile);
      setView('ADMIN');
      soundManager.play('win');
    } else {
      setAuthError('Invalid Admin Credentials');
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('LUDO_SESSION', JSON.stringify(updatedUser));
    await databaseService.updateUser(updatedUser);
  };

  const handleExitGame = useCallback(async () => {
    soundManager.play('click');
    if (currentMatchId && user?.phone) {
        await databaseService.leaveMatch(currentMatchId, user.phone);
    }
    setGameState(null);
    setCurrentMatchId(null);
    setFoundPlayers([]);
    setIsExitModalOpen(false);
    setView('LOBBY');
    if (findingInterval.current) clearInterval(findingInterval.current);
    if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
    if (autoMoveTimeout.current) clearTimeout(autoMoveTimeout.current);
  }, [currentMatchId, user?.phone]);

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
    const matchId = await databaseService.findOrCreateMatch(selectedStake, count, user);
    setCurrentMatchId(matchId);
    if (findingInterval.current) clearInterval(findingInterval.current);
    findingInterval.current = setInterval(() => {
      setFindingTimer(t => {
        if (t <= 1) {
          clearInterval(findingInterval.current);
          fillWithBotsAndStart(count);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const fillWithBotsAndStart = (count: 2 | 4) => {
    if (viewRef.current !== 'FINDING') return;
    const userPlayer: Player = { id: 'user', name: user!.name, country: user!.country || 'Bangladesh', flag: user!.flag || '🇧🇩', color: PlayerColor.RED, isBot: false, avatarUrl: user!.avatar, tokens: [] };
    const finalPlayers: Player[] = [userPlayer];
    const needed = count - 1;
    for (let i = 0; i < needed; i++) {
        const botIden = getRandomBotIdentity();
        const bot: Player = {
            id: `bot-${Date.now()}-${i}`, name: botIden.name, country: botIden.country, flag: botIden.flag,
            isBot: true, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botIden.name + Math.random()}`,
            color: [PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE][i] as PlayerColor, tokens: []
        };
        finalPlayers.push(bot);
    }
    startActualGame(finalPlayers, count);
  };

  const startActualGame = (playersList: Player[], count: 2 | 4) => {
    const finalPlayers = playersList.map((p, i) => {
        const color = count === 2 ? (i === 0 ? PlayerColor.RED : PlayerColor.YELLOW) : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE][i];
        return {
            ...p,
            color,
            tokens: [0, 1, 2, 3].map(tid => ({ id: (i * 4) + tid, color, state: TokenState.HOME, position: 0, distanceTraveled: 0 }))
        } as Player;
    });
    setGameState({ players: finalPlayers, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Battle Started', consecutiveSixes: 0 });
    if (currentMatchId) databaseService.updateMatchStatus(currentMatchId, 'ACTIVE');
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
      if (val === 6) soundManager.play('six');
      setGameState(prev => {
        if (!prev) return null;
        const newConsecSixes = val === 6 ? prev.consecutiveSixes + 1 : 0;
        if (newConsecSixes === 3) { setTimeout(nextTurn, 1000); return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 3 }; }
        return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: newConsecSixes };
      });
    }, 800);
  };

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      return { ...prev, currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, diceValue: null, isDiceRolled: false, consecutiveSixes: 0 };
    });
  }, []);

  const moveToken = async (tokenData: Token) => {
    if (!gameState || !gameState.isDiceRolled || isRolling || isMoving || gameState.winner) return;
    setIsMoving(true);
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const tokenIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    const val = gameState.diceValue!;
    let currentToken = { ...player.tokens[tokenIdx] };
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
          await new Promise(r => setTimeout(r, 250)); 
      }
    }
    if (currentToken.distanceTraveled === 56) {
        currentToken.state = TokenState.WIN;
        soundManager.play('win');
    }
    player.tokens[tokenIdx] = currentToken;
    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(prev => prev ? { ...prev, players: [...players], winner: player.color } : null);
      soundManager.play('win');
      setIsMoving(false);
      return;
    }
    const continueTurn = val === 6;
    setGameState(prev => prev ? { ...prev, players: [...players], isDiceRolled: false, diceValue: null, currentPlayerIndex: continueTurn ? prev.currentPlayerIndex : (prev.currentPlayerIndex + 1) % prev.players.length } : null);
    setIsMoving(false);
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-7xl mb-12">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5"><div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg rounded-full transition-all duration-300" style={{width: `${loadingProgress}%`}}></div></div>
        </div>
      )}

      {(view === 'LOGIN' || view === 'ADMIN_AUTH') && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
           <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 py-12 rounded-[50px] w-full max-w-[420px] border border-white/10 flex flex-col items-center shadow-2xl z-10">
              <h2 className="ludo-money-logo text-6xl mb-12 italic font-black uppercase">{view === 'ADMIN_AUTH' ? 'ADMIN' : (isSignUp ? 'SIGNUP' : 'LOGIN')}</h2>
              {authError && <div className="text-red-500 mb-6 text-[10px] font-black uppercase bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 text-center">{authError}</div>}
              <div className="w-full space-y-5 mb-10">
                 {view === 'LOGIN' && isSignUp && <input type="text" placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none" />}
                 <input type={view === 'ADMIN_AUTH' ? "text" : "tel"} placeholder={view === 'ADMIN_AUTH' ? "Admin ID" : "Phone Number"} value={view === 'ADMIN_AUTH' ? adminId : phone} onChange={(e) => view === 'ADMIN_AUTH' ? setAdminId(e.target.value) : setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none" />
                 <input type="password" placeholder="Password" value={view === 'ADMIN_AUTH' ? adminPass : password} onChange={(e) => view === 'ADMIN_AUTH' ? setAdminPass(e.target.value) : setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none" />
              </div>
              <button onClick={view === 'ADMIN_AUTH' ? handleAdminLogin : handleAuth} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all">Enter</button>
              {view === 'LOGIN' && <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-white/40 text-[10px] font-black uppercase">{isSignUp ? 'Login instead' : 'Create Account'}</button>}
           </div>
           {view === 'LOGIN' && <button onClick={handleHiddenAdminTap} className="absolute bottom-10 text-white/10 text-[10px] font-black uppercase">VER 1.0.8 PRO</button>}
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="flex-1 flex flex-col animate-in fade-in overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center p-6 pb-2">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setProfileOpen(true)}>
              <div className="w-12 h-12 rounded-xl border-2 border-yellow-500 bg-slate-800 overflow-hidden shadow-lg"><img src={user.avatar} className="w-full h-full object-cover" /></div>
              <div><h3 className="text-sm font-black uppercase italic leading-none">{user.name}</h3><p className="text-[8px] font-bold text-white/40 uppercase mt-1">Player Rank: Gold</p></div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setSettingsOpen(true)} className="bg-slate-900/80 border border-white/10 p-2.5 rounded-full shadow-lg">⚙️</button>
                <button onClick={() => setWalletOpen(true)} className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                    <span className="text-xs font-black text-yellow-500">৳{user.balance.toLocaleString()}</span>
                </button>
            </div>
          </div>
          <div className="p-6 pt-4 space-y-6 flex-1 flex flex-col">
            <div className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 rounded-[50px] p-8 border-4 border-blue-400/20 shadow-2xl flex flex-col items-center justify-between relative overflow-hidden">
               <div className="bg-[#1c2e63] p-1.5 rounded-3xl flex w-full max-w-[280px] z-10 shadow-inner">
                  <button onClick={() => setPlayerCount(2)} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40'}`}>2 Player</button>
                  <button onClick={() => setPlayerCount(4)} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40'}`}>4 Player</button>
               </div>
               <div className="flex flex-col items-center gap-4 py-6 z-10"><h2 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">Global Arena</h2></div>
               <div className="w-full grid grid-cols-4 gap-2 z-10">
                  {[50, 100, 500, 1000].map(stake => (
                    <button key={stake} onClick={() => setSelectedStake(stake)} className={`py-3 rounded-xl font-black text-[10px] border-2 transition-all ${selectedStake === stake ? 'bg-yellow-400 border-yellow-300 text-black scale-105 shadow-md' : 'bg-[#0f1d44] border-white/5 text-white/40'}`}>৳{stake}</button>
                  ))}
               </div>
               <button onClick={() => startFinding(playerCount)} className="w-full mt-6 py-5 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[30px] font-black text-xl uppercase italic text-black border-b-8 border-amber-800 active:translate-y-2 transition-all shadow-xl z-10">Start Battle</button>
            </div>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-[#020617] animate-in fade-in overflow-hidden">
           <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[6px] border-white/5 shadow-inner"></div>
              <div className="absolute inset-0 rounded-full border-[6px] border-sky-500 border-t-transparent animate-[spin_2s_linear_infinite]"></div>
              <div className="flex flex-col items-center justify-center z-10"><span className="text-7xl font-black text-yellow-500 italic">{findingTimer}</span></div>
           </div>
           <h2 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter">Finding Players</h2>
           <p className="text-sky-400 font-bold uppercase text-[10px] tracking-widest mb-12">Waiting for Arena</p>
           <button onClick={handleExitGame} className="text-white/20 font-black uppercase text-[10px] tracking-widest">Cancel Search</button>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col p-4 relative animate-in fade-in">
          <div className="absolute top-4 left-4 z-[110]">
             <button onClick={() => setIsExitModalOpen(true)} className="bg-red-600 text-white px-5 py-2 rounded-full font-black uppercase italic text-[9px] shadow-lg">Exit</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 mt-20 sm:mt-24">
            <div className="w-full max-w-[600px] aspect-square relative">
              <LudoBoard players={gameState.players} onTokenClick={moveToken} validTokens={(() => { if (gameState.currentPlayerIndex !== 0 || isMoving) return []; const player = gameState.players[0]; const val = gameState.diceValue; if (!val || !gameState.isDiceRolled) return []; return player.tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56)).map(t => t.id); })()} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} />
              {gameState.players.map((p, i) => { 
                const positionsMap: ('TL' | 'TR' | 'BR' | 'BL')[] = playerCount === 2 ? ['TL', 'BR'] : ['TL', 'TR', 'BR', 'BL']; 
                return <PlayerProfileOverlay key={p.id} player={p} isActive={gameState.currentPlayerIndex === i} position={positionsMap[i]} />; 
              })}
            </div>
          </div>
          <div className="h-32 flex flex-col items-center justify-center bg-[#020617]/90 rounded-t-[50px] border-t border-white/10 mt-4 shadow-2xl">
             <button onClick={rollDice} disabled={gameState.currentPlayerIndex !== 0 || gameState.isDiceRolled || isRolling} className={`flex flex-col items-center transition-all ${gameState.currentPlayerIndex === 0 && !gameState.isDiceRolled ? 'scale-100 opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                <div className="relative w-20 h-20 rounded-[25px] border-2 border-yellow-500 shadow-xl flex items-center justify-center bg-slate-800"><Dice3D value={gameState.diceValue} isRolling={isRolling} /></div>
             </button>
          </div>
          {gameState.winner && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in zoom-in">
               <div className="bg-indigo-900 p-12 rounded-[60px] border-4 border-yellow-500 shadow-2xl text-center max-w-sm w-full">
                  <h2 className="text-4xl font-black italic uppercase text-yellow-400 mb-8">Victory!</h2>
                  <button onClick={handleExitGame} className="w-full bg-white text-black py-5 rounded-[25px] font-black uppercase text-sm shadow-xl">Exit Game</button>
               </div>
            </div>
          )}
        </div>
      )}

      {view === 'ADMIN' && user && (
        <AdminPortal 
          user={user} allUsers={allUsers} onUpdateUsersDB={setAllUsers} pendingTransactions={pendingTransactions} liveMatches={[]} 
          onUpdateUser={async (u) => { const updated = allUsers.map(usr => usr.phone === u.phone ? u : usr); setAllUsers(updated); await databaseService.updateUser(u); }} 
          onApproveTransaction={async (tx) => { 
            try {
              // CRITICAL: Finding user by the accountPhone (registered) rather than payment phone
              const lookupPhone = tx.accountPhone || tx.phone;
              const u = await databaseService.getUserByPhone(lookupPhone);
              if (u) { 
                const updatedUser = { 
                  ...u, 
                  balance: tx.type === 'DEPOSIT' ? u.balance + tx.amount : u.balance - tx.amount, 
                  history: (u.history || []).map(h => h.id === tx.id ? { ...h, status: 'APPROVED' as const } : h) 
                }; 
                await databaseService.updateUser(updatedUser); 
                await databaseService.updateTransactionStatus(tx.id, 'APPROVED');
                setAllUsers(prev => prev.map(usr => usr.phone === updatedUser.phone ? updatedUser : usr)); 
                setPendingTransactions(prev => prev.filter(p => p.id !== tx.id)); 
                soundManager.play('win');
                alert(`${tx.userName} এর লেনদেন অ্যাপ্রুভ হয়েছে।`);
              } else { alert("ইউজার পাওয়া যায়নি।"); }
            } catch (err) { alert("ত্রুটি হয়েছে!"); }
          }} 
          onRejectTransaction={async (txId) => { 
            try { await databaseService.updateTransactionStatus(txId, 'REJECTED'); setPendingTransactions(prev => prev.filter(p => p.id !== txId)); soundManager.play('kill'); alert("রিজেক্ট হয়েছে।"); } catch (err) { alert("ত্রুটি হয়েছে!"); }
          }} 
          onExit={() => setView('LOBBY')} 
        />
      )}

      {isWalletOpen && user && (
        <WalletModal 
          isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} 
          onSubmitTransaction={async (tx) => { 
            setPendingTransactions(prev => [...prev, tx]); 
            const updatedUser = { ...user, history: [...(user.history || []), tx] }; 
            setUser(updatedUser); 
            await databaseService.updateUser(updatedUser); 
            await databaseService.createTransaction(tx);
          }} 
        />
      )}
    </div>
  );
};

export default App;
