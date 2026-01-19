
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS, START_POSITIONS, HOME_ENTRANCE } from './constants';
import { databaseService } from './services/database.ts';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
const STORAGE_KEY_USER = "LUDO_USER_PROFILE";
const STORAGE_KEY_ADMIN = "LUDO_ADMIN_SESSION";

const INITIAL_USER: UserProfile = {
  name: "Guest Player",
  balance: 400,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
  stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
  history: []
};

const STAKE_OPTIONS = [50, 100, 500, 1000, 5000];

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP' | 'ADMIN_LOGIN'>('LOGIN');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const matchIdRef = useRef<string | null>(null);
  const botActionTimeoutRef = useRef<number | null>(null);

  // Cloud Sync Polling
  const refreshCloudData = useCallback(async () => {
    const users = await databaseService.getUsers();
    setAllUsers(users);
    const txs = await databaseService.getPendingTransactions();
    setPendingTransactions(txs);
    const matches = await databaseService.getLiveMatches();
    setLiveMatches(matches);

    // Sync current user session
    const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUserStr) {
        const saved = JSON.parse(savedUserStr);
        const upToDateUser = users.find(u => u.phone === saved.phone);
        if (upToDateUser) {
            setUser(upToDateUser);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(upToDateUser));
        }
    }

    // Admin termination check
    if (matchIdRef.current) {
        const myMatch = matches.find(m => m.matchId === matchIdRef.current);
        if (myMatch && myMatch.status === 'TERMINATED') {
            alert("Match closed by Admin.");
            matchIdRef.current = null;
            setView('LOBBY');
        }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshCloudData, 5000);
    refreshCloudData();
    return () => clearInterval(interval);
  }, [refreshCloudData]);

  // Initial Boot
  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const isAdmin = localStorage.getItem(STORAGE_KEY_ADMIN);
              if (isAdmin === 'true') { setView('ADMIN'); return 100; }
              const savedUser = localStorage.getItem(STORAGE_KEY_USER);
              if (savedUser) { setView('LOBBY'); return 100; }
              setView('LOGIN');
            }, 500);
            return 100;
          }
          return prev + 5;
        });
      }, 20);
      return () => clearInterval(interval);
    }
  }, [view]);

  const handleLogout = () => {
    if (confirm("Logout?")) {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_ADMIN);
        window.location.reload();
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('click');
    
    if (authMode === 'ADMIN_LOGIN') {
      if (loginPhone === 'emukhan580' && loginPassword === 'Imran2015@!@!') {
        localStorage.setItem(STORAGE_KEY_ADMIN, 'true');
        setView('ADMIN');
      } else alert("Wrong Admin ID/Password");
      return;
    }

    if (authMode === 'SIGNUP') {
      const existing = allUsers.find(u => u.phone === loginPhone);
      if (existing) return alert("Phone already registered!");
      const newUser: UserProfile = {
        name: loginName || "Player", phone: loginPhone, password: loginPassword, balance: 400, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginPhone}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: []
      };
      await databaseService.updateUser(newUser);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      setUser(newUser);
      setView('LOBBY');
    } else {
      const existingUser = allUsers.find(u => u.phone === loginPhone && u.password === loginPassword);
      if (existingUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(existingUser));
        setUser(existingUser);
        setView('LOBBY');
      } else alert("Wrong credentials!");
    }
  };

  const handleUpdateUsersDB = async (updatedUsers: UserProfile[]) => {
    setAllUsers(updatedUsers);
    const currentUserInDB = updatedUsers.find(u => u.phone === user.phone);
    if (currentUserInDB) {
      setUser(currentUserInDB);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUserInDB));
      await databaseService.updateUser(currentUserInDB);
    }
  };

  const handleApproveTransaction = async (tx: PendingTransaction) => {
    const targetUser = allUsers.find(u => u.phone === tx.phone);
    if (!targetUser) return alert("User not found!");
    
    const newBalance = tx.type === 'DEPOSIT' ? targetUser.balance + tx.amount : targetUser.balance - tx.amount;
    const updatedUser = { ...targetUser, balance: Math.max(0, newBalance) };
    
    await databaseService.updateUser(updatedUser);
    await databaseService.updateTransactionStatus(tx.id, 'APPROVED');
    refreshCloudData();
    alert("Transaction Approved!");
  };

  const handleRejectTransaction = async (txId: string) => {
    await databaseService.updateTransactionStatus(txId, 'REJECTED');
    refreshCloudData();
    alert("Transaction Rejected!");
  };

  const syncMatchState = useCallback(async (currentGS: GameState) => {
    if (!matchIdRef.current) return;
    const match: LiveMatch = {
        matchId: matchIdRef.current,
        players: currentGS.players.map(p => ({ name: p.name, color: p.color, score: p.tokens.filter(t => t.state === TokenState.WIN).length })),
        currentPlayer: currentGS.players[currentGS.currentPlayerIndex].name,
        stake: selectedStake,
        startTime: new Date().toLocaleTimeString(),
        status: 'ACTIVE'
    };
    await databaseService.syncMatch(match);
  }, [selectedStake]);

  const switchTurn = useCallback((bonus: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      let nextIdx = prev.currentPlayerIndex;
      if (!bonus) {
          nextIdx = (prev.currentPlayerIndex + 1) % prev.players.length;
      }
      const nextState = { ...prev, currentPlayerIndex: nextIdx, isDiceRolled: false, diceValue: null, consecutiveSixes: bonus && prev.diceValue === 6 ? prev.consecutiveSixes + 1 : 0 };
      syncMatchState(nextState);
      return nextState;
    });
  }, [syncMatchState]);

  const moveToken = async (tokenId: number) => {
    if (!gameState || !gameState.diceValue || animating) return;
    setAnimating(true);
    const dice = gameState.diceValue;
    const players = [...gameState.players];
    const playerIndex = gameState.currentPlayerIndex;
    const player = players[playerIndex];
    const token = player.tokens.find(t => t.id === tokenId);
    if (!token) { setAnimating(false); return; }

    if (token.state === TokenState.HOME && dice === 6) {
      token.state = TokenState.PATH;
      token.position = 0; 
      token.distanceTraveled = 0;
      soundManager.play('move');
    } else {
      for (let i = 0; i < dice; i++) {
        token.distanceTraveled += 1;
        // Logic for home entrance
        if (token.distanceTraveled >= 51) {
            token.position = 100 + (token.distanceTraveled - 51); // Special home track mapping
        } else {
            token.position = (token.position + 1) % 52;
        }
        soundManager.play('move');
        setGameState(prev => prev ? ({ ...prev, players: [...players] }) : null);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    let didCapture = false;
    let didReachFinish = false;

    if (token.distanceTraveled === 57) {
        token.state = TokenState.WIN;
        didReachFinish = true;
        soundManager.play('win');
    } else if (token.distanceTraveled < 51) {
        const myAbs = (token.position + START_POSITIONS[player.color]) % 52;
        if (!SAFE_SPOTS.includes(myAbs)) {
            players.forEach((p, pIdx) => {
                if (pIdx !== playerIndex) {
                    p.tokens.forEach(ot => {
                        const otAbs = (ot.position + START_POSITIONS[p.color]) % 52;
                        if (ot.state === TokenState.PATH && otAbs === myAbs) {
                            ot.state = TokenState.HOME;
                            ot.position = -1;
                            ot.distanceTraveled = 0;
                            didCapture = true;
                            soundManager.play('kill');
                        }
                    });
                }
            });
        }
    }

    setGameState(prev => {
        const gs = prev ? ({ ...prev, players: [...players] }) : null;
        if (gs) syncMatchState(gs);
        return gs;
    });

    setTimeout(() => {
      setAnimating(false);
      if (player.tokens.every(t => t.state === TokenState.WIN)) {
        alert(`${player.name} Won! Entry Stake: ৳${selectedStake}`);
        databaseService.deleteMatch(matchIdRef.current || '');
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 300);
  };

  const rollDice = useCallback(async () => {
    if (animating || (gameState && gameState.isDiceRolled)) return;
    setAnimating(true);
    soundManager.play('dice');
    
    const matches = await databaseService.getLiveMatches();
    const myMatch = matches.find(m => m.matchId === matchIdRef.current);
    let override = myMatch?.nextRollOverride;
    if (override) {
        myMatch!.nextRollOverride = null;
        await databaseService.syncMatch(myMatch!);
    }

    setTimeout(() => {
      const val = override || Math.floor(Math.random() * 6) + 1;
      setAnimating(false);
      soundManager.play('dice_stop');
      if (val === 6) soundManager.play('six');
      
      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && (t.distanceTraveled + val) <= 57));
        if (!canMove) setTimeout(() => switchTurn(false), 1000);
        const nextState = { ...prev, diceValue: val, isDiceRolled: true };
        syncMatchState(nextState);
        return nextState;
      });
    }, 700); 
  }, [animating, gameState, syncMatchState, switchTurn]);

  useEffect(() => {
    if (view !== 'GAME' || !gameState || animating) return;
    const cp = gameState.players[gameState.currentPlayerIndex];
    if (!cp || !cp.isBot) return;
    
    if (!gameState.isDiceRolled) {
        botActionTimeoutRef.current = window.setTimeout(rollDice, 1500);
    } else if (gameState.diceValue !== null) {
        const possibleMoves = cp.tokens.filter(t => (t.state === TokenState.HOME && gameState.diceValue === 6) || (t.state === TokenState.PATH && t.distanceTraveled + gameState.diceValue <= 57)).map(t => t.id);
        if (possibleMoves.length > 0) {
            botActionTimeoutRef.current = window.setTimeout(() => moveToken(possibleMoves[0]), 1000);
        }
    }
    return () => { if (botActionTimeoutRef.current) clearTimeout(botActionTimeoutRef.current); };
  }, [view, gameState, animating, rollDice, moveToken]);

  const initGame = async () => {
    if (user.balance < selectedStake) return alert("Insufficient Balance");
    soundManager.play('click');
    const players: Player[] = [];
    let colors = selectedPlayerCount === 2 ? [PlayerColor.RED, PlayerColor.YELLOW] : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    players.push({
      id: 'p1', name: user.name, color: colors[0], isBot: false, avatarUrl: user.avatar,
      tokens: [0,1,2,3].map(id => ({ id, color: colors[0], state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
    });

    for (let i = 1; i < selectedPlayerCount; i++) {
        const bName = getRandomBotName();
        players.push({
            id: `p${i+1}`, name: bName, color: colors[i], isBot: true, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bName}`,
            tokens: [0,1,2,3].map(id => ({ id, color: colors[i], state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
        });
    }

    const matchId = `match_${Date.now()}`;
    matchIdRef.current = matchId;
    const initialGS: GameState = { players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: "", consecutiveSixes: 0 };
    setGameState(initialGS);
    await syncMatchState(initialGS);
    setView('GAME');
  };

  const validTokens = useMemo(() => {
    if (!gameState || !gameState.isDiceRolled || gameState.diceValue === null) return [];
    const player = gameState.players[gameState.currentPlayerIndex];
    const val = gameState.diceValue;
    return player.tokens.filter(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && t.distanceTraveled + val <= 57)).map(t => t.id);
  }, [gameState]);

  if (view === 'SPLASH') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center dotted-bg">
      <img src={LOGO_URL} className="w-32 h-32 animate-pulse mb-8" />
      <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">Ludo Online Arena</h1>
      <div className="w-64 bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
        <div className="bg-sky-500 h-full transition-all duration-500" style={{width:`${loadingProgress}%`}}></div>
      </div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 dotted-bg">
        <form onSubmit={handleAuthAction} className="bg-[#1e293b] p-10 rounded-[45px] w-full max-sm:max-w-xs max-w-sm border border-white/10 space-y-5 shadow-2xl">
          <div className="text-center mb-6">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Arena Access</h2>
              <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mt-1">Join the global competition</p>
          </div>
          {authMode === 'SIGNUP' && <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Display Name" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-sky-500" />}
          <input type="text" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-sky-500" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Security Code" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-sky-500" />
          <button type="submit" className="w-full bg-sky-500 py-6 rounded-3xl font-black text-white uppercase tracking-[0.2em] shadow-xl hover:bg-sky-400 transition-all">{authMode === 'LOGIN' ? 'Login' : 'Create Account'}</button>
          <div className="flex justify-between px-2">
              <p className="text-white/20 text-[10px] font-black uppercase cursor-pointer hover:text-white" onClick={() => setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}>{authMode === 'LOGIN' ? "No account? Signup" : "Already registered? Login"}</p>
              <p className="text-white/10 text-[10px] font-black uppercase cursor-pointer" onClick={() => setAuthMode('ADMIN_LOGIN')}>Admin</p>
          </div>
        </form>
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal 
      user={user} 
      allUsers={allUsers} 
      onUpdateUsersDB={handleUpdateUsersDB} 
      pendingTransactions={pendingTransactions} 
      liveMatches={liveMatches} 
      onApproveTransaction={handleApproveTransaction} 
      onRejectTransaction={handleRejectTransaction} 
      onExit={() => { localStorage.removeItem(STORAGE_KEY_ADMIN); setView('LOGIN'); }} 
      onUpdateUser={setUser} 
    />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col relative text-white dotted-bg overflow-hidden">
        <div className="p-6 flex items-center justify-between z-[100] relative bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-4">
                <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-yellow-500 shadow-lg" />
                <div>
                    <h3 className="font-black text-sm uppercase tracking-tighter">{user.name}</h3>
                    <p className="text-[8px] text-green-400 font-black uppercase tracking-[0.3em] animate-pulse flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full"></span> Online
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-[#1e293b] px-6 py-2 rounded-full border-2 border-yellow-500/20 flex items-center gap-4 shadow-inner">
                    <span className="text-yellow-400 font-black text-xl">৳</span>
                    <span className="font-black text-2xl tracking-tighter">{user.balance.toLocaleString()}</span>
                    <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-8 h-8 rounded-full font-black text-xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all">+</button>
                </div>
                <button onClick={handleLogout} className="bg-red-500/10 text-red-500 w-12 h-12 rounded-2xl flex items-center justify-center border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">✕</button>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8 max-w-2xl mx-auto w-full">
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 w-full p-16 rounded-[60px] shadow-[0_40px_80px_rgba(0,0,0,0.5)] text-center border-b-[12px] border-indigo-950 hover:scale-[1.02] active:translate-y-2 active:border-b-0 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setView('MATCH_CONFIG')}>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
                <h2 className="text-5xl font-black uppercase italic mb-3 tracking-tighter text-white drop-shadow-2xl">BATTLE ONLINE</h2>
                <p className="text-white/40 text-xs uppercase font-black tracking-[0.4em]">Earn ৳ Real Cash Globally</p>
                <div className="mt-8 inline-block bg-yellow-500 text-black px-10 py-4 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl">Start Match 🎲</div>
            </div>

            <div className="grid grid-cols-2 gap-8 w-full">
                <div className="bg-white/5 p-10 rounded-[45px] border border-white/5 text-center hover:bg-white/10 transition-all cursor-pointer shadow-xl">
                    <span className="text-5xl block mb-4">🤖</span>
                    <p className="font-black text-[10px] uppercase tracking-[0.5em] text-sky-400">Training</p>
                </div>
                <div className="bg-white/5 p-10 rounded-[45px] border border-white/5 text-center hover:bg-white/10 transition-all cursor-pointer shadow-xl">
                    <span className="text-5xl block mb-4">👬</span>
                    <p className="font-black text-[10px] uppercase tracking-[0.5em] text-yellow-500">Private</p>
                </div>
            </div>
        </div>
        
        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={(tx) => { databaseService.submitTransaction(tx); refreshCloudData(); }} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-6 text-white dotted-bg">
        <div className="bg-[#1e293b] p-12 rounded-[55px] w-full max-w-sm shadow-2xl border border-white/10 backdrop-blur-md">
           <h2 className="text-3xl font-black italic uppercase text-center mb-10 text-yellow-500 tracking-tighter">Table Setup</h2>
           <div className="grid grid-cols-2 gap-5 mb-10">
              {[2, 4].map(c => <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-8 rounded-[30px] font-black text-lg border-2 transition-all ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-300 shadow-xl scale-105' : 'bg-white/5 border-transparent text-white/30'}`}>{c} Players</button>)}
           </div>
           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-4 text-center">Entry Fee</p>
           <div className="grid grid-cols-3 gap-3 mb-12">
              {STAKE_OPTIONS.map(s => <button key={s} onClick={() => setSelectedStake(s)} className={`py-5 rounded-[22px] font-black text-sm border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-xl scale-110' : 'bg-white/5 border-transparent text-white/30'}`}>{s}</button>)}
           </div>
           <button onClick={initGame} className="w-full bg-green-500 py-8 rounded-[35px] font-black text-2xl shadow-2xl active:scale-95 hover:bg-green-400 transition-all uppercase tracking-widest border-b-[10px] border-green-700">Enter Arena</button>
           <p className="text-center mt-6 text-white/20 text-[10px] font-black uppercase cursor-pointer" onClick={() => setView('LOBBY')}>Back to Lobby</p>
        </div>
    </div>
  );

  if (view === 'GAME' && gameState) return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative text-white overflow-hidden">
        <div className="w-full h-20 bg-slate-900/90 backdrop-blur-md flex justify-between items-center px-8 border-b border-white/5 shadow-2xl z-[100]">
           <button onClick={() => { if(confirm("Surrender?")) setView('LOBBY'); }} className="text-red-500 font-black text-xs uppercase bg-red-500/10 px-6 py-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all">Surrender</button>
           <div className="font-black text-sky-400 italic text-2xl uppercase tracking-tighter drop-shadow-xl">Ludo Battle</div>
           <div className="bg-yellow-500/10 px-6 py-3 rounded-2xl text-yellow-500 font-black text-lg border border-yellow-500/20 shadow-inner">৳{selectedStake}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8 w-full max-h-[calc(100vh-80px)]">
            <div className="w-full max-w-[500px] aspect-square shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-[45px] overflow-hidden border-[10px] border-white/10 bg-white/5">
                <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} validTokens={validTokens} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-6 pb-12">
                <div className="h-10">
                    <p className="text-xl font-black uppercase text-sky-400 tracking-[0.4em] animate-pulse">{gameState.players[gameState.currentPlayerIndex].name}'s Turn</p>
                </div>
                <div onClick={!gameState.players[gameState.currentPlayerIndex].isBot ? rollDice : undefined} className={`w-32 h-32 bg-white rounded-[45px] shadow-2xl flex items-center justify-center text-7xl font-black text-slate-800 border-b-[12px] border-slate-300 transition-all ${animating ? 'animate-bounce-slow' : ''} ${(gameState.isDiceRolled || gameState.players[gameState.currentPlayerIndex].isBot) && !animating ? 'opacity-30' : 'cursor-pointer hover:scale-110 active:scale-95 active:border-b-0'}`}>
                   {gameState.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );

  return null;
};

export default App;
