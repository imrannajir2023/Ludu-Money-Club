
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS } from './constants';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
const STORAGE_KEY_USER = "LUDO_USER_PROFILE";
const STORAGE_KEY_USERS_DB = "LUDO_USERS_DATABASE"; // Mock DB for local testing
const STORAGE_KEY_TX = "LUDO_TRANSACTIONS";

const INITIAL_USER: UserProfile = {
  name: "Guest Player",
  balance: 500,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
  stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
  history: []
};

const STAKE_OPTIONS = [50, 100, 500, 1000, 5000];

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  
  // Login form state
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [animating, setAnimating] = useState(false);
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  const botThinkingRef = useRef(false);

  // Load user and transactions
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    const savedTx = localStorage.getItem(STORAGE_KEY_TX);
    
    if (savedUser) {
        setUser(JSON.parse(savedUser));
        setView('LOBBY'); // Auto login if profile exists
    }
    if (savedTx) setPendingTransactions(JSON.parse(savedTx));

    const handleSync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TX && e.newValue) setPendingTransactions(JSON.parse(e.newValue));
      if (e.key === STORAGE_KEY_USER && e.newValue) setUser(JSON.parse(e.newValue));
    };

    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  // Sync current user profile
  useEffect(() => {
    if (user.name !== "Guest Player") {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  }, [user]);

  // Sync transactions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(pendingTransactions));
  }, [pendingTransactions]);

  // Splash Screen loading
  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const saved = localStorage.getItem(STORAGE_KEY_USER);
              setView(saved ? 'LOBBY' : 'LOGIN');
            }, 800);
            return 100;
          }
          return prev + 5;
        });
      }, 30);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Auth Logic
  const handleAuthAction = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('click');

    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');

    if (authMode === 'SIGNUP') {
      if (loginName.trim().length < 3) return alert("সঠিক নাম লিখুন (কমপক্ষে ৩ অক্ষর)");
      if (!/^\d{11}$/.test(loginPhone)) return alert("১১ অক্ষরের সঠিক ফোন নম্বর দিন");
      if (loginPassword.length < 4) return alert("পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে");
      
      // Check if user already exists
      if (usersDB.some(u => u.phone === loginPhone)) {
        return alert("এই নম্বর দিয়ে অলরেডি অ্যাকাউন্ট করা আছে! দয়া করে লগইন করুন।");
      }

      const newUser: UserProfile = {
        name: loginName.trim(),
        phone: loginPhone,
        password: loginPassword,
        balance: 500, // Signup Bonus
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginName.trim()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
        history: []
      };

      usersDB.push(newUser);
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDB));
      setUser(newUser);
      setView('LOBBY');
      soundManager.play('win');
    } else {
      // Login Mode
      const existingUser = usersDB.find(u => u.phone === loginPhone && u.password === loginPassword);
      if (existingUser) {
        setUser(existingUser);
        setView('LOBBY');
        soundManager.play('win');
      } else {
        alert("ফোন নম্বর বা পাসওয়ার্ড ভুল! অথবা সাইন-আপ করুন।");
      }
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'emukhan580' && adminPassword === 'Imran2015@!@!') {
      soundManager.play('win');
      setIsAdminAuthOpen(false);
      setView('ADMIN');
    } else {
      alert("ভুল অ্যাডমিন তথ্য!");
    }
  };

  const handleNewTransaction = (tx: PendingTransaction) => {
    if (tx.type === 'WITHDRAW') setUser(prev => ({ ...prev, balance: prev.balance - tx.amount }));
    const updatedTx = [...pendingTransactions, tx];
    setPendingTransactions(updatedTx);
    setUser(prev => ({ ...prev, history: [tx, ...prev.history] }));
  };

  const approveTransaction = (tx: PendingTransaction) => {
    soundManager.play('win');
    setUser(prev => {
        const newBalance = tx.type === 'DEPOSIT' ? prev.balance + tx.amount : prev.balance;
        return { 
          ...prev, 
          balance: newBalance,
          history: prev.history.map(h => h.id === tx.id ? { ...h, status: 'APPROVED' } : h)
        }
    });
    setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
  };

  const rejectTransaction = (txId: string) => {
    const tx = pendingTransactions.find(t => t.id === txId);
    if (tx && tx.type === 'WITHDRAW') setUser(prev => ({ ...prev, balance: prev.balance + tx.amount }));
    setUser(prev => ({ 
      ...prev, 
      history: prev.history.map(h => h.id === txId ? { ...h, status: 'REJECTED' } : h)
    }));
    setPendingTransactions(prev => prev.filter(t => t.id !== txId));
  };

  const initGame = () => {
    if (user.balance < selectedStake) return alert("ব্যালেন্স পর্যাপ্ত নয়!");
    setUser(prev => ({ ...prev, balance: prev.balance - selectedStake }));
    const players: Player[] = [];
    
    let colors = selectedPlayerCount === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

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

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null,
      log: ["খেলা শুরু হলো"], lastAction: "", consecutiveSixes: 0
    });
    setView('GAME');
  };

  const switchTurn = useCallback((bonus: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      let nextIndex = prev.currentPlayerIndex;
      let nextSixes = bonus && prev.diceValue === 6 ? prev.consecutiveSixes + 1 : 0;
      if (!bonus || nextSixes === 3) {
        nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
        nextSixes = 0;
      }
      return { ...prev, currentPlayerIndex: nextIndex, consecutiveSixes: nextSixes, diceValue: null, isDiceRolled: false };
    });
  }, []);

  const moveToken = useCallback((tokenId: number) => {
    if (!gameState || !gameState.diceValue) return;
    const dice = gameState.diceValue;
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const token = player.tokens.find(t => t.id === tokenId);
    if (!token) return;

    let didCapture = false;
    let didReachFinish = false;
    soundManager.play('move');

    if (token.state === TokenState.HOME && dice === 6) {
      token.state = TokenState.PATH;
      token.position = 0; 
      token.distanceTraveled = 0;
    } else if (token.state === TokenState.PATH) {
      token.distanceTraveled += dice;
      token.position = (token.position + dice) % 52;
      
      if (token.distanceTraveled === 57) {
        token.state = TokenState.WIN;
        didReachFinish = true;
        soundManager.play('win');
      } else {
        if (!SAFE_SPOTS.includes(token.position)) {
          players.forEach(p => {
            if (p.color !== player.color) {
              p.tokens.forEach(ot => {
                if (ot.state === TokenState.PATH && ot.position === token.position) {
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
    }

    setGameState(prev => prev ? ({ ...prev, players }) : null);

    setTimeout(() => {
      const hasWon = player.tokens.every(t => t.state === TokenState.WIN);
      if (hasWon) {
        alert(`${player.name} জয়লাভ করেছে!`);
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 400);
  }, [gameState, switchTurn]);

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
        const canMove = player.tokens.some(t => {
          if (t.state === TokenState.HOME) return val === 6;
          if (t.state === TokenState.PATH) return (t.distanceTraveled + val) <= 57;
          return false;
        });
        if (!canMove) {
          setTimeout(() => switchTurn(false), 1200);
        }
        return { ...prev, diceValue: val, isDiceRolled: true };
      });
    }, 600);
  }, [animating, gameState, switchTurn]);

  // Bot logic
  useEffect(() => {
    if (view !== 'GAME' || !gameState || gameState.winner || animating || botThinkingRef.current) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    if (!gameState.isDiceRolled) {
      botThinkingRef.current = true;
      setTimeout(() => { rollDice(); botThinkingRef.current = false; }, 1500);
    } else if (gameState.diceValue) {
      const possibleMoves = currentPlayer.tokens.filter(t => {
        if (t.state === TokenState.WIN) return false;
        if (t.state === TokenState.HOME) return gameState.diceValue === 6;
        if (t.state === TokenState.PATH) return (t.distanceTraveled + gameState.diceValue!) <= 57;
        return false;
      });
      if (possibleMoves.length > 0) {
        botThinkingRef.current = true;
        setTimeout(() => {
          let bestToken = possibleMoves[0];
          const captureMove = possibleMoves.find(t => {
             const nextPos = (t.position + gameState.diceValue!) % 52;
             return !SAFE_SPOTS.includes(nextPos) && gameState.players.some(p => 
               p.color !== currentPlayer.color && p.tokens.some(ot => ot.state === TokenState.PATH && ot.position === nextPos)
             );
          });
          if (captureMove) bestToken = captureMove;
          else bestToken = possibleMoves.reduce((prev, curr) => (curr.distanceTraveled > prev.distanceTraveled) ? curr : prev);
          moveToken(bestToken.id);
          botThinkingRef.current = false;
        }, 1200);
      } else {
        setTimeout(() => switchTurn(false), 800);
      }
    }
  }, [view, gameState, animating, rollDice, moveToken, switchTurn]);

  if (view === 'SPLASH') return (
    <div className="h-screen w-full dotted-bg flex flex-col items-center justify-center bg-[#0a192f]">
      <img src={LOGO_URL} className="w-48 h-48 animate-bounce-slow" />
      <h1 className="text-4xl font-black text-white italic mt-8 uppercase tracking-tighter">Ludo Money</h1>
      <div className="w-64 bg-white/10 h-2 rounded-full mt-10 overflow-hidden"><div className="bg-yellow-500 h-full transition-all" style={{width:`${loadingProgress}%`}}></div></div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 relative overflow-hidden dotted-bg">
      <div className="bg-[#1e293b] rounded-[50px] shadow-[0_30px_100px_rgba(0,0,0,0.5)] w-full max-w-md flex flex-col items-center border border-white/10 z-10 relative overflow-hidden">
        {/* Banner Section */}
        <div className="w-full bg-gradient-to-br from-[#1e297a] to-[#0a192f] p-10 flex flex-col items-center border-b border-white/5">
            <img src={LOGO_URL} className="w-20 h-20 mb-4 drop-shadow-2xl animate-bounce-slow" />
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter text-center">Ludo Money Club</h2>
            <p className="text-sky-400 font-bold text-[9px] uppercase tracking-[0.3em] mt-2">Earn Real Cash Rewards</p>
        </div>

        {/* Tab System */}
        <div className="flex w-full bg-black/20 p-2">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${authMode === 'LOGIN' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20 hover:text-white/50'}`}>Log In</button>
            <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${authMode === 'SIGNUP' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20 hover:text-white/50'}`}>Sign Up</button>
        </div>
        
        <form onSubmit={handleAuthAction} className="w-full p-10 space-y-5">
          {authMode === 'SIGNUP' && (
            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-4 italic">Display Name</label>
                <input 
                  type="text" required value={loginName} onChange={(e) => setLoginName(e.target.value)}
                  placeholder="আপনার নাম লিখুন" 
                  className="w-full bg-white/5 border border-white/10 p-5 rounded-[25px] text-white font-bold focus:outline-none focus:border-sky-500 transition-all placeholder:text-white/10" 
                />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-4 italic">Phone Number</label>
            <input 
              type="tel" required maxLength={11} value={loginPhone} onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="মোবাইল নম্বর (১১ ডিজিট)" 
              className="w-full bg-white/5 border border-white/10 p-5 rounded-[25px] text-white font-bold focus:outline-none focus:border-sky-500 transition-all placeholder:text-white/10" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-4 italic">Passcode</label>
            <input 
              type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="পাসওয়ার্ড দিন" 
              className="w-full bg-white/5 border border-white/10 p-5 rounded-[25px] text-white font-bold focus:outline-none focus:border-sky-500 transition-all placeholder:text-white/10" 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-sky-500 text-white py-6 rounded-[30px] font-black shadow-xl border-b-8 border-sky-700 active:translate-y-2 active:border-b-0 transition-all uppercase tracking-[0.2em] text-lg mt-4"
          >
            {authMode === 'LOGIN' ? 'Enter Game' : 'Create Account'}
          </button>
        </form>
        <div className="p-6 text-center border-t border-white/5 w-full bg-white/5">
            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Safe & Secure Payment Gateways Supported</p>
        </div>
      </div>
      
      <button onClick={() => setIsAdminAuthOpen(true)} className="mt-10 text-white/10 hover:text-white/50 font-black uppercase tracking-[0.3em] text-[9px] transition-all">STAFF PANEL ACCESS</button>

      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
           <form onSubmit={handleAdminAuth} className="bg-[#1e293b] w-full max-w-sm rounded-[50px] p-12 border border-white/10 shadow-2xl">
              <h2 className="text-3xl font-black uppercase italic text-yellow-500 mb-10 text-center tracking-tighter">Staff Authorization</h2>
              <input type="text" placeholder="Username" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-white font-bold mb-4 focus:outline-none focus:border-sky-500" />
              <input type="password" placeholder="Passcode" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-white font-bold mb-10 focus:outline-none focus:border-sky-500" />
              <button type="submit" className="w-full bg-sky-500 text-white py-6 rounded-[30px] font-black uppercase shadow-2xl border-b-8 border-sky-700 active:border-b-0 active:translate-y-2 transition-all">Enter Dashboard</button>
              <button type="button" onClick={() => setIsAdminAuthOpen(false)} className="w-full mt-6 text-white/30 font-bold uppercase text-[10px] tracking-widest hover:text-white">Cancel</button>
           </form>
        </div>
      )}
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal user={user} pendingTransactions={pendingTransactions} onUpdateUser={(u) => setUser(prev => ({...prev, balance: u.balance}))} onApproveTransaction={approveTransaction} onRejectTransaction={rejectTransaction} onExit={() => setView('LOBBY')} />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col relative text-white select-none overflow-hidden font-fredoka">
      <div className="p-5 flex justify-between items-center z-50 bg-[#0f172a] shadow-2xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={user.avatar} className="w-11 h-11 rounded-2xl bg-white border-2 border-yellow-500 shadow-lg object-cover" />
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight">{user.name}</span>
            <span className="text-[9px] text-green-400 font-black uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#1e293b] border border-white/10 rounded-3xl px-4 py-1.5 flex items-center gap-3 shadow-inner">
             <span className="text-yellow-400 font-black text-lg">৳</span>
             <span className="font-black text-sm">{user.balance.toLocaleString()}</span>
             <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-6 h-6 rounded-xl font-black text-lg shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center">+</button>
          </div>
          <button onClick={() => { localStorage.removeItem(STORAGE_KEY_USER); window.location.reload(); }} className="p-2 text-white/20 hover:text-white">✕</button>
        </div>
      </div>
      <div className="flex-1 p-6 space-y-6 z-10 overflow-y-auto no-scrollbar pb-32">
        <div className="bg-gradient-to-br from-[#2d3da9] to-[#1e297a] rounded-[50px] p-10 shadow-2xl relative overflow-hidden flex flex-col items-start min-h-[220px] group cursor-pointer" onClick={() => setView('MATCH_CONFIG')}>
            <div className="relative z-10 w-2/3">
              <h2 className="text-5xl font-black italic text-[#ffd900] mb-3 uppercase tracking-tighter leading-tight drop-shadow-lg">PLAY ONLINE</h2>
              <p className="text-white/70 text-[11px] font-bold mb-8 max-w-[180px]">Real players, real stakes. Battle for glory!</p>
              <button className="bg-white text-[#2d3da9] font-black px-10 py-4 rounded-full uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">ENTER ARENA</button>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] text-[180px] opacity-10 rotate-12 group-hover:rotate-0 transition-all duration-700 select-none pointer-events-none">🎲</div>
        </div>
        <div className="grid grid-cols-2 gap-6">
            <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b] py-10 px-6 rounded-[50px] shadow-2xl flex flex-col items-center cursor-pointer border border-white/5 hover:bg-white/5 transition-all">
              <div className="text-6xl mb-4 filter drop-shadow-xl">🤖</div>
              <span className="font-black text-xs italic text-[#0ea5e9] uppercase tracking-widest">Training Bot</span>
            </div>
            <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b] py-10 px-6 rounded-[50px] shadow-2xl flex flex-col items-center cursor-pointer border border-white/5 hover:bg-white/5 transition-all">
              <div className="text-6xl mb-4 filter drop-shadow-xl">👬</div>
              <span className="font-black text-xs italic text-[#ffd900] uppercase tracking-widest">Private Table</span>
            </div>
        </div>
        <div className="bg-[#1e293b]/40 p-8 rounded-[50px] border border-white/5 backdrop-blur-md">
            <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-6 italic">GLOBAL LEADERBOARD</h3>
            <div className="space-y-3">
              {[{ name: "Zubair Al-Mahmud", win: 19030 }, { name: "Tanvir Hossain", win: 16580 }, { name: "Anika Tabassum", win: 14440 }].map((winner, i) => (
                <div key={i} className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-white/5 shadow-lg group hover:border-yellow-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-lg ${i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white'}`}>{i+1}</div>
                      <span className="text-sm font-bold text-white/80">{winner.name}</span>
                    </div>
                    <span className="text-[#4ade80] font-black text-sm tracking-tighter">৳{winner.win.toLocaleString()}</span>
                </div>
              ))}
            </div>
        </div>
      </div>
      <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={handleNewTransaction} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-6 text-white overflow-hidden">
        <div className="bg-[#1e293b] p-10 rounded-[60px] w-full max-w-sm shadow-2xl border border-white/5 relative z-10">
           <h2 className="text-2xl font-black italic uppercase text-center mb-8 text-yellow-500 tracking-tighter">Table Settings</h2>
           <div className="mb-8">
             <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-4 ml-2">Number of Players</p>
             <div className="grid grid-cols-2 gap-4">
                {[2, 4].map(count => (
                  <button key={count} onClick={() => setSelectedPlayerCount(count)} className={`py-4 rounded-3xl font-black text-sm border-4 transition-all flex flex-col items-center justify-center gap-1 ${selectedPlayerCount === count ? 'bg-sky-500 border-sky-400 text-white shadow-xl scale-105' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                    <span className="text-2xl">{count === 2 ? '👥' : '👨‍👩‍👧‍👦'}</span>
                    <span>{count} Players</span>
                  </button>
                ))}
             </div>
           </div>
           <div className="mb-10">
             <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-4 ml-2">Choose Stake (৳)</p>
             <div className="grid grid-cols-3 gap-3">
                {STAKE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`py-3 rounded-2xl font-black text-xs border-4 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-400 text-black shadow-xl scale-105' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>{s}</button>
                ))}
             </div>
           </div>
           <button onClick={() => { setView('MATCHING'); setTimeout(initGame, 2000); }} className="w-full bg-green-500 py-6 rounded-[35px] font-black text-xl shadow-2xl border-b-[8px] border-green-700 uppercase italic tracking-widest active:border-b-0 active:translate-y-2 transition-all">Start Battle</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-6 text-white/20 font-black uppercase text-[10px] tracking-[0.4em] hover:text-white transition-all text-center">Back</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center text-white p-10 overflow-hidden">
      <div className="relative">
          <div className="w-64 h-64 border-[16px] border-sky-500/10 border-t-sky-500 rounded-full animate-spin flex items-center justify-center shadow-2xl shadow-sky-500/20"></div>
          <span className="absolute inset-0 flex items-center justify-center text-8xl animate-pulse">🎲</span>
      </div>
      <h2 className="text-4xl font-black mt-20 italic uppercase text-center tracking-tighter text-white/80">Connecting...</h2>
      <p className="mt-4 text-[10px] font-bold text-sky-400 uppercase tracking-widest animate-pulse">Looking for {selectedPlayerCount - 1} opponents</p>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center relative overflow-hidden text-white font-fredoka">
        <div className="w-full h-16 bg-[#0f172a] flex justify-between items-center px-8 z-10 shadow-2xl border-b border-white/5">
           <button onClick={() => { setGameState(null); setView('LOBBY'); }} className="bg-red-600/20 text-red-500 font-black px-6 py-2 rounded-2xl text-[10px] uppercase border border-red-500/20 hover:bg-red-600/40 transition-all">Exit</button>
           <div className="font-black text-sky-400 italic text-sm tracking-widest uppercase">Ludo Money Battle</div>
           <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-yellow-500 font-black text-xs">Prizepool: ৳{Math.floor(selectedStake * selectedPlayerCount * 0.9)}</div>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 gap-12 w-full overflow-hidden">
            <div className="w-full max-w-[520px] shadow-[0_50px_100px_rgba(0,0,0,0.6)] rounded-[60px] overflow-hidden border-[16px] border-white/5 bg-white/5 backdrop-blur-sm flex-shrink-0">
                <LudoBoard players={gameState!.players} currentPlayerColor={gameState!.players[gameState!.currentPlayerIndex].color} validTokens={[]} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-8 w-full max-w-xs">
                <div className="bg-slate-900/80 p-8 rounded-[40px] border border-white/5 text-center w-full shadow-2xl backdrop-blur-xl">
                    <p className="text-[10px] font-black uppercase text-sky-400 mb-2 tracking-[0.3em] italic">Current Turn</p>
                    <div className="flex items-center justify-center gap-3">
                        <img src={gameState!.players[gameState!.currentPlayerIndex].avatarUrl} className="w-8 h-8 rounded-xl border border-white/10" />
                        <p className="text-2xl font-black italic uppercase text-yellow-500 truncate">{gameState!.players[gameState!.currentPlayerIndex].name}</p>
                    </div>
                </div>
                <div onClick={!gameState!.players[gameState!.currentPlayerIndex].isBot ? rollDice : undefined} className={`w-40 h-40 bg-white rounded-[50px] shadow-2xl flex items-center justify-center text-8xl font-black text-gray-800 border-b-[20px] border-gray-200 transition-all ${animating ? 'animate-spin' : ''} ${gameState?.isDiceRolled || gameState!.players[gameState!.currentPlayerIndex].isBot ? 'opacity-40 grayscale' : 'cursor-pointer hover:scale-105 active:translate-y-4 active:border-b-0'}`}>
                   {gameState!.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );
};

export default App;
