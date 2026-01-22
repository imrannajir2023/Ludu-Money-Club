
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile, PendingTransaction, LiveMatch } from './types';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import AdminPortal from './components/AdminPortal';
import { soundManager } from './services/soundService';
import { databaseService } from './services/database';
import { generateGameCommentary } from './services/geminiService';
import { getRandomBotIdentity } from './services/botService';
import { START_POSITIONS, SAFE_SPOTS } from './constants';

const LOGO_ICON = "https://cdn-icons-png.flaticon.com/512/806/806131.png";

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
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'LOBBY' | 'MATCH_CONFIG' | 'MATCHING' | 'GAME'>('SPLASH');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [user, setUser] = useState<UserProfile>({ 
    name: "HAMIM KING", 
    balance: 6650, 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hamim", 
    flag: "🇧🇩",
    country: "Bangladesh",
    history: [], 
    stats: { totalGames: 0, wins: 0, totalWinnings: 0 } 
  });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [commentary, setCommentary] = useState<string>("Welcome to the Arena! Let the games begin!");
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const [selectedStake, setSelectedStake] = useState(50);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [matchingTimer, setMatchingTimer] = useState(35);
  const [matchedBots, setMatchedBots] = useState<any[]>([]);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);

  const updateCommentary = async (event: string, playerName: string) => {
    setIsAiThinking(true);
    const msg = await generateGameCommentary(event, playerName);
    setCommentary(msg);
    setIsAiThinking(false);
  };

  const unlockAudio = () => {
    soundManager.unlock();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };

  useEffect(() => {
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const initGame = (count: number, isPractice: boolean = false) => {
    const colors = count === 2 
      ? [PlayerColor.RED, PlayerColor.YELLOW] 
      : [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    const players: Player[] = colors.map((color, idx) => {
      const botIdentity = idx === 0 ? null : (matchedBots[idx-1] || getRandomBotIdentity());
      return {
        id: idx === 0 ? 'player-1' : `bot-${idx}`,
        name: idx === 0 ? user.name : botIdentity.name,
        country: idx === 0 ? (user.country || "Bangladesh") : botIdentity.country,
        flag: idx === 0 ? (user.flag || "🇧🇩") : botIdentity.flag,
        color,
        isBot: idx !== 0,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${idx === 0 ? 'user' : (botIdentity.name || 'bot')}`,
        tokens: Array.from({ length: 4 }).map((_, tIdx) => ({
          id: (idx + 1) * 100 + tIdx,
          color: color,
          state: TokenState.HOME,
          position: 0,
          distanceTraveled: 0
        }))
      };
    });

    setGameState({
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      isDiceRolled: false,
      winner: null,
      log: ['Game started!'],
      lastAction: 'Waiting for roll',
      consecutiveSixes: 0
    });
    updateCommentary(isPractice ? "Practice mode started!" : "High stakes match started!", user.name);
    setView('GAME');
  };

  useEffect(() => {
    if (view === 'SPLASH') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setView('LOBBY'), 500);
            return 100;
          }
          return prev + 10;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Matchmaking logic with priority window
  useEffect(() => {
    let timerInterval: any;
    let botInjectionInterval: any;
    let dbSyncInterval: any;

    if (view === 'MATCHING') {
      setMatchedBots([]);
      setMatchingTimer(35); // 20s for real players, 15s buffer for bot filling

      const findAndJoinMatch = async () => {
        const existingMatch = await databaseService.findWaitingMatch(selectedStake, playerCount);
        if (existingMatch) {
            setCurrentMatchId(existingMatch.matchId);
        } else {
            const newId = Math.random().toString(36).substring(7);
            setCurrentMatchId(newId);
            await databaseService.createMatch({
                matchId: newId,
                stake: selectedStake,
                players: [{ name: user.name, avatar: user.avatar, flag: user.flag, color: PlayerColor.RED, isBot: false }],
                status: 'WAITING',
                startTime: new Date().toISOString()
            });
        }
      };

      findAndJoinMatch();

      dbSyncInterval = setInterval(async () => {
         if (currentMatchId) {
             const allMatches = await databaseService.getLiveMatches();
             const myMatch = allMatches.find(m => m.matchId === currentMatchId);
             if (myMatch && myMatch.players.length > matchedBots.length + 1) {
                 const others = myMatch.players.filter(p => p.name !== user.name);
                 setMatchedBots(others);
                 soundManager.play('win');
             }
         }
      }, 2000);

      // Bot fallback logic - Wait 20 seconds before allowing bots to join
      setTimeout(() => {
        if (view === 'MATCHING') {
            botInjectionInterval = setInterval(() => {
                setMatchedBots(prev => {
                    if (prev.length < (playerCount - 1)) {
                        soundManager.play('click');
                        return [...prev, getRandomBotIdentity()];
                    }
                    return prev;
                });
              }, 3000);
        }
      }, 20000); // 20 seconds delay for bots

      timerInterval = setInterval(() => {
        setMatchingTimer(prev => {
          if (prev <= 0) {
            clearInterval(timerInterval);
            clearInterval(botInjectionInterval);
            clearInterval(dbSyncInterval);
            soundManager.play('win');
            initGame(playerCount);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(timerInterval);
      clearInterval(botInjectionInterval);
      clearInterval(dbSyncInterval);
    };
  }, [view, playerCount, selectedStake]);

  const rollDice = async () => {
    if (!gameState || isRolling || gameState.isDiceRolled || gameState.winner) return;
    
    setIsRolling(true);
    soundManager.play('dice');
    
    setTimeout(() => {
        const val = Math.floor(Math.random() * 6) + 1;
        setGameState(prev => {
            if (!prev) return null;
            const currentPlayer = prev.players[prev.currentPlayerIndex];
            const newConsecutiveSixes = val === 6 ? prev.consecutiveSixes + 1 : 0;
            if (newConsecutiveSixes === 3) {
                setTimeout(() => nextTurn(), 1500);
                return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0, lastAction: 'Triple sixes! Skipped.' };
            }
            const canMove = currentPlayer.tokens.some(token => {
                if (token.state === TokenState.HOME) return val === 6;
                if (token.state === TokenState.PATH) return token.distanceTraveled + val <= 56;
                return false;
            });
            if (!canMove) {
                setTimeout(() => nextTurn(), 1200);
                return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: 0, lastAction: 'No moves possible' };
            }
            return { ...prev, diceValue: val, isDiceRolled: true, consecutiveSixes: newConsecutiveSixes, lastAction: 'Select a token to move' };
        });
        setIsRolling(false);
        soundManager.play('dice_stop');
    }, 800);
  };

  const getValidTokens = () => {
    if (!gameState || !gameState.isDiceRolled || gameState.diceValue === null) return [];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer.tokens
      .filter(t => {
        const val = gameState.diceValue || 0;
        if (t.state === TokenState.HOME) return val === 6;
        if (t.state === TokenState.PATH) return t.distanceTraveled + val <= 56;
        return false;
      })
      .map(t => t.id);
  };

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      if (!prev) return null;
      const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      return { ...prev, currentPlayerIndex: nextIndex, diceValue: null, isDiceRolled: false, lastAction: 'Waiting for roll', consecutiveSixes: 0 };
    });
  }, []);

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

    if (token.state === TokenState.HOME) {
        if (diceVal !== 6) return;
        token.state = TokenState.PATH;
        token.distanceTraveled = 0; 
        soundManager.play('move');
    } else if (token.state === TokenState.PATH) {
        if (token.distanceTraveled + diceVal > 56) return;
        token.distanceTraveled += diceVal;
        if (token.distanceTraveled === 56) {
            token.state = TokenState.WIN;
            reachedWin = true;
            soundManager.play('win');
        } else {
            soundManager.play('move');
            if (token.distanceTraveled <= 50) {
              const startOffset = START_POSITIONS[token.color];
              const absolutePos = (token.distanceTraveled + startOffset) % 52;
              const isSafe = SAFE_SPOTS.includes(absolutePos);
              if (!isSafe) {
                players.forEach((otherPlayer, pIdx) => {
                  if (pIdx !== gameState.currentPlayerIndex) {
                    otherPlayer.tokens.forEach(otherToken => {
                      if (otherToken.state === TokenState.PATH && otherToken.distanceTraveled <= 50) {
                        const otherStartOffset = START_POSITIONS[otherToken.color];
                        if ((otherToken.distanceTraveled + otherStartOffset) % 52 === absolutePos) {
                          otherToken.state = TokenState.HOME;
                          otherToken.distanceTraveled = 0;
                          captured = true;
                        }
                      }
                    });
                  }
                });
              }
            }
        }
    }
    if (captured) soundManager.play('kill');
    player.tokens[tokenIdx] = token;
    const allWon = player.tokens.every(t => t.state === TokenState.WIN);
    if (allWon) {
        setGameState(prev => prev ? { ...prev, players, winner: player.color } : null);
        soundManager.play('win');
        return;
    }
    setGameState(prev => {
        if (!prev) return null;
        if (diceVal === 6 || captured || reachedWin) {
            return { ...prev, players, diceValue: null, isDiceRolled: false };
        } else {
            const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
            return { ...prev, players, currentPlayerIndex: nextIndex, diceValue: null, isDiceRolled: false, consecutiveSixes: 0 };
        }
    });
  };

  useEffect(() => {
    if (view === 'GAME' && gameState && !gameState.winner) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.isBot) {
            const timer = setTimeout(() => {
                if (!gameState.isDiceRolled && !isRolling) rollDice();
                else if (gameState.isDiceRolled) {
                    const validTokens = currentPlayer.tokens.filter(t => {
                        const val = gameState.diceValue || 0;
                        if (t.state === TokenState.HOME) return val === 6;
                        if (t.state === TokenState.PATH) return t.distanceTraveled + val <= 56;
                        return false;
                    });
                    if (validTokens.length > 0) setTimeout(() => moveToken(validTokens[Math.floor(Math.random() * validTokens.length)].id), 800);
                    else nextTurn();
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }
  }, [gameState?.currentPlayerIndex, gameState?.isDiceRolled, isRolling]);

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

      {view === 'LOBBY' && (
        <>
          <div className="p-4 pt-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-[2px] border-yellow-500 p-0.5 bg-slate-800 shadow-xl">
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
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-900 h-24 rounded-3xl p-4 flex items-center gap-3 border border-white/10 shadow-lg relative group active:scale-95 transition-all">
                    <div className="text-3xl">🎁</div>
                    <div><p className="text-[8px] font-black uppercase text-purple-200 opacity-60">Daily Bonus</p><p className="text-xs font-black uppercase italic tracking-tight">Claim ৳৫০</p></div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-red-700 h-24 rounded-3xl p-4 flex items-center gap-3 border border-white/10 shadow-lg relative group active:scale-95 transition-all">
                    <div className="text-3xl">🔥</div>
                    <div><p className="text-[8px] font-black uppercase text-orange-200 opacity-60">Hot Deal</p><p className="text-xs font-black uppercase italic tracking-tight">2x Tokens</p></div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e40af] rounded-[40px] p-6 flex flex-col items-center justify-between border-[2px] border-white/10 relative overflow-hidden shadow-2xl min-h-[300px]">
                    <div className="relative z-10 w-24 h-24 bg-yellow-400 rounded-full p-4 shadow-2xl flex items-center justify-center"><span className="text-5xl">🎮</span></div>
                    <div className="text-center relative z-10"><h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none drop-shadow-lg text-white mb-1">BATTLE ONLINE</h2><p className="text-blue-200/50 text-[10px] font-black uppercase tracking-widest italic">Play & Earn Cash</p></div>
                    <button onClick={() => { soundManager.play('click'); setView('MATCH_CONFIG'); }} className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 py-4 rounded-2xl font-black text-lg text-black shadow-[0_8px_0_#92400e] active:shadow-none active:translate-y-2 transition-all uppercase italic tracking-tighter z-10">JOIN TABLE</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div onClick={() => { soundManager.play('click'); initGame(2, true); }} className="bg-[#1e293b]/60 h-24 rounded-3xl p-5 border border-white/5 flex items-center justify-between group active:scale-95 transition-all cursor-pointer backdrop-blur-sm">
                        <div className="flex items-center gap-4"><div className="text-3xl">🤖</div><div><h3 className="text-xl font-black italic uppercase tracking-tighter text-white">PRACTICE</h3><p className="text-[8px] font-black uppercase text-white/20 tracking-widest">Free Mode</p></div></div>
                    </div>
                    <div className="bg-[#1e293b]/60 h-24 rounded-3xl p-5 border border-white/5 flex items-center justify-between group opacity-80 backdrop-blur-sm">
                        <div className="flex items-center gap-4"><div className="text-3xl">👫</div><div><h3 className="text-xl font-black italic uppercase tracking-tighter text-white">PRIVATE</h3><p className="text-[8px] font-black uppercase text-white/20 tracking-widest">With Friends</p></div></div>
                        <span className="bg-yellow-500/10 text-yellow-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-yellow-500/20 italic tracking-widest">SOON</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="h-20 bg-[#0a0f20]/80 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-4 shrink-0 relative z-[100]">
             <div className="flex flex-col items-center gap-1 opacity-40"><span className="text-xl">🛒</span><span className="text-[8px] font-black uppercase">Store</span></div>
             <div className="flex flex-col items-center gap-1 opacity-40"><span className="text-xl">🎒</span><span className="text-[8px] font-black uppercase">Inv</span></div>
             <div className="relative -top-6"><button onClick={() => { soundManager.play('click'); setView('LOBBY'); }} className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl border-t-2 border-white/20 shadow-blue-500/20"><span className="text-3xl">🏠</span></button></div>
             <div className="flex flex-col items-center gap-1 opacity-100 text-yellow-500"><span className="text-xl">👫</span><span className="text-[8px] font-black uppercase">Friends</span></div>
             <div className="flex flex-col items-center gap-1 opacity-40"><span className="text-xl">🏆</span><span className="text-[8px] font-black uppercase">Club</span></div>
          </div>
        </>
      )}

      {view === 'MATCH_CONFIG' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
           <div className="bg-[#1e2333] p-10 py-12 rounded-[60px] w-full max-w-sm border border-white/10 flex flex-col items-center animate-in zoom-in-95 duration-300">
              <h2 className="text-3xl font-black italic uppercase text-yellow-500 text-center mb-10 tracking-tighter">SELECT PLAYER</h2>
              <div className="flex w-full gap-4 mb-10">
                 <button onClick={() => { setPlayerCount(2); soundManager.play('click'); }} className={`flex-1 py-6 rounded-[30px] font-black text-xl border-[3px] transition-all ${playerCount === 2 ? 'bg-[#2563eb] border-white/20 text-white shadow-lg' : 'bg-slate-800/40 border-transparent text-white/30'}`}>2 Players</button>
                 <button onClick={() => { setPlayerCount(4); soundManager.play('click'); }} className={`flex-1 py-6 rounded-[30px] font-black text-xl border-[3px] transition-all ${playerCount === 4 ? 'bg-[#2563eb] border-white/20 text-white shadow-lg' : 'bg-slate-800/40 border-transparent text-white/30'}`}>4 Players</button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-12 w-full px-2">
                 {[50, 100, 500, 1000, 5000].map(s => (
                   <button key={s} onClick={() => { setSelectedStake(s); soundManager.play('click'); }} className={`py-5 rounded-[25px] font-black text-lg transition-all ${selectedStake === s ? 'bg-yellow-500 text-black shadow-xl scale-105' : 'bg-slate-800/40 text-white/40'}`}>{s}</button>
                 ))}
              </div>
              <button onClick={() => setView('MATCHING')} className="w-full bg-gradient-to-b from-[#f97316] to-[#ea580c] py-7 rounded-[40px] font-black text-2xl text-black shadow-xl tracking-tighter uppercase italic">START MATCH</button>
              <button onClick={() => setView('LOBBY')} className="mt-8 text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">BACK</button>
           </div>
        </div>
      )}

      {view === 'MATCHING' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
           <div className="bg-[#1e2333] p-8 py-12 rounded-[60px] w-full max-w-lg border border-white/10 flex flex-col items-center animate-in zoom-in-95 duration-300">
              <h2 className="text-4xl font-black italic uppercase text-yellow-500 text-center mb-2 tracking-tighter">SEARCHING PLAYERS</h2>
              <div className="bg-slate-800/60 px-6 py-1 rounded-full mb-6 border border-yellow-500/20">
                <span className="text-yellow-500 font-black text-sm">{matchingTimer}S</span>
              </div>
              
              <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-10 animate-pulse">
                {matchingTimer > 15 ? "🔍 Priority: Looking for Real Players..." : "🤖 No players found. Filling with Bots..."}
              </div>
              
              <div className={`grid ${playerCount === 4 ? 'grid-cols-2' : 'grid-cols-2'} gap-8 mb-12`}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-full border-4 border-yellow-500 p-1 bg-slate-800 shadow-2xl overflow-hidden animate-pulse">
                    <img src={user.avatar} className="w-full h-full rounded-full" />
                  </div>
                  <span className="font-black text-[10px] uppercase text-white/90 flex items-center gap-1">{user.name} <span>{user.flag}</span></span>
                </div>

                {Array.from({ length: playerCount - 1 }).map((_, i) => {
                   const foundBot = matchedBots[i];
                   return (
                     <div key={i} className="flex flex-col items-center gap-3">
                        {foundBot ? (
                          <div className="w-24 h-24 rounded-full border-4 border-green-500 p-1 bg-slate-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                             <img src={foundBot.isBot === false ? foundBot.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${foundBot.name}`} className="w-full h-full rounded-full" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-full border-4 border-slate-700 bg-slate-800 flex items-center justify-center relative overflow-hidden">
                             <div className="absolute inset-0 border-4 border-transparent border-t-yellow-500/30 rounded-full animate-spin"></div>
                             <span className="text-3xl opacity-10">?</span>
                          </div>
                        )}
                        <span className={`font-black text-[10px] uppercase transition-all ${foundBot ? 'text-white/90' : 'text-white/20'}`}>
                          {foundBot ? `${foundBot.name} ${foundBot.flag}` : 'SEARCHING...'}
                        </span>
                     </div>
                   );
                })}
              </div>

              <button onClick={() => setView('MATCH_CONFIG')} className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em] active:scale-95 transition-all">CANCEL SEARCH</button>
           </div>
        </div>
      )}

      {view === 'GAME' && gameState && (
        <div className="h-full flex flex-col items-center relative">
           <div className="w-full p-4 flex justify-between items-center bg-slate-900 border-b border-white/5 shrink-0">
              <button onClick={() => { if(confirm("Exit game?")) setView('LOBBY'); }} className="text-[10px] font-black uppercase bg-red-500/10 text-red-500 px-5 py-2 rounded-xl border border-red-500/20">Exit</button>
              <h2 className="ludo-money-logo text-2xl">LUDO MONEY</h2>
              <div className="bg-yellow-500/10 px-4 py-1.5 rounded-xl text-yellow-500 font-black text-sm italic">৳{selectedStake}</div>
           </div>

           <div className="flex-1 w-full flex flex-col items-center justify-center p-4 gap-4 overflow-hidden relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-50">
                  <div className="bg-black/60 backdrop-blur-md border border-yellow-500/30 rounded-2xl p-3 flex gap-3 items-center shadow-2xl">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shrink-0">🎙️</div>
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-yellow-100 italic">"{commentary}"</p>
                    </div>
                  </div>
              </div>

              <div className="w-full max-w-[420px] aspect-square shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-3xl overflow-hidden relative border-8 border-slate-800 bg-white">
                 <LudoBoard players={gameState.players} currentPlayerColor={gameState.players[gameState.currentPlayerIndex]?.color || PlayerColor.RED} validTokens={getValidTokens()} onTokenClick={(token) => moveToken(token.id)} />
                 {gameState.winner && (
                    <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-4xl font-black italic uppercase text-yellow-500 mb-2 tracking-tighter">WINNER!</h2>
                        <p className="text-xl font-black text-white mb-8">{gameState.players.find(p => p.color === gameState.winner)?.name} WON!</p>
                        <button onClick={() => setView('LOBBY')} className="bg-yellow-500 text-black px-12 py-4 rounded-3xl font-black uppercase">BACK TO LOBBY</button>
                    </div>
                 )}
              </div>

              <div className="w-full max-w-[420px] flex items-center justify-between gap-3 shrink-0">
                 <div className={`flex-1 p-3 rounded-3xl border transition-all duration-300 flex items-center gap-3 ${gameState.players[gameState.currentPlayerIndex].color === PlayerColor.RED ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800/80 border-white/10'}`}>
                    <img src={gameState.players[gameState.currentPlayerIndex].avatarUrl} className="w-10 h-10 rounded-full border-2 border-yellow-500" />
                    <div className="overflow-hidden"><h3 className="text-sm font-black italic uppercase text-white truncate">{gameState.players[gameState.currentPlayerIndex].name}</h3></div>
                 </div>
                 <div onClick={rollDice} className={`w-20 h-20 bg-slate-900/60 rounded-[30px] border-[3px] flex items-center justify-center transition-all cursor-pointer shadow-inner ${!gameState.isDiceRolled && !gameState.players[gameState.currentPlayerIndex].isBot ? 'border-yellow-500 scale-110 shadow-yellow-500/20' : 'border-white/10 opacity-90'}`}><Dice3D value={gameState.diceValue} isRolling={isRolling} /></div>
                 <div className="flex-1 bg-slate-800/40 p-3 rounded-3xl border border-white/5 flex flex-col items-center justify-center"><p className="text-[10px] font-black text-center text-white italic leading-tight">{gameState.lastAction}</p></div>
              </div>
           </div>
        </div>
      )}

      <WalletModal isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} onSubmitTransaction={() => {}} />
    </div>
  );
};

export default App;
