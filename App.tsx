
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
        {/* Face 1 */}
        <div className="cube-face face-1"><div className="dot row-start-2 col-start-2"></div></div>
        {/* Face 2 */}
        <div className="cube-face face-2"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        {/* Face 3 */}
        <div className="cube-face face-3"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-2 col-start-2"></div><div className="dot row-start-3 col-start-3"></div></div>
        {/* Face 4 */}
        <div className="cube-face face-4"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        {/* Face 5 */}
        <div className="cube-face face-5"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-2 col-start-2"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
        {/* Face 6 */}
        <div className="cube-face face-6"><div className="dot row-start-1 col-start-1"></div><div className="dot row-start-1 col-start-3"></div><div className="dot row-start-2 col-start-1"></div><div className="dot row-start-2 col-start-3"></div><div className="dot row-start-3 col-start-1"></div><div className="dot row-start-3 col-start-3"></div></div>
      </div>
    </div>
  );
};

const PlayerProfileOverlay: React.FC<{ player: Player, isActive: boolean, position: 'TL' | 'TR' | 'BL' | 'BR' }> = ({ player, isActive, position }) => {
  const posClasses = {
    TL: 'top-[-85px] left-0',
    TR: 'top-[-85px] right-0',
    BL: 'bottom-[-85px] left-0',
    BR: 'bottom-[-85px] right-0'
  };

  const borderColors = {
    [PlayerColor.RED]: 'border-red-500',
    [PlayerColor.GREEN]: 'border-green-500',
    [PlayerColor.YELLOW]: 'border-yellow-400',
    [PlayerColor.BLUE]: 'border-blue-500'
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-60 scale-90'}`}>
       <div className={`relative p-1 rounded-2xl border-4 ${isActive ? 'border-yellow-500 shadow-[0_0_25px_#fbbf24]' : borderColors[player.color]}`}>
          <img src={player.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`} className="w-16 h-16 rounded-xl object-cover bg-slate-800 shadow-lg" />
          {isActive && <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full border-2 border-[#0f172a] animate-bounce"></div>}
       </div>
       <div className="mt-1 flex flex-col items-center bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
          <span className="text-[10px] font-black uppercase tracking-tighter italic text-white leading-none whitespace-nowrap">{player?.name || 'Player'}</span>
          <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">{player?.flag || '🚩'} {player?.country || 'Global'}</span>
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

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [commentary, setCommentary] = useState<string>('Welcome to Ludo Money Arena!');

  const botActionTimeout = useRef<any>(null);
  const autoForwardTimeout = useRef<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const users = await databaseService.getUsers();
        setAllUsers(users);
        const saved = localStorage.getItem('LUDO_SESSION');
        if (saved) {
          const parsed = JSON.parse(saved);
          const fresh = users.find(u => u.phone === parsed.phone);
          setUser(fresh || parsed);
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

    if (isSignUp) {
      const exists = allUsers.find(u => u.phone === phone);
      if (exists) return setAuthError('User already exists');
      const newUser: UserProfile = {
        name, phone, password, balance: 50,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name + Math.random()}`,
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 },
        history: []
      };
      await databaseService.updateUser(newUser);
      setUser(newUser);
      localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
      setView('LOBBY');
    } else {
      const found = allUsers.find(u => u.phone === phone && u.password === password);
      if (found) {
        setUser(found);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(found));
        setView('LOBBY');
      } else {
        setAuthError('Invalid credentials');
      }
    }
  };

  const handleAdminAuth = () => {
    setAuthError('');
    if (adminId === 'admin' && adminPass === 'admin123') {
      setView('ADMIN');
      setAdminId('');
      setAdminPass('');
    } else {
      setAuthError('Invalid Admin Credentials');
    }
  };

  const startFinding = async (count: 2 | 4) => {
    if (!user) return;
    if (user.balance < selectedStake) return alert("Insufficient Balance!");
    
    const updatedUser = { ...user, balance: user.balance - selectedStake };
    setUser(updatedUser);
    await databaseService.updateUser(updatedUser);

    setPlayerCount(count);
    setView('FINDING');
    setFoundPlayers([]);
    soundManager.play('click');

    const playersToFind = count - 1;
    let found = 0;
    const colors = [PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    const bots: Player[] = [];
    const searchInterval = setInterval(() => {
      if (found < playersToFind) {
        const botIden = getRandomBotIdentity();
        const newBot: Player = {
          id: `bot-${found}`,
          name: botIden.name,
          country: botIden.country,
          flag: botIden.flag,
          color: colors[found],
          isBot: true,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botIden.name + Math.random()}`,
          tokens: []
        };
        bots.push(newBot);
        setFoundPlayers([...bots]);
        found++;
        soundManager.play('click');
      } else {
        clearInterval(searchInterval);
        setTimeout(() => initGame(count, bots), 1000);
      }
    }, 1200 + Math.random() * 1500);
  };

  const initGame = (count: number, bots: Player[]) => {
    if (!user) return;
    const colors = count === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    const players: Player[] = colors.map((color, i) => {
      const isUser = i === 0;
      const botIdentity = isUser ? null : bots[i-1];
      return {
        id: isUser ? 'user' : `bot-${i}`,
        name: isUser ? user.name : (botIdentity?.name || 'Bot Player'),
        country: isUser ? 'Bangladesh' : (botIdentity?.country || 'Global'),
        flag: isUser ? '🇧🇩' : (botIdentity?.flag || '🚩'),
        color, isBot: !isUser,
        avatarUrl: isUser ? user.avatar : (botIdentity?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=Bot${i}`),
        tokens: Array(4).fill(null).map((_, ti) => ({
          id: (i * 10) + ti, color, state: TokenState.HOME, position: 0, distanceTraveled: 0
        }))
      };
    });

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false,
      winner: null, log: ['Game Started'], lastAction: 'Roll Dice', consecutiveSixes: 0
    });
    setView('GAME');
    soundManager.play('six');
    setCommentary('Good luck everyone! Let the battle begin.');
  };

  const nextTurn = useCallback(() => {
    if (autoForwardTimeout.current) {
        clearTimeout(autoForwardTimeout.current);
        autoForwardTimeout.current = null;
    }
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

  const rollDice = async () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    
    setIsRolling(true);
    soundManager.play('dice');
    
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');

      setGameState(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          diceValue: val, 
          isDiceRolled: true, 
          consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 
        };
      });
    }, 800);
  };

  const moveToken = async (tokenData: Token) => {
    if (autoForwardTimeout.current) {
        clearTimeout(autoForwardTimeout.current);
        autoForwardTimeout.current = null;
    }
    if (!gameState || !gameState.isDiceRolled || isRolling || gameState.winner) return;
    
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    if (!player) return;

    const tokenIdx = player.tokens.findIndex(t => t.id === tokenData.id);
    if (tokenIdx === -1) return;

    const token = { ...player.tokens[tokenIdx] };
    const val = gameState.diceValue!;

    if (token.state === TokenState.WIN) return;
    if (token.state === TokenState.HOME && val !== 6) return;
    if (token.state === TokenState.PATH && token.distanceTraveled + val > 56) return;

    let capturedToken = false;

    if (token.state === TokenState.HOME && val === 6) {
      token.state = TokenState.PATH;
      token.distanceTraveled = 0;
    } else if (token.state === TokenState.PATH) {
      token.distanceTraveled += val;
      if (token.distanceTraveled === 56) {
        token.state = TokenState.WIN;
        soundManager.play('win');
      } else {
        const startPos = START_POSITIONS[token.color];
        const absolutePos = (token.distanceTraveled + startPos) % 52;
        const isSafe = SAFE_SPOTS.includes(absolutePos);

        if (!isSafe) {
          players.forEach((otherPlayer, pIdx) => {
            if (pIdx !== gameState.currentPlayerIndex) {
              otherPlayer.tokens.forEach((otherToken) => {
                if (otherToken.state === TokenState.PATH) {
                  const otherStart = START_POSITIONS[otherToken.color];
                  const otherAbsolute = (otherToken.distanceTraveled + otherStart) % 52;
                  if (otherAbsolute === absolutePos) {
                    otherToken.state = TokenState.HOME;
                    otherToken.distanceTraveled = 0;
                    capturedToken = true;
                  }
                }
              });
            }
          });
        }
      }
    }
    
    player.tokens[tokenIdx] = token;
    soundManager.play('move');

    if (capturedToken) {
      soundManager.play('kill');
      const comment = await generateGameCommentary("just executed a brilliant capture!", player.name);
      setCommentary(comment);
    }

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(prev => prev ? { ...prev, players, winner: player.color } : null);
      if (player.id === 'user' && user) {
        const prize = Math.floor(selectedStake * 1.8);
        const updatedUser = { ...user, balance: user.balance + prize };
        setUser(updatedUser);
        await databaseService.updateUser(updatedUser);
      }
      return;
    }

    const continueTurn = val === 6 || capturedToken;
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        players,
        isDiceRolled: false,
        diceValue: null,
        currentPlayerIndex: continueTurn ? prev.currentPlayerIndex : (prev.currentPlayerIndex + 1) % prev.players.length
      };
    });
  };

  useEffect(() => {
    if (!gameState || gameState.winner || isRolling) return;
    
    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    if (!activePlayer) return;

    if (activePlayer.isBot) {
        if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
        
        botActionTimeout.current = setTimeout(() => {
            if (!gameState.isDiceRolled) {
                rollDice();
            } else {
                const val = gameState.diceValue!;
                const valid = activePlayer.tokens.filter(t => {
                    if (t.state === TokenState.WIN) return false;
                    if (t.state === TokenState.HOME) return val === 6;
                    return t.distanceTraveled + val <= 56;
                });

                if (valid.length > 0) {
                    let bestToken = valid[0];
                    const captureToken = valid.find(t => {
                        const start = START_POSITIONS[t.color];
                        const dist = t.state === TokenState.HOME ? 0 : t.distanceTraveled + val;
                        const abs = (dist + start) % 52;
                        if (SAFE_SPOTS.includes(abs)) return false;
                        return gameState.players.some((other, pIdx) => {
                            if (pIdx === gameState.currentPlayerIndex) return false;
                            return other.tokens.some(ot => ot.state === TokenState.PATH && (ot.distanceTraveled + START_POSITIONS[ot.color]) % 52 === abs);
                        });
                    });

                    if (captureToken) bestToken = captureToken;
                    else {
                        const nearingWin = valid.find(t => t.distanceTraveled > 40);
                        const outFromHome = valid.find(t => t.state === TokenState.HOME);
                        if (nearingWin) bestToken = nearingWin;
                        else if (outFromHome) bestToken = outFromHome;
                    }
                    moveToken(bestToken);
                } else {
                    nextTurn();
                }
            }
        }, 1500 + Math.random() * 1000);
    } else {
        if (gameState.isDiceRolled && !autoForwardTimeout.current) {
            const val = gameState.diceValue!;
            const hasValidMove = activePlayer.tokens.some(t => {
                if (t.state === TokenState.WIN) return false;
                if (t.state === TokenState.HOME) return val === 6;
                return t.distanceTraveled + val <= 56;
            });

            if (!hasValidMove) {
                setCommentary("No valid moves! Skipping in 2s...");
                autoForwardTimeout.current = setTimeout(() => {
                    autoForwardTimeout.current = null;
                    nextTurn();
                }, 2000);
            } else {
                if (val === 6) setCommentary("You got a SIX! Roll again after move.");
                else setCommentary(`You rolled a ${val}. Please select a token.`);
            }
        }
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled, isRolling]);

  return (
    <div className="h-screen w-full bg-[#020617] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-7xl mb-12">LUDO MONEY</h1>
          <div className="w-72 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.5)] rounded-full transition-all duration-300" style={{width: `${loadingProgress}%`}}></div>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.5em] text-white/20">Loading Arena</p>
        </div>
      )}

      {(view === 'LOGIN' || view === 'ADMIN_AUTH') && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18] relative">
           <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-600/10 to-transparent"></div>
           <div className="bg-[#1c212e]/90 backdrop-blur-xl p-10 py-12 rounded-[50px] w-full max-w-[420px] border border-white/10 flex flex-col items-center shadow-[0_30px_60px_rgba(0,0,0,0.5)] animate-in zoom-in-95 z-10">
              <h2 className="ludo-money-logo text-6xl mb-12 uppercase font-black italic tracking-tight scale-110">
                {view === 'ADMIN_AUTH' ? 'ADMIN' : (isSignUp ? 'SIGNUP' : 'LOGIN')}
              </h2>
              {authError && <div className="text-red-500 mb-6 text-[11px] font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">{authError}</div>}
              
              <div className="w-full space-y-5 mb-10">
                 {view === 'LOGIN' && isSignUp && (
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-white/20 ml-5 tracking-widest">Display Name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />
                   </div>
                 )}
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-white/20 ml-5 tracking-widest">Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-white/20 ml-5 tracking-widest">Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 transition-all" />
                 </div>
              </div>
              
              <button onClick={view === 'ADMIN_AUTH' ? handleAdminAuth : handleAuth} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-lg uppercase shadow-xl active:scale-95 transition-all">
                 {view === 'ADMIN_AUTH' ? 'Enter Console' : (isSignUp ? 'Create Account' : 'Login Now')}
              </button>

              {view === 'LOGIN' && (
                <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                   {isSignUp ? 'Already have an account? Login' : 'New here? Create Account'}
                </button>
              )}
           </div>
           
           {view === 'LOGIN' && (
             <button onClick={() => setView('ADMIN_AUTH')} className="absolute bottom-10 text-white/10 hover:text-white/40 transition-colors text-[10px] font-black uppercase tracking-widest">
                Admin Access
             </button>
           )}
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="flex-1 flex flex-col animate-in fade-in overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl border-2 border-yellow-500 bg-slate-800 overflow-hidden">
                <img src={user.avatar} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none">{user.name}</h3>
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Player Rank: Gold</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => setWalletOpen(true)} className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                    <span className="bg-yellow-500 text-black w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black">৳</span>
                    <span className="text-xs font-black text-yellow-500">{user.balance.toLocaleString()}</span>
                </button>
                <button className="text-white/40 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
          </div>

          {/* Notice Bar */}
          <div className="bg-yellow-400 h-8 flex items-center overflow-hidden border-y border-yellow-600 shadow-md">
             <div className="animate-scroll-text whitespace-nowrap flex items-center gap-10">
                <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🏆 TOURNAMENT STARTING IN 15 MINS! JOIN NOW 🏆</span>
                <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🎲 RONY JUST WITHDREW ৳২০০০ TO BKASH 🎲</span>
                <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🏆 TOURNAMENT STARTING IN 15 MINS! JOIN NOW 🏆</span>
                <span className="text-[10px] font-black text-black uppercase tracking-tighter flex items-center gap-2">🎲 RONY JUST WITHDREW ৳২০০০ TO BKASH 🎲</span>
             </div>
          </div>

          <div className="p-6 pt-4 space-y-6 flex-1 flex flex-col">
            {/* Promo Cards */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-[30px] flex items-center gap-3 border border-indigo-400/30 shadow-xl relative overflow-hidden group active:scale-95 transition-all">
                  <div className="absolute -right-2 -bottom-2 opacity-10 text-6xl group-hover:scale-125 transition-all">🎁</div>
                  <span className="text-3xl">🎁</span>
                  <div>
                    <p className="text-[8px] font-black uppercase text-indigo-300 tracking-widest mb-0.5">Daily Reward</p>
                    <h4 className="text-[11px] font-black uppercase italic tracking-tighter">Claim ৳৫০</h4>
                  </div>
               </div>
               <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-4 rounded-[30px] flex items-center gap-3 border border-orange-400/30 shadow-xl relative overflow-hidden group active:scale-95 transition-all">
                  <div className="absolute -right-2 -bottom-2 opacity-10 text-6xl group-hover:scale-125 transition-all">🔥</div>
                  <span className="text-3xl">🔥</span>
                  <div>
                    <p className="text-[8px] font-black uppercase text-orange-200 tracking-widest mb-0.5">Hot Event</p>
                    <h4 className="text-[11px] font-black uppercase italic tracking-tighter">2X Points</h4>
                  </div>
               </div>
            </div>

            {/* Main Pro Arena Card */}
            <div className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 rounded-[50px] p-8 border-4 border-blue-400/20 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between relative overflow-hidden">
               {/* 2P / 4P Selector */}
               <div className="bg-slate-900/40 p-1.5 rounded-full flex gap-1 border border-white/5 backdrop-blur-sm z-10">
                  <button onClick={() => setPlayerCount(2)} className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 2 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40 hover:text-white/60'}`}>2 Player</button>
                  <button onClick={() => setPlayerCount(4)} className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${playerCount === 4 ? 'bg-yellow-400 text-black shadow-lg scale-105' : 'text-white/40 hover:text-white/60'}`}>4 Player</button>
               </div>

               <div className="flex flex-col items-center gap-4 py-6 z-10">
                  <div className="w-32 h-32 bg-yellow-400 rounded-[35px] flex items-center justify-center shadow-[0_15px_30px_rgba(0,0,0,0.3)] border-b-8 border-yellow-600 active:translate-y-1 active:border-b-4 transition-all">
                     <div className="w-16 h-16 bg-white rounded-xl rotate-12 flex items-center justify-center shadow-lg border-b-4 border-slate-300">
                        <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                     </div>
                  </div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.2)]">Pro Arena</h2>
               </div>

               {/* Stakes */}
               <div className="w-full max-w-sm grid grid-cols-4 gap-2 z-10">
                  {[50, 100, 500, 1000].map(stake => (
                    <button 
                      key={stake} 
                      onClick={() => setSelectedStake(stake)}
                      className={`py-3 rounded-xl font-black text-[10px] border-2 transition-all ${selectedStake === stake ? 'bg-yellow-400 border-yellow-300 text-black shadow-lg scale-105' : 'bg-slate-900/40 border-white/5 text-white/40'}`}
                    >
                      ৳{stake}
                    </button>
                  ))}
               </div>

               {/* Start Battle Button */}
               <button 
                 onClick={() => startFinding(playerCount)}
                 className="w-full mt-6 py-5 bg-gradient-to-b from-yellow-400 to-amber-600 rounded-[30px] font-black text-xl uppercase italic tracking-tight text-black border-b-8 border-amber-800 active:translate-y-2 active:border-b-0 transition-all shadow-[0_10px_30px_rgba(251,191,36,0.2)] z-10"
               >
                 Start Battle
               </button>

               {/* Decorative Circle BG */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square rounded-full border border-white/5 pointer-events-none"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-square rounded-full border border-white/5 pointer-events-none"></div>
            </div>
          </div>

          {/* Bottom Nav */}
          <div className="bg-slate-900/90 backdrop-blur-xl border-t border-white/5 flex justify-around p-4">
             <button className="flex flex-col items-center gap-1 group">
                <div className="w-6 h-6 bg-yellow-400 rounded-md flex items-center justify-center text-xs group-active:scale-90 transition-all shadow-md">🏠</div>
                <span className="text-[8px] font-black uppercase text-yellow-400 tracking-widest">Home</span>
             </button>
             <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                <div className="w-6 h-6 flex items-center justify-center text-xl">🏆</div>
                <span className="text-[8px] font-black uppercase tracking-widest">Rank</span>
             </button>
             <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                <div className="w-6 h-6 flex items-center justify-center text-xl">🛡️</div>
                <span className="text-[8px] font-black uppercase tracking-widest">Shop</span>
             </button>
          </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#020617] animate-in zoom-in-95">
           {/* Circular Yellow Loader from image */}
           <div className="relative w-32 h-32 mb-10 flex items-center justify-center">
              <div className="absolute inset-0 border-[10px] border-slate-900 rounded-full"></div>
              <div className="absolute inset-0 border-[10px] border-yellow-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#fbbf24]"></div>
           </div>
           
           <h2 className="text-5xl font-black italic tracking-tighter text-yellow-400 uppercase drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] mb-2">Searching...</h2>
           <p className="text-white/40 font-black uppercase tracking-widest text-[10px] mb-12">POOL STAKE: ৳ {selectedStake} • PRO BATTLE</p>
           
           <div className="grid grid-cols-2 gap-x-12 gap-y-12 mb-16">
              {/* YOU slot */}
              <div className="flex flex-col items-center gap-3">
                 <div className="w-24 h-24 rounded-[25px] border-4 border-yellow-500 shadow-[0_0_25px_rgba(251,191,36,0.5)] p-1 bg-slate-800 relative">
                    <img src={user?.avatar} className="w-full h-full rounded-[20px] object-cover" alt="You" />
                 </div>
                 <div className="bg-yellow-500 px-4 py-0.5 rounded-full">
                    <span className="text-[8px] font-black text-black uppercase">YOU</span>
                 </div>
              </div>

              {/* Opponent slots */}
              {Array(3).fill(0).map((_, i) => {
                  const p = foundPlayers[i];
                  return (
                    <div key={i} className={`flex flex-col items-center gap-3 transition-all duration-500 ${p ? 'scale-100 opacity-100' : 'opacity-20 scale-90'}`}>
                       <div className={`w-24 h-24 rounded-[25px] border-4 ${p ? 'border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.5)]' : 'border-white/10'} p-1 bg-slate-800`}>
                          {p ? <img src={p.avatarUrl} className="w-full h-full rounded-[20px] object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/10">?</div>}
                       </div>
                       <span className="text-[10px] font-black uppercase italic tracking-tighter text-white/60">{p?.name || 'WAITING...'}</span>
                    </div>
                  );
              })}
           </div>

           <button onClick={() => setView('LOBBY')} className="px-10 py-3 bg-slate-900/50 border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all">
              Abort Matchmaking
           </button>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="flex-1 flex flex-col p-4 relative animate-in fade-in">
          <div className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 z-[60] flex items-center gap-3">
             <span className="text-xl">🎙️</span>
             <p className="text-[11px] font-bold text-sky-400 italic leading-tight">{commentary}</p>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 mt-12">
            <div className="w-full max-w-[500px] aspect-square relative">
              <LudoBoard 
                players={gameState.players} 
                onTokenClick={moveToken}
                validTokens={(() => {
                  if (gameState.currentPlayerIndex !== 0) return [];
                  const player = gameState.players[0];
                  const val = gameState.diceValue;
                  if (!val || !gameState.isDiceRolled) return [];
                  return player.tokens.filter(t => {
                    if (t.state === TokenState.WIN) return false;
                    if (t.state === TokenState.HOME) return val === 6;
                    return t.distanceTraveled + val <= 56;
                  }).map(t => t.id);
                })()}
                currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color}
              />
              {gameState.players.map((p, i) => {
                const positions: ('TL' | 'TR' | 'BR' | 'BL')[] = playerCount === 2 ? ['TL', 'BR'] : ['TL', 'TR', 'BR', 'BL'];
                return <PlayerProfileOverlay key={p.id} player={p} isActive={gameState.currentPlayerIndex === i} position={positions[i]} />;
              })}
            </div>
          </div>

          {/* REALISTIC 3D DICE ROLL UI */}
          <div className="h-44 flex flex-col items-center justify-center gap-4 bg-[#020617]/80 rounded-t-[40px] border-t border-white/5 backdrop-blur-xl">
             <button 
               onClick={rollDice} 
               disabled={gameState.currentPlayerIndex !== 0 || gameState.isDiceRolled || isRolling}
               className={`group flex flex-col items-center gap-4 transition-all ${gameState.currentPlayerIndex === 0 && !gameState.isDiceRolled ? 'scale-100 opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}
             >
                <div className="relative w-28 h-28 rounded-[35px] border-4 border-yellow-500 shadow-[0_0_20px_rgba(251,191,36,0.6)] flex items-center justify-center bg-slate-800 transition-transform group-active:scale-95">
                    {/* Integrated 3D Rolling Dice */}
                    <Dice3D value={gameState.diceValue} isRolling={isRolling} />
                </div>
                <div className="flex flex-col items-center gap-2">
                   <span className="text-xs font-black uppercase italic tracking-tighter text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Roll the dice!</span>
                   {/* Horizontal Progress Bar */}
                   <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-yellow-400 ${!gameState.isDiceRolled && gameState.currentPlayerIndex === 0 ? 'animate-[timer_10s_linear_forwards]' : 'w-0'}`}></div>
                   </div>
                </div>
             </button>
          </div>
        </div>
      )}

      {view === 'ADMIN' && user && (
        <AdminPortal 
          user={user}
          allUsers={allUsers}
          onUpdateUsersDB={setAllUsers}
          pendingTransactions={pendingTransactions}
          liveMatches={[]}
          onUpdateUser={async (u) => {
            const updated = allUsers.map(usr => usr.phone === u.phone ? u : usr);
            setAllUsers(updated);
            await databaseService.updateUser(u);
          }}
          onApproveTransaction={async (tx) => {
            const u = allUsers.find(usr => usr.name === tx.userName);
            if (u) {
              const updatedUser = { 
                ...u, 
                balance: tx.type === 'DEPOSIT' ? u.balance + tx.amount : u.balance - tx.amount,
                history: u.history.map(h => h.id === tx.id ? { ...h, status: 'APPROVED' as const } : h)
              };
              await databaseService.updateUser(updatedUser);
              setAllUsers(allUsers.map(usr => usr.phone === updatedUser.phone ? updatedUser : usr));
              setPendingTransactions(prev => prev.filter(p => p.id !== tx.id));
            }
          }}
          onRejectTransaction={async (txId) => {
            setPendingTransactions(prev => prev.filter(p => p.id !== txId));
          }}
          onExit={() => setView('LOBBY')}
        />
      )}

      {isWalletOpen && user && (
        <WalletModal 
          isOpen={isWalletOpen} 
          onClose={() => setWalletOpen(false)} 
          user={user}
          onSubmitTransaction={(tx) => {
            setPendingTransactions(prev => [...prev, tx]);
            const updatedUser = { ...user, history: [...(user.history || []), tx] };
            setUser(updatedUser);
            databaseService.updateUser(updatedUser);
          }}
        />
      )}

      {gameState?.winner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
           <div className="bg-slate-900 border-2 border-yellow-500 rounded-[50px] p-12 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-sm w-full">
              <h2 className="text-4xl font-black italic text-white mb-2 uppercase tracking-tighter">Winner!</h2>
              <button onClick={() => setView('LOBBY')} className="w-full bg-yellow-500 text-black py-5 rounded-3xl font-black text-xl uppercase shadow-xl active:scale-95 transition-all">Lobby</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
