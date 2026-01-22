
import React, { useState, useEffect, useCallback } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { generateGameCommentary } from './services/geminiService';
import { getRandomBotIdentity } from './services/botService';
import { START_POSITIONS, SAFE_SPOTS } from './constants';

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

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'ADMIN_AUTH' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  
  // Auth Form State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Admin Auth State
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [commentary, setCommentary] = useState<string>("Welcome to the Arena! 🔥");
  
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [matchingTimer, setMatchingTimer] = useState(35);
  const [matchedBots, setMatchedBots] = useState<any[]>([]);
  const [matchingStatus, setMatchingStatus] = useState("Searching for players...");
  const [adminClickCount, setAdminClickCount] = useState(0);

  // Load Initial Data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [users, transactions, matches] = await Promise.all([
          databaseService.getUsers(),
          databaseService.getPendingTransactions(),
          databaseService.getLiveMatches()
        ]);
        setAllUsers(users);
        setPendingTransactions(transactions);
        setLiveMatches(matches);
        
        const savedUser = localStorage.getItem('LUDO_SESSION');
        if (savedUser) setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to load database data:", err);
      }
    };
    loadInitialData();
  }, []);

  // Splash Screen Logic
  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => Math.min(prev + 5, 100));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Transition after Splash
  useEffect(() => {
    if (view === 'SPLASH' && loadingProgress >= 100) {
      const timer = setTimeout(() => {
        setView(user ? 'LOBBY' : 'LOGIN');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loadingProgress, view, user]);

  const handleAuth = async () => {
    setAuthError('');
    if (!phone || !password || (isSignUp && !name)) {
      setAuthError('সবগুলো তথ্য দিন');
      return;
    }

    if (isSignUp) {
      const exists = allUsers.find(u => u.phone === phone);
      if (exists) {
        setAuthError('এই নম্বরটি ইতিমধ্যে নিবন্ধিত');
        return;
      }
      const newUser: UserProfile = {
        name, phone, password, balance: 50,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        flag: "🇧🇩", country: "Bangladesh", history: [],
        stats: { totalGames: 0, wins: 0, totalWinnings: 0 }
      };
      await databaseService.updateUser(newUser);
      setUser(newUser);
      setAllUsers(prev => [...prev, newUser]);
      localStorage.setItem('LUDO_SESSION', JSON.stringify(newUser));
      setView('LOBBY');
    } else {
      const found = allUsers.find(u => u.phone === phone && u.password === password);
      if (found) {
        setUser(found);
        localStorage.setItem('LUDO_SESSION', JSON.stringify(found));
        setView('LOBBY');
      } else {
        setAuthError('ভুল মোবাইল নম্বর বা পাসওয়ার্ড');
      }
    }
  };

  const handleAdminLogin = () => {
    setAdminAuthError('');
    if (adminId === 'emukhan580' && adminPass === 'Imran2015@!@!') {
      soundManager.play('win');
      setView('ADMIN');
    } else {
      setAdminAuthError('Invalid Admin ID or Password');
      soundManager.play('click');
    }
  };

  const updateCommentary = async (event: string, playerName: string) => {
    const msg = await generateGameCommentary(event, playerName);
    setCommentary(msg);
  };

  const initGame = (count: number) => {
    if (!user) return;
    const colors = count === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    const players: Player[] = colors.map((color, idx) => {
      const botIdentity = idx === 0 ? null : (matchedBots[idx-1] || getRandomBotIdentity());
      return {
        id: idx === 0 ? 'player-1' : `bot-${idx}`,
        name: idx === 0 ? user.name : botIdentity.name,
        country: idx === 0 ? "Bangladesh" : botIdentity.country,
        flag: idx === 0 ? "🇧🇩" : botIdentity.flag,
        color, isBot: idx !== 0,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${idx === 0 ? 'user' : botIdentity.name}`,
        tokens: Array.from({ length: 4 }).map((_, tIdx) => ({
          id: (idx + 1) * 100 + tIdx,
          color: color, state: TokenState.HOME, position: 0, distanceTraveled: 0
        }))
      };
    });

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false,
      winner: null, log: ['Game started!'], lastAction: 'Waiting for roll', consecutiveSixes: 0
    });
    updateCommentary("New game started!", user.name);
    setView('GAME');
  };

  const rollDice = async () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    setIsRolling(true);
    soundManager.play('dice');
    setTimeout(() => {
        const val = Math.floor(Math.random() * 6) + 1;
        setGameState(prev => {
            if (!prev) return null;
            const currentPlayer = prev.players[prev.currentPlayerIndex];
            const canMove = currentPlayer.tokens.some(token => {
                if (token.state === TokenState.HOME) return val === 6;
                if (token.state === TokenState.PATH) return token.distanceTraveled + val <= 56;
                return false;
            });
            if (!canMove) {
                setTimeout(() => nextTurn(), 1200);
                return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0, lastAction: 'No moves' };
            }
            return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: val === 6 ? prev.consecutiveSixes + 1 : 0, lastAction: 'Move your token' };
        });
        setIsRolling(false);
        soundManager.play('dice_stop');
    }, 800);
  };

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      return { ...prev, currentPlayerIndex: nextIndex, diceValue: null, isDiceRolled: false, lastAction: 'Waiting for roll' };
    });
  }, []);

  const getValidTokens = useCallback(() => {
    if (!gameState || !gameState.isDiceRolled || isRolling || gameState.diceValue === null) return [];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer.tokens.filter(token => {
        const val = gameState.diceValue!;
        if (token.state === TokenState.HOME) return val === 6;
        if (token.state === TokenState.PATH) return token.distanceTraveled + val <= 56;
        return false;
      }).map(t => t.id);
  }, [gameState, isRolling]);

  const moveToken = (tokenId: number) => {
    if (!gameState || !gameState.isDiceRolled || isRolling) return;
    const diceVal = gameState.diceValue || 0;
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const tokenIdx = player.tokens.findIndex(t => t.id === tokenId);
    if (tokenIdx === -1) return;
    
    const token = { ...player.tokens[tokenIdx] };
    let captured = false;
    let reachedWin = false;

    if (token.state === TokenState.HOME && diceVal === 6) {
        token.state = TokenState.PATH;
        token.distanceTraveled = 0;
        soundManager.play('move');
    } else if (token.state === TokenState.PATH) {
        token.distanceTraveled += diceVal;
        if (token.distanceTraveled === 56) {
            token.state = TokenState.WIN;
            reachedWin = true;
            soundManager.play('win');
        } else {
            soundManager.play('move');
            const startOffset = START_POSITIONS[token.color];
            const absolutePos = (token.distanceTraveled + startOffset) % 52;
            if (!SAFE_SPOTS.includes(absolutePos)) {
                players.forEach((otherP, pIdx) => {
                    if (pIdx !== gameState.currentPlayerIndex) {
                        otherP.tokens.forEach(otherT => {
                            if (otherT.state === TokenState.PATH && (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52 === absolutePos) {
                                otherT.state = TokenState.HOME;
                                otherT.distanceTraveled = 0;
                                captured = true;
                            }
                        });
                    }
                });
            }
        }
    }

    if (captured) soundManager.play('kill');
    player.tokens[tokenIdx] = token;

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
        setGameState(prev => prev ? { ...prev, players, winner: player.color } : null);
        return;
    }

    setGameState(prev => {
        if (!prev) return null;
        if (diceVal === 6 || captured || reachedWin) return { ...prev, players, diceValue: null, isDiceRolled: false };
        return { ...prev, players, currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, diceValue: null, isDiceRolled: false };
    });
  };

  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.isBot) {
            const timer = setTimeout(() => {
                if (!gameState.isDiceRolled && !isRolling) rollDice();
                else if (gameState.isDiceRolled) {
                    const validIds = getValidTokens();
                    if (validIds.length > 0) setTimeout(() => moveToken(validIds[Math.floor(Math.random() * validIds.length)]), 1500);
                    else nextTurn();
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled, isRolling]);

  if (view === 'ADMIN') return (
    <AdminPortal 
      user={user!} 
      allUsers={allUsers} 
      onUpdateUsersDB={setAllUsers} 
      pendingTransactions={pendingTransactions} 
      liveMatches={liveMatches} 
      onUpdateUser={setUser} 
      onApproveTransaction={async (tx) => {
        const targetUser = allUsers.find(u => u.name === tx.userName);
        if (targetUser) {
           const updated = { ...targetUser, balance: targetUser.balance + tx.amount };
           await databaseService.updateUser(updated);
           setAllUsers(prev => prev.map(u => u.phone === updated.phone ? updated : u));
           setPendingTransactions(prev => prev.filter(p => p.id !== tx.id));
           alert("Deposit Approved!");
        }
      }} 
      onRejectTransaction={(txId) => {
        setPendingTransactions(prev => prev.filter(p => p.id !== txId));
        alert("Transaction Rejected.");
      }} 
      onExit={() => setView('LOGIN')} 
    />
  );

  return (
    <div className="h-screen w-full bg-[#050a18] overflow-hidden text-white font-['Fredoka'] dotted-bg relative flex flex-col">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center">
          <h1 className="ludo-money-logo text-6xl">LUDO MONEY</h1>
          <div className="w-64 h-2 bg-white/10 rounded-full mt-10 overflow-hidden">
            <div className="h-full bg-yellow-500" style={{width: `${loadingProgress}%`}}></div>
          </div>
        </div>
      )}

      {view === 'LOGIN' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl relative">
           <div className="bg-[#1e2333] p-10 py-12 rounded-[50px] w-full max-sm border border-white/10 flex flex-col items-center shadow-2xl animate-in zoom-in-95">
              <h2 className="ludo-money-logo text-4xl mb-10">{isSignUp ? 'SIGN UP' : 'LOGIN'}</h2>
              {authError && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-xs mb-6 w-full text-center border border-red-500/20">{authError}</div>}
              <div className="w-full space-y-4 mb-10">
                 {isSignUp && <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-yellow-500" />}
                 <input type="tel" placeholder="Mobile Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-yellow-500" />
                 <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-yellow-500" />
              </div>
              <button onClick={handleAuth} className="w-full bg-yellow-500 text-black py-5 rounded-[30px] font-black text-xl shadow-xl active:scale-95">
                {isSignUp ? 'REGISTER' : 'ENTER ARENA'}
              </button>
              <button onClick={() => setIsSignUp(!isSignUp)} className="mt-8 text-[10px] font-black uppercase text-white/30 tracking-widest hover:text-yellow-500">
                {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
              </button>
           </div>

           <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[110]">
              <span 
                onClick={() => { 
                  const count = adminClickCount + 1;
                  setAdminClickCount(count); 
                  if (count >= 3) { 
                    setView('ADMIN_AUTH'); 
                    setAdminClickCount(0); 
                    soundManager.play('click');
                  } 
                }} 
                className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] cursor-pointer hover:text-white/60 transition-colors py-4 px-8"
              >
                v1.0.4
              </span>
           </div>
        </div>
      )}

      {view === 'ADMIN_AUTH' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-2xl z-[200]">
           <div className="bg-slate-900 p-10 py-12 rounded-[60px] w-full max-w-sm border-2 border-sky-500/30 flex flex-col items-center shadow-[0_0_50px_rgba(14,165,233,0.1)] animate-in zoom-in-95">
              <div className="w-20 h-20 bg-sky-500/20 rounded-full flex items-center justify-center border border-sky-500/30 mb-8">
                 <span className="text-4xl">🛡️</span>
              </div>
              <h2 className="text-2xl font-black italic uppercase text-sky-400 text-center mb-8 tracking-tighter">ADMIN ACCESS</h2>
              {adminAuthError && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-[10px] mb-6 w-full text-center border border-red-500/20 uppercase font-black">{adminAuthError}</div>}
              <div className="w-full space-y-4 mb-10">
                 <input type="text" placeholder="Admin User ID" value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-sky-500" />
                 <input type="password" placeholder="Admin Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-white outline-none focus:border-sky-500" />
              </div>
              <button onClick={handleAdminLogin} className="w-full bg-sky-500 text-white py-5 rounded-[30px] font-black text-xl shadow-xl active:scale-95 shadow-sky-500/20">
                LOGIN TO PORTAL
              </button>
              <button onClick={() => setView('LOGIN')} className="mt-8 text-[10px] font-black uppercase text-white/20 tracking-[0.3em] hover:text-white">BACK</button>
           </div>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <>
          <div className="p-4 pt-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-[2px] border-yellow-500 p-0.5 bg-slate-800 shadow-xl overflow-hidden">
                <img src={user.avatar} className="w-full h-full rounded-full" />
              </div>
              <div className="flex flex-col">
                <span className="font-black uppercase text-sm italic tracking-tighter leading-none">{user.name}</span>
                <div className="bg-yellow-500 px-1.5 py-0.5 rounded-md mt-1 border border-yellow-600 w-fit">
                  <span className="text-[7px] font-black text-black uppercase tracking-wider">VIP MEMBER</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div onClick={() => { soundManager.play('click'); setWalletOpen(true); }} className="bg-black/50 border-[1px] border-yellow-500/50 px-3 py-1.5 rounded-2xl flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md">
                <div className="bg-yellow-500 text-black w-5 h-5 rounded-full flex items-center justify-center font-black text-xs">৳</div>
                <span className="font-black text-lg tracking-tighter text-white">{user.balance.toLocaleString()}</span>
              </div>
              <button className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center border border-white/10 text-xl">✕</button>
            </div>
          </div>

          <div className="w-full h-6 bg-black/40 border-y border-white/5 overflow-hidden flex items-center">
            <div className="notice-scroll flex gap-20">
               <span className="text-[10px] font-black italic text-yellow-500 uppercase tracking-widest flex items-center gap-2">🔥 RONY KHAN WITHDRAW ৳৫০০০ 🔥</span>
               <span className="text-[10px] font-black italic text-green-500 uppercase tracking-widest flex items-center gap-2">💰 SAJID AHMED WON ৳২০০০ 💰</span>
            </div>
          </div>

          <div className="flex-1 px-4 py-4 overflow-y-auto no-scrollbar space-y-4">
            <div className="bg-[#2563eb] rounded-[50px] p-8 flex flex-col items-center justify-center border-[4px] border-white/10 relative overflow-hidden shadow-2xl min-h-[350px]">
                <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl mb-6"><span className="text-5xl">🎮</span></div>
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none drop-shadow-xl text-white mb-2">BATTLE ONLINE</h2>
                    <p className="text-blue-200 text-xs font-black uppercase tracking-widest italic opacity-70">Play & Earn Cash</p>
                </div>
                <button onClick={() => { soundManager.play('click'); setView('MATCH_CONFIG'); }} className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 py-6 rounded-[30px] font-black text-2xl text-black shadow-[0_8px_0_#92400e] active:shadow-none active:translate-y-2 transition-all uppercase italic tracking-tighter">JOIN TABLE</button>
            </div>
          </div>

          <WalletModal 
            isOpen={isWalletOpen} 
            onClose={() => setWalletOpen(false)} 
            user={user} 
            onSubmitTransaction={(tx) => {
              setPendingTransactions(prev => [...prev, tx]);
            }} 
          />
        </>
      )}

      {view === 'GAME' && gameState && (
        <div className="h-full flex flex-col items-center relative">
           <div className="w-full p-4 flex justify-between items-center bg-slate-900 border-b border-white/5 shrink-0">
              <button onClick={() => { if(confirm("Exit game?")) setView('LOBBY'); }} className="text-[10px] font-black uppercase bg-red-500/10 text-red-500 px-5 py-2 rounded-xl border border-red-500/20">Exit</button>
              <h2 className="ludo-money-logo text-2xl">LUDO MONEY</h2>
              <div className="bg-yellow-500/10 px-4 py-1.5 rounded-xl text-yellow-500 font-black text-sm italic">৳{selectedStake}</div>
           </div>
           <div className="flex-1 w-full flex flex-col items-center justify-center p-4 gap-4 overflow-hidden relative">
              <div className="w-full max-w-[420px] aspect-square shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-3xl overflow-hidden relative border-8 border-slate-800 bg-white">
                 <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex]?.color || PlayerColor.RED} validTokens={getValidTokens()} onTokenClick={(token) => moveToken(token.id)} />
              </div>
              <div className="w-full max-w-[420px] flex items-center justify-between gap-3 shrink-0">
                 <div onClick={rollDice} className={`w-20 h-20 bg-slate-900/60 rounded-[30px] border-[3px] flex items-center justify-center transition-all cursor-pointer shadow-inner ${!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex].isBot ? 'border-yellow-500 scale-110 shadow-yellow-500/20' : 'border-white/10 opacity-90'}`}><Dice3D value={gameState.diceValue} isRolling={isRolling} /></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
