
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS, START_POSITIONS, HOME_ENTRANCE } from './constants';
import { databaseService } from './services/database';

const LOGO_ICON = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
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

const LATEST_WINNERS = [
  "Rony Khan withdraw ৳৫০০০", "Sajid Ahmed won ৳২০০০", "Aryan Dev withdraw ৳১০০০", 
  "Sumaiya won ৳৫০০", "Tanvir withdraw ৳৩০০০", "Mehedi won ৳১০০০০"
];

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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  
  const matchIdRef = useRef<string | null>(null);
  const botActionTimeoutRef = useRef<number | null>(null);

  const refreshCloudData = useCallback(async () => {
    const users = await databaseService.getUsers();
    setAllUsers(users);
    const txs = await databaseService.getPendingTransactions();
    setPendingTransactions(txs);
    const matches = await databaseService.getLiveMatches();
    setLiveMatches(matches);

    const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUserStr) {
        const saved = JSON.parse(savedUserStr);
        const upToDateUser = users.find(u => u.phone === saved.phone);
        if (upToDateUser) {
            setUser(upToDateUser);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(upToDateUser));
        }
    }

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
            }, 800);
            return 100;
          }
          return prev + 5;
        });
      }, 30);
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
    if (!matchIdRef.current || isPracticeMode) return;
    const match: LiveMatch = {
        matchId: matchIdRef.current,
        players: currentGS.players.map(p => ({ name: p.name, color: p.color, score: p.tokens.filter(t => t.state === TokenState.WIN).length })),
        currentPlayer: currentGS.players[currentGS.currentPlayerIndex].name,
        stake: selectedStake,
        startTime: new Date().toLocaleTimeString(),
        status: 'ACTIVE'
    };
    await databaseService.syncMatch(match);
  }, [selectedStake, isPracticeMode]);

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
        if (token.distanceTraveled >= 51) {
            token.position = 100 + (token.distanceTraveled - 51);
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

    setTimeout(async () => {
      setAnimating(false);
      if (player.tokens.every(t => t.state === TokenState.WIN)) {
        const winningAmount = isPracticeMode ? 0 : selectedStake * 1.8;
        if (!player.isBot && !isPracticeMode) {
            const updatedUser = { 
                ...user, 
                balance: user.balance + winningAmount,
                stats: { ...user.stats, wins: user.stats.wins + 1, totalWinnings: user.stats.totalWinnings + winningAmount }
            };
            setUser(updatedUser);
            await databaseService.updateUser(updatedUser);
        }
        alert(`${player.name} Won ${winningAmount > 0 ? `৳${winningAmount}` : 'the Practice Match'}!`);
        if (!isPracticeMode) await databaseService.deleteMatch(matchIdRef.current || '');
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
    
    let override = null;
    if (!isPracticeMode) {
        const matches = await databaseService.getLiveMatches();
        const myMatch = matches.find(m => m.matchId === matchIdRef.current);
        override = myMatch?.nextRollOverride;
        if (override) {
            myMatch!.nextRollOverride = null;
            await databaseService.syncMatch(myMatch!);
        }
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
  }, [animating, gameState, syncMatchState, switchTurn, isPracticeMode]);

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

  const initGame = async (practice: boolean = false) => {
    const stake = practice ? 0 : selectedStake;
    if (!practice && user.balance < stake) return alert("Insufficient Balance");
    soundManager.play('click');

    setIsPracticeMode(practice);

    if (!practice) {
        const updatedUser = { ...user, balance: user.balance - stake, stats: { ...user.stats, totalGames: user.stats.totalGames + 1 } };
        setUser(updatedUser);
        await databaseService.updateUser(updatedUser);
    }

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
    
    if (!practice) {
        await syncMatchState(initialGS);
    }
    
    setView('GAME');
  };

  const validTokens = useMemo(() => {
    if (!gameState || !gameState.isDiceRolled || gameState.diceValue === null) return [];
    const player = gameState.players[gameState.currentPlayerIndex];
    const val = gameState.diceValue;
    return player.tokens.filter(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && t.distanceTraveled + val <= 57)).map(t => t.id);
  }, [gameState]);

  if (view === 'SPLASH') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center dotted-bg overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-transparent"></div>
      <div className="relative animate-float mb-12 flex flex-col items-center">
        <img src={LOGO_ICON} className="w-24 h-24 mb-6 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]" />
        <h1 className="ludo-money-logo text-7xl md:text-9xl tracking-tight text-center">
          LUDO<br/><span className="text-5xl md:text-7xl">MONEY</span>
        </h1>
      </div>
      <div className="w-72 bg-white/5 h-3 rounded-full overflow-hidden border border-white/10 p-[2px]">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-300 h-full rounded-full transition-all duration-300" style={{width:`${loadingProgress}%`}}></div>
      </div>
      <p className="mt-4 text-yellow-500/60 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading Arena...</p>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 dotted-bg overflow-hidden relative">
        <div className="absolute top-10 flex flex-col items-center">
          <h1 className="ludo-money-logo text-5xl tracking-tight">LUDO MONEY</h1>
          <p className="text-sky-400 font-black text-[10px] uppercase tracking-[0.4em] mt-2">Win Real Cash Rewards</p>
        </div>
        <form onSubmit={handleAuthAction} className="premium-card p-10 rounded-[50px] w-full max-w-sm border border-yellow-500/20 space-y-5 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative z-10">
          <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Arena Access</h2>
              <div className="h-1 w-20 bg-yellow-500 mx-auto mt-2 rounded-full"></div>
          </div>
          {authMode === 'SIGNUP' && <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Display Name" className="w-full bg-slate-800/50 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all font-bold placeholder:text-white/20" />}
          <input type="text" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-slate-800/50 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all font-bold placeholder:text-white/20" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Security Code" className="w-full bg-slate-800/50 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all font-bold placeholder:text-white/20" />
          <button type="submit" className="w-full gold-button py-6 rounded-3xl font-black text-black uppercase tracking-[0.2em] text-lg mt-4">
            {authMode === 'LOGIN' ? 'Login' : 'Create Account'}
          </button>
          <div className="flex justify-between px-2 pt-4">
              <p className="text-yellow-500/40 text-[10px] font-black uppercase cursor-pointer hover:text-yellow-500 transition-colors" onClick={() => setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}>{authMode === 'LOGIN' ? "No account? Signup" : "Already registered? Login"}</p>
              <p className="text-white/10 text-[10px] font-black uppercase cursor-pointer hover:text-white/30 transition-colors" onClick={() => setAuthMode('ADMIN_LOGIN')}>Admin Access</p>
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
        <div className="p-6 flex items-center justify-between z-[100] relative bg-slate-900/90 backdrop-blur-2xl border-b border-yellow-500/10 shadow-xl">
            <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={user.avatar} className="w-14 h-14 rounded-full border-4 border-yellow-500/30 shadow-2xl" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#0a1220] rounded-full"></div>
                </div>
                <div>
                    <h3 className="font-black text-base uppercase tracking-tight italic">{user.name}</h3>
                    <div className="bg-yellow-500/10 px-3 py-0.5 rounded-full border border-yellow-500/20 inline-block mt-1">
                      <p className="text-[9px] text-yellow-500 font-black uppercase tracking-widest">VIP Member</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-black/40 px-6 py-3 rounded-3xl border-2 border-yellow-500/30 flex items-center gap-4 shadow-2xl group hover:border-yellow-500 transition-all cursor-pointer" onClick={() => setWalletOpen(true)}>
                    <div className="w-8 h-8 bg-gradient-to-b from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center text-black font-black text-xl shadow-lg ring-2 ring-yellow-500/20 group-hover:scale-110 transition-transform">৳</div>
                    <span className="font-black text-2xl tracking-tighter text-yellow-500">{user.balance.toLocaleString()}</span>
                    <div className="bg-yellow-500 text-black w-6 h-6 rounded-full font-black text-base flex items-center justify-center shadow-lg">+</div>
                </div>
                <button onClick={handleLogout} className="bg-red-500/10 text-red-500 w-12 h-12 rounded-2xl flex items-center justify-center border border-red-500/10 hover:bg-red-500 hover:text-white transition-all shadow-lg">✕</button>
            </div>
        </div>

        <div className="w-full bg-yellow-500/5 py-2 border-b border-yellow-500/10 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap inline-block">
             {LATEST_WINNERS.concat(LATEST_WINNERS).map((msg, i) => (
               <span key={i} className="mx-12 text-[11px] font-black uppercase tracking-widest text-yellow-500/80">🔥 {msg}</span>
             ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8 max-w-4xl mx-auto w-full pb-20">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-gradient-to-br from-blue-700 to-indigo-950 p-12 rounded-[60px] shadow-[0_40px_80px_rgba(0,0,0,0.6)] text-center border-b-[15px] border-indigo-950 hover:scale-[1.02] active:translate-y-2 active:border-b-0 transition-all cursor-pointer group relative overflow-hidden flex flex-col items-center justify-center" onClick={() => { setIsPracticeMode(false); setView('MATCH_CONFIG'); }}>
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1)_0%,transparent_60%)]"></div>
                  <span className="text-7xl block mb-6 animate-float drop-shadow-2xl">🎲</span>
                  <h2 className="text-4xl font-black uppercase italic mb-2 tracking-tighter text-white">Battle Online</h2>
                  <p className="text-yellow-400 text-[10px] uppercase font-black tracking-[0.4em] mb-8">Win Huge Real Money</p>
                  <div className="gold-button text-black px-12 py-5 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl">Join Table</div>
               </div>

               <div className="grid grid-rows-2 gap-8">
                  <div className="bg-slate-800/40 p-8 rounded-[45px] border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer shadow-xl group" onClick={() => { setSelectedPlayerCount(2); initGame(true); }}>
                      <div className="flex items-center gap-6">
                        <span className="text-5xl group-hover:scale-110 transition-transform">🤖</span>
                        <div>
                          <h4 className="font-black text-xl uppercase italic tracking-tighter">Practice</h4>
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Train for free</p>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">→</div>
                  </div>
                  <div className="bg-slate-800/40 p-8 rounded-[45px] border border-white/5 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer shadow-xl group" onClick={() => alert("Private Room feature is coming soon! Use Battle Online to play with others.")}>
                      <div className="flex items-center gap-6">
                        <span className="text-5xl group-hover:scale-110 transition-transform">👬</span>
                        <div>
                          <h4 className="font-black text-xl uppercase italic tracking-tighter">Private</h4>
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Play with friends</p>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">→</div>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-8 w-full justify-center">
               <div className="text-center">
                  <p className="text-[40px] font-black text-white">10K+</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Active</p>
               </div>
               <div className="w-[1px] h-12 bg-white/10"></div>
               <div className="text-center">
                  <p className="text-[40px] font-black text-yellow-500">৳1M+</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Payouts</p>
               </div>
            </div>
        </div>
        
        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={(tx) => { databaseService.submitTransaction(tx); refreshCloudData(); }} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-6 text-white dotted-bg">
        <div className="premium-card p-12 rounded-[60px] w-full max-w-sm shadow-2xl border border-yellow-500/10">
           <h2 className="ludo-money-logo text-3xl text-center mb-10 tracking-tighter">SELECT STAKE</h2>
           <div className="grid grid-cols-2 gap-5 mb-10">
              {[2, 4].map(c => <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-8 rounded-[35px] font-black text-lg border-2 transition-all ${selectedPlayerCount === c ? 'bg-blue-600 border-blue-400 shadow-xl scale-105' : 'bg-white/5 border-transparent text-white/30'}`}>{c} Players</button>)}
           </div>
           <p className="text-[10px] font-black text-yellow-500/40 uppercase tracking-[0.5em] mb-4 text-center">Entry Fee (৳)</p>
           <div className="grid grid-cols-3 gap-3 mb-12">
              {STAKE_OPTIONS.map(s => <button key={s} onClick={() => setSelectedStake(s)} className={`py-5 rounded-[22px] font-black text-sm border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-xl scale-110' : 'bg-white/5 border-transparent text-white/30'}`}>{s}</button>)}
           </div>
           <button onClick={() => initGame(false)} className="w-full gold-button py-8 rounded-[40px] font-black text-2xl uppercase tracking-widest text-black">Start Battle</button>
           <p className="text-center mt-6 text-white/20 text-[10px] font-black uppercase cursor-pointer hover:text-white transition-colors" onClick={() => setView('LOBBY')}>Cancel & Return</p>
        </div>
    </div>
  );

  if (view === 'GAME' && gameState) return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative text-white overflow-hidden">
        <div className="w-full h-20 bg-slate-900/95 backdrop-blur-xl flex justify-between items-center px-8 border-b border-yellow-500/10 shadow-2xl z-[100]">
           <button onClick={() => { if(confirm("Surrender?")) setView('LOBBY'); }} className="text-red-500 font-black text-[10px] uppercase bg-red-500/10 px-6 py-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all tracking-widest border border-red-500/20">Surrender</button>
           <div className="ludo-money-logo text-3xl tracking-tighter">LUDO MONEY</div>
           <div className="bg-yellow-500/10 px-6 py-3 rounded-2xl text-yellow-500 font-black text-xl border border-yellow-500/20 shadow-inner">{isPracticeMode ? 'Practice' : `৳${selectedStake}`}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8 w-full max-h-[calc(100vh-80px)]">
            <div className="w-full max-w-[500px] aspect-square shadow-[0_60px_120px_rgba(0,0,0,0.8)] rounded-[50px] overflow-hidden border-[12px] border-white/5 bg-white/5 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} validTokens={validTokens} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-6 pb-12 w-full max-w-sm">
                <div className="flex items-center gap-4 bg-slate-800/40 p-4 px-8 rounded-full border border-white/5 shadow-2xl">
                    <img src={gameState.players[gameState.currentPlayerIndex].avatarUrl} className="w-10 h-10 rounded-full border-2 border-yellow-500" alt="" />
                    <p className="text-xl font-black uppercase text-white tracking-tight">{gameState.players[gameState.currentPlayerIndex].name}'s Turn</p>
                </div>
                <div onClick={!gameState.players[gameState.currentPlayerIndex].isBot ? rollDice : undefined} className={`w-36 h-36 bg-white rounded-[50px] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex items-center justify-center text-8xl font-black text-slate-800 border-b-[15px] border-slate-300 transition-all ${animating ? 'animate-bounce-slow' : ''} ${(gameState.isDiceRolled || gameState.players[gameState.currentPlayerIndex].isBot) && !animating ? 'opacity-30' : 'cursor-pointer hover:scale-110 active:scale-95 active:border-b-0 active:translate-y-4'}`}>
                   {gameState.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );

  return null;
};

export default App;
