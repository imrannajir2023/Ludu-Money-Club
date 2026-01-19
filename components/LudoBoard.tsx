
import React from 'react';
import { Player, Token, TokenState, PlayerColor } from '../types';
import { COLORS, START_POSITIONS } from '../constants';

interface LudoBoardProps {
  players: Player[];
  onTokenClick: (token: Token) => void;
  validTokens: number[]; 
  currentPlayerColor: PlayerColor;
}

const LudoBoard: React.FC<LudoBoardProps> = ({ players, onTokenClick, validTokens, currentPlayerColor }) => {

  const getGridPos = (pathIndex: number, color: PlayerColor) => {
    const pathCoords = [
      [6,1], [6,2], [6,3], [6,4], [6,5],
      [5,6], [4,6], [3,6], [2,6], [1,6], [0,6],
      [0,7], [0,8],
      [1,8], [2,8], [3,8], [4,8], [5,8],
      [6,9], [6,10], [6,11], [6,12], [6,13], [6,14],
      [7,14], [8,14],
      [8,13], [8,12], [8,11], [8,10], [8,9],
      [9,8], [10,8], [11,8], [12,8], [13,8], [14,8],
      [14,7], [14,6],
      [13,6], [12,6], [11,6], [10,6], [9,6],
      [8,5], [8,4], [8,3], [8,2], [8,1], [8,0],
      [7,0], [6,0]
    ];

    const redHome = [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]]; 
    const greenHome = [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]];
    const yellowHome = [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]];
    const blueHome = [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]];

    if (pathIndex >= 100) {
        const homeIdx = pathIndex - 100;
        if (color === PlayerColor.RED) return redHome[homeIdx] || [7,6];
        if (color === PlayerColor.GREEN) return greenHome[homeIdx] || [6,7];
        if (color === PlayerColor.YELLOW) return yellowHome[homeIdx] || [7,8];
        if (color === PlayerColor.BLUE) return blueHome[homeIdx] || [8,7];
    }
    
    const offset = START_POSITIONS[color];
    const absoluteIndex = (pathIndex + offset) % 52;
    return pathCoords[absoluteIndex] || [7,7];
  };

  const getBaseGridPos = (color: PlayerColor, tokenId: number) => {
    const bases = {
      [PlayerColor.RED]: [[1,1], [1,4], [4,1], [4,4]],
      [PlayerColor.GREEN]: [[1,10], [1,13], [4,10], [4,13]],
      [PlayerColor.YELLOW]: [[10,10], [10,13], [13,10], [13,13]],
      [PlayerColor.BLUE]: [[10,1], [10,4], [13,1], [13,4]],
    };
    return bases[color][tokenId];
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
        if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8) || (r >= 6 && r <= 8 && c >= 6 && c <= 8)) continue;

        let bgColor = 'bg-white';
        let isStar = starSpots.some(s => s.r === r && s.c === c);

        if (r === 7 && c >= 1 && c <= 5) bgColor = 'bg-red-500';
        if (c === 7 && r >= 1 && r <= 5) bgColor = 'bg-green-500';
        if (r === 7 && c >= 9 && c <= 13) bgColor = 'bg-yellow-400';
        if (c === 7 && r >= 9 && r <= 13) bgColor = 'bg-blue-500';

        if (r === 6 && c === 1) bgColor = 'bg-red-500';
        if (r === 1 && c === 8) bgColor = 'bg-green-500';
        if (r === 8 && c === 13) bgColor = 'bg-yellow-400';
        if (r === 13 && c === 6) bgColor = 'bg-blue-500';

        cells.push(
          <div 
            key={`${r}-${c}`} 
            className={`absolute w-[6.66%] h-[6.66%] border-[0.5px] border-gray-100 ${bgColor} flex items-center justify-center`}
            style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%` }}
          >
            {isStar && (
              <span className="text-[10px] md:text-sm drop-shadow-sm select-none opacity-40">⭐</span>
            )}
          </div>
        );
      }
    }
    return cells;
  };

  const tokensAtPos: Record<string, {token: Token, playerIndex: number}[]> = {};
  players.forEach((p, pIdx) => {
    p.tokens.forEach(t => {
      if (t.state === TokenState.WIN) return;
      let r, c;
      if (t.state === TokenState.HOME) [r, c] = getBaseGridPos(t.color, t.id);
      else [r, c] = getGridPos(t.position, t.color);
      const key = `${r}-${c}`;
      if (!tokensAtPos[key]) tokensAtPos[key] = [];
      tokensAtPos[key].push({token: t, playerIndex: pIdx});
    });
  });

  return (
    <div className="relative w-full h-full aspect-square bg-white border-[6px] border-[#e8c058] rounded-[16px] shadow-2xl overflow-hidden select-none">
      {renderGridBackground()}

      {/* BASES */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-red-500 rounded-xl border-2 border-white shadow-lg flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute top-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-green-500 rounded-xl border-2 border-white shadow-lg flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-yellow-400 rounded-xl border-2 border-white shadow-lg flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-blue-500 rounded-xl border-2 border-white shadow-lg flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>

      {/* CENTER */}
      <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%]">
          <div className="w-full h-full relative">
              <div className="absolute left-0 top-0 bottom-0 w-1/2 h-full bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}></div>
              <div className="absolute top-0 left-0 right-0 h-1/2 w-full bg-green-500" style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }}></div>
              <div className="absolute right-0 top-0 bottom-0 w-1/2 h-full bg-yellow-400" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}></div>
              <div className="absolute bottom-0 left-0 right-0 h-1/2 w-full bg-blue-500" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}></div>
          </div>
      </div>

      {/* TOKENS WITH SMART STACKING GRID */}
      {Object.entries(tokensAtPos).flatMap(([posKey, stack]) => {
          const [r, c] = posKey.split('-').map(Number);
          const isAtHome = stack.some(s => s.token.state === TokenState.HOME);
          
          return stack.map(({token, playerIndex}, index) => {
              const isClickable = validTokens.includes(token.id) && token.color === currentPlayerColor;
              
              let sizeClass = "w-[85%] h-[85%]";
              let offsetStyle = {};
              
              if (stack.length > 1 && !isAtHome) {
                  sizeClass = "w-[45%] h-[45%]";
                  const row = Math.floor(index / 2);
                  const col = index % 2;
                  offsetStyle = {
                      top: `${row * 50}%`,
                      left: `${col * 50}%`,
                      transform: 'none'
                  };
              }

              // Clickable/Current turn tokens always on top of others in same cell
              const zIndex = isClickable ? 300 : 10 + index;

              return (
                  <div 
                     key={`${token.color}-${token.id}`}
                     className={`absolute w-[6.66%] h-[6.66%] transition-all duration-300 ease-out pointer-events-none`}
                     style={{ 
                        top: `${r * 6.666}%`, 
                        left: `${c * 6.666}%`,
                        zIndex: zIndex
                     }}
                  >
                      <div 
                        className={`absolute ${sizeClass} flex items-center justify-center transition-all cursor-pointer pointer-events-auto`}
                        style={offsetStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isClickable) onTokenClick(token);
                        }}
                      >
                        <div className={`w-full h-full rounded-full shadow-lg border-[1.5px] border-white flex items-center justify-center ${COLORS[token.color].base} ${isClickable ? 'animate-bounce ring-4 ring-yellow-400 z-[400]' : ''} transition-transform hover:scale-110 active:scale-95`}>
                            <div className="w-[40%] h-[20%] bg-white/30 rounded-full mb-1"></div>
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
