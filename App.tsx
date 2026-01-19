
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

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser(JSON.parse(savedUser));
    
    const savedTxs = localStorage.getItem(STORAGE_KEY_TXS);
    if (savedTxs) setPendingTransactions(JSON.parse(savedTxs));
  }, []);

  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const saved = localStorage.getItem(STORAGE_KEY_USER);
              setView(saved ? 'LOBBY' : 'LOGIN');
            }, 500);
            return 100;
          }
          return prev + 5;
        });
      }, 30);
      return () => clearInterval(interval);
    }
  }, [view]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm("আপনি কি লগআউট করতে চান?")) {
        soundManager.play('click');
        localStorage.removeItem(STORAGE_KEY_USER);
        window.location.reload();
    }
  };

  const handleAuthAction = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.play('click');
    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');

    if (authMode === 'ADMIN_LOGIN') {
      if (loginPhone === 'emukhan580' && loginPassword === 'Imran2015@!@!') {
        setView('ADMIN');
      } else {
        alert("Invalid Admin Credentials!");
      }
      return;
    }

    if (authMode === 'SIGNUP') {
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
      } else alert("Invalid Login!");
    }
  };

  const handleAddTransaction = (tx: PendingTransaction) => {
    const updated = [...pendingTransactions, tx];
    setPendingTransactions(updated);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(updated));
  };

  const approveTransaction = (tx: PendingTransaction) => {
    const usersDB: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS_DB) || '[]');
    const targetUser = usersDB.find(u => u.name === tx.userName);
    if (targetUser) {
      if (tx.type === 'DEPOSIT') targetUser.balance += tx.amount;
      else targetUser.balance -= tx.amount;
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDB));
      if (user.name === targetUser.name) {
        const updatedUser = { ...user, balance: targetUser.balance };
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
      }
    }
    const remaining = pendingTransactions.filter(t => t.id !== tx.id);
    setPendingTransactions(remaining);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(remaining));
  };

  const rejectTransaction = (txId: string) => {
    const remaining = pendingTransactions.filter(t => t.id !== txId);
    setPendingTransactions(remaining);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(remaining));
  };

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
    if (user.balance < selectedStake) return alert("Low Balance!");
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
      <p className="mt-4 text-white/40 font-black uppercase tracking-[0.3em] text-[10px]">Loading Experience...</p>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 dotted-bg">
      <div className="bg-[#1e293b] rounded-[40px] shadow-2xl w-full max-w-sm border border-white/10 overflow-hidden relative">
        <div className="bg-gradient-to-br from-[#1e297a] to-[#0a192f] p-8 text-center border-b border-white/5">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              {authMode === 'ADMIN_LOGIN' ? 'Admin Login' : 'Enter Club'}
            </h2>
        </div>
        <div className="flex bg-black/20 p-3">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-4 rounded-3xl font-black text-sm uppercase transition-all ${authMode === 'LOGIN' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20'}`}>Login</button>
            <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-4 rounded-3xl font-black text-sm uppercase transition-all ${authMode === 'SIGNUP' ? 'bg-sky-500 text-white shadow-xl' : 'text-white/20'}`}>Signup</button>
        </div>
        <form onSubmit={handleAuthAction} className="p-8 space-y-4">
          {authMode === 'SIGNUP' && <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Name" className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />}
          <input type="text" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder={authMode === 'ADMIN_LOGIN' ? "Admin ID" : "Phone"} className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 p-5 rounded-[20px] text-white outline-none focus:border-sky-500 transition-all font-bold" />
          <button type="submit" className="w-full bg-sky-500 py-5 rounded-[20px] font-black text-white shadow-2xl text-lg tracking-widest active:scale-95 transition-all">
             {authMode === 'ADMIN_LOGIN' ? 'ACCESS ADMIN' : 'LET\'S PLAY'}
          </button>
        </form>
        <div onClick={() => setAuthMode(authMode === 'ADMIN_LOGIN' ? 'LOGIN' : 'ADMIN_LOGIN')} className="absolute bottom-3 right-3 w-10 h-10 flex items-center justify-center opacity-10 cursor-default hover:opacity-50 transition-opacity">🛡️</div>
      </div>
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal user={user} pendingTransactions={pendingTransactions} onUpdateUser={setUser} onApproveTransaction={approveTransaction} onRejectTransaction={rejectTransaction} onExit={() => setView('LOBBY')} />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col relative text-white font-fredoka overflow-hidden dotted-bg">
        {/* TOP GORGEOUS BAR */}
        <div className="p-6 flex items-center justify-between z-[100] relative bg-gradient-to-b from-black/40 to-transparent">
            <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-full border border-white/10 backdrop-blur-md">
                <img src={user.avatar} className="w-14 h-14 rounded-full border-2 border-yellow-500 shadow-xl" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tighter text-white">{user.name}</h3>
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Premium Player</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-[24px] px-6 py-3 flex items-center gap-4 border-2 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                  <span className="text-yellow-400 font-black text-2xl drop-shadow-lg">৳</span>
                  <span className="font-black text-xl tracking-tighter">{user.balance.toLocaleString()}</span>
                  <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-8 h-8 rounded-xl font-black text-2xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all">+</button>
              </div>
              
              <button 
                onClick={handleLogout} 
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white w-12 h-12 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-xl transition-all"
                title="Logout"
              >
                <span className="text-xl font-black">✕</span>
              </button>
            </div>
        </div>

        {/* MAIN CARDS */}
        <div className="flex-1 px-8 space-y-8 overflow-y-auto no-scrollbar pb-32 pt-4">
            <div 
              className="bg-gradient-to-br from-[#243494] via-[#1e297a] to-[#0a192f] rounded-[45px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group cursor-pointer border-2 border-white/5 active:scale-95 transition-all"
              onClick={() => setView('MATCH_CONFIG')}
            >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-all"></div>
                <h2 className="text-5xl font-black italic text-[#FFD700] mb-3 uppercase tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">PLAY ONLINE</h2>
                <p className="text-white/60 font-bold mb-6 text-sm tracking-wide uppercase">Compete with world-class players & win big!</p>
                <button className="bg-white text-[#243494] font-black px-10 py-4 rounded-[20px] uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-yellow-400 hover:text-black transition-all">START BATTLE</button>
                <div className="absolute bottom-6 right-10 text-6xl opacity-30 group-hover:opacity-100 group-hover:scale-125 transition-all">🎲</div>
            </div>

            <div className="grid grid-cols-2 gap-8">
                <div 
                  onClick={() => setView('MATCH_CONFIG')} 
                  className="bg-white/5 backdrop-blur-md p-8 rounded-[40px] border border-white/10 text-center cursor-pointer group hover:bg-sky-500/10 hover:border-sky-500/30 transition-all shadow-2xl"
                >
                    <div className="text-5xl mb-4 group-hover:scale-125 transition-all duration-300">🤖</div>
                    <span className="font-black text-xs uppercase tracking-[0.3em] text-sky-400">Bot Training</span>
                </div>
                <div 
                  onClick={() => setView('MATCH_CONFIG')} 
                  className="bg-white/5 backdrop-blur-md p-8 rounded-[40px] border border-white/10 text-center cursor-pointer group hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-all shadow-2xl"
                >
                    <div className="text-5xl mb-4 group-hover:scale-125 transition-all duration-300">👭</div>
                    <span className="font-black text-xs uppercase tracking-[0.3em] text-yellow-500">Private Club</span>
                </div>
            </div>
            
            {/* STATS PREVIEW */}
            <div className="bg-black/20 p-8 rounded-[40px] border border-white/5 flex justify-around">
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Wins</p>
                  <p className="text-2xl font-black text-green-500">{user.stats.wins}</p>
                </div>
                <div className="h-10 w-[1px] bg-white/5 self-center"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Earnings</p>
                  <p className="text-2xl font-black text-yellow-500">৳{user.stats.totalWinnings.toLocaleString()}</p>
                </div>
            </div>
        </div>

        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={handleAddTransaction} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-6 text-white dotted-bg">
        <div className="bg-[#1e293b] p-10 rounded-[50px] w-full max-w-sm shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-white/10">
           <h2 className="text-2xl font-black italic uppercase text-center mb-8 text-yellow-500 tracking-tighter">Table Settings</h2>
           <div className="grid grid-cols-2 gap-4 mb-8">
              {[2, 4].map(c => (
                <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-6 rounded-[24px] font-black text-sm border-2 transition-all ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-300 shadow-xl scale-105' : 'bg-white/5 border-transparent text-white/20 hover:text-white/60'}`}>{c} Players</button>
              ))}
           </div>
           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-4 text-center">Select Stake (৳)</p>
           <div className="grid grid-cols-3 gap-3 mb-10">
              {STAKE_OPTIONS.map(s => (
                <button key={s} onClick={() => setSelectedStake(s)} className={`py-4 rounded-[18px] font-black text-xs border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-xl scale-110' : 'bg-white/5 border-transparent text-white/20 hover:text-white/60'}`}>{s}</button>
              ))}
           </div>
           <button onClick={() => { soundManager.play('click'); setView('MATCHING'); setTimeout(initGame, 1500); }} className="w-full bg-green-500 py-6 rounded-[24px] font-black text-xl shadow-2xl active:scale-95 hover:bg-green-400 transition-all uppercase tracking-widest">Confirm & Start</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-6 text-white/20 uppercase font-black text-[10px] tracking-widest hover:text-white transition-all">Cancel</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center text-white p-10 dotted-bg">
      <div className="relative w-40 h-40 mb-10">
        <div className="absolute inset-0 border-[8px] border-sky-500/10 rounded-full"></div>
        <div className="absolute inset-0 border-[8px] border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-6xl">🎲</div>
      </div>
      <h2 className="text-2xl font-black italic uppercase animate-pulse tracking-tighter">Connecting to Arena...</h2>
      <p className="text-white/30 font-black uppercase text-[10px] tracking-[0.5em] mt-4">Waiting for Opponents</p>
    </div>
  );

  if (view === 'GAME' && gameState) return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative text-white overflow-hidden">
        <div className="w-full h-16 bg-[#0f172a] flex justify-between items-center px-6 border-b border-white/5 shrink-0 shadow-xl">
           <button onClick={() => { if(confirm("Exit Game?")) setView('LOBBY'); }} className="text-red-500 font-black text-xs uppercase bg-red-500/10 px-4 py-2 rounded-xl">Surrender</button>
           <div className="font-black text-sky-400 italic text-xl uppercase tracking-tighter">Ludo Arena</div>
           <div className="bg-yellow-500/10 px-4 py-2 rounded-xl text-yellow-500 font-black text-sm">৳{selectedStake}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8 w-full">
            <div className="w-full max-w-[450px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] rounded-[32px] overflow-hidden border-[6px] border-white/10 shrink-0 bg-white/5">
                <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} validTokens={validTokens} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-4 shrink-0">
                <div className="text-center h-6">
                    <p className="text-sm font-black uppercase text-sky-400 tracking-[0.3em] animate-pulse">{gameState.players[gameState.currentPlayerIndex].name}'s Turn</p>
                </div>
                <div 
                   onClick={!gameState.players[gameState.currentPlayerIndex].isBot ? rollDice : undefined} 
                   className={`w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-5xl font-black text-gray-800 border-b-[8px] border-gray-300 transition-all ${animating ? 'animate-bounce-slow' : ''} ${(gameState.isDiceRolled || gameState.players[gameState.currentPlayerIndex].isBot) && !animating ? 'opacity-30' : 'cursor-pointer active:scale-90 active:border-b-0'}`}
                >
                   {gameState.diceValue || '🎲'}
                </div>
            </div>
        </div>
    </div>
  );

  return null;
};

export default App;
