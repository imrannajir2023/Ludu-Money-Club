
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
      [PlayerColor.RED]: [[7,1], [7,2], [7,3], [7,4], [7,5]], 
      [PlayerColor.GREEN]: [[1,7], [2,7], [3,7], [4,7], [5,7]],
      [PlayerColor.YELLOW]: [[7,13], [7,12], [7,11], [7,10], [7,9]],
      [PlayerColor.BLUE]: [[13,7], [12,7], [11,7], [10,7], [9,7]]
    };

    if (token.state === TokenState.HOME) {
      const bases = {
        [PlayerColor.RED]: [[1,1], [1,4], [4,1], [4,4]],
        [PlayerColor.GREEN]: [[1,10], [1,13], [4,10], [4,13]],
        [PlayerColor.YELLOW]: [[10,10], [10,13], [13,10], [13,13]],
        [PlayerColor.BLUE]: [[10,1], [10,4], [13,1], [13,4]],
      };
      return bases[token.color][token.id % 4] as [number, number];
    }

    if (token.distanceTraveled >= 51) {
      const laneIdx = token.distanceTraveled - 51;
      return laneIdx >= 5 ? [7,7] : (homeLanes[token.color][laneIdx] as [number, number]);
    }

    return pathCoords[(token.distanceTraveled + START_POSITIONS[token.color]) % 52] as [number, number];
  };

  const renderCells = () => {
    const cells = [];
    const starSpots = [
      {r: 6, c: 1}, {r: 2, c: 6}, 
      {r: 1, c: 8}, {r: 6, c: 12}, 
      {r: 8, c: 13}, {r: 12, c: 8}, 
      {r: 13, c: 6}, {r: 8, c: 2}
    ];

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip base areas and center area (they are rendered separately)
        if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8) || (r >= 6 && r <= 8 && c >= 6 && c <= 8)) continue;
        
        let bg = 'bg-white';
        let isSafeSpot = false;

        if (r === 7 && c >= 1 && c <= 5) bg = 'bg-red-500';
        else if (c === 7 && r >= 1 && r <= 5) bg = 'bg-green-500';
        else if (r === 7 && c >= 9 && c <= 13) bg = 'bg-yellow-400';
        else if (c === 7 && r >= 9 && r <= 13) bg = 'bg-blue-500';
        else if ((r === 6 && c === 1)) { bg = 'bg-red-500'; isSafeSpot = true; }
        else if ((r === 1 && c === 8)) { bg = 'bg-green-500'; isSafeSpot = true; }
        else if ((r === 8 && c === 13)) { bg = 'bg-yellow-400'; isSafeSpot = true; }
        else if ((r === 13 && c === 6)) { bg = 'bg-blue-500'; isSafeSpot = true; }
        else if (starSpots.some(s => s.r === r && s.c === c)) { isSafeSpot = true; }
        
        cells.push(
          <div 
            key={`${r}-${c}`} 
            className={`absolute w-[6.66%] h-[6.66%] border-[0.5px] border-slate-200 ${bg} flex items-center justify-center`} 
            style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%` }}
          >
            {isSafeSpot && (
              <span className={`text-[14px] font-bold ${bg === 'bg-white' ? 'text-black/10' : 'text-white/40'}`}>
                ★
              </span>
            )}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="relative w-full h-full aspect-square bg-white border-[6px] border-[#d4af37] rounded-xl shadow-2xl overflow-hidden">
      {renderCells()}
      
      {/* Bases */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-red-500 rounded-lg border-2 border-white flex items-center justify-center"><div className="bg-white w-[60%] h-[60%] rounded-md shadow-inner"></div></div></div>
      <div className="absolute top-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-green-500 rounded-lg border-2 border-white flex items-center justify-center"><div className="bg-white w-[60%] h-[60%] rounded-md shadow-inner"></div></div></div>
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-yellow-400 rounded-lg border-2 border-white flex items-center justify-center"><div className="bg-white w-[60%] h-[60%] rounded-md shadow-inner"></div></div></div>
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] p-2"><div className="w-full h-full bg-blue-500 rounded-lg border-2 border-white flex items-center justify-center"><div className="bg-white w-[60%] h-[60%] rounded-md shadow-inner"></div></div></div>
      
      {/* Center Home */}
      <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%]">
        <div className="w-full h-full relative" style={{ clipPath: 'polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%)' }}>
          <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 50% 50%, 0 100%)' }}></div>
          <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }}></div>
          <div className="absolute inset-0 bg-yellow-400" style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)' }}></div>
          <div className="absolute inset-0 bg-blue-500" style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)' }}></div>
        </div>
      </div>

      {/* Tokens */}
      {players.flatMap((p, pi) => p.tokens.map(t => {
        if (t.state === TokenState.WIN) return null;
        const [r, c] = getGridPos(t);
        const isClickable = validTokens.includes(t.id) && t.color === currentPlayerColor;
        return (
          <div 
            key={`${pi}-${t.id}`} 
            className="absolute w-[6.66%] h-[6.66%] flex items-center justify-center transition-all duration-300 cursor-pointer pointer-events-auto"
            style={{ top: `${r * 6.666}%`, left: `${c * 6.666}%`, zIndex: isClickable ? 100 : 10 }}
            onClick={() => isClickable && onTokenClick(t)}
          >
            <div className={`w-[80%] h-[80%] rounded-full border-2 border-white shadow-lg ${COLORS[t.color].base} ${isClickable ? 'animate-bounce ring-4 ring-yellow-400' : ''}`}>
               <div className="absolute inset-1 border border-white/20 rounded-full bg-gradient-to-br from-white/30 to-black/20"></div>
            </div>
          </div>
        );
      }))}
    </div>
  );
};

export default LudoBoard;
