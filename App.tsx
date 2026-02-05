
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

const Dice3D: React.FC<{ value: number | null, isRolling: boolean, onClick?: () => void, disabled?: boolean }> = ({ value, isRolling, onClick, disabled }) => {
  return (
    <div 
      className={`dice-scene ${!disabled && !isRolling ? 'dice-glow cursor-pointer' : 'opacity-60 grayscale'}`} 
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

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'ADMIN_AUTH' | 'LOBBY' | 'FINDING' | 'LOCAL_SETUP' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
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
  const [commentary, setCommentary] = useState<string>("Welcome to Ludo Money! 🎲");

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [adminTapCount, setAdminTapCount] = useState(0);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Setup initial loading
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
    const interval = setInterval(() => setLoadingProgress(p => (p < 100 ? p + 5 : 100)), 40);
    return () => clearInterval(interval);
  }, []);

  // Poller for real-time updates
  useEffect(() => {
    if (user && view !== 'SPLASH' && view !== 'LOGIN') {
      const fetchUpdates = async () => {
        const freshUser = await databaseService.getUserByPhone(user.phone);
        if (freshUser) setUser(prev => prev ? { ...prev, balance: freshUser.balance } : null);
        
        if (user.phone === '01700000000' || view === 'ADMIN') {
          const [users, txs] = await Promise.all([databaseService.getUsers(), databaseService.getPendingTransactions()]);
          setAllUsers(users);
          setPendingTransactions(txs);
        }
      };
      const interval = setInterval(fetchUpdates, 8000);
      fetchUpdates();
      return () => clearInterval(interval);
    }
  }, [user?.phone, view]);

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
           setTimeout(() => nextTurn(), 1000);
           return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0 };
        }

        const canMove = player.tokens.some(t => 
          t.state !== TokenState.WIN && (t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56)
        );

        if (!canMove) setTimeout(() => nextTurn(), 1500);
        return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 };
      });
    }, 600);
  };

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

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(p => p ? { ...p, winner: player.color } : null);
      if (!isLocalMode && user) {
        const winAmount = selectedStake * (gameState.players.length - 0.2);
        databaseService.updateUser({ ...user, balance: user.balance + winAmount });
      }
    } else {
      const getExtra = val === 6 || killed || reachedHome;
      setGameState(p => p ? { 
        ...p, isDiceRolled: false, diceValue: null, 
        currentPlayerIndex: getExtra ? p.currentPlayerIndex : (p.currentPlayerIndex + 1) % p.players.length,
        consecutiveSixes: getExtra && val === 6 ? p.consecutiveSixes : 0
      } : null);
    }
    setIsMoving(false);
  };

  const startFinding = () => {
    if (!user) return;
    if (user.balance < selectedStake) return alert("Low balance! Deposit first.");
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
        if (t === 4 || t === 2) {
          const bot = getRandomBotIdentity();
          setFoundPlayers(p => [...p, { name: bot.name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name}` }]);
        }
        return t - 1;
      });
    }, 1000);
  };

  const prepareGame = (local: boolean) => {
    const activeCount = local ? 2 : playerCount; // Simplified local setup
    const players: Player[] = [];
    const colors = [PlayerColor.RED, PlayerColor.YELLOW, PlayerColor.GREEN, PlayerColor.BLUE];
    
    for (let i = 0; i < activeCount; i++) {
      const color = activeCount === 2 ? (i === 0 ? PlayerColor.RED : PlayerColor.YELLOW) : colors[i];
      if (local) {
        players.push({ id: `l-${i}`, name: `Player ${i+1}`, country: 'BD', flag: '🇧🇩', color, isBot: false, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Local${i}`, tokens: [] });
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

    const finalPlayers = players.map((p, i) => ({ 
      ...p, 
      tokens: [0, 1, 2, 3].map(tid => ({ id: (i * 4) + tid, color: p.color, state: TokenState.HOME, position: 0, distanceTraveled: 0 })) 
    }));

    setGameState({ players: finalPlayers, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: 'Started', consecutiveSixes: 0 });
    setView('GAME');
    soundManager.play('six');
  };

  const handleAuth = async () => {
    if (!phone || !password) return setAuthError('Missing info');
    setIsAuthLoading(true); setAuthError('');
    try {
      const normalized = phone.replace(/\D/g, '').slice(-10);
      const existing = await databaseService.getUserByPhone(normalized);
      if (isSignUp) {
        if (existing) return setAuthError('Phone registered');
        const newUser: UserProfile = { name: name || 'User', phone: normalized, password, balance: 0, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalized}`, stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: [] };
        await databaseService.updateUser(newUser); setUser(newUser);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser)); setView('LOBBY');
      } else {
        if (!existing || existing.password !== password) setAuthError('Wrong credentials');
        else { setUser(existing); localStorage.setItem('LUDO_SESSION', JSON.stringify(existing)); setView('LOBBY'); }
      }
    } finally { setIsAuthLoading(false); }
  };

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 onClick={() => setAdminTapCount(c => c + 1)} className="ludo-money-logo text-7xl mb-12 select-none">LUDO MONEY</h1>
          <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
          </div>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18]">
          <div className="bg-[#1c212e]/90 backdrop-blur-xl p-8 rounded-[40px] w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="ludo-money-logo text-5xl mb-8 uppercase text-center">{isSignUp ? 'SignUp' : 'Login'}</h2>
            {authError && <p className="text-red-500 text-xs text-center mb-4">{authError}</p>}
            <div className="space-y-4 mb-8">
              {isSignUp && <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />}
              <input type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />
            </div>
            <button onClick={handleAuth} disabled={isAuthLoading} className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase shadow-xl transition-all">
               {isAuthLoading ? '...' : 'Enter Arena'}
            </button>
            <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-4 text-white/30 text-[10px] uppercase font-bold">{isSignUp ? 'Login instead' : 'New Account'}</button>
          </div>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col animate-in fade-in overflow-y-auto no-scrollbar pb-24">
          <div className="flex justify-between items-center p-6">
            <div className="flex items-center gap-3">
              <img src={user.avatar} className="w-10 h-10 rounded-xl border border-yellow-400" />
              <h3 className="text-xs font-black uppercase italic">{user.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettingsOpen(true)} className="bg-slate-900 border border-white/10 p-2 rounded-full text-lg">⚙️</button>
              <button onClick={() => setWalletOpen(true)} className="bg-slate-900 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                <span className="text-xs font-black text-yellow-400">৳{Math.floor(user.balance)}</span><span className="w-4 h-4 bg-yellow-400 text-black rounded-full flex items-center justify-center text-[8px] font-bold">+</span>
              </button>
            </div>
          </div>

          <div className="px-6 space-y-6">
            <div className="bg-[#2b64f3] rounded-[40px] border-[8px] border-[#1e4ccf] p-8 flex flex-col items-center">
              <div className="bg-[#1e40af] p-1 rounded-full flex w-full max-w-[160px] mb-6">
                <button onClick={() => setPlayerCount(2)} className={`flex-1 py-2 rounded-full text-[8px] font-black uppercase ${playerCount === 2 ? 'bg-yellow-400 text-black' : 'text-white/40'}`}>2P</button>
                <button onClick={() => setPlayerCount(4)} className={`flex-1 py-2 rounded-full text-[8px] font-black uppercase ${playerCount === 4 ? 'bg-yellow-400 text-black' : 'text-white/40'}`}>4P</button>
              </div>
              <h2 className="text-3xl font-black italic uppercase text-white mb-6">Global Arena</h2>
              <div className="flex gap-2 mb-8">
                {[50, 100, 500, 1000].map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${selectedStake === s ? 'bg-yellow-400 border-yellow-300 text-black scale-105' : 'bg-[#1e40af] border-transparent text-white/40'}`}>৳{s}</button>
                ))}
              </div>
              <button onClick={startFinding} className="w-full py-5 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[25px] font-black text-xl uppercase text-black border-b-4 border-amber-800 active:translate-y-1 transition-all">Battle Now</button>
            </div>

            <div className="bg-purple-700 rounded-[40px] border-[8px] border-purple-800 p-8 flex flex-col items-center">
              <h2 className="text-2xl font-black italic uppercase text-white mb-6">Local Pass</h2>
              <button onClick={() => { setIsLocalMode(true); prepareGame(true); }} className="w-full py-4 bg-white text-purple-700 rounded-[25px] font-black text-lg uppercase shadow-lg">Play Local</button>
            </div>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center bg-[#020617] animate-in fade-in">
           <div className="w-32 h-32 border-4 border-yellow-400/20 rounded-full animate-ping flex items-center justify-center mb-12">
              <span className="text-5xl animate-bounce">🎲</span>
           </div>
           <h2 className="text-2xl font-black italic uppercase text-white mb-8">Finding Rivals...</h2>
           <div className="flex gap-3 mb-12">
              {foundPlayers.map((p, i) => (
                <div key={i} className="flex flex-col items-center"><img src={p.avatar} className="w-12 h-12 rounded-xl border border-yellow-400" /><span className="text-[8px] mt-1 uppercase">{p.name}</span></div>
              ))}
              {[...Array(Math.max(0, playerCount - foundPlayers.length))].map((_, i) => (
                <div key={i} className="w-12 h-12 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center">?</div>
              ))}
           </div>
           <button onClick={() => setView('LOBBY')} className="text-white/20 uppercase font-black text-xs">Cancel</button>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col relative animate-in fade-in p-2">
          <div className="absolute top-4 left-4 z-[100] flex gap-2">
            <button onClick={() => setShowExitWarning(true)} className="bg-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-xl border border-white/20">✕</button>
            <span className="bg-black/60 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10">
              {isLocalMode ? 'Local' : `Online • ৳${selectedStake}`}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-12 mt-12 mb-20">
             <div className="w-full max-w-[500px] aspect-square relative">
                <LudoBoard 
                  players={gameState.players} 
                  onTokenClick={moveToken} 
                  validTokens={gameState.isDiceRolled && !isMoving ? gameState.players[gameState.currentPlayerIndex].tokens.filter(t => t.state !== TokenState.WIN && (t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56)).map(t => t.id) : []} 
                  currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} 
                />
                
                {gameState.players.map((p, i) => {
                  const isActive = gameState.currentPlayerIndex === i;
                  const pos = gameState.players.length === 2 ? (i === 0 ? 'top-[-80px] left-0' : 'bottom-[-80px] right-0') : (['top-[-80px] left-0', 'top-[-80px] right-0', 'bottom-[-80px] right-0', 'bottom-[-80px] left-0'][i]);
                  return (
                    <div key={p.id} className={`absolute ${pos} flex items-center gap-3 transition-all ${isActive ? 'scale-110' : 'opacity-40 scale-90 grayscale'}`}>
                       <div className={`p-1 rounded-xl border-2 ${isActive ? 'border-yellow-400 animate-pulse' : 'border-white/10'} bg-slate-900`}>
                          <img src={p.avatarUrl} className="w-10 h-10 rounded-lg object-cover" />
                       </div>
                       {isActive && (
                         <div className="bg-white p-1 rounded-2xl shadow-2xl scale-110">
                            <Dice3D value={gameState.diceValue} isRolling={isRolling} onClick={rollDice} disabled={gameState.isDiceRolled} />
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>
          </div>

          <div className="fixed bottom-6 left-0 right-0 flex justify-center px-6">
            <div className="bg-slate-900 border border-white/10 p-4 rounded-[25px] w-full max-w-sm h-12 flex items-center gap-4 shadow-2xl overflow-hidden shrink-0">
               <span className="text-sm shrink-0">🎙️</span>
               <p className="text-[10px] font-black italic text-white/80 truncate leading-none">{commentary}</p>
            </div>
          </div>
          
          {gameState.winner && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 animate-in fade-in">
              <div className="bg-indigo-900 p-12 rounded-[50px] border-4 border-yellow-400 text-center w-full max-w-xs">
                <h2 className="text-4xl font-black italic uppercase text-yellow-400 mb-2">Victory!</h2>
                <p className="text-white font-bold uppercase mb-8 text-sm">{gameState.players.find(p => p.color === gameState.winner)?.name} Won</p>
                <button onClick={() => setView('LOBBY')} className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase text-sm">Lobby</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isWalletOpen && user && <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={async (tx) => { await databaseService.createTransaction(tx); setWalletOpen(false); alert("Submitted!"); }} />}
      {adminTapCount >= 5 && <div className="fixed inset-0 bg-black z-[500] flex flex-col items-center justify-center p-6"><div className="bg-slate-900 p-8 rounded-[30px] w-full max-w-xs text-center border border-white/10"><h2 className="text-xl font-black uppercase text-sky-400 mb-6 italic">Admin Portal</h2><div className="space-y-4 mb-8"><input type="text" placeholder="ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-white/5 p-4 rounded-xl outline-none" /><input type="password" placeholder="Pass" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-white/5 p-4 rounded-xl outline-none" /></div><button onClick={() => { if (adminId==='admin' && adminPass==='ludo2025') setView('ADMIN'); setAdminTapCount(0); }} className="w-full bg-sky-500 py-4 rounded-xl font-black uppercase shadow-lg">Auth</button><button onClick={() => setAdminTapCount(0)} className="mt-4 text-[8px] uppercase font-bold text-white/20">Cancel</button></div></div>}
      {view === 'ADMIN' && user && <AdminPortal user={user} allUsers={allUsers} onUpdateUsersDB={setAllUsers} pendingTransactions={pendingTransactions} liveMatches={[]} onUpdateUser={(u) => setAllUsers(allUsers.map(usr => usr.phone === u.phone ? u : usr))} onApproveTransaction={async (tx) => { const target = allUsers.find(u => u.phone === tx.userPhone); if (target) { const updated = { ...target, balance: target.balance + tx.amount }; await databaseService.updateUser(updated); await databaseService.updateTransactionStatus(tx.id, 'APPROVED'); setAllUsers(allUsers.map(u => u.phone === updated.phone ? updated : u)); setPendingTransactions(pendingTransactions.filter(p => p.id !== tx.id)); alert("Success!"); } }} onRejectTransaction={async (txId) => { await databaseService.updateTransactionStatus(txId, 'REJECTED'); setPendingTransactions(pendingTransactions.filter(p => p.id !== txId)); }} onExit={() => setView('LOBBY')} onRefreshData={async () => { const [users, txs] = await Promise.all([databaseService.getUsers(), databaseService.getPendingTransactions()]); setAllUsers(users); setPendingTransactions(txs); }} />}
    </div>
  );
};

export default App;
