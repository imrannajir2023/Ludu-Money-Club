
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS, START_POSITIONS } from './constants';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
const STORAGE_KEY_USER = "LUDO_USER_PROFILE";
const STORAGE_KEY_USERS_DB = "LUDO_USERS_DATABASE"; 
const STORAGE_KEY_TXS = "LUDO_PENDING_TRANSACTIONS";
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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  const botActionTimeoutRef = useRef<number | null>(null);

  // 1. Initial Load and Cross-Tab Real-time Sync
  useEffect(() => {
    const loadData = () => {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) setUser(JSON.parse(savedUser));
      
      const savedTxs = localStorage.getItem(STORAGE_KEY_TXS);
      if (savedTxs) setPendingTransactions(JSON.parse(savedTxs));
    };

    loadData();

    // Listener for real-time updates across tabs (e.g. User sends, Admin receives)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TXS) {
        if (e.newValue) setPendingTransactions(JSON.parse(e.newValue));
      }
      if (e.key === STORAGE_KEY_USER && e.newValue) {
        setUser(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 2. Persistent View Redirection in Splash
  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const isAdmin = localStorage.getItem(STORAGE_KEY_ADMIN);
              if (isAdmin === 'true') {
                  setView('ADMIN');
                  return 100;
              }
              const savedUser = localStorage.getItem(STORAGE_KEY_USER);
              if (savedUser) {
                  const parsed = JSON.parse(savedUser);
                  if (parsed.phone) {
                      setView('LOBBY');
                      return 100;
                  }
              }
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

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm("আপনি কি লগআউট করতে চান?")) {
        soundManager.play('click');
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_ADMIN);
        window.location.reload();
    }
  };

  const handleAuthAction = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('click');
    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');

    if (authMode === 'ADMIN_LOGIN') {
      if (loginPhone === 'emukhan580' && loginPassword === 'Imran2015@!@!') {
        localStorage.setItem(STORAGE_KEY_ADMIN, 'true');
        setView('ADMIN');
      } else {
        alert("ভুল এডমিন আইডি বা পাসওয়ার্ড!");
      }
      return;
    }

    if (authMode === 'SIGNUP') {
      if (!loginPhone || !loginPassword) return alert("সব ঘর পূরণ করুন!");
      if (usersDB.some(u => u.phone === loginPhone)) return alert("এই নম্বর দিয়ে আগে থেকেই অ্যাকাউন্ট খোলা আছে!");
      
      const newUser: UserProfile = {
        name: loginName || "Player", phone: loginPhone, password: loginPassword, balance: 400, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginPhone}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: []
      };
      usersDB.push(newUser);
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDB));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      setUser(newUser);
      setView('LOBBY');
    } else {
      const existingUser = usersDB.find(u => u.phone === loginPhone && u.password === loginPassword);
      if (existingUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(existingUser));
        setUser(existingUser);
        setView('LOBBY');
      } else alert("ভুল ফোন নম্বর বা পাসওয়ার্ড!");
    }
  };

  const handleAddTransaction = (tx: PendingTransaction) => {
    setPendingTransactions(prev => {
      const updated = [...prev, tx];
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(updated));
      return updated;
    });
  };

  const approveTransaction = (tx: PendingTransaction) => {
    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');
    const targetIdx = usersDB.findIndex(u => u.phone === tx.phone);
    
    if (targetIdx !== -1) {
      if (tx.type === 'DEPOSIT') usersDB[targetIdx].balance += tx.amount;
      else if (tx.type === 'WITHDRAW') usersDB[targetIdx].balance -= tx.amount;
      
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDB));
      
      if (user.phone === usersDB[targetIdx].phone) {
        const updatedUser = { ...user, balance: usersDB[targetIdx].balance };
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
      }
    }

    setPendingTransactions(prev => {
      const remaining = prev.filter(t => t.id !== tx.id);
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(remaining));
      return remaining;
    });
    soundManager.play('win');
  };

  const rejectTransaction = (txId: string) => {
    setPendingTransactions(prev => {
      const remaining = prev.filter(t => t.id !== txId);
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(remaining));
      return remaining;
    });
    soundManager.play('click');
  };

  const winners = useMemo(() => [
    "সালাম ১০০০ টাকা জিতেছে!",
    "শাকিব ৫০০ টাকা উইথড্র করেছে!",
    "মেহেদী ২০০০ টাকা জিতেছে!",
    "অনিক ৫০০০ টাকা উইথড্র করেছে!",
    "তন্ময় ৫০০০ টাকা বোনাস পেয়েছে!"
  ], []);

  const validTokens = useMemo(() => {
    if (!gameState || !gameState.isDiceRolled || gameState.diceValue === null) return [];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const val = gameState.diceValue;
    return currentPlayer.tokens
      .filter(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && t.distanceTraveled + val <= 57))
      .map(t => t.id);
  }, [gameState]);

  const switchTurn = useCallback((bonus: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      if (bonus) return { ...prev, isDiceRolled: false, diceValue: null };
      const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      return { ...prev, currentPlayerIndex: nextIndex, consecutiveSixes: 0, diceValue: null, isDiceRolled: false };
    });
  }, []);

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
      setGameState(prev => prev ? ({ ...prev, players: [...players] }) : null);
      await new Promise(resolve => setTimeout(resolve, 400));
    } else {
      for (let i = 0; i < dice; i++) {
        token.distanceTraveled += 1;
        token.position = (token.position + 1) % 52;
        soundManager.play('move');
        setGameState(prev => prev ? ({ ...prev, players: [...players] }) : null);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    let didCapture = false;
    let didReachFinish = false;
    if (token.distanceTraveled === 57) {
      token.state = TokenState.WIN;
      didReachFinish = true;
      soundManager.play('win');
    } else if (token.distanceTraveled < 51) {
      const myAbsolutePos = (token.position + START_POSITIONS[player.color]) % 52;
      if (!SAFE_SPOTS.includes(myAbsolutePos)) {
        players.forEach((p, pIdx) => {
          if (pIdx !== playerIndex) {
            p.tokens.forEach(ot => {
              const otherAbs = (ot.position + START_POSITIONS[p.color]) % 52;
              if (ot.state === TokenState.PATH && otherAbs === myAbsolutePos) {
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
    setGameState(prev => prev ? ({ ...prev, players: [...players] }) : null);
    setTimeout(() => {
      setAnimating(false);
      if (player.tokens.every(t => t.state === TokenState.WIN)) {
        alert(`${player.name} Won!`);
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 300);
  };

  const rollDice = useCallback(() => {
    if (animating || (gameState && gameState.isDiceRolled)) return;
    setAnimating(true);
    soundManager.play('dice');
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setAnimating(false);
      soundManager.play('dice_stop');
      if (val === 6) soundManager.play('six');
      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && (t.distanceTraveled + val) <= 57));
        if (!canMove) setTimeout(() => switchTurn(false), 1000);
        return { ...prev, diceValue: val, isDiceRolled: true };
      });
    }, 700); 
  }, [animating, gameState, switchTurn]);

  useEffect(() => {
    if (view !== 'GAME' || !gameState || animating) return;
    const cp = gameState.players[gameState.currentPlayerIndex];
    if (!cp || !cp.isBot) return;
    if (!gameState.isDiceRolled) botActionTimeoutRef.current = window.setTimeout(rollDice, 1200);
    else if (gameState.diceValue !== null) {
      const moves = validTokens;
      if (moves.length > 0) botActionTimeoutRef.current = window.setTimeout(() => moveToken(moves[0]), 1000);
    }
    return () => { if (botActionTimeoutRef.current) clearTimeout(botActionTimeoutRef.current); };
  }, [view, gameState?.currentPlayerIndex, gameState?.isDiceRolled, gameState?.diceValue, animating, rollDice, moveToken, validTokens]);

  const initGame = () => {
    if (user.balance < selectedStake) return alert("ব্যালেন্স পর্যাপ্ত নয়!");
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
    setGameState({ players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: [], lastAction: "", consecutiveSixes: 0 });
    setView('GAME');
  };

  if (view === 'SPLASH') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center dotted-bg">
      <img src={LOGO_URL} className="w-32 h-32 animate-pulse mb-8" />
      <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">Ludo Club</h1>
      <div className="w-64 bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
        <div className="bg-sky-500 h-full transition-all duration-500" style={{width:`${loadingProgress}%`}}></div>
      </div>
      <p className="mt-4 text-white/40 font-black uppercase tracking-[0.3em] text-[10px]">Verifying Session...</p>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 dotted-bg">
      <div className="bg-[#1e293b] rounded-[40px] shadow-2xl w-full max-sm:max-w-xs sm:max-w-sm border border-white/10 overflow-hidden relative">
        <div className="bg-gradient-to-br from-[#1e297a] to-[#0a192f] p-8 text-center border-b border-white/5">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              {authMode === 'ADMIN_LOGIN' ? 'Admin Access' : 'Ludo Club'}
            </h2>
        </div>
        <div className="flex bg-black/20 p-3">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-3xl font-black text-sm uppercase transition-all ${authMode === 'LOGIN' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20'}`}>Login</button>
            <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-4 rounded-3xl font-black text-sm uppercase transition-all ${authMode === 'SIGNUP' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20'}`}>Signup</button>
        </div>
        <form onSubmit={handleAuthAction} className="p-8 space-y-4">
          {authMode === 'SIGNUP' && <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Name" className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />}
          <input type="text" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder={authMode === 'ADMIN_LOGIN' ? "Admin ID" : "Phone (01xxxxxxxxx)"} className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />
          <button type="submit" className="w-full bg-sky-500 py-5 rounded-[20px] font-black text-white shadow-2xl text-lg tracking-widest active:scale-95 transition-all">
             {authMode === 'ADMIN_LOGIN' ? 'OPEN ADMIN' : 'PLAY NOW'}
          </button>
        </form>
        <div onClick={() => setAuthMode(authMode === 'ADMIN_LOGIN' ? 'LOGIN' : 'ADMIN_LOGIN')} className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center opacity-10 cursor-default hover:opacity-50 transition-opacity">🛡️</div>
      </div>
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal user={user} pendingTransactions={pendingTransactions} onUpdateUser={setUser} onApproveTransaction={approveTransaction} onRejectTransaction={rejectTransaction} onExit={() => { localStorage.removeItem(STORAGE_KEY_ADMIN); setView('LOGIN'); }} />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col relative text-white font-fredoka overflow-hidden dotted-bg">
        <div className="p-6 flex items-center justify-between z-[100] relative bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-4 bg-white/10 p-2 pr-6 rounded-full border border-white/20 backdrop-blur-xl shadow-2xl">
                <img src={user.avatar} className="w-14 h-14 rounded-full border-2 border-yellow-500 shadow-xl" />
                <div>
                  <h3 className="font-black text-base uppercase tracking-tighter text-white">{user.name}</h3>
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Connected
                  </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-[24px] px-6 py-3 flex items-center gap-4 border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)] backdrop-blur-md">
                  <span className="text-yellow-400 font-black text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">৳</span>
                  <span className="font-black text-2xl tracking-tighter">{user.balance.toLocaleString()}</span>
                  <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-10 h-10 rounded-xl font-black text-3xl flex items-center justify-center shadow-lg hover:bg-yellow-400 hover:scale-110 active:scale-90 transition-all ml-2">+</button>
              </div>
              
              <button onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white w-14 h-14 rounded-2xl flex items-center justify-center border border-red-500/30 shadow-2xl backdrop-blur-md transition-all group">
                <span className="text-2xl font-black group-hover:rotate-90 transition-transform duration-300">✕</span>
              </button>
            </div>
        </div>

        <div className="flex-1 px-8 space-y-8 overflow-y-auto no-scrollbar pb-32 pt-6 relative z-10">
            <div className="bg-gradient-to-br from-[#243494] via-[#1e297a] to-[#0a192f] rounded-[50px] p-12 shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative overflow-hidden group cursor-pointer border-2 border-white/10 active:scale-95 transition-all" onClick={() => setView('MATCH_CONFIG')}>
                <div className="absolute -top-10 -right-10 w-52 h-52 bg-sky-500/10 rounded-full blur-3xl group-hover:bg-sky-500/20 transition-all"></div>
                <div className="relative z-10">
                  <h2 className="text-5xl font-black italic text-[#FFD700] mb-3 uppercase tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">PLAY ONLINE</h2>
                  <p className="text-white/70 font-bold mb-8 text-base tracking-wide uppercase max-w-[300px]">挑战全球玩家，赢取巨额奖金!</p>
                  <button className="bg-yellow-500 text-black font-black px-12 py-5 rounded-2xl uppercase text-sm tracking-[0.25em] shadow-2xl hover:bg-white transition-all transform group-hover:translate-x-2">START BATTLE 🎲</button>
                </div>
                <div className="absolute bottom-10 right-12 text-8xl opacity-20 group-hover:opacity-100 group-hover:scale-125 transition-all transform duration-700 pointer-events-none">🎲</div>
            </div>

            <div className="grid grid-cols-2 gap-8">
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-white/5 backdrop-blur-xl p-10 rounded-[45px] border border-white/10 text-center cursor-pointer group hover:bg-sky-500/20 transition-all shadow-2xl">
                    <div className="text-6xl mb-4 group-hover:scale-125 transition-all duration-300">🤖</div>
                    <span className="font-black text-sm uppercase tracking-[0.4em] text-sky-400">Training</span>
                </div>
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-white/5 backdrop-blur-xl p-10 rounded-[45px] border border-white/10 text-center cursor-pointer group hover:bg-yellow-500/20 transition-all shadow-2xl">
                    <div className="text-6xl mb-4 group-hover:scale-125 transition-all duration-300">👬</div>
                    <span className="font-black text-sm uppercase tracking-[0.4em] text-yellow-500">Private</span>
                </div>
            </div>
        </div>

        <div className="fixed bottom-0 w-full h-12 bg-yellow-500/90 backdrop-blur-sm flex items-center overflow-hidden z-[200]">
           <div className="bg-black text-yellow-500 px-4 h-full flex items-center font-black text-xs italic uppercase tracking-tighter shrink-0 border-r border-yellow-500/30">🏆 RECENT WINNERS</div>
           <div className="flex-1 overflow-hidden whitespace-nowrap">
              <div className="inline-block animate-marquee pl-[100%] hover:pause">
                 {winners.map((win, idx) => <span key={idx} className="inline-block px-10 text-black font-black text-sm uppercase italic">{win} •</span>)}
                 {winners.map((win, idx) => <span key={`dup-${idx}`} className="inline-block px-10 text-black font-black text-sm uppercase italic">{win} •</span>)}
              </div>
           </div>
        </div>

        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={handleAddTransaction} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-6 text-white dotted-bg relative">
        <div className="bg-[#1e293b] p-12 rounded-[55px] w-full max-w-sm shadow-[0_40px_80px_rgba(0,0,0,0.7)] border border-white/10 backdrop-blur-md">
           <h2 className="text-3xl font-black italic uppercase text-center mb-10 text-yellow-500 tracking-tighter">Table Settings</h2>
           <div className="grid grid-cols-2 gap-5 mb-10">
              {[2, 4].map(c => <button key={c} onClick={() => { soundManager.play('click'); setSelectedPlayerCount(c); }} className={`py-8 rounded-[30px] font-black text-lg border-2 transition-all transform ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-300 shadow-[0_0_30px_rgba(14,165,233,0.4)] scale-105' : 'bg-white/5 border-transparent text-white/30'}`}>{c} Players</button>)}
           </div>
           <p className="text-[12px] font-black text-white/40 uppercase tracking-[0.4em] mb-4 text-center">Entry Stake (৳)</p>
           <div className="grid grid-cols-3 gap-3 mb-12">
              {STAKE_OPTIONS.map(s => <button key={s} onClick={() => { soundManager.play('click'); setSelectedStake(s); }} className={`py-5 rounded-[22px] font-black text-sm border-2 transition-all transform ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-[0_0_25px_rgba(234,179,8,0.4)] scale-110' : 'bg-white/5 border-transparent text-white/30'}`}>{s}</button>)}
           </div>
           <button onClick={() => { soundManager.play('click'); setView('MATCHING'); setTimeout(initGame, 1500); }} className="w-full bg-green-500 py-8 rounded-[30px] font-black text-2xl shadow-2xl active:scale-95 hover:bg-green-400 transition-all uppercase tracking-widest border-b-8 border-green-700">START GAME</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-8 text-white/30 uppercase font-black text-xs tracking-widest">Cancel</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center text-white p-10 dotted-bg">
      <div className="relative w-48 h-48 mb-12">
        <div className="absolute inset-0 border-[10px] border-sky-500/10 rounded-full"></div>
        <div className="absolute inset-0 border-[10px] border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-7xl animate-pulse">🎲</div>
      </div>
      <h2 className="text-3xl font-black italic uppercase animate-pulse tracking-tighter text-sky-400">Finding Opponents...</h2>
    </div>
  );

  if (view === 'GAME' && gameState) return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative text-white overflow-hidden">
        <div className="w-full h-20 bg-[#0f172a]/90 backdrop-blur-md flex justify-between items-center px-8 border-b border-white/10 shrink-0 shadow-2xl z-50">
           <button onClick={() => { if(confirm("Surrender? Entry stake will be lost.")) setView('LOBBY'); }} className="text-red-500 font-black text-sm uppercase bg-red-500/10 px-6 py-3 rounded-2xl hover:bg-red-500 transition-all">Surrender</button>
           <div className="font-black text-sky-400 italic text-2xl uppercase tracking-tighter drop-shadow-lg">Ludo Arena</div>
           <div className="bg-yellow-500/10 px-6 py-3 rounded-2xl text-yellow-500 font-black text-lg border border-yellow-500/20 shadow-inner">৳{selectedStake}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8 w-full max-h-screen overflow-hidden">
            <div className="w-full max-w-[500px] shadow-[0_40px_120px_rgba(0,0,0,0.9)] rounded-[40px] overflow-hidden border-[8px] border-white/20 shrink-0 bg-white/5 relative">
                <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} validTokens={validTokens} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-6 shrink-0 pb-10">
                <div className="text-center h-8"><p className="text-lg font-black uppercase text-sky-400 tracking-[0.4em] animate-pulse drop-shadow-lg">{gameState.players[gameState.currentPlayerIndex].name}'s Turn</p></div>
                <div onClick={!gameState.players[gameState.currentPlayerIndex].isBot ? rollDice : undefined} className={`w-28 h-28 bg-white rounded-[40px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex items-center justify-center text-6xl font-black text-gray-800 border-b-[10px] border-gray-300 transition-all ${animating ? 'animate-bounce-slow' : ''} ${(gameState.isDiceRolled || gameState.players[gameState.currentPlayerIndex].isBot) && !animating ? 'opacity-30' : 'cursor-pointer hover:scale-105 active:scale-90 active:border-b-0'}`}>
                   {gameState.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );

  return null;
};

export default App;
