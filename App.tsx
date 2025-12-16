import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerColor, Token, TokenState, GameState, UserProfile } from './types';
import { COLORS, SAFE_SPOTS, START_POSITIONS, HOME_ENTRANCE } from './constants';
import LudoBoard from './components/LudoBoard';
import WalletModal from './components/WalletModal';
import { generateGameCommentary } from './services/geminiService';

// Default User
const INITIAL_USER: UserProfile = {
  name: "Player 1",
  balance: 500.00, // Starting bonus
  transactions: []
};

// Initial Game State
const createInitialState = (players: Player[]): GameState => ({
  players,
  currentPlayerIndex: 0,
  diceValue: null,
  isDiceRolled: false,
  winner: null,
  log: ["Game Started! Good Luck."],
  lastAction: ""
});

const App: React.FC = () => {
  const [view, setView] = useState<'LOBBY' | 'GAME'>('LOBBY');
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [entryFee, setEntryFee] = useState(50);
  const [commentary, setCommentary] = useState<string>("");
  const [animating, setAnimating] = useState(false);

  // Audio refs (placeholders)
  const rollSound = useRef<HTMLAudioElement | null>(null);

  // --- GAME LOGIC ---

  const startGame = () => {
    if (user.balance < entryFee) {
      setWalletOpen(true);
      return;
    }

    // Deduct Fee
    const updatedUser = { ...user, balance: user.balance - entryFee };
    updatedUser.transactions.unshift({
        id: Date.now().toString(),
        type: 'GAME_FEE',
        amount: entryFee,
        date: new Date().toISOString(),
        status: 'COMPLETED'
    });
    setUser(updatedUser);

    // Create Players (1 Human, 3 Bots for simplicity or 1v1)
    // Let's do 1v1 vs Bot for speed
    const human: Player = {
      id: 'p1', name: user.name, color: PlayerColor.RED, isBot: false, avatarUrl: 'https://picsum.photos/50',
      tokens: [0,1,2,3].map(id => ({ id, color: PlayerColor.RED, state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
    };
    const bot: Player = {
      id: 'bot', name: 'Ludo Master Bot', color: PlayerColor.YELLOW, isBot: true, avatarUrl: 'https://picsum.photos/51',
      tokens: [0,1,2,3].map(id => ({ id, color: PlayerColor.YELLOW, state: TokenState.HOME, position: -1, distanceTraveled: 0 }))
    };

    setGameState(createInitialState([human, bot]));
    setView('GAME');
    setCommentary("Match Started! 🔴 vs 🟡");
  };

  const rollDice = () => {
    if (!gameState || gameState.isDiceRolled || animating || gameState.winner) return;

    const newVal = Math.floor(Math.random() * 6) + 1;
    setAnimating(true);
    
    // Simulate dice animation time
    setTimeout(() => {
        setAnimating(false);
        setGameState(prev => {
            if(!prev) return null;
            return { ...prev, diceValue: newVal, isDiceRolled: true };
        });
        
        // Check moves immediately after state update
        // We need to use a useEffect or a timeout to handle auto-pass
    }, 600);
  };

  // Bot Logic Effect
  useEffect(() => {
    if (!gameState || gameState.winner) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isBot && !gameState.isDiceRolled && !animating) {
        setTimeout(() => rollDice(), 1000);
    } else if (currentPlayer.isBot && gameState.isDiceRolled && !animating) {
        // Bot Move Logic
        setTimeout(() => {
             const validMoves = currentPlayer.tokens.filter(t => canMove(t, gameState.diceValue!, currentPlayer));
             if (validMoves.length > 0) {
                 // Simple AI: Prioritize cutting > winning > getting out > moving furthest
                 const bestMove = validMoves[0]; // Just take first for now
                 handleMove(bestMove);
             } else {
                 nextTurn();
             }
        }, 1000);
    } else if (!currentPlayer.isBot && gameState.isDiceRolled && !animating) {
         // Human check for no moves
         const validMoves = currentPlayer.tokens.filter(t => canMove(t, gameState.diceValue!, currentPlayer));
         if (validMoves.length === 0) {
             setTimeout(nextTurn, 1000);
         }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, animating]);


  const canMove = (token: Token, dice: number, player: Player): boolean => {
      if (token.state === TokenState.HOME) return dice === 6;
      if (token.state === TokenState.WIN) return false;
      
      // Check if move exceeds home path
      const newDist = token.distanceTraveled + dice;
      return newDist <= 56; // 50 main path steps + 6 home steps
  };

  const handleMove = async (token: Token) => {
    if (!gameState || !gameState.diceValue) return;

    const dice = gameState.diceValue;
    const player = gameState.players.find(p => p.color === token.color)!;
    
    // Update Token
    let newState = token.state;
    let newPos = token.position;
    let newDist = token.distanceTraveled + dice;

    if (token.state === TokenState.HOME) {
        newState = TokenState.PATH;
        newDist = 0; // Reset distance count when entering path
        newPos = 0; // Relative to start 0-51 loop logic needs careful handling
        // We track position as 0-51 relative to start for path logic? 
        // Simpler: Track 0-51 for main path.
        newPos = 0; // Relative index 0 is Start
    } else {
        newPos = token.position + dice;
        // Check entry to home stretch
        if (newDist > 50) { 
            // Enter home stretch (represented as 100+)
            const homeSteps = newDist - 51; // 0 to 5
            newPos = 100 + homeSteps;
            if (homeSteps === 5) {
                newState = TokenState.WIN;
                // Trigger AI Commentary for Win
                const comment = await generateGameCommentary("reached the goal!", player.name);
                setCommentary(comment);
            }
        }
    }

    // Check collisions (Cutting)
    let opponentReset = false;
    let opponentName = "";
    
    // Convert relative pos to absolute for collision check
    const getAbsolutePos = (p: Player, pos: number) => {
        if (pos >= 100) return -1; // Home stretch is safe
        return (START_POSITIONS[p.color] + pos) % 52;
    };

    const myAbsPos = getAbsolutePos(player, newPos);
    
    // Clone players to mutate
    const newPlayers = gameState.players.map(p => ({...p, tokens: [...p.tokens]}));
    const currentPlayerRef = newPlayers.find(p => p.color === player.color)!;
    const tokenRef = currentPlayerRef.tokens.find(t => t.id === token.id)!;
    
    tokenRef.state = newState;
    tokenRef.position = newPos;
    tokenRef.distanceTraveled = newDist;

    // Check Cuts
    if (newState === TokenState.PATH && !SAFE_SPOTS.includes(myAbsPos)) {
        newPlayers.forEach(p => {
            if (p.color !== player.color) {
                p.tokens.forEach(t => {
                    if (t.state === TokenState.PATH && getAbsolutePos(p, t.position) === myAbsPos) {
                        // CUT!
                        t.state = TokenState.HOME;
                        t.position = -1;
                        t.distanceTraveled = 0;
                        opponentReset = true;
                        opponentName = p.name;
                    }
                });
            }
        });
    }

    if (opponentReset) {
        const comment = await generateGameCommentary(`killed ${opponentName}'s token!`, player.name);
        setCommentary(comment);
    }

    // Update Game State
    let winner: PlayerColor | null = null;
    if (currentPlayerRef.tokens.every(t => t.state === TokenState.WIN)) {
        winner = player.color;
        // Payout
        if (!player.isBot) {
            const winAmount = entryFee * 1.8;
            setUser(prev => ({
                ...prev,
                balance: prev.balance + winAmount,
                transactions: [{
                    id: Date.now().toString(), type: 'GAME_WIN', amount: winAmount, date: new Date().toISOString(), status: 'COMPLETED'
                }, ...prev.transactions]
            }));
        }
    }

    setGameState({
        ...gameState,
        players: newPlayers,
        winner,
        isDiceRolled: false,
        diceValue: null
    });

    // Determine next turn
    if (dice !== 6 && !winner && !opponentReset) {
        nextTurn();
    }
  };

  const nextTurn = () => {
      setGameState(prev => {
          if (!prev) return null;
          const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
          return {
              ...prev,
              currentPlayerIndex: nextIndex,
              isDiceRolled: false,
              diceValue: null
          };
      });
  };

  // --- UI RENDER ---

  if (view === 'LOBBY') {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-yellow-400">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-center relative">
             <h1 className="text-4xl font-black text-yellow-300 drop-shadow-md tracking-wider">LUDO MONEY</h1>
             <div className="absolute top-4 right-4 bg-black/30 px-3 py-1 rounded-full flex items-center gap-2 cursor-pointer" onClick={() => setWalletOpen(true)}>
                 <span className="text-yellow-400 text-lg">৳</span>
                 <span className="font-bold text-white">{user.balance.toFixed(2)}</span>
                 <span className="bg-green-500 text-xs px-1 rounded text-white">+</span>
             </div>
          </div>

          <div className="p-6 space-y-6">
             {/* Mode Selection */}
             <div className="grid grid-cols-2 gap-4">
                 <button className="bg-blue-100 hover:bg-blue-200 border-2 border-blue-400 p-4 rounded-2xl flex flex-col items-center transition-all">
                     <span className="text-4xl">🤖</span>
                     <span className="font-bold text-blue-800">Vs Computer</span>
                 </button>
                 <button className="bg-gray-100 border-2 border-gray-300 p-4 rounded-2xl flex flex-col items-center opacity-50 cursor-not-allowed">
                     <span className="text-4xl">🌍</span>
                     <span className="font-bold text-gray-500">Online (Soon)</span>
                 </button>
             </div>

             {/* Entry Fee Slider */}
             <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200">
                 <div className="flex justify-between mb-2">
                     <span className="font-bold text-gray-700">Entry Fee:</span>
                     <span className="font-bold text-green-600">৳{entryFee}</span>
                 </div>
                 <input 
                    type="range" 
                    min="10" 
                    max="500" 
                    step="10" 
                    value={entryFee} 
                    onChange={(e) => setEntryFee(Number(e.target.value))}
                    className="w-full accent-green-500 h-3 rounded-full cursor-pointer"
                 />
                 <div className="flex justify-between mt-2 text-sm text-gray-500 font-semibold">
                     <span>Prize: ৳{(entryFee * 1.8).toFixed(0)}</span>
                     <span>2 Players</span>
                 </div>
             </div>

             {/* Play Button */}
             <button 
                onClick={startGame}
                className="w-full bg-gradient-to-b from-green-400 to-green-600 text-white text-2xl font-black py-4 rounded-2xl shadow-[0_6px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all"
             >
                 PLAY NOW
             </button>
          </div>
        </div>
        
        <WalletModal 
            isOpen={isWalletOpen} 
            onClose={() => setWalletOpen(false)} 
            user={user} 
            onUpdateUser={setUser} 
        />
      </div>
    );
  }

  // GAME VIEW
  if (!gameState) return null;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = !currentPlayer.isBot;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start py-4">
      {/* Game Header */}
      <div className="w-full max-w-lg px-4 flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-xl border border-gray-700">
              <img src={gameState.players[0].avatarUrl} className="w-10 h-10 rounded-full border-2 border-red-500" />
              <div>
                  <div className="text-white font-bold text-sm leading-tight">{gameState.players[0].name}</div>
                  <div className="text-xs text-green-400">৳{(entryFee * 1.8).toFixed(0)} Pool</div>
              </div>
          </div>
          <div className="bg-gray-800 p-2 rounded-full cursor-pointer hover:bg-gray-700" onClick={() => setView('LOBBY')}>
              🛑
          </div>
          <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-xl border border-gray-700">
              <div className="text-right">
                  <div className="text-white font-bold text-sm leading-tight">{gameState.players[1].name}</div>
                  <div className="text-xs text-gray-400">Computer</div>
              </div>
              <img src={gameState.players[1].avatarUrl} className="w-10 h-10 rounded-full border-2 border-yellow-500" />
          </div>
      </div>

      {/* Commentary Bubble (Gemini) */}
      {commentary && (
        <div className="mb-4 px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full text-white font-bold text-sm shadow-lg animate-pulse text-center max-w-xs mx-auto">
           🎤 {commentary}
        </div>
      )}

      {/* The Board */}
      <LudoBoard 
        players={gameState.players} 
        currentPlayerColor={currentPlayer.color}
        validTokens={isMyTurn && gameState.isDiceRolled && gameState.diceValue ? currentPlayer.tokens.filter(t => canMove(t, gameState.diceValue!, currentPlayer)).map(t => t.id) : []}
        onTokenClick={(t) => handleMove(t)}
      />

      {/* Controls Area */}
      <div className="mt-8 w-full max-w-lg flex items-center justify-between px-8">
           {/* Player 1 Dice */}
           <div className={`flex flex-col items-center transition-opacity ${currentPlayer.color === PlayerColor.RED ? 'opacity-100 scale-110' : 'opacity-50'}`}>
                <div 
                    className={`w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center text-4xl font-black border-4 border-red-500 relative cursor-pointer ${animating && currentPlayer.color === PlayerColor.RED ? 'animate-spin' : ''}`}
                    onClick={() => isMyTurn && !gameState.isDiceRolled && rollDice()}
                >
                    {currentPlayer.color === PlayerColor.RED && gameState.diceValue ? gameState.diceValue : '🎲'}
                    {isMyTurn && !gameState.isDiceRolled && !animating && (
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
                    )}
                </div>
                <span className="mt-2 font-bold text-red-400">{isMyTurn ? "YOUR TURN" : "..."}</span>
           </div>

           {/* Winner Modal Overlay */}
           {gameState.winner && (
               <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                   <div className="bg-white p-8 rounded-3xl text-center shadow-2xl border-4 border-yellow-400 animate-bounce">
                       <div className="text-6xl mb-4">🏆</div>
                       <h2 className="text-3xl font-black text-gray-800 uppercase mb-2">
                           {gameState.players.find(p => p.color === gameState.winner)?.name} WINS!
                       </h2>
                       <p className="text-green-600 font-bold text-xl mb-6">Won ৳{(entryFee * 1.8).toFixed(2)}</p>
                       <button onClick={() => setView('LOBBY')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700">Back to Lobby</button>
                   </div>
               </div>
           )}

           {/* Bot Dice */}
           <div className={`flex flex-col items-center transition-opacity ${currentPlayer.color === PlayerColor.YELLOW ? 'opacity-100 scale-110' : 'opacity-50'}`}>
                <div className={`w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center text-4xl font-black border-4 border-yellow-500 ${animating && currentPlayer.color === PlayerColor.YELLOW ? 'animate-spin' : ''}`}>
                    {currentPlayer.color === PlayerColor.YELLOW && gameState.diceValue ? gameState.diceValue : '🎲'}
                </div>
                <span className="mt-2 font-bold text-yellow-400">{!isMyTurn ? "BOT THINKING..." : "WAITING"}</span>
           </div>
      </div>

    </div>
  );
};

export default App;