
import React from 'react';
import { Player, Token, TokenState, PlayerColor } from '../types';
import { COLORS, START_POSITIONS } from '../constants';

interface LudoBoardProps {
  players: Player[];
  onTokenClick: (token: Token) => void;
  validTokens: number[]; 
  currentPlayerColor: PlayerColor;
}

const LudoBoard: React.FC<LudoBoardProps> = ({ players = [], onTokenClick, validTokens = [], currentPlayerColor }) => {

  const getGridPos = (token: Token): [number, number] => {
    // Shared path coordinates (0-51)
    const pathCoords = [
      [6,1], [6,2], [6,3], [6,4], [6,5], // Red start & path
      [5,6], [4,6], [3,6], [2,6], [1,6], [0,6], // To Green
      [0,7], [0,8], // Top turn
      [1,8], [2,8], [3,8], [4,8], [5,8], // Down to Yellow
      [6,9], [6,10], [6,11], [6,12], [6,13], [6,14], // To Yellow
      [7,14], [8,14], // Right turn
      [8,13], [8,12], [8,11], [8,10], [8,9], // Back to Blue
      [9,8], [10,8], [11,8], [12,8], [13,8], [14,8], // Down to Blue
      [14,7], [14,6], // Bottom turn
      [13,6], [12,6], [11,6], [10,6], [9,6], // Up to Red
      [8,5], [8,4], [8,3], [8,2], [8,1], [8,0], // Back to Red start
      [7,0], [6,0] // Final turn before entrance
    ];

    // Home Lane coordinates for each color
    const homeLanes = {
      [PlayerColor.RED]: [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]], 
      [PlayerColor.GREEN]: [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]],
      [PlayerColor.YELLOW]: [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]],
      [PlayerColor.BLUE]: [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]]
    };

    // If token is at HOME base
    if (token.state === TokenState.HOME) {
      const bases = {
        [PlayerColor.RED]: [[1,1], [1,4], [4,1], [4,4]],
        [PlayerColor.GREEN]: [[1,10], [1,13], [4,10], [4,13]],
        [PlayerColor.YELLOW]: [[10,10], [10,13], [13,10], [13,13]],
        [PlayerColor.BLUE]: [[10,1], [10,4], [13,1], [13,4]],
      };
      // Use id-based indexing to keep tokens in separate base spots
      const slot = token.id % 4;
      return (bases[token.color][slot] as [number, number]) || [1,1];
    }

    // If token is in the Home Lane (Steps 51-56)
    if (token.distanceTraveled >= 51) {
      const laneIdx = token.distanceTraveled - 51;
      return (homeLanes[token.color][laneIdx] as [number, number]) || [7,7];
    }

    // Normal path (Steps 0-50)
    // IMPORTANT: The offset is applied here so everyone starts at their correct color exit
    const startOffset = START_POSITIONS[token.color];
    const absoluteIndex = (token.distanceTraveled + startOffset) % 52;
    return (pathCoords[absoluteIndex] as [number, number]) || [7,7];
  };

  const renderGridBackground = () => {
    const cells = [];
    const starSpots = [
      {r: 6, c: 1}, {r: 2, c: 6},
      {r: 1, c: 8}, {r: 6, c: 12},
      {r: 8, c: 13}, {r: 12, c: 8},
      {r: 13, c: 6}, {r: 8, c: 2}
    ];

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip base and center areas
        if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8) || (r >= 6 && r <= 8 && c >= 6 && c <= 8)) continue;

        let bgColor = 'bg-white';
        let isStar = starSpots.some(s => s.r === r && s.c === c);

        // Color the paths leading to center
        if (r === 7 && c >= 1 && c <= 5) bgColor = 'bg-red-500';
        if (c === 7 && r >= 1 && r <= 5) bgColor = 'bg-green-500';
        if (r === 7 && c >= 9 && c <= 13) bgColor = 'bg-yellow-400';
        if (c === 7 && r >= 9 && r <= 13) bgColor = 'bg-blue-500';

        // Starting squares
        if (r === 6 && c === 1) bgColor = 'bg-red-500';
        if (r === 1 && c === 8) bgColor = 'bg-green-500';
        if (r === 8 && c === 13) bgColor = 'bg-yellow-400';
        if (r === 13 && c === 6) bgColor = 'bg-blue-500';

        cells.push(
          <div 
            key={`cell-${r}-${c}`} 
            className={`absolute w-[6.66%] h-[6.66%] border-[0.5px] border-gray-100 ${bgColor} flex items-center justify-center`}
            style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%` }}
          >
            {isStar && <span className="text-[10px] opacity-40">⭐</span>}
          </div>
        );
      }
    }
    return cells;
  };

  // Logic to stack tokens if multiple are on the same spot
  const tokensAtPos: Record<string, {token: Token, playerIndex: number}[]> = {};
  
  players.forEach((p, pIdx) => {
    p.tokens.forEach((t) => {
      if (t.state === TokenState.WIN) return;
      const [r, c] = getGridPos(t);
      const key = `${r}-${c}`;
      if (!tokensAtPos[key]) tokensAtPos[key] = [];
      tokensAtPos[key].push({token: t, playerIndex: pIdx});
    });
  });

  return (
    <div className="relative w-full h-full aspect-square bg-white border-[4px] border-[#e8c058] rounded-[16px] shadow-2xl overflow-hidden select-none">
      {renderGridBackground()}

      {/* BASES */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-red-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute top-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-green-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-yellow-400 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-blue-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>

      {/* CENTER */}
      <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%]">
          <div className="w-full h-full relative">
              <div className="absolute left-0 top-0 bottom-0 w-1/2 h-full bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}></div>
              <div className="absolute top-0 left-0 right-0 h-1/2 w-full bg-green-500" style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }}></div>
              <div className="absolute right-0 top-0 bottom-0 w-1/2 h-full bg-yellow-400" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}></div>
              <div className="absolute bottom-0 left-0 right-0 h-1/2 w-full bg-blue-500" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}></div>
          </div>
      </div>

      {/* TOKENS */}
      {Object.entries(tokensAtPos).flatMap(([posKey, stack]) => {
          const [r, c] = posKey.split('-').map(Number);
          const isAtHomeBase = stack.some(s => s.token.state === TokenState.HOME);
          
          return stack.map(({token}, index) => {
              const isClickable = validTokens.includes(token.id) && token.color === currentPlayerColor;
              
              let sizeClass = "w-[85%] h-[85%]";
              let offsetStyle: React.CSSProperties = {};
              
              // If multiple tokens are on the same spot, arrange them in a grid
              if (stack.length > 1 && !isAtHomeBase) {
                  sizeClass = "w-[45%] h-[45%]";
                  const row = Math.floor(index / 2);
                  const col = index % 2;
                  offsetStyle = { top: `${row * 50}%`, left: `${col * 50}%` };
              }

              return (
                  <div 
                     key={`token-${token.color}-${token.id}`}
                     className="absolute w-[6.66%] h-[6.66%] transition-all duration-300 pointer-events-none"
                     style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%`, zIndex: isClickable ? 100 : 10 + index }}
                  >
                      <div 
                        className={`absolute ${sizeClass} flex items-center justify-center transition-all cursor-pointer pointer-events-auto`}
                        style={offsetStyle}
                        onClick={(e) => { e.stopPropagation(); if (isClickable) onTokenClick(token); }}
                      >
                        <div className={`w-full h-full rounded-full shadow-lg border-[1.5px] border-white/50 flex items-center justify-center ${COLORS[token.color].base} ${isClickable ? 'animate-bounce ring-4 ring-yellow-400 z-50' : ''}`}>
                            <div className="w-[40%] h-[20%] bg-white/40 rounded-full mb-1"></div>
                            <div className="absolute inset-0 rounded-full shadow-inner bg-gradient-to-tr from-black/20 to-transparent"></div>
                        </div>
                      </div>
                  </div>
              );
          });
      })}
    </div>
  );
};

export default LudoBoard;
