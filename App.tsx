
import React, { useState, useEffect, useCallback } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { getRandomBotIdentity } from './services/botService';

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
       <div className={`relative p-1 rounded-2xl border-2 ${isActive ? 'border-yellow-500 shadow-[0_0_15px_#fbbf24]' : 'border-white/10'}`}>
          <img src={player.avatarUrl} className="w-14 h-14 rounded-xl object-cover bg-slate-800 shadow-lg" />
          {isActive && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0f172a] animate-pulse"></div>}
       </div>
       <div className="mt-1 flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-tighter italic text-white leading-none whitespace-nowrap">{player.name}</span>
          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{player.flag} {player.country}</span>
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
    if (!phone || !password) return setAuthError('তথ্য দিন');
    if (isSignUp && !name) return setAuthError('নাম দিন');

    if (isSignUp) {
      const exists = allUsers.find(u => u.phone === phone);
      if (exists) return setAuthError('ইতিমধ্যে নিবন্ধিত');
      const newUser: UserProfile = {
        name, phone, password, balance: 50,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
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
        setAuthError('ভুল তথ্য');
      }
    }
  };

  const handleAdminAuth = () => {
    if (adminId === 'admin' && adminPass === '123456') {
      setView('ADMIN');
      setAdminId('');
      setAdminPass('');
      setAuthError('');
    } else {
      setAuthError('ভুল এডমিন তথ্য');
    }
  };

  const startFinding = async (count: 2 | 4) => {
    if (!user) return;
    if (user.balance < selectedStake) return alert("আপনার ব্যালেন্স পর্যাপ্ত নয়! দয়া করে ডিপোজিট করুন।");
    
    // Deduct stake immediately
    const updatedUser = { ...user, balance: user.balance - selectedStake };
    setUser(updatedUser);
    await databaseService.updateUser(updatedUser);

    setPlayerCount(count);
    setView('FINDING');
    setFoundPlayers([]);
    soundManager.play('click');

    // Simulate realistic finding players sequence
    const playersToFind = count - 1;
    let found = 0;
    
    const colors = [PlayerColor.YELLOW, PlayerColor.GREEN, PlayerColor.BLUE];
    
    const searchInterval = setInterval(() => {
      if (found < playersToFind) {
        const bot = getRandomBotIdentity();
        const newBot: Player = {
          id: `bot-${found}`,
          name: bot.name,
          country: bot.country,
          flag: bot.flag,
          color: colors[found],
          isBot: true,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bot.name + Math.random()}`,
          tokens: []
        };
        setFoundPlayers(prev => [...prev, newBot]);
        found++;
        soundManager.play('click');
      } else {
        clearInterval(searchInterval);
        setTimeout(() => initGame(count), 1500);
      }
    }, 1500 + Math.random() * 2000);
  };

  const initGame = (count: number) => {
    if (!user) return;
    
    const colors = count === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    const players: Player[] = colors.map((color, i) => {
      if (i === 0) {
        return {
          id: 'user',
          name: user.name,
          country: 'Bangladesh',
          flag: '🇧🇩',
          color, isBot: false,
          avatarUrl: user.avatar,
          tokens: Array(4).fill(null).map((_, ti) => ({
            id: i * 10 + ti, color, state: TokenState.HOME, position: 0, distanceTraveled: 0
          }))
        };
      } else {
        const botIdentity = foundPlayers[i-1] || { name: 'Player', country: 'BD', flag: '🇧🇩', avatarUrl: '' };
        return {
          id: `bot-${i}`,
          name: botIdentity.name,
          country: botIdentity.country,
          flag: botIdentity.flag,
          color, isBot: true,
          avatarUrl: botIdentity.avatarUrl,
          tokens: Array(4).fill(null).map((_, ti) => ({
            id: i * 10 + ti, color, state: TokenState.HOME, position: 0, distanceTraveled: 0
          }))
        };
      }
    });

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false,
      winner: null, log: ['Game Started'], lastAction: 'Roll Dice', consecutiveSixes: 0
    });
    setView('GAME');
    soundManager.play('six');
  };

  const rollDice = () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    setIsRolling(true);
    soundManager.play('dice');
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setGameState(prev => {
        if (!prev) return null;
        const player = prev.players[prev.currentPlayerIndex];
        const canMove = player.tokens.some(t => t.state === TokenState.HOME ? val === 6 : t.distanceTraveled + val <= 56);
        if (!canMove) {
          setTimeout(nextTurn, 1000);
          return { ...prev, diceValue: val, isDiceRolled: true };
        }
        return { ...prev, diceValue: val, isDiceRolled: true };
      });
      setIsRolling(false);
      soundManager.play('dice_stop');
    }, 800);
  };

  const nextTurn = useCallback(() => {
    setGameState(prev => prev ? { ...prev, currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length, diceValue: null, isDiceRolled: false } : null);
  }, []);

  const moveToken = async (tokenId: number) => {
    if (!gameState || !gameState.isDiceRolled || isRolling) return;
    const players = [...gameState.players];
    const player = players[gameState.currentPlayerIndex];
    const tokenIdx = player.tokens.findIndex(t => t.id === tokenId);
    const token = { ...player.tokens[tokenIdx] };
    const val = gameState.diceValue!;

    if (token.state === TokenState.HOME && val === 6) {
      token.state = TokenState.PATH;
      token.distanceTraveled = 0;
    } else if (token.state === TokenState.PATH) {
      token.distanceTraveled += val;
      if (token.distanceTraveled === 56) token.state = TokenState.WIN;
    }
    player.tokens[tokenIdx] = token;
    soundManager.play('move');

    if (player.tokens.every(t => t.state === TokenState.WIN)) {
      setGameState(prev => prev ? { ...prev, players, winner: player.color } : null);
      soundManager.play('win');
      
      // If user wins, add prize
      if (player.id === 'user' && user) {
        const prize = Math.floor(selectedStake * 1.8);
        const updatedUser = { ...user, balance: user.balance + prize };
        setUser(updatedUser);
        await databaseService.updateUser(updatedUser);
      }
      return;
    }

    setGameState(prev => prev ? { ...prev, players, isDiceRolled: false, diceValue: null, currentPlayerIndex: val === 6 ? prev.currentPlayerIndex : (prev.currentPlayerIndex + 1) % prev.players.length } : null);
  };

  useEffect(() => {
    if (gameState && gameState.players[gameState.currentPlayerIndex].isBot && !gameState.winner) {
      const delay = Math.random() * 1000 + 1000;
      setTimeout(() => {
        if (!gameState.isDiceRolled) rollDice();
        else {
          const p = gameState.players[gameState.currentPlayerIndex];
          const valid = p.tokens.filter(t => t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56);
          if (valid.length > 0) moveToken(valid[0].id);
          else nextTurn();
        }
      }, delay);
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled]);

  return (
    <div className="h-screen w-full bg-[#050a18] text-white font-['Fredoka'] dotted-bg overflow-hidden flex flex-col relative">
      {view === 'SPLASH' && (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
          <h1 className="ludo-money-logo text-6xl mb-10">LUDO MONEY</h1>
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-yellow-500 shadow-[0_0_15px_#fbbf24]" style={{width: `${loadingProgress}%`}}></div>
          </div>
        </div>
      )}

      {(view === 'LOGIN' || view === 'ADMIN_AUTH') && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#050a18]">
           <div className="bg-[#1c212e] p-10 py-12 rounded-[50px] w-full max-w-[420px] border border-white/5 flex flex-col items-center shadow-2xl animate-in zoom-in-95">
              <h2 className="ludo-money-logo text-6xl mb-14 uppercase font-black italic tracking-tight scale-110">
                {view === 'ADMIN_AUTH' ? 'ADMIN' : 'LOGIN'}
              </h2>
              {authError && <div className="text-red-500 mb-6 text-[10px] font-black uppercase tracking-widest">{authError}</div>}
              
              <div className="w-full space-y-6 mb-12">
                 {view === 'LOGIN' && isSignUp && (
                   <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-[#2a2f3e] border border-white/5 p-6 rounded-[25px] outline-none text-white font-medium placeholder:text-white/20 focus:border-yellow-500/30 transition-all text-sm" 
                   />
                 )}
                 <input 
                  type="text" 
                  placeholder={view === 'ADMIN_AUTH' ? "Admin ID" : "Mobile Number"} 
                  value={view === 'ADMIN_AUTH' ? adminId : phone} 
                  onChange={e => view === 'ADMIN_AUTH' ? setAdminId(e.target.value) : setPhone(e.target.value)} 
                  className="w-full bg-[#2a2f3e] border border-white/5 p-6 rounded-[25px] outline-none text-white font-medium placeholder:text-white/20 focus:border-yellow-500/30 transition-all text-sm" 
                 />
                 <input 
                  type="password" 
                  placeholder="Password" 
                  value={view === 'ADMIN_AUTH' ? adminPass : password} 
                  onChange={e => view === 'ADMIN_AUTH' ? setAdminPass(e.target.value) : setPassword(e.target.value)} 
                  className="w-full bg-[#2a2f3e] border border-white/5 p-6 rounded-[25px] outline-none text-white font-medium placeholder:text-white/20 focus:border-yellow-500/30 transition-all text-sm" 
                 />
              </div>

              <button 
                onClick={view === 'ADMIN_AUTH' ? handleAdminAuth : handleAuth} 
                className="w-full bg-[#f6b40e] text-black py-6 rounded-[30px] font-black text-xl shadow-[0_10px_0_#b47906] active:translate-y-2 active:shadow-[0_4px_0_#b47906] transition-all uppercase tracking-tight"
              >
                {view === 'ADMIN_AUTH' ? 'SIGN IN' : (isSignUp ? 'REGISTER' : 'ENTER ARENA')}
              </button>

              <button 
                onClick={() => view === 'ADMIN_AUTH' ? setView('LOGIN') : setIsSignUp(!isSignUp)} 
                className="mt-12 text-[10px] uppercase font-black text-white/20 tracking-[0.25em] hover:text-white/40 transition-colors"
              >
                {view === 'ADMIN_AUTH' ? 'Back to Login' : (isSignUp ? 'Back to Login' : 'CREATE ACCOUNT')}
              </button>
           </div>
        </div>
      )}

      {view === 'FINDING' && (
        <div className="h-full flex flex-col items-center justify-center bg-[#020617] p-10 relative">
           <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
           
           <div className="text-center mb-16 z-10">
              <div className="w-20 h-20 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-[0_0_20px_rgba(251,191,36,0.2)]"></div>
              <h2 className="text-4xl font-black italic uppercase text-yellow-500 tracking-tighter">Searching...</h2>
              <p className="text-white/30 text-[10px] font-bold mt-2 uppercase tracking-[0.3em]">Stake: ৳{selectedStake} • {playerCount}P Mode</p>
           </div>
           
           <div className="grid grid-cols-2 gap-12 w-full max-w-sm z-10">
              {/* User Slot */}
              <div className="flex flex-col items-center gap-4">
                 <div className="w-28 h-28 rounded-[35px] border-4 border-yellow-500 p-1 bg-slate-800 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                    <img src={user?.avatar} className="w-full h-full rounded-[25px] object-cover" />
                 </div>
                 <div className="bg-yellow-500 px-3 py-0.5 rounded-full">
                    <span className="font-black text-[9px] text-black uppercase">YOU</span>
                 </div>
                 <span className="font-black text-xs uppercase italic truncate max-w-[100px]">{user?.name}</span>
              </div>

              {/* Bot Slots */}
              {Array.from({ length: playerCount - 1 }).map((_, i) => {
                const found = foundPlayers[i];
                return (
                  <div key={i} className="flex flex-col items-center gap-4 animate-in zoom-in-50">
                     <div className={`w-28 h-28 rounded-[35px] border-4 ${found ? 'border-green-500' : 'border-white/5 border-dashed'} p-1 bg-slate-800 transition-all duration-700 relative overflow-hidden`}>
                        {found ? (
                          <img src={found.avatarUrl} className="w-full h-full rounded-[25px] object-cover animate-in fade-in" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/5 text-5xl">?</div>
                        )}
                        {!found && <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent animate-pulse"></div>}
                     </div>
                     {found && <div className="bg-green-500 px-3 py-0.5 rounded-full"><span className="font-black text-[9px] text-black uppercase">READY</span></div>}
                     <span className={`font-black text-xs uppercase italic truncate max-w-[100px] ${found ? 'text-white' : 'text-white/10'}`}>
                        {found ? found.name : 'Finding...'}
                     </span>
                  </div>
                );
              })}
           </div>

           <button onClick={() => setView('LOBBY')} className="mt-20 z-10 text-white/20 text-[10px] font-black uppercase tracking-widest border border-white/5 px-10 py-4 rounded-full hover:bg-white/5 transition-all">Cancel Match</button>
        </div>
      )}

      {view === 'LOBBY' && user && (
        <div className="h-full flex flex-col bg-[#020617] relative">
          <div className="p-4 flex justify-between items-center z-20">
            <div className="flex items-center gap-3">
              <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-yellow-500 shadow-lg shadow-yellow-500/10" />
              <div className="flex flex-col">
                <span className="font-black uppercase text-sm italic leading-none">{user.name}</span>
                <div className="bg-yellow-500 px-2 py-0.5 rounded mt-1 w-fit">
                  <span className="text-[7px] font-black text-black uppercase tracking-wider">VIP MEMBER</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div onClick={() => setWalletOpen(true)} className="bg-black/60 border border-yellow-500/40 px-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
                <div className="bg-yellow-500 text-black w-4 h-4 rounded-full flex items-center justify-center font-black text-[10px]">৳</div>
                <span className="font-bold text-sm">{user.balance.toLocaleString()}</span>
              </div>
              <button onClick={() => { localStorage.removeItem('LUDO_SESSION'); setView('LOGIN'); }} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">✕</button>
            </div>
          </div>

          <div className="w-full h-8 bg-black/60 border-y border-white/5 overflow-hidden flex items-center">
            <div className="animate-scroll-text gap-20">
               <span className="text-[10px] font-black italic text-yellow-500 uppercase tracking-widest flex items-center gap-2">🔥 RONY KHAN WITHDRAW ৳৫০০০ 🔥</span>
               <span className="text-[10px] font-black italic text-green-500 uppercase tracking-widest flex items-center gap-2">💰 SAJID AHMED WON ৳২০০০ 💰</span>
               <span className="text-[10px] font-black italic text-yellow-500 uppercase tracking-widest flex items-center gap-2">🔥 HAMIM KING WITHDRAW ৳৩০০০ 🔥</span>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar pb-24">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gradient-to-br from-[#6366f1] to-[#4338ca] p-5 rounded-[35px] border border-white/10 flex items-center gap-3 active:scale-95 transition-all shadow-xl">
                  <div className="text-3xl">🎁</div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-white/50">Daily Bonus</span>
                    <span className="text-xs font-black italic text-white uppercase">Claim ৳৫০</span>
                  </div>
               </div>
               <div className="bg-gradient-to-br from-[#f97316] to-[#c2410c] p-5 rounded-[35px] border border-white/10 flex items-center gap-3 active:scale-95 transition-all shadow-xl">
                  <div className="text-3xl">🔥</div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-white/50">Hot Deal</span>
                    <span className="text-xs font-black italic text-white uppercase">2X Tokens</span>
                  </div>
               </div>
            </div>

            <div className="bg-[#2563eb] rounded-[60px] p-8 flex flex-col items-center border-4 border-white/10 relative shadow-2xl min-h-[420px] overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12">🎲</div>
                
                <div className="flex gap-4 mb-8 bg-black/20 p-2 rounded-full border border-white/5 z-10">
                   <button onClick={() => setPlayerCount(2)} className={`px-8 py-3 rounded-full font-black text-xs uppercase transition-all ${playerCount === 2 ? 'bg-yellow-500 text-black shadow-lg' : 'bg-transparent text-white/40'}`}>2 Player</button>
                   <button onClick={() => setPlayerCount(4)} className={`px-8 py-3 rounded-full font-black text-xs uppercase transition-all ${playerCount === 4 ? 'bg-yellow-500 text-black shadow-lg' : 'bg-transparent text-white/40'}`}>4 Player</button>
                </div>

                <div className="w-28 h-28 bg-yellow-400 rounded-[40px] flex items-center justify-center shadow-2xl mb-10 relative z-10 rotate-12">
                  <div className="absolute inset-0 bg-yellow-300 rounded-[40px] animate-ping opacity-20"></div>
                  <span className="text-6xl z-10 -rotate-12">🎮</span>
                </div>

                <div className="text-center mb-10 z-10">
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-2 leading-none">BATTLE ARENA</h2>
                    <div className="flex items-center justify-center gap-3 mt-6">
                        {[50, 100, 500, 1000].map(s => (
                          <button 
                            key={s} 
                            onClick={() => { soundManager.play('click'); setSelectedStake(s); }}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${selectedStake === s ? 'bg-yellow-500 border-yellow-400 text-black shadow-lg' : 'bg-black/20 border-white/5 text-white/40 hover:text-white'}`}
                          >৳{s}</button>
                        ))}
                    </div>
                </div>

                <button onClick={() => startFinding(playerCount)} className="w-full bg-[#f6b40e] py-7 rounded-[30px] font-black text-3xl text-black shadow-[0_12px_0_#b47906] active:translate-y-2 active:shadow-[0_4px_0_#b47906] uppercase italic tracking-tighter z-10">PLAY NOW</button>
            </div>
          </div>

          <div className="h-20 bg-[#0f172a] border-t border-white/5 flex items-center justify-around px-6 shrink-0">
             <div className="flex flex-col items-center gap-1 cursor-pointer">
                <div className="text-xl">🏠</div>
                <span className="text-[8px] font-black uppercase text-yellow-500">Home</span>
             </div>
             <div className="flex flex-col items-center gap-1 opacity-40 grayscale">
                <div className="text-xl">🎒</div>
                <span className="text-[8px] font-black uppercase">Skins</span>
             </div>
             <div className="flex flex-col items-center gap-1 opacity-40 grayscale">
                <div className="text-xl">🏆</div>
                <span className="text-[8px] font-black uppercase">Leader</span>
             </div>
          </div>

          <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={(tx) => setPendingTransactions(p => [...p, tx])} />
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="h-full flex flex-col items-center bg-[#0f172a] relative overflow-hidden">
          <div className="w-full p-4 flex justify-between items-center bg-slate-900 z-10 border-b border-white/5">
             <button onClick={() => confirm("Exit Game?") && setView('LOBBY')} className="text-red-500 font-bold text-[10px] uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">Exit</button>
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">Win Amount</span>
                <span className="text-yellow-500 font-black italic text-xl leading-none">৳{Math.floor(selectedStake * 1.8)}</span>
             </div>
             <div className="w-10"></div>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center p-6">
             <div className="w-full max-w-[420px] relative aspect-square">
                <LudoBoard 
                  players={gameState.players} 
                  currentPlayerColor={gameState.players[gameState.currentPlayerIndex].color} 
                  validTokens={gameState.isDiceRolled && !isRolling ? gameState.players[gameState.currentPlayerIndex].tokens.filter(t => t.state === TokenState.HOME ? gameState.diceValue === 6 : t.distanceTraveled + gameState.diceValue! <= 56).map(t => t.id) : []} 
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

             <div className="mt-32 flex flex-col items-center gap-6">
                <div onClick={rollDice} className={`w-32 h-32 bg-[#1c212e] rounded-[40px] border-4 flex items-center justify-center cursor-pointer transition-all ${!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex].isBot ? 'border-yellow-500 scale-110 shadow-[0_0_40px_rgba(251,191,36,0.4)]' : 'border-white/5 opacity-40'}`}>
                   <Dice3D value={gameState.diceValue} isRolling={isRolling} />
                </div>
                {!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex].isBot && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-yellow-500 animate-bounce uppercase tracking-[0.3em] italic mb-1">Your Turn!</span>
                    <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-yellow-500 animate-[timer_15s_linear_infinite]"></div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {gameState.winner && (
            <div className="absolute inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
               <div className="w-48 h-48 bg-yellow-500 rounded-[50px] flex items-center justify-center text-8xl shadow-[0_0_80px_#fbbf24] mb-12 animate-bounce rotate-6">👑</div>
               <h2 className="text-7xl font-black italic text-white mb-2 uppercase tracking-tighter">VICTORY!</h2>
               <p className="text-2xl font-black text-yellow-500 mb-12 uppercase tracking-widest">{gameState.players.find(p => p.color === gameState.winner)?.name} Won ৳{Math.floor(selectedStake * 1.8)}</p>
               <button onClick={() => setView('LOBBY')} className="bg-[#f6b40e] text-black px-20 py-6 rounded-full font-black text-3xl active:scale-95 transition-all shadow-2xl shadow-yellow-500/20 border-b-8 border-yellow-700">CONTINUE</button>
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

      {/* Persistent Version Label with Triple-Click for Admin Access */}
      {(view === 'LOGIN' || view === 'LOBBY' || view === 'ADMIN_AUTH') && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center py-4 z-[200]">
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
            className="text-[10px] font-black uppercase text-white/10 hover:text-white/30 cursor-pointer tracking-[0.4em] select-none px-8 py-3 transition-all"
          >
            v1.0.4
          </span>
        </div>
      )}
    </div>
  );
};

export default App;
