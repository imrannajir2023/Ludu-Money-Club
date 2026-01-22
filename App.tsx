
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
    TL: 'top-[-80px] left-0',
    TR: 'top-[-80px] right-0',
    BL: 'bottom-[-80px] left-0',
    BR: 'bottom-[-80px] right-0'
  };

  return (
    <div className={`absolute ${posClasses[position]} flex flex-col items-center z-50 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-60 scale-90'}`}>
       <div className={`relative p-1 rounded-2xl border-2 ${isActive ? 'border-yellow-500 shadow-[0_0_20px_#fbbf24]' : 'border-white/10'}`}>
          <img src={player.avatarUrl} className="w-14 h-14 rounded-xl object-cover bg-slate-800 shadow-lg" />
          {isActive && <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-[#0f172a] animate-pulse"></div>}
       </div>
       <div className="mt-1 flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-tighter italic text-white leading-none whitespace-nowrap drop-shadow-md">{player?.name || 'Player'}</span>
          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{player?.flag || '🚩'} {player?.country || 'Global'}</span>
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
  const [adminClickCount, setAdminClickCount] = useState(0);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [commentary, setCommentary] = useState<string>('Welcome to Ludo Money Arena!');

  const botActionTimeout = useRef<any>(null);

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
    if (adminId === 'admin' && adminPass === '123456') {
      setView('ADMIN');
      setAdminId('');
      setAdminPass('');
    } else {
      setAuthError('Invalid Admin details');
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
    const colors = [PlayerColor.YELLOW, PlayerColor.GREEN, PlayerColor.BLUE];
    
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
        avatarUrl: isUser ? user.avatar : (botIdentity?.avatarUrl || ''),
        tokens: Array(4).fill(null).map((_, ti) => ({
          id: i * 10 + ti, color, state: TokenState.HOME, position: 0, distanceTraveled: 0
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
    setGameState(prev => {
      if (!prev) return null;
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
    
    setTimeout(async () => {
      const val = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      soundManager.play('dice_stop');

      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => {
          if (t.state === TokenState.WIN) return false;
          if (t.state === TokenState.HOME) return val === 6;
          return t.distanceTraveled + val <= 56;
        });

        if (val === 6) {
          if (prev.consecutiveSixes === 2) { 
            setTimeout(nextTurn, 1000);
            return { ...prev, diceValue: val, isDiceRolled: true, log: [...prev.log, 'Triple 6! Turn skipped'] };
          }
        }

        if (!canMove) {
          setTimeout(nextTurn, 1200);
        }

        return { 
          ...prev, 
          diceValue: val, 
          isDiceRolled: true, 
          consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0 
        };
      });

      if (val === 6) {
        const pName = gameState.players[gameState.currentPlayerIndex]?.name || 'Player';
        const comment = await generateGameCommentary("rolled a massive six", pName);
        setCommentary(comment);
      }
    }, 800);
  };

  const moveToken = async (tokenId: number) => {
    if (!gameState || !gameState.isDiceRolled || isRolling) return;
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    if (!player) return;
    
    const tokenIdx = player.tokens.findIndex(t => t.id === tokenId);
    const token = { ...player.tokens[tokenIdx] };
    const val = gameState.diceValue!;

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
    if (gameState && gameState.players[gameState.currentPlayerIndex]?.isBot && !gameState.winner) {
      if (botActionTimeout.current) clearTimeout(botActionTimeout.current);
      
      botActionTimeout.current = setTimeout(() => {
        if (!gameState.isDiceRolled) {
          rollDice();
        } else {
          const p = gameState.players[gameState.currentPlayerIndex];
          const val = gameState.diceValue!;
          const valid = p.tokens.filter(t => {
            if (t.state === TokenState.WIN) return false;
            if (t.state === TokenState.HOME) return val === 6;
            return t.distanceTraveled + val <= 56;
          });

          if (valid.length > 0) {
            // Pro AI Decision Logic
            let bestToken = valid[0];
            
            // 1. Prioritize Capturing opponents
            const captureToken = valid.find(t => {
              const start = START_POSITIONS[t.color];
              const dist = t.state === TokenState.HOME ? 0 : t.distanceTraveled + val;
              const abs = (dist + start) % 52;
              if (SAFE_SPOTS.includes(abs)) return false;
              return gameState.players.some((other, pIdx) => {
                if (pIdx === gameState.currentPlayerIndex) return false;
                return other.tokens.some(ot => {
                  if (ot.state !== TokenState.PATH) return false;
                  const otAbs = (ot.distanceTraveled + START_POSITIONS[ot.color]) % 52;
                  return otAbs === abs;
                });
              });
            });

            if (captureToken) {
                bestToken = captureToken;
            } else {
                // 2. Prioritize Winning/Entering Home
                const nearingWin = valid.find(t => t.distanceTraveled > 40);
                // 3. Prioritize getting out of Home
                const outFromHome = valid.find(t => t.state === TokenState.HOME);
                // 4. Prioritize getting into a Safe Spot
                const toSafeSpot = valid.find(t => SAFE_SPOTS.includes((t.distanceTraveled + val + START_POSITIONS[t.color]) % 52));

                if (nearingWin) bestToken = nearingWin;
                else if (toSafeSpot) bestToken = toSafeSpot;
                else if (outFromHome) bestToken = outFromHome;
            }
            
            moveToken(bestToken.id);
          } else {
            nextTurn();
          }
        }
      }, 1500 + Math.random() * 1000);
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled]);

  return (
    <div className="h-screen w-full bg-[#050a18] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
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
                      <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/40 border border-white/5 p-5 rounded-[25px] outline-none text-white font-medium placeholder:text-white/10 focus:border-yellow-500/30 transition-all" />
                   </div>
                 )}
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-white/20 ml-5 tracking-widest">Credentials</label>
                    <input type="text" placeholder={view === 'ADMIN_AUTH' ? "Admin ID" : "Phone Number"} value={view === 'ADMIN_AUTH' ? adminId : phone} onChange={e => view === 'ADMIN_AUTH' ? setAdminId(e.target.value) : setPhone(e.target.value)} className="w-full bg-black/40 border border-white/5 p-5 rounded-[25px] outline-none text-white font-medium placeholder:text-white/10 focus:border-yellow-500/30 transition-all" />
                 </div>
                 <input type="password" placeholder="Password" value={view === 'ADMIN_AUTH' ? adminPass : password} onChange={e => view === 'ADMIN_AUTH' ? setAdminPass(e.target.value) : setPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 p-5 rounded-[25px] outline-none text-white font-medium placeholder:text-white/10 focus:border-yellow-500/30 transition-all" />
              </div>

              <button 
                onClick={view === 'ADMIN_AUTH' ? handleAdminAuth : handleAuth} 
                className="w-full bg-gradient-to-b from-[#fcd34d] to-[#f59e0b] text-black py-6 rounded-[30px] font-black text-xl shadow-[0_10px_0_#b45309] active:translate-y-2 active:shadow-[0_4px_0_#b45309] transition-all uppercase tracking-tight"
              >
                {view === 'ADMIN_AUTH' ? 'LOGIN ADMIN' : (isSignUp ? 'REGISTER' : 'ENTER LOBBY')}
              </button>

              <button 
                onClick={() => view === 'ADMIN_AUTH' ? setView('LOGIN') : setIsSignUp(!isSignUp)} 
                className="mt-10 text-[10px] uppercase font-black text-white/20 tracking-[0.3em] hover:text-white/60 transition-colors"
              >
                {view === 'ADMIN_AUTH' ? 'Back to Player Login' : (isSignUp ? 'Already have account? Login' : 'No account? Join Club')}
              </button>
           </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center bg-[#020617] p-10 relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
           
           <div className="text-center mb-16 z-10">
              <div className="w-24 h-24 border-8 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-8 shadow-[0_0_40px_rgba(251,191,36,0.2)]"></div>
              <h2 className="text-5xl font-black italic uppercase text-yellow-500 tracking-tighter drop-shadow-lg">Searching...</h2>
              <p className="text-white/30 text-[11px] font-bold mt-4 uppercase tracking-[0.4em]">Pool Stake: ৳{selectedStake} • Pro Battle</p>
           </div>
           
           <div className="grid grid-cols-2 gap-12 w-full max-w-sm z-10">
              <div className="flex flex-col items-center gap-5">
                 <div className="w-28 h-28 rounded-[40px] border-4 border-yellow-500 p-1 bg-slate-800 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                    <img src={user?.avatar} className="w-full h-full rounded-[30px] object-cover" />
                 </div>
                 <div className="bg-yellow-500 px-4 py-1 rounded-full shadow-lg">
                    <span className="font-black text-[10px] text-black uppercase">YOU</span>
                 </div>
              </div>

              {Array.from({ length: playerCount - 1 }).map((_, i) => {
                const found = foundPlayers[i];
                return (
                  <div key={i} className="flex flex-col items-center gap-5 animate-in zoom-in-50">
                     <div className={`w-28 h-28 rounded-[40px] border-4 ${found ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/5 border-dashed'} p-1 bg-slate-800 transition-all duration-700 relative overflow-hidden`}>
                        {found ? (
                          <img src={found.avatarUrl} className="w-full h-full rounded-[30px] object-cover animate-in fade-in" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/5 text-5xl">?</div>
                        )}
                        {!found && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent animate-pulse"></div>}
                     </div>
                     <span className={`font-black text-[10px] uppercase italic truncate max-w-[110px] tracking-widest ${found ? 'text-white' : 'text-white/10'}`}>
                        {found ? found.name : 'Finding Player...'}
                     </span>
                  </div>
                );
              })}
           </div>

           <button onClick={() => setView('LOBBY')} className="mt-20 z-10 text-white/20 text-[10px] font-black uppercase tracking-widest border border-white/5 px-12 py-4 rounded-full hover:bg-white/5 transition-all active:scale-95">Abort Matchmaking</button>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col bg-[#020617] relative">
          <div className="p-4 flex justify-between items-center z-20 bg-black/20 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="relative">
                 <img src={user.avatar} className="w-14 h-14 rounded-2xl border-2 border-yellow-500 shadow-xl" />
                 <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#020617]"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-black uppercase text-base italic leading-none">{user.name}</span>
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Player Rank: Gold</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div onClick={() => setWalletOpen(true)} className="bg-black/60 border border-yellow-500/20 px-4 py-2 rounded-2xl flex items-center gap-3 cursor-pointer active:scale-95 transition-all shadow-lg">
                <div className="bg-yellow-500 text-black w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px]">৳</div>
                <span className="font-black text-base text-yellow-500 tracking-tighter">{user.balance.toLocaleString()}</span>
              </div>
              <button onClick={() => { localStorage.removeItem('LUDO_SESSION'); setView('LOGIN'); }} className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-colors">✕</button>
            </div>
          </div>

          <div className="w-full h-9 bg-yellow-500 border-y border-yellow-600 flex items-center shadow-lg">
            <div className="animate-scroll-text gap-24 whitespace-nowrap">
               <span className="text-[11px] font-black italic text-black uppercase tracking-widest flex items-center gap-3">🏆 TOURNAMENT STARTING IN 15 MINS! JOIN NOW 🏆</span>
               <span className="text-[11px] font-black italic text-black uppercase tracking-widest flex items-center gap-3">💸 RONY JUST WITHDREW ৳৫০০০ TO BKASH 💸</span>
               <span className="text-[11px] font-black italic text-black uppercase tracking-widest flex items-center gap-3 ml-24">🏆 TOURNAMENT STARTING IN 15 MINS! JOIN NOW 🏆</span>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-6 overflow-y-auto no-scrollbar pb-24">
            <div className="grid grid-cols-2 gap-5">
               <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-[40px] border border-white/10 flex items-center gap-4 active:scale-95 transition-all shadow-xl group">
                  <div className="text-4xl group-hover:scale-110 transition-transform">🎁</div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">Daily Reward</span>
                    <span className="text-sm font-black italic text-white uppercase leading-none mt-1">Claim ৳৫০</span>
                  </div>
               </div>
               <div className="bg-gradient-to-br from-amber-600 to-orange-700 p-6 rounded-[40px] border border-white/10 flex items-center gap-4 active:scale-95 transition-all shadow-xl group">
                  <div className="text-4xl group-hover:scale-110 transition-transform">🔥</div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">Hot Event</span>
                    <span className="text-sm font-black italic text-white uppercase leading-none mt-1">2X Points</span>
                  </div>
               </div>
            </div>

            <div className="bg-gradient-to-b from-blue-600 to-blue-800 rounded-[60px] p-10 flex flex-col items-center border-4 border-white/10 relative shadow-[0_40px_80px_rgba(0,0,0,0.6)] min-h-[460px] overflow-hidden">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-black/20 rounded-full blur-3xl"></div>
                
                <div className="flex gap-4 mb-10 bg-black/30 p-2.5 rounded-full border border-white/5 z-10 shadow-inner">
                   <button onClick={() => setPlayerCount(2)} className={`px-10 py-3.5 rounded-full font-black text-xs uppercase transition-all ${playerCount === 2 ? 'bg-yellow-500 text-black shadow-[0_5px_15px_rgba(251,191,36,0.4)] scale-105' : 'bg-transparent text-white/20 hover:text-white'}`}>2 Player</button>
                   <button onClick={() => setPlayerCount(4)} className={`px-10 py-3.5 rounded-full font-black text-xs uppercase transition-all ${playerCount === 4 ? 'bg-yellow-500 text-black shadow-[0_5px_15px_rgba(251,191,36,0.4)] scale-105' : 'bg-transparent text-white/20 hover:text-white'}`}>4 Player</button>
                </div>

                <div className="w-32 h-32 bg-gradient-to-tr from-yellow-400 to-amber-300 rounded-[45px] flex items-center justify-center shadow-2xl mb-12 relative z-10 rotate-6 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 bg-yellow-300 rounded-[45px] animate-ping opacity-20"></div>
                  <span className="text-7xl z-10 -rotate-6">🎲</span>
                </div>

                <div className="text-center mb-10 z-10">
                    <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white mb-3 leading-none drop-shadow-lg">PRO ARENA</h2>
                    <div className="flex items-center justify-center gap-3.5 mt-8">
                        {[50, 100, 500, 1000].map(s => (
                          <button 
                            key={s} 
                            onClick={() => { soundManager.play('click'); setSelectedStake(s); }}
                            className={`px-5 py-3 rounded-2xl text-[11px] font-black transition-all border-2 ${selectedStake === s ? 'bg-yellow-500 border-yellow-300 text-black shadow-xl scale-110' : 'bg-black/40 border-white/5 text-white/40 hover:text-white'}`}
                          >৳{s}</button>
                        ))}
                    </div>
                </div>

                <button onClick={() => startFinding(playerCount)} className="w-full bg-gradient-to-b from-yellow-400 to-amber-500 py-8 rounded-[35px] font-black text-3xl text-black shadow-[0_15px_0_#92400e] active:translate-y-2 active:shadow-[0_5px_0_#92400e] uppercase italic tracking-tighter z-10 transition-all">START BATTLE</button>
            </div>
          </div>

          <div className="h-20 bg-[#0f172a] border-t border-white/5 flex items-center justify-around px-8 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
             <div className="flex flex-col items-center gap-1.5 cursor-pointer">
                <span className="text-2xl">🏠</span>
                <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Home</span>
             </div>
             <div className="flex flex-col items-center gap-1.5 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-not-allowed">
                <span className="text-2xl">🏆</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Rank</span>
             </div>
             <div className="flex flex-col items-center gap-1.5 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-not-allowed">
                <span className="text-2xl">🛡️</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Shop</span>
             </div>
          </div>

          <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={(tx) => setPendingTransactions(p => [...p, tx])} />
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="h-full flex flex-col items-center bg-[#050a18] relative overflow-hidden">
          {/* Commentary Bar */}
          <div className="absolute top-20 left-0 right-0 z-[60] px-6 animate-in slide-in-from-top-4">
             <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl flex items-center gap-3">
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-lg animate-pulse">🎙️</div>
                <p className="text-[11px] font-black italic text-sky-400 uppercase leading-tight">{commentary}</p>
             </div>
          </div>

          <div className="w-full p-4 flex justify-between items-center bg-[#0f172a] z-[70] border-b border-white/10 shadow-lg">
             <button onClick={() => confirm("Exit Arena?") && setView('LOBBY')} className="text-red-500 font-black text-[11px] uppercase tracking-widest bg-red-500/10 px-6 py-2.5 rounded-2xl border border-red-500/20 active:scale-95 transition-all">Surrender</button>
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">Prize Pool</span>
                <span className="text-yellow-500 font-black italic text-2xl leading-none tracking-tighter">৳{Math.floor(selectedStake * 1.8)}</span>
             </div>
             <div className="w-20"></div>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center p-6 mt-8">
             <div className="w-full max-w-[420px] relative aspect-square">
                <LudoBoard 
                  players={gameState.players} 
                  currentPlayerColor={gameState.players[gameState.currentPlayerIndex]?.color || PlayerColor.RED} 
                  validTokens={gameState.isDiceRolled && !isRolling ? (gameState.players[gameState.currentPlayerIndex]?.tokens || []).filter(t => {
                    if (t.state === TokenState.WIN) return false;
                    if (t.state === TokenState.HOME) return gameState.diceValue === 6;
                    return t.distanceTraveled + gameState.diceValue! <= 56;
                  }).map(t => t.id) : []} 
                  onTokenClick={(t) => moveToken(t.id)} 
                />

                {gameState.players.map((p, idx) => {
                  const posMap2P: Record<number, 'BL' | 'TR'> = { 0: 'BL', 1: 'TR' };
                  const posMap4P: Record<number, 'BL' | 'TL' | 'TR' | 'BR'> = { 0: 'BL', 1: 'TL', 2: 'TR', 3: 'BR' };
                  const position = playerCount === 2 ? posMap2P[idx] : posMap4P[idx];
                  
                  return (
                    <PlayerProfileOverlay 
                      key={p.id} 
                      player={p} 
                      isActive={gameState.currentPlayerIndex === idx} 
                      position={position || 'TL'} 
                    />
                  );
                })}
             </div>

             <div className="mt-28 flex flex-col items-center gap-8">
                <div onClick={rollDice} className={`w-36 h-36 bg-[#1c212e]/80 backdrop-blur-md rounded-[45px] border-4 flex items-center justify-center cursor-pointer transition-all ${!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex]?.isBot ? 'border-yellow-500 scale-110 shadow-[0_0_50px_rgba(251,191,36,0.5)]' : 'border-white/5 opacity-40 grayscale-[0.5]'}`}>
                   <Dice3D value={gameState.diceValue} isRolling={isRolling} />
                </div>
                {!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex]?.isBot && (
                  <div className="flex flex-col items-center animate-in fade-in">
                    <span className="text-xs font-black text-yellow-500 animate-bounce uppercase tracking-[0.4em] italic mb-3">Roll the Dice!</span>
                    <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden p-0.5">
                       <div className="h-full bg-yellow-500 rounded-full w-full animate-[timer_15s_linear_infinite]"></div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {gameState.winner && (
            <div className="absolute inset-0 z-[200] bg-black/98 flex flex-col items-center justify-center animate-in fade-in backdrop-blur-sm">
               <div className="w-56 h-56 bg-gradient-to-tr from-yellow-400 to-amber-300 rounded-[60px] flex items-center justify-center text-9xl shadow-[0_0_100px_rgba(251,191,36,0.6)] mb-12 animate-bounce rotate-12">🏆</div>
               <h2 className="text-8xl font-black italic text-white mb-2 uppercase tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,1)]">VICTORY!</h2>
               <p className="text-3xl font-black text-yellow-500 mb-16 uppercase tracking-[0.2em]">{gameState.players.find(p => p.color === gameState.winner)?.name || 'Someone'} Won ৳{Math.floor(selectedStake * 1.8)}</p>
               <button onClick={() => setView('LOBBY')} className="bg-yellow-500 text-black px-24 py-7 rounded-[40px] font-black text-4xl active:scale-95 transition-all shadow-2xl border-b-[12px] border-yellow-700 hover:brightness-110">CONTINUE</button>
            </div>
          )}
        </div>
      )}

      {view === 'ADMIN' && (
        <AdminPortal 
          user={user!} 
          allUsers={allUsers} 
          onUpdateUsersDB={(u) => setAllUsers(u)} 
          pendingTransactions={pendingTransactions} 
          liveMatches={[]} 
          onUpdateUser={(u) => setUser(u)} 
          onApproveTransaction={(tx) => {
            const users = [...allUsers];
            const uIdx = users.findIndex(u => u.name === tx.userName);
            if (uIdx !== -1) {
              users[uIdx].balance += tx.amount;
              setAllUsers(users);
              databaseService.updateUser(users[uIdx]);
            }
            setPendingTransactions(p => p.filter(pt => pt.id !== tx.id));
          }}
          onRejectTransaction={(id) => setPendingTransactions(p => p.filter(tx => tx.id !== id))}
          onExit={() => setView('LOBBY')}
        />
      )}

      {/* Version & Admin Access Trigger */}
      {(view === 'LOGIN' || view === 'LOBBY' || view === 'ADMIN_AUTH') && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center py-6 z-[200]">
          <span 
            onClick={() => {
              const next = adminClickCount + 1;
              if (next >= 3) {
                setAdminClickCount(0);
                setView('ADMIN_AUTH');
              } else {
                setAdminClickCount(next);
              }
            }}
            className="text-[10px] font-black uppercase text-white/5 hover:text-white/20 cursor-pointer tracking-[0.5em] select-none px-10 py-4 transition-all"
          >
            VER 1.0.6 PRO
          </span>
        </div>
      )}
    </div>
  );
};

export default App;
