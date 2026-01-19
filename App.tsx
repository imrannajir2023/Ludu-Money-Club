
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile } from './types';
import { COLORS, SAFE_SPOTS, START_POSITIONS } from './constants';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";

const INITIAL_USER: UserProfile = {
  name: "Guest User",
  balance: 50000,
  transactions: []
};

const STAKE_OPTIONS = [50, 100, 500, 1000, 5000];

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [matchingStatus, setMatchingStatus] = useState<string>("Searching...");
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [commentary, setCommentary] = useState<string>("Welcome back!");
  const [animating, setAnimating] = useState(false);
  const [muted, setMuted] = useState(false);
  
  // Match Config
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
  const [gameMode, setGameMode] = useState<'AI' | 'ONLINE' | 'FRIENDS'>('AI');

  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setView('LOGIN'), 1000);
            return 100;
          }
          return prev + 5;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [view]);

  const handleFacebookLogin = () => {
    soundManager.play('click');
    setUser({ ...INITIAL_USER, name: "Araf Ahmed" });
    setView('LOBBY');
    soundManager.play('win');
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'emukhan580' && adminPassword === 'Imran2015@!@!') {
      soundManager.play('win');
      setIsAdminAuthOpen(false);
      setView('ADMIN');
      setAdminUsername('');
      setAdminPassword('');
    } else {
      alert("Invalid Admin Credentials!");
    }
  };

  const openMatchConfig = (mode: 'AI' | 'ONLINE' | 'FRIENDS') => {
    soundManager.play('click');
    setGameMode(mode);
    setView('MATCH_CONFIG');
  };

  const startMatchmaking = () => {
    if (user.balance < selectedStake) {
      alert("Insufficient Balance! Please deposit more.");
      return;
    }
    soundManager.play('click');
    setView('MATCHING');
    setMatchingStatus(`Joining Table with ৳${selectedStake}...`);
    setTimeout(() => {
      setMatchingStatus(`Matching with ${selectedPlayerCount - 1} skilled players...`);
      setTimeout(() => initGame(), 1500);
    }, 2000);
  };

  const initGame = () => {
    setUser(prev => ({ ...prev, balance: prev.balance - selectedStake }));
    const players: Player[] = [];
    let colors: PlayerColor[] = [PlayerColor.RED, PlayerColor.YELLOW];
    if (selectedPlayerCount === 3) colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW];
    if (selectedPlayerCount === 4) colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];

    players.push({
      id: 'p1', name: user.name, color: colors[0], isBot: false,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
      tokens: [0,1,2,3].map(id => ({ id, color: colors[0], state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
    });

    for (let i = 1; i < selectedPlayerCount; i++) {
      const bName = getRandomBotName();
      players.push({
        id: `p${i+1}`, name: bName, color: colors[i], isBot: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${bName}`,
        tokens: [0,1,2,3].map(id => ({ id, color: colors[i], state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
      });
    }

    setGameState({
      players, currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null,
      log: [`Match Started! Pot: ৳${selectedStake * selectedPlayerCount}`],
      lastAction: "", consecutiveSixes: 0
    });
    setView('GAME');
  };

  const getValidTokens = useCallback((player: Player, dice: number): number[] => {
    if (dice === 0) return [];
    return player.tokens.filter(t => {
      if (t.state === TokenState.WIN) return false;
      if (t.state === TokenState.HOME) return dice === 6;
      return (t.distanceTraveled + dice) <= 57;
    }).map(t => t.id);
  }, []);

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      return { ...prev, currentPlayerIndex: nextIndex, diceValue: null, isDiceRolled: false, consecutiveSixes: 0 };
    });
  }, []);

  const handleTokenClick = useCallback(async (token: Token) => {
    if (animating) return;
    setGameState(prev => {
      if (!prev || !prev.isDiceRolled || prev.diceValue === null) return prev;
      const dice = prev.diceValue;
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      const valid = getValidTokens(currentPlayer, dice);
      if (!valid.includes(token.id)) return prev;

      let newState = token.state, newDist = token.distanceTraveled, newPos = token.position;
      if (token.state === TokenState.HOME && dice === 6) { newState = TokenState.PATH; newPos = 0; newDist = 0; }
      else { newDist += dice; newPos = (newPos + dice) % 52; if (newDist >= 52) newPos = 100 + (newDist - 52); if (newDist === 57) newState = TokenState.WIN; }

      let absPos = -1;
      if (newState === TokenState.PATH && newDist < 52) absPos = (newPos + START_POSITIONS[currentPlayer.color]) % 52;
      const isSafe = absPos === -1 || SAFE_SPOTS.includes(absPos);
      let captured = false;
      const updatedPlayers = prev.players.map(p => {
        if (p.id !== currentPlayer.id && !isSafe) {
          const tokens = p.tokens.map(t => {
            if (t.state === TokenState.PATH && t.distanceTraveled < 52 && (t.position + START_POSITIONS[p.color]) % 52 === absPos) {
              captured = true; return { ...t, state: TokenState.HOME, position: -1, distanceTraveled: 0 };
            } return t;
          });
          return { ...p, tokens };
        }
        if (p.id === currentPlayer.id) return { ...p, tokens: p.tokens.map(t => t.id === token.id ? { ...t, state: newState, position: newPos, distanceTraveled: newDist } : t) };
        return p;
      });

      if (captured) soundManager.play('kill'); else if (newState === TokenState.WIN) soundManager.play('win'); else soundManager.play('move');
      
      const turnShouldContinue = (dice === 6 || captured || newState === TokenState.WIN);

      setTimeout(() => { 
        if (!turnShouldContinue) {
          nextTurn(); 
        } else {
          setGameState(s => s ? {...s, isDiceRolled: false, diceValue: null} : null); 
        }
      }, 500);

      return { ...prev, players: updatedPlayers, winner: updatedPlayers[prev.currentPlayerIndex].tokens.every(t => t.state === TokenState.WIN) ? currentPlayer.color : null };
    });
  }, [nextTurn, getValidTokens, animating]);

  const rollDice = useCallback(() => {
    if (animating || (gameState && gameState.isDiceRolled)) return;
    setAnimating(true); 
    soundManager.play('dice');
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setAnimating(false); 
      soundManager.play('dice_stop');
      setGameState(prev => {
        if (!prev) return null;
        let cSix = val === 6 ? prev.consecutiveSixes + 1 : 0;
        if (cSix === 3) { 
          setTimeout(nextTurn, 1000); 
          return { ...prev, diceValue: 6, isDiceRolled: true, consecutiveSixes: 0 }; 
        }
        const valid = getValidTokens(prev.players[prev.currentPlayerIndex], val);
        if (valid.length === 0) {
          setTimeout(nextTurn, 1000);
        }
        return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: cSix };
      });
    }, 600);
  }, [animating, gameState, nextTurn, getValidTokens]);

  // BOT AUTOMATION EFFECT
  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner && !animating) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.isBot) {
        if (!gameState.isDiceRolled) {
          // Bot rolls dice after a delay
          const timer = setTimeout(rollDice, 1200);
          return () => clearTimeout(timer);
        } else {
          // Bot moves after rolling
          const validIds = getValidTokens(currentPlayer, gameState.diceValue || 0);
          if (validIds.length > 0) {
            // Pick a token (simple priority: move the one furthest along, or home entrance)
            const playableTokens = currentPlayer.tokens.filter(t => validIds.includes(t.id));
            const targetToken = playableTokens.sort((a, b) => b.distanceTraveled - a.distanceTraveled)[0];
            const timer = setTimeout(() => handleTokenClick(targetToken), 800);
            return () => clearTimeout(timer);
          }
        }
      }
    }
  }, [gameState, view, animating, rollDice, handleTokenClick, getValidTokens]);

  const toggleMute = () => { setMuted(soundManager.toggleMute()); setSettingsOpen(false); };
  const logout = () => { setView('LOGIN'); setSettingsOpen(false); };

  if (view === 'SPLASH') return (
    <div className="h-screen w-full dotted-bg flex flex-col items-center justify-center bg-[#0a192f]">
      <img src={LOGO_URL} className="w-48 h-48 animate-bounce-slow" />
      <h1 className="text-4xl font-black text-white italic mt-8 uppercase tracking-tighter">Ludo Money</h1>
      <div className="w-64 bg-white/10 h-2 rounded-full mt-10 overflow-hidden"><div className="bg-yellow-500 h-full transition-all" style={{width:`${loadingProgress}%`}}></div></div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="h-screen w-full bg-[#1877F2] flex flex-col items-center justify-center p-6 relative">
      <div className="bg-white p-10 rounded-[50px] shadow-2xl w-full max-w-sm flex flex-col items-center border-[10px] border-white/50 z-10">
        <img src={LOGO_URL} className="w-32 h-32 mb-8 drop-shadow-xl" />
        <h2 className="text-3xl font-black text-gray-800 mb-10 italic uppercase tracking-tighter">Ludo Money</h2>
        <button onClick={handleFacebookLogin} className="w-full bg-[#1877F2] text-white py-6 rounded-3xl font-black shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
           <span className="bg-white text-[#1877F2] w-8 h-8 rounded-lg flex items-center justify-center font-black">f</span>
           LOGIN WITH FACEBOOK
        </button>
      </div>
      
      <button 
        onClick={() => setIsAdminAuthOpen(true)} 
        className="mt-8 text-white/20 hover:text-white/60 font-bold uppercase tracking-widest text-[10px] bg-white/5 px-6 py-2 rounded-full border border-white/5 transition-all"
      >
        ADMIN ACCESS CONTROL
      </button>

      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in">
           <form onSubmit={handleAdminAuth} className="bg-[#1e293b] w-full max-w-sm rounded-[40px] p-10 border border-white/10 shadow-2xl">
              <h2 className="text-2xl font-black uppercase italic text-yellow-500 mb-8 text-center tracking-tighter">Secure Admin Login</h2>
              <div className="space-y-4 mb-8">
                 <input 
                   type="text" 
                   placeholder="Admin Username" 
                   value={adminUsername}
                   onChange={e => setAdminUsername(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold focus:outline-none focus:border-sky-500" 
                 />
                 <input 
                   type="password" 
                   placeholder="Secret Password" 
                   value={adminPassword}
                   onChange={e => setAdminPassword(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold focus:outline-none focus:border-sky-500" 
                 />
              </div>
              <button type="submit" className="w-full bg-sky-500 text-white py-5 rounded-3xl font-black uppercase italic tracking-widest shadow-xl border-b-8 border-sky-700 active:border-b-0 active:translate-y-1">Authorize Access</button>
              <button type="button" onClick={() => setIsAdminAuthOpen(false)} className="w-full mt-6 text-white/30 font-bold uppercase text-[10px] tracking-widest text-center">Cancel</button>
           </form>
        </div>
      )}
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal user={user} onUpdateUser={setUser} onExit={() => setView('LOBBY')} />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col relative text-white select-none overflow-hidden font-fredoka">
      <div className="p-4 flex justify-between items-center z-50 bg-blue-950/80 backdrop-blur-3xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 bg-white/5 p-2 pr-6 rounded-2xl border border-white/10">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} className="w-12 h-12 rounded-2xl bg-white border-2 border-yellow-500 shadow-xl" />
          <div className="flex flex-col">
            <span className="font-black text-sm italic tracking-tight">{user.name}</span>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               <span className="text-[10px] text-green-400 font-black uppercase tracking-widest">Master</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-blue-900/40 border border-white/10 rounded-2xl px-4 flex items-center gap-3 shadow-inner">
             <span className="text-yellow-400 font-black text-xl">৳</span>
             <span className="font-black text-base">{user.balance.toLocaleString()}</span>
             <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-7 h-7 rounded-lg font-black text-lg ml-1 shadow-md hover:scale-110 transition-all">+</button>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-2xl hover:bg-white/10">⚙️</button>
        </div>
      </div>

      <div className="bg-yellow-500/10 py-2 border-b border-yellow-500/20 overflow-hidden whitespace-nowrap relative">
         <div className="flex animate-marquee gap-10 items-center px-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-yellow-500">
                 <span className="text-white">🏆</span> {getRandomBotName()} just won ৳1,500!
              </div>
            ))}
         </div>
      </div>

      <div className="flex-1 p-6 space-y-8 z-10 overflow-y-auto no-scrollbar pb-32">
         <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 rounded-[50px] p-10 relative overflow-hidden shadow-2xl border-4 border-white/5 group active:scale-95 transition-all" onClick={() => openMatchConfig('ONLINE')}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400/10 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
            <h2 className="text-5xl font-black italic text-yellow-400 mb-2 uppercase tracking-tighter drop-shadow-lg">Play Online</h2>
            <p className="text-white/60 text-sm font-bold mb-10 max-w-[200px] leading-snug">Battle against real players and win big cash prizes!</p>
            <button className="bg-white text-indigo-900 font-black px-12 py-5 rounded-[22px] shadow-2xl uppercase italic tracking-widest border-b-8 border-indigo-950">Find Table</button>
            <div className="absolute right-10 bottom-4 text-8xl opacity-10 group-hover:scale-125 transition-transform pointer-events-none">🎲</div>
         </div>

         <div className="grid grid-cols-2 gap-8">
            <div onClick={() => openMatchConfig('AI')} className="bg-[#1e293b]/80 backdrop-blur-xl p-10 rounded-[50px] border-4 border-white/5 shadow-2xl flex flex-col items-center hover:bg-white/10 transition-all cursor-pointer active:scale-90">
               <div className="text-7xl mb-6 drop-shadow-2xl">🤖</div>
               <span className="font-black text-xl italic text-sky-400 uppercase tracking-tighter">vs Bot</span>
            </div>
            <div onClick={() => openMatchConfig('FRIENDS')} className="bg-[#1e293b]/80 backdrop-blur-xl p-10 rounded-[50px] border-4 border-white/5 shadow-2xl flex flex-col items-center hover:bg-white/10 transition-all cursor-pointer active:scale-90">
               <div className="text-7xl mb-6 drop-shadow-2xl">👬</div>
               <span className="font-black text-xl italic text-yellow-500 uppercase tracking-tighter">Private</span>
            </div>
         </div>

         <div className="bg-white/5 p-8 rounded-[40px] border-2 border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
               <h3 className="text-sm font-black text-sky-400 uppercase tracking-[0.2em]">Top Players</h3>
               <span className="text-[10px] text-white/30 font-bold uppercase">Weekly</span>
            </div>
            <div className="space-y-5">
               {[1, 2, 3].map(i => (
                 <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${i === 1 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/40'}`}>{i}</div>
                       <span className="font-black text-sm">{getRandomBotName()}</span>
                    </div>
                    <span className="text-sm font-black text-yellow-500">৳ {Math.floor(Math.random()*20000).toLocaleString()}</span>
                 </div>
               ))}
            </div>
         </div>
      </div>

      <div className="absolute bottom-0 w-full h-24 bg-blue-950/90 backdrop-blur-3xl border-t border-white/10 flex items-center justify-around z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-all cursor-pointer">
            <span className="text-3xl">🏪</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Store</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-yellow-500 scale-125 bg-blue-900/60 p-4 rounded-full -translate-y-6 shadow-2xl border-2 border-yellow-500/20">
            <span className="text-3xl">🏠</span>
          </div>
          <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-all cursor-pointer">
            <span className="text-3xl">🏆</span>
            <span className="text-[9px] font-black uppercase tracking-widest">League</span>
          </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in">
           <div className="bg-[#1e293b] w-full max-w-xs rounded-[40px] p-8 border border-white/10 shadow-2xl text-center">
              <h2 className="text-xl font-black uppercase italic text-yellow-500 mb-8">Settings</h2>
              <button onClick={toggleMute} className="w-full py-4 mb-4 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                 {muted ? '🔇 Sound: OFF' : '🔊 Sound: ON'}
              </button>
              <button onClick={() => setView('ADMIN')} className="w-full py-4 mb-4 bg-sky-600/20 text-sky-400 rounded-2xl font-black uppercase tracking-widest text-sm border border-sky-500/20">Admin Portal</button>
              <button onClick={logout} className="w-full py-4 bg-red-600/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-sm border border-red-500/20 mb-8">Logout</button>
              <button onClick={() => setSettingsOpen(false)} className="text-white/40 font-black text-xs uppercase tracking-widest">Close</button>
           </div>
        </div>
      )}

      <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onUpdateUser={setUser} />
      <style>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 15s linear infinite; }
      `}</style>
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-6 text-white overflow-y-auto no-scrollbar">
        <div className="bg-[#1e293b] p-10 rounded-[50px] border-4 border-white/5 w-full max-w-sm shadow-2xl">
           <h2 className="text-2xl font-black italic uppercase text-center mb-10 text-yellow-500 tracking-tighter">Match Settings</h2>
           <div className="mb-8">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-400 mb-4">Players</p>
             <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4].map(c => (
                  <button key={c} onClick={() => setSelectedPlayerCount(c)} className={`py-4 rounded-2xl font-black border-2 transition-all ${selectedPlayerCount === c ? 'bg-sky-500 border-sky-400 text-white shadow-lg' : 'bg-white/5 border-white/5 text-white/40'}`}>{c}P</button>
                ))}
             </div>
           </div>
           <div className="mb-10">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 mb-4">Stake (৳)</p>
             <div className="grid grid-cols-3 gap-3">
                {STAKE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`py-3 rounded-2xl font-black text-xs border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-400 text-black shadow-lg' : 'bg-white/5 border-white/5 text-white/40'}`}>{s}</button>
                ))}
             </div>
           </div>
           <button onClick={startMatchmaking} className="w-full bg-green-500 py-6 rounded-3xl font-black text-xl shadow-2xl border-b-8 border-green-700 active:translate-y-2 active:border-b-0 uppercase italic tracking-widest">Start Battle</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-6 text-white/30 font-black uppercase text-[10px] tracking-widest">Back to Lobby</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center text-white p-10">
      <div className="w-56 h-56 border-[16px] border-yellow-500/10 border-t-yellow-500 rounded-full animate-spin flex items-center justify-center shadow-[0_0_100px_rgba(234,179,8,0.2)]">
          <span className="text-7xl animate-pulse">🎲</span>
      </div>
      <h2 className="text-3xl font-black mt-16 italic uppercase text-center tracking-tighter drop-shadow-2xl">{matchingStatus}</h2>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center relative overflow-hidden text-white select-none">
        <div className="w-full h-14 bg-blue-950/90 flex justify-between items-center px-6 z-10 border-b border-white/5 shadow-2xl backdrop-blur-3xl">
           <button onClick={() => setView('LOBBY')} className="bg-red-600 text-white font-black px-6 py-2 rounded-2xl text-[10px] uppercase shadow-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1">Quit Match</button>
           <div className="bg-white/5 px-8 py-2 rounded-full text-[11px] font-black text-sky-400 uppercase italic truncate max-w-[200px] border border-white/5">{commentary}</div>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-12 w-full overflow-hidden">
            <div className="w-full max-w-[500px] shadow-[0_50px_100px_rgba(0,0,0,0.6)] rounded-[50px] overflow-hidden border-[16px] border-yellow-500/20 flex-shrink-0 relative">
                <LudoBoard 
                    players={gameState!.players} 
                    currentPlayerColor={gameState!.players[gameState!.currentPlayerIndex].color}
                    validTokens={getValidTokens(gameState!.players[gameState!.currentPlayerIndex], gameState!.diceValue || 0)} 
                    onTokenClick={handleTokenClick}
                />
            </div>

            <div className="flex flex-col items-center gap-12">
                <div onClick={() => !gameState?.players[gameState.currentPlayerIndex].isBot && rollDice()}
                  className={`w-36 h-36 bg-white rounded-[45px] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex items-center justify-center text-8xl font-black text-gray-800 active:scale-90 border-b-[16px] border-gray-200 active:border-b-0 active:translate-y-4 ${animating ? 'animate-spin' : ''} cursor-pointer group`}>
                  <span className="group-hover:scale-110 transition-transform">{gameState!.diceValue || '🎲'}</span>
                </div>
                <div className={`px-16 py-5 rounded-[30px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.4)] border-b-8 border-black/30 italic text-xl transition-all ${
                  COLORS[gameState!.players[gameState!.currentPlayerIndex].color].base
                } ${gameState!.players[gameState!.currentPlayerIndex].color === PlayerColor.YELLOW ? 'text-black' : 'text-white'}`}>
                  {gameState!.players[gameState!.currentPlayerIndex].name}
                </div>
            </div>
        </div>

        {gameState?.winner && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/98 backdrop-blur-[40px] animate-in fade-in">
             <div className="text-[180px] animate-bounce z-10 drop-shadow-[0_0_80px_rgba(234,179,8,0.5)]">🏆</div>
             <h2 className="text-7xl font-black text-yellow-500 italic uppercase mb-4 drop-shadow-2xl">Champion!</h2>
             <p className="text-3xl font-black text-white mb-20 uppercase tracking-widest opacity-80">You Won ৳{(selectedStake * selectedPlayerCount).toLocaleString()}!</p>
             <button onClick={() => { setUser(prev => ({...prev, balance: prev.balance + (selectedStake * selectedPlayerCount)})); setView('LOBBY'); }} className="bg-green-500 px-24 py-8 rounded-[35px] font-black text-4xl text-white shadow-2xl border-b-[14px] border-green-800 active:border-b-0 active:translate-y-4 hover:scale-105 transition-all italic uppercase tracking-widest">Collect Prize</button>
          </div>
        )}
    </div>
  );
};

export default App;
