
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS, START_POSITIONS } from './constants';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";
const STORAGE_KEY_USER = "LUDO_USER_PROFILE";
const STORAGE_KEY_USERS_DB = "LUDO_USERS_DATABASE"; 

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
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  const botActionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // Smoother Splash Screen
  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              const saved = localStorage.getItem(STORAGE_KEY_USER);
              setView(saved ? 'LOBBY' : 'LOGIN');
            }, 300);
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
    e.stopPropagation();
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

  const moveToken = useCallback((tokenId: number) => {
    if (!gameState || !gameState.diceValue || animating) return;
    const dice = gameState.diceValue;
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const token = player.tokens.find(t => t.id === tokenId);
    if (!token) return;

    setAnimating(true);
    let didCapture = false;
    let didReachFinish = false;
    soundManager.play('move');

    if (token.state === TokenState.HOME && dice === 6) {
      token.state = TokenState.PATH;
      token.position = 0; 
      token.distanceTraveled = 0;
    } else {
      token.distanceTraveled += dice;
      token.position = (token.position + dice) % 52;
      
      if (token.distanceTraveled === 57) {
        token.state = TokenState.WIN;
        didReachFinish = true;
        soundManager.play('win');
      } else if (token.distanceTraveled < 51) {
        const myAbsolutePos = (token.position + START_POSITIONS[player.color]) % 52;
        if (!SAFE_SPOTS.includes(myAbsolutePos)) {
          players.forEach(p => {
            if (p.color !== player.color) {
              p.tokens.forEach(ot => {
                const otherAbsolutePos = (ot.position + START_POSITIONS[p.color]) % 52;
                if (ot.state === TokenState.PATH && otherAbsolutePos === myAbsolutePos) {
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

    // Smooth movement delay - allows user to see the piece sliding
    setTimeout(() => {
      setAnimating(false);
      if (player.tokens.every(t => t.state === TokenState.WIN)) {
        alert(`${player.name} Won!`);
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 500);
  }, [gameState, switchTurn, animating]);

  const rollDice = useCallback(() => {
    if (animating || (gameState && gameState.isDiceRolled)) return;
    setAnimating(true);
    soundManager.play('dice');
    
    // Natural dice roll speed
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setAnimating(false);
      soundManager.play('dice_stop');
      if (val === 6) soundManager.play('six');
      
      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => (t.state === TokenState.HOME && val === 6) || (t.state === TokenState.PATH && (t.distanceTraveled + val) <= 57));
        
        if (!canMove) {
          // Pause briefly if no moves possible so user can see the dice value
          setTimeout(() => switchTurn(false), 800);
        }
        return { ...prev, diceValue: val, isDiceRolled: true };
      });
    }, 600); 
  }, [animating, gameState, switchTurn]);

  // Smooth Bot Thinking
  useEffect(() => {
    if (view !== 'GAME' || !gameState || animating) return;
    const cp = gameState.players[gameState.currentPlayerIndex];
    if (!cp || !cp.isBot) return;

    if (!gameState.isDiceRolled) {
      botActionTimeoutRef.current = window.setTimeout(rollDice, 1200);
    } else if (gameState.diceValue !== null) {
      const moves = validTokens;
      if (moves.length > 0) {
        botActionTimeoutRef.current = window.setTimeout(() => moveToken(moves[0]), 800);
      }
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
      <img src={LOGO_URL} className="w-20 h-20 animate-pulse" />
      <h1 className="text-2xl font-black text-white italic mt-6 tracking-tighter uppercase">Ludo Club</h1>
      <div className="w-32 bg-white/5 h-1 rounded-full mt-6 overflow-hidden">
        <div className="bg-sky-500 h-full transition-all duration-300" style={{width:`${loadingProgress}%`}}></div>
      </div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-4 dotted-bg">
      <div className="bg-[#1e293b] rounded-[30px] shadow-2xl w-full max-w-sm border border-white/10 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1e297a] to-[#0a192f] p-6 text-center border-b border-white/5">
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Enter Club</h2>
        </div>
        <div className="flex bg-black/20 p-2">
            <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase ${authMode === 'LOGIN' ? 'bg-sky-500 text-white' : 'text-white/20'}`}>Login</button>
            <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase ${authMode === 'SIGNUP' ? 'bg-sky-500 text-white' : 'text-white/20'}`}>Signup</button>
        </div>
        <form onSubmit={handleAuthAction} className="p-6 space-y-3">
          {authMode === 'SIGNUP' && <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none" />}
          <input type="tel" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="Phone" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none" />
          <button type="submit" className="w-full bg-sky-500 py-4 rounded-2xl font-black text-white shadow-xl">SUBMIT</button>
        </form>
      </div>
    </div>
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col relative text-white font-fredoka overflow-hidden">
        <button 
          onClick={handleLogout}
          className="fixed top-4 right-4 z-[400] bg-red-600 text-white px-4 py-1.5 rounded-full font-black text-[10px] shadow-2xl border border-white/20 active:scale-95 transition-all"
        >
          LOGOUT ✕
        </button>

        <div className="p-4 flex items-center justify-between z-[100] relative">
            <div className="flex items-center gap-2">
                <img src={user.avatar} className="w-10 h-10 rounded-xl border border-yellow-500" />
                <span className="font-black text-xs uppercase truncate max-w-[80px]">{user.name}</span>
            </div>
            <div className="bg-[#1e293b]/60 rounded-xl px-3 py-1.5 flex items-center gap-3 border border-white/10">
                <span className="text-yellow-400 font-black text-sm">৳</span>
                <span className="font-black text-xs">{user.balance.toLocaleString()}</span>
                <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-5 h-5 rounded-lg font-black text-lg flex items-center justify-center">+</button>
            </div>
        </div>

        <div className="flex-1 px-6 space-y-6 overflow-y-auto no-scrollbar pb-20">
            <div className="bg-[#243494] rounded-[30px] p-6 shadow-2xl relative overflow-hidden min-h-[160px] cursor-pointer flex flex-col justify-center" onClick={() => setView('MATCH_CONFIG')}>
                <h2 className="text-3xl font-black italic text-[#FFD700] mb-2 uppercase tracking-tighter drop-shadow-lg">PLAY ONLINE</h2>
                <button className="bg-white text-[#243494] font-black px-6 py-2 rounded-xl uppercase text-[9px] w-fit shadow-xl">START GAME</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b]/40 p-5 rounded-[25px] border border-white/5 text-center cursor-pointer active:scale-95 transition-all">
                    <div className="text-2xl mb-2">🤖</div>
                    <span className="font-black text-[9px] uppercase tracking-widest text-sky-400">Training</span>
                </div>
                <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b]/40 p-5 rounded-[25px] border border-white/5 text-center cursor-pointer active:scale-95 transition-all">
                    <div className="text-2xl mb-2">👬</div>
                    <span className="font-black text-[9px] uppercase tracking-widest text-yellow-500">Private</span>
                </div>
            </div>
        </div>

        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={tx => { setUser(prev => ({ ...prev, balance: tx.type === 'WITHDRAW' ? prev.balance - tx.amount : prev.balance })); }} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-[#1e293b] p-6 rounded-[30px] w-full max-w-sm shadow-2xl border border-white/10">
           <h2 className="text-lg font-black italic uppercase text-center mb-6 text-yellow-500">Table Setup</h2>
           <div className="grid grid-cols-2 gap-3 mb-6">
              {[2, 4].map(c => (
                <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-4 rounded-2xl font-black text-xs border-2 transition-all ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-300' : 'bg-white/5 border-transparent text-white/40'}`}>{c} Players</button>
              ))}
           </div>
           <div className="grid grid-cols-3 gap-2 mb-8">
              {STAKE_OPTIONS.map(s => (
                <button key={s} onClick={() => setSelectedStake(s)} className={`py-3 rounded-xl font-black text-[9px] border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black' : 'bg-white/5 border-transparent text-white/20'}`}>{s}</button>
              ))}
           </div>
           <button onClick={() => { setView('MATCHING'); setTimeout(initGame, 800); }} className="w-full bg-green-500 py-4 rounded-2xl font-black text-lg shadow-2xl active:scale-95 transition-all">Start Game</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-4 text-white/20 uppercase text-[9px]">Back</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center justify-center text-white p-10">
      <div className="w-24 h-24 border-[6px] border-sky-500/10 border-t-sky-500 rounded-full animate-spin flex items-center justify-center mb-6"><span className="text-3xl">🎲</span></div>
      <h2 className="text-lg font-black italic uppercase animate-pulse">Connecting Players...</h2>
    </div>
  );

  if (view === 'GAME' && gameState) return (
    <div className="h-screen w-full bg-[#0a1220] flex flex-col items-center relative text-white overflow-hidden">
        <div className="w-full h-12 bg-[#0f172a] flex justify-between items-center px-4 border-b border-white/5 shrink-0">
           <button onClick={() => setView('LOBBY')} className="text-red-500 font-black text-[10px] uppercase">Exit</button>
           <div className="font-black text-sky-400 italic text-[10px] uppercase">Ludo Arena</div>
           <div className="text-yellow-500 font-black text-[10px]">৳{selectedStake}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-2 gap-4 w-full">
            <div className="w-full max-w-[400px] shadow-2xl rounded-[20px] overflow-hidden border-[4px] border-white/5 shrink-0 bg-white/5">
                <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} validTokens={validTokens} onTokenClick={(t) => moveToken(t.id)} />
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="text-center h-4">
                    <p className="text-[9px] font-black uppercase text-sky-400 tracking-widest animate-pulse">{gameState.players[gameState.currentPlayerIndex].name}'s Turn</p>
                </div>
                <div 
                   onClick={!gameState.players[gameState.currentPlayerIndex].isBot ? rollDice : undefined} 
                   className={`w-16 h-16 bg-white rounded-xl shadow-2xl flex items-center justify-center text-3xl font-black text-gray-800 border-b-[4px] border-gray-200 transition-all ${animating ? 'animate-spin' : ''} ${(gameState.isDiceRolled || gameState.players[gameState.currentPlayerIndex].isBot) && !animating ? 'opacity-30' : 'cursor-pointer active:scale-90 active:border-b-0'}`}
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
