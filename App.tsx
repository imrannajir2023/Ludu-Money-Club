
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { getRandomBotName } from './services/botService';
import { SAFE_SPOTS } from './constants';

const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/806/806131.png";

const INITIAL_USER: UserProfile = {
  name: "Araf Ahmed",
  balance: 5000,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Araf",
  stats: {
    totalGames: 124,
    wins: 86,
    totalWinnings: 15400
  },
  history: []
};

const STAKE_OPTIONS = [50, 100, 500, 1000, 5000];

const App: React.FC = () => {
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME' | 'ADMIN'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [animating, setAnimating] = useState(false);
  
  const [selectedStake, setSelectedStake] = useState(100);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  // Use a ref to prevent double bot triggers
  const botThinkingRef = useRef(false);

  // Splash Loading
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

  // Bot AI Controller
  useEffect(() => {
    if (view !== 'GAME' || !gameState || gameState.winner || animating || botThinkingRef.current) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    if (!gameState.isDiceRolled) {
      botThinkingRef.current = true;
      const rollDelay = Math.floor(Math.random() * 1000) + 1000;
      setTimeout(() => {
        rollDice();
        botThinkingRef.current = false;
      }, rollDelay);
    } else if (gameState.diceValue) {
      const possibleMoves = currentPlayer.tokens.filter(t => {
        if (t.state === TokenState.WIN) return false;
        if (t.state === TokenState.HOME) return gameState.diceValue === 6;
        if (t.state === TokenState.PATH) return (t.distanceTraveled + gameState.diceValue!) <= 57;
        return false;
      });

      if (possibleMoves.length > 0) {
        botThinkingRef.current = true;
        const moveDelay = Math.floor(Math.random() * 800) + 700;
        setTimeout(() => {
          // Smart AI: 1. Try to kill someone, 2. Try to get out, 3. Move furthest token
          let bestToken = possibleMoves[0];
          
          // Check for capture moves
          const captureMove = possibleMoves.find(t => {
             const nextPos = (t.position + gameState.diceValue!) % 52;
             return !SAFE_SPOTS.includes(nextPos) && gameState.players.some(p => 
               p.color !== currentPlayer.color && p.tokens.some(ot => ot.state === TokenState.PATH && ot.position === nextPos)
             );
          });

          if (captureMove) bestToken = captureMove;
          else {
            bestToken = possibleMoves.reduce((prev, curr) => (curr.distanceTraveled > prev.distanceTraveled) ? curr : prev);
          }

          moveToken(bestToken.id);
          botThinkingRef.current = false;
        }, moveDelay);
      }
    }
  }, [view, gameState?.currentPlayerIndex, gameState?.isDiceRolled, animating]);

  const handleFacebookLogin = () => {
    soundManager.play('click');
    setUser(prev => ({ ...prev, name: "Araf Ahmed" }));
    setView('LOBBY');
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'emukhan580' && adminPassword === 'Imran2015@!@!') {
      soundManager.play('win');
      setIsAdminAuthOpen(false);
      setView('ADMIN');
    } else {
      alert("Invalid Admin Credentials!");
    }
  };

  const handleNewTransaction = (tx: PendingTransaction) => {
    if (tx.type === 'WITHDRAW') {
      setUser(prev => ({ ...prev, balance: prev.balance - tx.amount }));
    }
    setPendingTransactions(prev => [...prev, tx]);
    setUser(prev => ({ ...prev, history: [tx, ...prev.history] }));
  };

  const approveTransaction = (tx: PendingTransaction) => {
    soundManager.play('win');
    if (tx.type === 'DEPOSIT') {
      setUser(prev => ({ 
        ...prev, 
        balance: prev.balance + tx.amount,
        history: prev.history.map(h => h.id === tx.id ? { ...h, status: 'APPROVED' } : h)
      }));
    } else {
      setUser(prev => ({ 
        ...prev, 
        history: prev.history.map(h => h.id === tx.id ? { ...h, status: 'APPROVED' } : h)
      }));
    }
    setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
  };

  const rejectTransaction = (txId: string) => {
    const tx = pendingTransactions.find(t => t.id === txId);
    if (tx && tx.type === 'WITHDRAW') {
      setUser(prev => ({ ...prev, balance: prev.balance + tx.amount }));
    }
    setUser(prev => ({ 
      ...prev, 
      history: prev.history.map(h => h.id === txId ? { ...h, status: 'REJECTED' } : h)
    }));
    setPendingTransactions(prev => prev.filter(t => t.id !== txId));
  };

  const initGame = () => {
    if (user.balance < selectedStake) return alert("Insufficient Balance!");
    setUser(prev => ({ ...prev, balance: prev.balance - selectedStake }));
    const players: Player[] = [];
    let colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE].slice(0, selectedPlayerCount);

    players.push({
      id: 'p1', name: user.name, color: colors[0], isBot: false,
      avatarUrl: user.avatar,
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
      log: ["Game Started"], lastAction: "", consecutiveSixes: 0
    });
    setView('GAME');
  };

  const validTokens = useMemo(() => {
    if (!gameState || !gameState.isDiceRolled || !gameState.diceValue) return [];
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.isBot) return []; 
    const dice = gameState.diceValue;
    return player.tokens
      .filter(t => {
        if (t.state === TokenState.WIN) return false;
        if (t.state === TokenState.HOME) return dice === 6;
        if (t.state === TokenState.PATH) return (t.distanceTraveled + dice) <= 57;
        return true;
      })
      .map(t => t.id);
  }, [gameState]);

  const switchTurn = (bonus: boolean) => {
    setGameState(prev => {
      if (!prev) return null;
      let nextIndex = prev.currentPlayerIndex;
      let nextSixes = bonus && prev.diceValue === 6 ? prev.consecutiveSixes + 1 : 0;
      
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
  };

  const moveToken = (tokenId: number) => {
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
        // Capture Logic
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
        alert(`${player.name} wins the match!`);
        setView('LOBBY');
        return;
      }
      switchTurn(dice === 6 || didCapture || didReachFinish);
    }, 400);
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
  }, [animating, gameState]);

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
           LOGIN WITH FACEBOOK
        </button>
      </div>
      <button onClick={() => setIsAdminAuthOpen(true)} className="mt-8 text-white/20 hover:text-white/60 font-bold uppercase tracking-widest text-[10px] bg-white/5 px-6 py-2 rounded-full border border-white/5">ADMIN ACCESS</button>

      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
           <form onSubmit={handleAdminAuth} className="bg-[#1e293b] w-full max-w-sm rounded-[40px] p-10 border border-white/10 shadow-2xl">
              <h2 className="text-2xl font-black uppercase italic text-yellow-500 mb-8 text-center">Secure Admin</h2>
              <input type="text" placeholder="Admin Username" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold mb-4" />
              <input type="password" placeholder="Password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold mb-8" />
              <button type="submit" className="w-full bg-sky-500 text-white py-5 rounded-3xl font-black uppercase shadow-xl">Authorize</button>
              <button type="button" onClick={() => setIsAdminAuthOpen(false)} className="w-full mt-4 text-white/40 font-bold uppercase text-[10px]">Close</button>
           </form>
        </div>
      )}
    </div>
  );

  if (view === 'ADMIN') return (
    <AdminPortal 
      user={user} 
      pendingTransactions={pendingTransactions} 
      onUpdateUser={(u) => setUser(prev => ({...prev, balance: u.balance}))} 
      onApproveTransaction={approveTransaction}
      onRejectTransaction={rejectTransaction}
      onExit={() => setView('LOBBY')} 
    />
  );

  if (view === 'LOBBY') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col relative text-white select-none overflow-hidden font-fredoka">
      <div className="p-4 flex justify-between items-center z-50 bg-[#0f172a] shadow-lg">
        <div className="flex items-center gap-2">
          <img src={user.avatar} className="w-10 h-10 rounded-xl bg-white border-2 border-yellow-500" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">{user.name}</span>
            <span className="text-[8px] text-green-400 font-bold uppercase tracking-tight">ONLINE</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#1e293b] border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
             <span className="text-yellow-400 font-black text-sm">৳</span>
             <span className="font-bold text-xs">{user.balance.toLocaleString()}</span>
             <button onClick={() => setWalletOpen(true)} className="bg-yellow-500 text-black w-5 h-5 rounded-lg font-black text-xs shadow-md hover:scale-110 transition-all flex items-center justify-center">+</button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 z-10 overflow-y-auto no-scrollbar pb-24">
        <div className="bg-[#2d3da9] rounded-[40px] p-8 shadow-2xl relative overflow-hidden flex flex-col items-start min-h-[200px]" onClick={() => setView('MATCH_CONFIG')}>
            <div className="relative z-10 w-2/3">
              <h2 className="text-4xl font-black italic text-[#ffd900] mb-2 uppercase tracking-tighter leading-tight">PLAY ONLINE</h2>
              <p className="text-white/80 text-[10px] font-bold mb-6 max-w-[150px]">Join live matches and win real cash!</p>
              <button className="bg-white text-[#2d3da9] font-black px-8 py-3 rounded-full uppercase text-xs shadow-lg hover:scale-105 transition-all">FIND TABLE</button>
            </div>
            <div className="absolute right-[-10px] bottom-4 text-[130px] opacity-20 rotate-12 scale-x-[-1]">🎲</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b] py-8 px-4 rounded-[40px] shadow-xl flex flex-col items-center cursor-pointer border border-white/5">
              <div className="text-5xl mb-3">🤖</div>
              <span className="font-black text-xs italic text-[#0ea5e9] uppercase">VS BOT</span>
            </div>
            <div onClick={() => setView('MATCH_CONFIG')} className="bg-[#1e293b] py-8 px-4 rounded-[40px] shadow-xl flex flex-col items-center cursor-pointer border border-white/5">
              <div className="text-5xl mb-3">👬</div>
              <span className="font-black text-xs italic text-[#ffd900] uppercase">FRIENDS</span>
            </div>
        </div>

        <div className="bg-[#1e293b]/50 p-6 rounded-[40px] border border-white/5">
            <h3 className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-4">TOP WINNERS TODAY</h3>
            <div className="space-y-2">
              {[
                { name: "Zubair Al-Mahmud", win: 903 },
                { name: "Tanvir Hossain", win: 658 },
                { name: "Anika Tabassum", win: 1444 }
              ].map((winner, i) => (
                <div key={i} className="flex justify-between items-center bg-[#1e293b] p-3 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#6366f1] flex items-center justify-center text-[10px] font-black">{i+1}</div>
                      <span className="text-xs font-bold text-white/80">{winner.name}</span>
                    </div>
                    <span className="text-[#4ade80] font-black text-xs tracking-tighter">+৳{winner.win}</span>
                </div>
              ))}
            </div>
        </div>
      </div>

      <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={handleNewTransaction} />
    </div>
  );

  if (view === 'MATCH_CONFIG') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-[#1e293b] p-10 rounded-[50px] w-full max-w-sm shadow-2xl">
           <h2 className="text-2xl font-black italic uppercase text-center mb-10 text-yellow-500">Match Settings</h2>
           <div className="mb-10">
             <p className="text-[10px] font-black uppercase text-yellow-500 mb-4">Stake Amount (৳)</p>
             <div className="grid grid-cols-3 gap-3">
                {STAKE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSelectedStake(s)} className={`py-3 rounded-2xl font-black text-xs border-2 transition-all ${selectedStake === s ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-white/5 border-white/5 text-white/40'}`}>{s}</button>
                ))}
             </div>
           </div>
           <button onClick={() => { setView('MATCHING'); setTimeout(initGame, 2000); }} className="w-full bg-green-500 py-6 rounded-3xl font-black text-xl shadow-2xl border-b-8 border-green-700 uppercase italic tracking-widest">Start Battle</button>
           <button onClick={() => setView('LOBBY')} className="w-full mt-6 text-white/30 font-black uppercase text-[10px] tracking-widest">Back</button>
        </div>
    </div>
  );

  if (view === 'MATCHING') return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center justify-center text-white p-10">
      <div className="w-56 h-56 border-[16px] border-yellow-500/10 border-t-yellow-500 rounded-full animate-spin flex items-center justify-center"><span className="text-7xl">🎲</span></div>
      <h2 className="text-3xl font-black mt-16 italic uppercase text-center">Finding Opponents...</h2>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a192f] flex flex-col items-center relative overflow-hidden text-white">
        <div className="w-full h-14 bg-blue-950 flex justify-between items-center px-6 z-10 shadow-2xl">
           <button onClick={() => { setGameState(null); setView('LOBBY'); }} className="bg-red-600 text-white font-black px-6 py-2 rounded-2xl text-[10px] uppercase border-b-4 border-red-800">Quit</button>
           <div className="font-black text-sky-400 italic">Ludo Money Battle</div>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-12 w-full overflow-hidden">
            <div className="w-full max-w-[500px] shadow-2xl rounded-[50px] overflow-hidden border-[16px] border-yellow-500/20 flex-shrink-0">
                <LudoBoard 
                    players={gameState!.players} 
                    currentPlayerColor={gameState!.players[gameState!.currentPlayerIndex].color}
                    validTokens={validTokens} 
                    onTokenClick={(token) => moveToken(token.id)}
                />
            </div>
            
            <div className="flex flex-col items-center gap-6">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/10 text-center w-full min-w-[200px]">
                    <p className="text-[10px] font-black uppercase text-sky-400 mb-1">Current Turn</p>
                    <p className="text-xl font-black italic uppercase text-yellow-500">{gameState!.players[gameState!.currentPlayerIndex].name}</p>
                </div>
                
                <div 
                  onClick={!gameState!.players[gameState!.currentPlayerIndex].isBot ? rollDice : undefined} 
                  className={`w-36 h-36 bg-white rounded-[45px] shadow-2xl flex items-center justify-center text-8xl font-black text-gray-800 border-b-[16px] border-gray-200 transition-all ${animating ? 'animate-spin' : ''} ${gameState?.isDiceRolled || gameState!.players[gameState!.currentPlayerIndex].isBot ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:translate-y-2'}`}
                >
                   {gameState!.diceValue || '🎲'}
                </div>
                
                {gameState?.diceValue && (
                    <div className="bg-yellow-500 text-black px-8 py-3 rounded-full font-black animate-bounce shadow-xl border-b-4 border-yellow-700 uppercase italic">
                        Rolled: {gameState.diceValue}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default App;
