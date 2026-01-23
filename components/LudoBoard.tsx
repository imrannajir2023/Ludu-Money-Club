
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

    const homeLanes = {
      [PlayerColor.RED]: [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]], 
      [PlayerColor.GREEN]: [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]],
      [PlayerColor.YELLOW]: [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]],
      [PlayerColor.BLUE]: [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]]
    };

    if (token.state === TokenState.HOME) {
      const bases = {
        [PlayerColor.RED]: [[1,1], [1,4], [4,1], [4,4]],
        [PlayerColor.GREEN]: [[1,10], [1,13], [4,10], [4,13]],
        [PlayerColor.YELLOW]: [[10,10], [10,13], [13,10], [13,13]],
        [PlayerColor.BLUE]: [[10,1], [10,4], [13,1], [13,4]],
      };
      const slot = token.id % 4;
      return (bases[token.color][slot] as [number, number]) || [1,1];
    }

    if (token.distanceTraveled >= 51) {
      const laneIdx = token.distanceTraveled - 51;
      return (homeLanes[token.color][laneIdx] as [number, number]) || [7,7];
    }

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

      {/* Bases */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-red-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute top-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-green-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-yellow-400 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-blue-500 rounded-xl border-2 border-white flex items-center justify-center"><div className="bg-white w-[70%] h-[70%] rounded-lg"></div></div></div>

      {/* Center Square */}
      <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%]">
          <div className="w-full h-full relative">
              <div className="absolute left-0 top-0 bottom-0 w-1/2 h-full bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}></div>
              <div className="absolute top-0 left-0 right-0 h-1/2 w-full bg-green-500" style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }}></div>
              <div className="absolute right-0 top-0 bottom-0 w-1/2 h-full bg-yellow-400" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}></div>
              <div className="absolute bottom-0 left-0 right-0 h-1/2 w-full bg-blue-500" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}></div>
          </div>
      </div>

      {/* ULTRA PREMIUM TOKENS */}
      {Object.entries(tokensAtPos).flatMap(([posKey, stack]) => {
          const [r, c] = posKey.split('-').map(Number);
          const isAtHomeBase = stack.some(s => s.token.state === TokenState.HOME);
          
          return stack.map(({token}, index) => {
              const isClickable = validTokens.includes(token.id) && token.color === currentPlayerColor;
              
              let sizeClass = "w-[110%] h-[110%]";
              let offsetStyle: React.CSSProperties = {};
              
              if (stack.length > 1 && !isAtHomeBase) {
                  sizeClass = "w-[75%] h-[75%]";
                  const angle = (index * (360 / stack.length)) * (Math.PI / 180);
                  const radius = 18;
                  offsetStyle = { 
                    transform: `translate(${Math.cos(angle) * radius}%, ${Math.sin(angle) * radius}%)`,
                    zIndex: 20 + index 
                  };
              }

              return (
                  <div 
                     key={`token-${token.color}-${token.id}`}
                     className="absolute w-[6.66%] h-[6.66%] pointer-events-none flex items-center justify-center"
                     style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%`, zIndex: isClickable ? 100 : 10 + index }}
                  >
                      <div 
                        className={`absolute ${sizeClass} flex items-center justify-center transition-transform duration-300 cursor-pointer pointer-events-auto active:scale-90`}
                        style={offsetStyle}
                        onClick={(e) => { e.stopPropagation(); if (isClickable) onTokenClick(token); }}
                      >
                        {/* ULTRA PREMIUM TOKEN CONTAINER */}
                        <div className={`
                          relative w-[90%] h-[90%] rounded-full 
                          shadow-[0_6px_15px_rgba(0,0,0,0.7),inset_0_-2px_4px_rgba(0,0,0,0.5)] 
                          border-[2.5px] border-yellow-500/80
                          flex items-center justify-center 
                          ${COLORS[token.color].base} 
                          ${isClickable ? 'animate-bounce z-50 ring-[4px] ring-white/40 ring-offset-2 ring-offset-yellow-500 shadow-[0_0_20px_rgba(251,191,36,0.6)]' : ''}
                        `}>
                            {/* Inner Metallic Gradient Ring */}
                            <div className="absolute inset-[10%] rounded-full border border-white/20 bg-gradient-to-br from-white/40 via-transparent to-black/20 shadow-inner"></div>
                            
                            {/* Specular High-Light (Glassy Reflection) */}
                            <div className="absolute top-[10%] left-[20%] w-[45%] h-[25%] bg-gradient-to-b from-white/70 to-transparent rounded-full blur-[0.5px] rotate-[-25deg]"></div>
                            
                            {/* Lower Secondary Shine */}
                            <div className="absolute bottom-[15%] right-[20%] w-[25%] h-[15%] bg-white/20 rounded-full blur-[1px]"></div>

                            {/* Center Diamond Jewel */}
                            <div className="w-[30%] h-[30%] bg-white/40 rounded-sm rotate-45 shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-white/60 flex items-center justify-center">
                               <div className="w-[40%] h-[40%] bg-white rounded-full"></div>
                            </div>

                            {/* Base Shadow for Depth */}
                            <div className="absolute -bottom-1 w-[80%] h-1.5 bg-black/40 blur-sm rounded-full -z-10"></div>
                            
                            {/* Interactive Pulse Glow */}
                            {isClickable && (
                              <div className="absolute inset-0 rounded-full animate-pulse bg-white/30 border-[4px] border-yellow-300/50 scale-125 -z-20"></div>
                            )}
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
