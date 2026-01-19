
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile } from './types';
import { COLORS, SAFE_SPOTS, START_POSITIONS } from './constants';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import { generateGameCommentary } from './services/geminiService';

const INITIAL_USER: UserProfile = {
  name: "Araf",
  balance: 48723,
  transactions: []
};

const ProfileModal: React.FC<{ user: UserProfile, isOpen: boolean, onClose: () => void }> = ({ user, isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#fff9e6] rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl border-[6px] border-[#fbbf24] animate-in zoom-in duration-200">
        <div className="bg-[#fbbf24] p-4 text-center relative">
          <h2 className="text-2xl font-black text-[#8b4513] uppercase">Player Profile</h2>
          <button onClick={onClose} className="absolute top-3 right-4 text-3xl text-[#8b4513]">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border-2 border-[#fbbf24]/30">
            <div className="relative">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Araf" className="w-20 h-20 rounded-2xl border-4 border-white bg-white shadow-md" alt="Avatar" />
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white font-bold px-2 rounded-lg border-2 border-white">36</div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-gray-800">{user.name}</span>
                <span className="text-xl">🇧🇩</span>
              </div>
              <div className="w-full bg-gray-200 h-4 rounded-full mt-1 overflow-hidden border border-gray-300">
                <div className="bg-yellow-500 h-full w-[40%] xp-bar-gradient"></div>
              </div>
              <span className="text-[10px] font-bold text-gray-500">Level 36</span>
            </div>
          </div>
          <button className="w-full bg-[#8b4513] text-white py-3 rounded-xl font-black shadow-lg uppercase">Achievements</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOBBY' | 'GAME'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [commentary, setCommentary] = useState<string>("Welcome to Ludo Club!");
  const [animating, setAnimating] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [view]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.log]);

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
      return {
        ...prev,
        currentPlayerIndex: nextIndex,
        diceValue: null,
        isDiceRolled: false
      };
    });
  }, []);

  const handleTokenClick = useCallback(async (token: Token) => {
    let captured = false;
    let isSix = false;

    setGameState(prev => {
      if (!prev || !prev.isDiceRolled || prev.diceValue === null) return prev;
      
      const dice = prev.diceValue;
      isSix = dice === 6;
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      const validIds = getValidTokens(currentPlayer, dice);

      if (!validIds.includes(token.id)) return prev;

      let newState = token.state;
      let newDist = token.distanceTraveled;
      let newPos = token.position;

      // Calculate new position
      if (token.state === TokenState.HOME && dice === 6) {
        newState = TokenState.PATH;
        newPos = 0;
        newDist = 0;
      } else {
        newDist += dice;
        newPos = (newPos + dice) % 52;
        if (newDist >= 52) newPos = 100 + (newDist - 52);
        if (newDist === 57) newState = TokenState.WIN;
      }

      // Check for capture (Only if not in home stretch or safe spot)
      let absoluteMovingPos = -1;
      if (newState === TokenState.PATH && newDist < 52) {
        absoluteMovingPos = (newPos + START_POSITIONS[currentPlayer.color]) % 52;
      }

      const isSafeSpot = absoluteMovingPos === -1 || SAFE_SPOTS.includes(absoluteMovingPos);
      let captureLog = "";

      const updatedPlayers = prev.players.map(p => {
        // Handle opponent tokens for capture
        if (p.id !== currentPlayer.id && !isSafeSpot) {
          const tokens = p.tokens.map(t => {
            if (t.state === TokenState.PATH && t.distanceTraveled < 52) {
              const absPos = (t.position + START_POSITIONS[p.color]) % 52;
              if (absPos === absoluteMovingPos) {
                captured = true;
                captureLog = `${currentPlayer.name} ate ${p.name}'s guti! 🔥`;
                return { ...t, state: TokenState.HOME, position: -1, distanceTraveled: 0 };
              }
            }
            return t;
          });
          return { ...p, tokens };
        }
        
        // Handle current player's token movement
        if (p.id === currentPlayer.id) {
          return {
            ...p,
            tokens: p.tokens.map(t => t.id === token.id ? { ...t, state: newState, position: newPos, distanceTraveled: newDist } : t)
          };
        }
        return p;
      });

      const hasWon = updatedPlayers[prev.currentPlayerIndex].tokens.every(t => t.state === TokenState.WIN);
      
      const newLogs = [...prev.log, `${currentPlayer.name} moved guti ${token.id + 1}`];
      if (captureLog) newLogs.push(captureLog);

      setTimeout(() => {
        if (!isSix && !captured) nextTurn();
        else {
            setGameState(s => s ? {...s, isDiceRolled: false, diceValue: null} : null);
            setCommentary(captured ? "Extra turn for killing! 🔥" : "Roll again! 🔥");
        }
      }, 500);

      return {
        ...prev,
        players: updatedPlayers,
        winner: hasWon ? currentPlayer.color : null,
        log: newLogs
      };
    });
    
    if (captured) {
        generateGameCommentary("captured an opponent's token", gameState?.players[gameState.currentPlayerIndex].name || "Player").then(setCommentary);
    } else {
        setCommentary("Nice move! 🎲");
    }
  }, [nextTurn, getValidTokens, gameState]);

  const rollDice = useCallback(() => {
    if (animating || (gameState && gameState.isDiceRolled)) return;
    setAnimating(true);
    
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setAnimating(false);
      
      setGameState(prev => {
        if (!prev) return null;
        const currentPlayer = prev.players[prev.currentPlayerIndex];
        const valid = getValidTokens(currentPlayer, val);
        
        if (valid.length === 0) {
          setTimeout(nextTurn, 1000);
          setCommentary("No moves available! 😴");
        } else {
          setCommentary(`Rolled a ${val}!`);
        }
        
        return {
          ...prev,
          diceValue: val,
          isDiceRolled: true,
          log: [...prev.log, `${currentPlayer.name} rolled ${val}`]
        };
      });
    }, 600);
  }, [animating, gameState, nextTurn, getValidTokens]);

  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner && !animating) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.isBot) {
        if (!gameState.isDiceRolled) {
          const t = setTimeout(rollDice, 1500);
          return () => clearTimeout(t);
        } else {
          const validIds = getValidTokens(currentPlayer, gameState.diceValue || 0);
          if (validIds.length > 0) {
            // Bot AI: Prioritize captures
            let targetToken = null;
            const dice = gameState.diceValue || 0;

            for(const tid of validIds) {
                const t = currentPlayer.tokens.find(tk => tk.id === tid)!;
                if (t.state === TokenState.HOME) { targetToken = t; break; }
                
                // Check if this move kills someone
                const newDist = t.distanceTraveled + dice;
                const newPos = (t.position + dice) % 52;
                if (newDist < 52) {
                    const absNewPos = (newPos + START_POSITIONS[currentPlayer.color]) % 52;
                    if (!SAFE_SPOTS.includes(absNewPos)) {
                        const canKill = gameState.players.some(p => p.id !== currentPlayer.id && p.tokens.some(tk => {
                            if (tk.state === TokenState.PATH && tk.distanceTraveled < 52) {
                                return ((tk.position + START_POSITIONS[p.color]) % 52) === absNewPos;
                            }
                            return false;
                        }));
                        if (canKill) { targetToken = t; break; }
                    }
                }
            }

            if (!targetToken) targetToken = currentPlayer.tokens.find(t => validIds.includes(t.id))!;
            
            const t = setTimeout(() => handleTokenClick(targetToken!), 1000);
            return () => clearTimeout(t);
          }
        }
      }
    }
  }, [gameState, view, animating, rollDice, handleTokenClick, getValidTokens]);

  const startGame = () => {
    const p1: Player = { id: 'p1', name: user.name, color: PlayerColor.RED, isBot: false, avatarUrl: '', tokens: [0,1,2,3].map(id => ({ id, color: PlayerColor.RED, state: TokenState.HOME, position: -1, distanceTraveled: 0 })) };
    const p2: Player = { id: 'bot', name: 'Computer', color: PlayerColor.YELLOW, isBot: true, avatarUrl: '', tokens: [0,1,2,3].map(id => ({ id, color: PlayerColor.YELLOW, state: TokenState.HOME, position: -1, distanceTraveled: 0 })) };
    
    setGameState({ players: [p1, p2], currentPlayerIndex: 0, diceValue: null, isDiceRolled: false, winner: null, log: ["Game started!"], lastAction: "" });
    setView('GAME');
    setCommentary("Start playing! 🎲");
  };

  if (view === 'SPLASH') {
    return (
      <div className="h-screen w-full dotted-bg flex flex-col items-center justify-center relative overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] aspect-square bg-red-500/20 blur-[100px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] aspect-square bg-yellow-500/20 blur-[100px] rounded-full"></div>
         <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
            <div className="w-48 h-48 bg-white rounded-[48px] shadow-2xl flex items-center justify-center border-[10px] border-yellow-500 mb-8 relative">
                <div className="text-8xl animate-bounce">🎲</div>
                <div className="absolute -top-4 -right-4 bg-red-500 text-white font-black px-4 py-1 rounded-full text-xl shadow-lg border-4 border-white">CLUB</div>
            </div>
            <h1 className="text-6xl font-black text-white italic drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] tracking-tighter mb-2 uppercase">Ludo Money</h1>
            <p className="text-yellow-400 font-bold tracking-[0.3em] uppercase mb-12">Premier League</p>
            {loadingProgress < 100 ? (
              <div className="w-64">
                <div className="w-full bg-blue-900/50 h-4 rounded-full border-2 border-white/20 overflow-hidden mb-2 shadow-inner">
                   <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                </div>
                <p className="text-white/50 text-center font-black text-xs uppercase tracking-widest animate-pulse">Loading Assets... {loadingProgress}%</p>
              </div>
            ) : (
              <button onClick={() => setView('LOBBY')} className="group relative px-20 py-6 bg-gradient-to-b from-green-400 to-green-600 rounded-[30px] border-b-[12px] border-green-800 shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:translate-y-2 active:border-b-0 transition-all hover:scale-105">
                <span className="text-white text-4xl font-black italic tracking-widest drop-shadow-lg">START</span>
                <div className="absolute -top-3 -right-3 bg-yellow-400 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center text-xl animate-ping group-hover:animate-none">🔥</div>
              </button>
            )}
         </div>
      </div>
    );
  }

  if (view === 'LOBBY') {
    return (
      <div className="h-screen w-full dotted-bg flex flex-col relative text-white select-none">
        <div className="flex justify-between items-center p-3 bg-blue-950/40 backdrop-blur-sm z-50">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setProfileOpen(true)}>
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Araf" className="w-10 h-10 rounded-lg border-2 border-yellow-400 bg-white" alt="Avatar" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs">Araf</span>
                  <div className="w-16 bg-gray-900/50 h-1.5 rounded-full mt-0.5 overflow-hidden"><div className="bg-yellow-400 h-full w-[40%]"></div></div>
                </div>
            </div>
            <div className="flex gap-2">
                <div className="bg-blue-950/80 rounded-full pl-2 pr-1 py-0.5 border border-yellow-500 flex items-center gap-1.5 min-w-[90px]">
                    <span className="text-yellow-400 text-xs font-black">৳</span>
                    <span className="text-[11px] font-black">{user.balance.toLocaleString()}</span>
                    <button onClick={() => setWalletOpen(true)} className="bg-green-500 w-5 h-5 rounded-md flex items-center justify-center text-xs font-black">+</button>
                </div>
                <button className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg active:scale-90 transition-all text-sm">⚙️</button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar pb-24">
            <div className="relative group cursor-pointer" onClick={startGame}>
              <div className="bg-gradient-to-b from-yellow-300 to-yellow-600 p-1 rounded-3xl shadow-xl border-b-8 border-yellow-800 active:translate-y-2 active:border-b-0 transition-all">
                <div className="bg-yellow-400 border-4 border-dashed border-yellow-700/50 rounded-2xl py-10 flex flex-col items-center justify-center overflow-hidden">
                   <h2 className="text-5xl font-black text-yellow-900 italic tracking-widest drop-shadow-md">PLAY VS AI</h2>
                   <span className="text-yellow-800 font-bold text-xs mt-1 bg-yellow-300/50 px-3 py-0.5 rounded-full">PRACTICE MODE</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="h-40 bg-gradient-to-b from-green-400 to-green-600 rounded-[40px] border-b-8 border-green-800 shadow-xl flex flex-col items-center justify-center p-4 opacity-50 cursor-not-allowed">
                  <div className="text-4xl mb-2">🌍</div>
                  <span className="text-white font-black text-xl italic uppercase tracking-tighter">ONLINE</span>
               </div>
               <div className="h-40 bg-gradient-to-b from-sky-400 to-sky-600 rounded-[40px] border-b-8 border-sky-800 shadow-xl flex flex-col items-center justify-center p-4 opacity-50 cursor-not-allowed">
                  <div className="text-4xl mb-2">👥</div>
                  <span className="text-white font-black text-xl italic uppercase tracking-tighter">FRIENDS</span>
               </div>
            </div>
        </div>
        <div className="absolute bottom-0 w-full h-20 bg-[#152a5c] border-t-4 border-[#25418a] flex items-center justify-around z-50">
            <div className="flex flex-col items-center gap-1 cursor-pointer"><div className="text-2xl">🏪</div><span className="text-[10px] font-black text-blue-200 uppercase tracking-tighter">Store</span></div>
            <div className="flex flex-col items-center gap-1 nav-active relative px-6 py-2"><div className="text-3xl">🏠</div><span className="text-[10px] font-black text-white uppercase tracking-tighter">Home</span></div>
            <div className="flex flex-col items-center gap-1 opacity-60"><div className="text-2xl">🏆</div><span className="text-[10px] font-black text-blue-200 uppercase tracking-tighter">Rank</span></div>
        </div>
        <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onUpdateUser={setUser} />
        <ProfileModal user={user} isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#1e40af] flex flex-col items-center relative overflow-hidden text-white select-none">
        <div className="w-full h-12 bg-blue-950/60 backdrop-blur flex justify-between items-center px-4 z-10 shadow-lg">
           <button onClick={() => setView('LOBBY')} className="bg-red-500 text-white font-black px-4 py-1 rounded-lg border-b-4 border-red-800 active:translate-y-0.5 active:border-b-0 transition-all text-xs uppercase tracking-widest">Exit</button>
           <div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-bold text-white border border-white/20 uppercase tracking-widest max-w-[200px] truncate">{commentary}</div>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 gap-6 w-full overflow-hidden">
            <div className="w-full max-w-[480px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-[40px] overflow-hidden border-[12px] border-yellow-500/50 flex-shrink-0 relative">
                <LudoBoard 
                    players={gameState!.players} 
                    currentPlayerColor={gameState!.players[gameState!.currentPlayerIndex].color}
                    validTokens={getValidTokens(gameState!.players[gameState!.currentPlayerIndex], gameState!.diceValue || 0)} 
                    onTokenClick={handleTokenClick}
                />
            </div>

            <div className="flex flex-col gap-4 w-full max-w-[320px] h-full justify-center pb-6">
                <div className="bg-blue-950/80 border-2 border-white/10 rounded-3xl h-56 overflow-hidden flex flex-col shadow-2xl">
                   <div className="bg-white/10 px-4 py-2 border-b border-white/10 text-[10px] font-black text-sky-300 tracking-[0.2em]">GAME PERFORMANCE LOG</div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar scroll-smooth">
                      {gameState?.log.map((entry, idx) => (
                        <div key={idx} className="bg-white/5 p-3 rounded-xl text-[11px] animate-in slide-in-from-right-2 border border-white/5 flex gap-3">
                          <span className="text-yellow-400 font-black opacity-50">{idx + 1}</span>
                          <span className="font-medium text-blue-100">{entry}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                   </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                   <div 
                      onClick={() => !gameState?.players[gameState.currentPlayerIndex].isBot && rollDice()}
                      className={`group w-32 h-32 bg-white rounded-[40px] border-b-[12px] border-gray-300 shadow-[0_15px_30px_rgba(0,0,0,0.4)] flex items-center justify-center text-7xl font-black text-gray-800 cursor-pointer active:scale-90 active:border-b-0 active:translate-y-3 transition-all ${animating ? 'animate-spin' : ''} ${gameState?.isDiceRolled && !gameState.players[gameState.currentPlayerIndex].isBot ? 'opacity-50 pointer-events-none' : ''}`}
                   >
                      <div className="group-hover:scale-110 transition-transform">{gameState!.diceValue || '🎲'}</div>
                   </div>
                   
                   <div className="relative flex flex-col items-center">
                     <div className={`px-10 py-3 rounded-full font-black uppercase text-sm shadow-2xl border-b-4 border-black/20 tracking-widest transition-colors ${gameState!.players[gameState!.currentPlayerIndex].color === PlayerColor.RED ? 'bg-red-600' : 'bg-yellow-500 text-yellow-950'}`}>
                       {gameState!.players[gameState!.currentPlayerIndex].name}'s Turn
                     </div>
                   </div>
                </div>
            </div>
        </div>
        
        {gameState?.winner && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-700">
             <div className="text-9xl animate-bounce">🏆</div>
             <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-2xl italic tracking-tighter uppercase text-center">
               {gameState.players.find(p => p.color === gameState.winner)?.name} VICTORY!
             </h2>
             <button onClick={() => setView('LOBBY')} className="mt-16 bg-green-500 px-16 py-6 rounded-full font-black text-3xl text-white border-b-[12px] border-green-800 active:border-b-0 active:translate-y-4 transition-all">CONTINUE</button>
          </div>
        )}
    </div>
  );
};

export default App;
