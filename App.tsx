
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS } from './constants';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
const STORAGE_KEY_USER = "LUDO_USER_PROFILE";
const STORAGE_KEY_USERS_DB = "LUDO_USERS_DATABASE"; 
const STORAGE_KEY_TX = "LUDO_TRANSACTIONS";

const INITIAL_USER: UserProfile = {
  name: "imranrajir",
  balance: 400,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=imranrajir",
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
  
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [animating, setAnimating] = useState(false);
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  const botThinkingRef = useRef(false);

  // Persistence logic
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser(JSON.parse(savedUser));
    const savedTx = localStorage.getItem(STORAGE_KEY_TX);
    if (savedTx) setPendingTransactions(JSON.parse(savedTx));
  }, []);

  useEffect(() => {
    if (user.name !== "Guest Player") {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  }, [user]);

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

  // Calculate valid tokens for current turn
  const validTokens = useMemo(() => {
    if (!gameState || !gameState.isDiceRolled || gameState.diceValue === null) return [];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const val = gameState.diceValue;
    
    return currentPlayer.tokens
      .filter(t => 
        (t.state === TokenState.HOME && val === 6) || 
        (t.state === TokenState.PATH && t.distanceTraveled + val <= 57)
      )
      .map(t => t.id);
  }, [gameState]);

  const handleAuthAction = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('click');
    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');

    if (authMode === 'SIGNUP') {
      if (loginName.trim().length < 3 || !/^\d{11}$/.test(loginPhone) || loginPassword.length < 4) {
        return alert("সঠিক তথ্য দিন।");
      }
      const newUser: UserProfile = {
        name: loginName.trim(), phone: loginPhone, password: loginPassword, balance: 400, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginName.trim()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }, history: []
      };
      usersDB.push(newUser);
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDB));
      setUser(newUser);
      setView('LOBBY');
      soundManager.play('win');
    } else {
      const existingUser = usersDB.find(u => u.phone === loginPhone && u.password === loginPassword);
      if (existingUser) {
        setUser(existingUser);
        setView('LOBBY');
        soundManager.play('win');
      } else alert("ভুল তথ্য!");
    }
  };

  const switchTurn = useCallback((bonus: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      let nextIndex = prev.currentPlayerIndex;
      let nextSixes = bonus && prev.diceValue === 6 ? prev.consecutiveSixes + 1 : 0;
      
      // If 3 consecutive sixes, lose turn
      if (!bonus || nextSixes === 3) {
        nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
        nextSixes = 0;
      }
      
      return { 
        ...prev, 
        currentPlayerIndex: nextIndex, 
        consecutiveSixes: nextSixes, 
        diceValue: null, 
        isDiceRolled: false 
      };
    });
  }, []);

  const moveToken = useCallback((tokenId: number) => {
    if (!gameState || !gameState.diceValue || animating) return;
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
        alert(`${player.name} জয়ী!`);
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 400);
  }, [gameState, switchTurn, animating]);

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
        
        // Auto-switch if no moves possible
        if (!canMove) {
          setTimeout(() => switchTurn(false), 1200);
        }
        
        return { ...prev, diceValue: val, isDiceRolled: true };
      });
    }, 600);
  }, [animating, gameState, switchTurn]);

  // STABLE BOT LOGIC
  useEffect(() => {
    if (view !== 'GAME' || !gameState || animating || botThinkingRef.current) return;
    
    const cp = gameState.players[gameState.currentPlayerIndex];
    if (!cp || !cp.isBot) return;

    if (!gameState.isDiceRolled) {
      botThinkingRef.current = true;
      const rollTimer = setTimeout(() => {
        rollDice();
        botThinkingRef.current = false;
      }, 1500);
      return () => clearTimeout(rollTimer);
    } else if (gameState.diceValue !== null) {
      const moves = validTokens;
      if (moves.length > 0) {
        botThinkingRef.current = true;
        const moveTimer = setTimeout(() => {
          moveToken(moves[0]);
          botThinkingRef.current = false;
        }, 1200);
        return () => clearTimeout(moveTimer);
      }
    }
  }, [view, gameState?.currentPlayerIndex, gameState?.isDiceRolled, gameState?.diceValue, animating, rollDice, moveToken, validTokens]);

  const initGame = () => {
    if (user.balance < selectedStake) return alert("ব্যালেন্স নেই!");
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
      log: ["খেলা শুরু"], lastAction: "", consecutiveSixes: 0
    });
    setView('GAME');
  };

  if (view === 'SPLASH') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center dotted-bg">
      <img src={LOGO_URL} className="w-32 h-32 animate-bounce-slow" />
      <h1 className="text-4xl font-black text-white italic mt-10 tracking-tighter uppercase">Ludo Money Club</h1>
      <div className="w-64 bg-white/5 h-2 rounded-full mt-10 overflow-hidden border border-white/5">
        <div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${loadingProgress}%`}}></div>
      </div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 relative dotted-bg">
      <div className="bg-[#1e293b] rounded-[50px] shadow-2xl w-full max-w-sm border border-white/10 overflow-hidden relative">
        <div className="bg-gradient-to-br from-[#1e297a] to-[#0a192f] p-8 text-center border-b border-white/5">
            <img src={LOGO_URL} className="w-20 h-20 mx-auto mb-4 drop-shadow-2xl" />
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Enter Club</h2>
        </div>
        <div className="flex bg-black/20 p-2">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all ${authMode === 'LOGIN' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20 hover:text-white/50'}`}>Login</button>
            <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all ${authMode === 'SIGNUP' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20 hover:text-white/50'}`}>Signup</button>
        </div>
        <form onSubmit={handleAuthAction} className="p-8 space-y-4">
          {authMode === 'SIGNUP' && (
            <input type="text" required value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="আপনার নাম" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white font-bold outline-none" />
          )}
          <input type="tel" required maxLength={11} value={loginPhone} onChange={e => setLoginPhone(e.target.value.replace(/\D/g,''))} placeholder="ফোন নম্বর" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white font-bold outline-none" />
          <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="পাসওয়ার্ড" className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white font-bold outline-none" />
          <button type="submit" className="w-full bg-sky-500 py-6 rounded-3xl font-black text-white shadow-xl border-b-8 border-sky-800 active:border-b-0 active:translate-y-2 transition-all uppercase tracking-widest mt-4">
            {authMode === 'LOGIN' ? 'ENTER GAME' : 'JOIN CLUB'}
          </button>
        </form>
      </div>
    </div>
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col relative text-white font-fredoka overflow-hidden">
        {/* HEADER */}
        <div className="p-4 px-6 flex justify-between items-center z-20">
            <div className="flex items-center gap-3">
                <img src={user.avatar} className="w-12 h-12 rounded-xl bg-white border-2 border-yellow-500" />
                <div className="flex flex-col">
                    <span className="font-black text-sm tracking-tighter">{user.name}</span>
                    <span className="text-[9px] text-green-400 font-black uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> ONLINE
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-[#1e293b]/40 rounded-2xl px-4 py-2 flex items-center gap-4 border border-white/10">
                    <span className="text-yellow-400 font-black text-lg">৳</span>
                    <span className="font-black text-sm">{user.balance.toLocaleString()}</span>
                    <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-6 h-6 rounded-lg font-black text-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">+</button>
                </div>
                <button className="text-white/20 hover:text-white transition-all text-2xl">✕</button>
            </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 px-8 space-y-8 overflow-y-auto no-scrollbar pb-32 pt-4 max-w-7xl mx-auto w-full">
            {/* HERO BANNER */}
            <div 
              className="bg-[#243494] rounded-[50px] p-12 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[340px] cursor-pointer hover:brightness-110 transition-all group"
              onClick={() => setView('MATCH_CONFIG')}
            >
                <div className="relative z-10 w-full md:w-1/2">
                    <h2 className="text-7xl font-black italic text-[#FFD700] mb-4 uppercase tracking-tighter drop-shadow-2xl">PLAY ONLINE</h2>
                    <p className="text-white/80 text-sm font-bold mb-10 max-w-[280px] leading-snug">Real players, real stakes. Battle for glory!</p>
                    <button className="bg-white text-[#243494] font-black px-12 py-5 rounded-3xl uppercase text-sm shadow-2xl tracking-widest hover:scale-105 transition-all active:scale-95">ENTER ARENA</button>
                </div>
                <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                    <svg width="280" height="280" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="10" y="10" width="80" height="80" rx="15" fill="white" fillOpacity="0.8"/>
                        <circle cx="28" cy="28" r="6" fill="#000" fillOpacity="0.4"/>
                        <circle cx="72" cy="72" r="6" fill="#000" fillOpacity="0.4"/>
                        <circle cx="50" cy="50" r="6" fill="#000" fillOpacity="0.4"/>
                        <circle cx="28" cy="72" r="6" fill="#000" fillOpacity="0.4"/>
                        <circle cx="72" cy="28" r="6" fill="#000" fillOpacity="0.4"/>
                    </svg>
                </div>
            </div>

            {/* TWO CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b]/40 p-12 rounded-[50px] flex flex-col items-center justify-center border border-white/5 cursor-pointer hover:bg-white/10 transition-all shadow-xl min-h-[220px]">
                    <div className="text-7xl mb-6">🤖</div>
                    <span className="font-black text-sm italic text-sky-400 uppercase tracking-[0.3em]">TRAINING BOT</span>
                </div>
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b]/40 p-12 rounded-[50px] flex flex-col items-center justify-center border border-white/5 cursor-pointer hover:bg-white/10 transition-all shadow-xl min-h-[220px]">
                    <div className="text-7xl mb-6">👬</div>
                    <span className="font-black text-sm italic text-yellow-500 uppercase tracking-[0.3em]">PRIVATE TABLE</span>
                </div>
            </div>

            {/* LEADERBOARD */}
            <div className="bg-[#1e293b]/20 p-10 rounded-[60px] border border-white/5">
                <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] mb-8 italic">GLOBAL LEADERBOARD</h3>
                <div className="space-y-4">
                  {[
                    { name: "Zubair Al-Mahmud", win: 19030, rank: 1 },
                    { name: "Tanvir Hossain", win: 16580, rank: 2 },
                    { name: "Anika Tabassum", win: 14440, rank: 3 }
                  ].map((player, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#1e293b]/40 p-6 rounded-[30px] border border-white/5">
                        <div className="flex items-center gap-6">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-lg ${i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white/60'}`}>{player.rank}</div>
                            <span className="text-lg font-bold text-white/90">{player.name}</span>
                        </div>
                        <span className="text-green-400 font-black text-lg italic tracking-tighter">৳{player.win.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
            </div>
        </div>

        <div className="absolute bottom-6 right-8 pointer-events-none opacity-40 text-right">
            <p className="text-sm font-bold text-white/20">Activate Windows</p>
            <p className="text-[9px] text-white/20">Go to Settings to activate Windows.</p>
        </div>

        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={tx => { setPendingTransactions(prev => [...prev, tx]); setUser(prev => ({ ...prev, history: [tx, ...prev.history], balance: tx.type === 'WITHDRAW' ? prev.balance - tx.amount : prev.balance })); }} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-6 text-white dotted-bg">
        <div className="bg-[#1e293b] p-10 rounded-[50px] w-full max-w-sm shadow-2xl border border-white/10 relative">
           <h2 className="text-xl font-black italic uppercase text-center mb-10 text-yellow-500 tracking-tighter">Table Setup</h2>
           <div className="grid grid-cols-2 gap-4 mb-10">
              {[2, 4].map(c => (
                <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-5 rounded-3xl font-black text-xs border-4 transition-all ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-300 text-white shadow-xl' : 'bg-white/5 border-transparent text-white/30'}`}>{c} Players</button>
              ))}
           </div>
           <p className="text-[10px] font-black uppercase text-white/30 mb-4 ml-2 italic tracking-widest">Select Stake (৳)</p>
           <div className="grid grid-cols-3 gap-3 mb-12">
              {STAKE_OPTIONS.map(s => (
                <button key={s} onClick={() => setSelectedStake(s)} className={`py-4 rounded-2xl font-black text-[10px] border-4 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-xl' : 'bg-white/5 border-transparent text-white/30'}`}>{s}</button>
              ))}
           </div>
           <button onClick={() => { setView('MATCHING'); setTimeout(initGame, 2000); }} className="w-full bg-green-500 py-6 rounded-3xl font-black text-lg shadow-2xl border-b-8 border-green-800 uppercase italic transition-all active:translate-y-2 active:border-b-0">Start Battle</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-6 text-white/20 font-black uppercase text-[10px] tracking-widest">Back</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center text-white p-10 dotted-bg">
      <div className="w-48 h-48 border-[12px] border-sky-500/10 border-t-sky-500 rounded-full animate-spin flex items-center justify-center shadow-2xl shadow-sky-500/30 mb-10">
          <span className="text-6xl animate-pulse">🎲</span>
      </div>
      <h2 className="text-3xl font-black italic uppercase tracking-tighter animate-pulse mb-2">Connecting...</h2>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative overflow-hidden text-white font-fredoka">
        <div className="w-full h-16 bg-[#0f172a] flex justify-between items-center px-6 z-10 border-b border-white/5">
           <button onClick={() => { setGameState(null); setView('LOBBY'); }} className="bg-red-500/10 text-red-500 font-black px-5 py-2 rounded-xl text-[10px] uppercase border border-red-500/20">Exit</button>
           <div className="font-black text-sky-400 italic text-xs tracking-widest uppercase">Ludo Money Arena</div>
           <div className="bg-yellow-500/10 px-4 py-2 rounded-xl border border-yellow-500/20 text-yellow-500 font-black text-[10px]">Pool: ৳{Math.floor(selectedStake * selectedPlayerCount * 0.9)}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-10 w-full overflow-hidden">
            <div className="w-full max-w-[480px] shadow-2xl rounded-[40px] overflow-hidden border-[12px] border-white/5 bg-white/5 flex-shrink-0">
                <LudoBoard 
                  players={gameState!.players} 
                  currentPlayerColor={gameState!.players[gameState!.currentPlayerIndex].color} 
                  validTokens={validTokens} 
                  onTokenClick={(t) => moveToken(t.id)} 
                />
            </div>
            <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 text-center w-full">
                    <p className="text-[10px] font-black uppercase text-sky-400 mb-1 tracking-widest italic">Current Turn</p>
                    <p className="text-xl font-black italic uppercase text-yellow-500 truncate">{gameState!.players[gameState!.currentPlayerIndex].name}</p>
                </div>
                <div 
                   onClick={!gameState!.players[gameState!.currentPlayerIndex].isBot ? rollDice : undefined} 
                   className={`w-32 h-32 bg-white rounded-[40px] shadow-2xl flex items-center justify-center text-7xl font-black text-gray-800 border-b-[16px] border-gray-200 transition-all ${animating ? 'animate-spin' : ''} ${gameState?.isDiceRolled || gameState!.players[gameState!.currentPlayerIndex].isBot ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer hover:scale-105 active:translate-y-4 active:border-b-0'}`}
                >
                   {gameState!.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );
};

export default App;
