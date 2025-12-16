import React from 'react';
import { Player, Token, TokenState, PlayerColor } from '../types';
import { COLORS, SAFE_SPOTS, START_POSITIONS } from '../constants';

interface LudoBoardProps {
  players: Player[];
  onTokenClick: (token: Token) => void;
  validTokens: number[]; // IDs of tokens valid to move
  currentPlayerColor: PlayerColor;
}

const LudoBoard: React.FC<LudoBoardProps> = ({ players, onTokenClick, validTokens, currentPlayerColor }) => {

  // Helper to determine absolute grid position (1-15, 1-15) based on path index
  // This is a manual mapping of the Ludo path to CSS Grid coordinates
  const getGridPos = (pathIndex: number, color: PlayerColor) => {
    // 0-51 is the main loop. 
    // We need to map path index (which is relative to start) to absolute board index (0-51 starting from Red's start).
    // Actually, let's normalize everything to absolute index 0 at Red Start (6, 1) in 0-indexed grid? No, simpler to map visual cells.
    
    // Let's use a coordinate map for the 52 outer cells starting from Red's start (bottom-left of top-left quadrant vertical strip)
    // Red Start is at grid x:1, y:6 (0-indexed: row 6, col 1) -> Actually standard ludo starts are:
    // Red: Row 6, Col 1
    // Green: Row 1, Col 8
    // Yellow: Row 8, Col 13
    // Blue: Row 13, Col 6
    
    const pathCoords = [
      [6,1], [6,2], [6,3], [6,4], [6,5], // 0-4
      [5,6], [4,6], [3,6], [2,6], [1,6], [0,6], // 5-10
      [0,7], [0,8], // 11-12 (Top center)
      [1,8], [2,8], [3,8], [4,8], [5,8], // 13-17
      [6,9], [6,10], [6,11], [6,12], [6,13], [6,14], // 18-23
      [7,14], [8,14], // 24-25 (Right center)
      [8,13], [8,12], [8,11], [8,10], [8,9], // 26-30
      [9,8], [10,8], [11,8], [12,8], [13,8], [14,8], // 31-36
      [14,7], [14,6], // 37-38 (Bottom center)
      [13,6], [12,6], [11,6], [10,6], [9,6], // 39-43
      [8,5], [8,4], [8,3], [8,2], [8,1], [8,0], // 44-49
      [7,0] // 50 (Left center) - wait, this loop has 52 steps.
    ];

    // Home paths
    const redHome = [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]]; // Ends at center
    const greenHome = [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]];
    const yellowHome = [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]];
    const blueHome = [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]];

    // Calculate Absolute Position (0-51) relative to Red Start
    // Token.position is 0-51 relative to main path + 52-57 for home stretch
    // We must offset based on player color to find absolute board index if on main path.
    
    // Normalize position relative to Red's start (0)
    let absoluteIndex = -1;
    let isHomeStretch = false;

    if (pathIndex >= 0 && pathIndex <= 50) {
        // Main path
        const offset = START_POSITIONS[color];
        absoluteIndex = (pathIndex + offset) % 52; 
    } else if (pathIndex >= 100) {
        // WIN state or Home Stretch
        isHomeStretch = true;
    }

    if (isHomeStretch) {
        const homeIdx = pathIndex - 100; // 0-5
        if (color === PlayerColor.RED) return redHome[homeIdx];
        if (color === PlayerColor.GREEN) return greenHome[homeIdx];
        if (color === PlayerColor.YELLOW) return yellowHome[homeIdx];
        if (color === PlayerColor.BLUE) return blueHome[homeIdx];
    }
    
    // Correction for the 52nd step which is the start of next
    // The pathCoords array needs to be perfect.
    // Let's rely on a simplified relative renderer for this example or the map above.
    return pathCoords[absoluteIndex] || [7,7];
  };

  const renderCell = (r: number, c: number) => {
    // Determine cell type (safe, path, home, base)
    // This is complex to generate procedurally in one go, 
    // instead we render the 4 bases and the cross.
    return null; 
  };

  // --- RENDERING STRATEGY ---
  // Use a 15x15 grid.
  // Bases are 6x6 at corners.
  // Paths are 3x6 strips.
  // Center is 3x3.

  return (
    <div className="relative w-full max-w-[500px] aspect-square bg-white border-4 border-gray-800 rounded-lg shadow-2xl overflow-hidden select-none">
      
      {/* 15x15 Grid Container */}
      <div className="grid grid-cols-15 grid-rows-15 w-full h-full bg-white" style={{ gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)' }}>
        
        {/* --- BASES --- */}
        {/* RED BASE (Top Left) */}
        <div className="col-span-6 row-span-6 bg-red-500 border-2 border-gray-800 p-4 relative">
            <div className="w-full h-full bg-white rounded-2xl flex flex-wrap items-center justify-center p-2 gap-2">
                {players.find(p => p.color === PlayerColor.RED)?.tokens.filter(t => t.state === TokenState.HOME).map((t) => (
                    <div key={t.id} className="w-8 h-8 bg-red-600 rounded-full border-2 border-gray-800 shadow-md"></div>
                ))}
            </div>
        </div>
        
        {/* GREEN BASE (Top Right) */}
        <div className="col-start-10 col-span-6 row-span-6 bg-green-500 border-2 border-gray-800 p-4 relative">
             <div className="w-full h-full bg-white rounded-2xl flex flex-wrap items-center justify-center p-2 gap-2">
                 {players.find(p => p.color === PlayerColor.GREEN)?.tokens.filter(t => t.state === TokenState.HOME).map((t) => (
                    <div key={t.id} className="w-8 h-8 bg-green-600 rounded-full border-2 border-gray-800 shadow-md"></div>
                ))}
             </div>
        </div>

        {/* BLUE BASE (Bottom Left) */}
        <div className="col-span-6 row-start-10 row-span-6 bg-blue-500 border-2 border-gray-800 p-4 relative">
             <div className="w-full h-full bg-white rounded-2xl flex flex-wrap items-center justify-center p-2 gap-2">
                 {players.find(p => p.color === PlayerColor.BLUE)?.tokens.filter(t => t.state === TokenState.HOME).map((t) => (
                    <div key={t.id} className="w-8 h-8 bg-blue-600 rounded-full border-2 border-gray-800 shadow-md"></div>
                ))}
             </div>
        </div>

        {/* YELLOW BASE (Bottom Right) */}
        <div className="col-start-10 col-span-6 row-start-10 row-span-6 bg-yellow-400 border-2 border-gray-800 p-4 relative">
             <div className="w-full h-full bg-white rounded-2xl flex flex-wrap items-center justify-center p-2 gap-2">
                 {players.find(p => p.color === PlayerColor.YELLOW)?.tokens.filter(t => t.state === TokenState.HOME).map((t) => (
                    <div key={t.id} className="w-8 h-8 bg-yellow-500 rounded-full border-2 border-gray-800 shadow-md"></div>
                ))}
             </div>
        </div>

        {/* --- CENTER TRIANGLE --- */}
        <div className="col-start-7 col-span-3 row-start-7 row-span-3 bg-gray-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-0 h-0 border-l-[33px] border-l-red-500 border-t-[33px] border-t-transparent border-b-[33px] border-b-transparent"></div> 
             {/* This requires cleaner CSS triangles, simpler: gradient or just colored divs */}
             <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                <div className="bg-red-500 opacity-20"></div><div className="bg-green-500 opacity-20"></div>
                <div className="bg-blue-500 opacity-20"></div><div className="bg-yellow-400 opacity-20"></div>
             </div>
             {/* Winners */}
             <div className="absolute inset-0 flex items-center justify-center">
                 <span className="text-xs font-bold text-gray-400">HOME</span>
             </div>
        </div>

        {/* --- PATHS BACKGROUNDS (Static Grid) --- */}
        {/* We overlay the Grid Cells div on top to handle tokens */}
      </div>

      {/* --- GRID CELLS & TOKENS LAYER --- */}
      <div className="absolute inset-0 grid grid-cols-15 grid-rows-15 pointer-events-none" style={{ gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)' }}>
         {/* Render Tokens on Path */}
         {players.flatMap(p => p.tokens).filter(t => t.state !== TokenState.HOME && t.state !== TokenState.WIN).map(token => {
             const [r, c] = getGridPos(token.position < 100 ? token.position : token.position, token.color);
             const isClickable = validTokens.includes(token.id) && token.color === currentPlayerColor;
             
             // Handle multiple tokens on same spot
             const othersHere = players.flatMap(pl => pl.tokens).filter(ot => 
                 ot.id !== token.id && 
                 ot.state === token.state && 
                 ot.position === token.position &&
                 ot.color === token.color // only stack own tokens visually for simplicity
             );
             const offset = othersHere.length > 0 ? (token.id * 2) : 0; // slight visual offset

             return (
                 <div 
                    key={`${token.color}-${token.id}`}
                    className={`absolute z-10 w-[6.66%] h-[6.66%] flex items-center justify-center transition-all duration-300 pointer-events-auto cursor-pointer`}
                    style={{ 
                        gridColumnStart: c + 1, 
                        gridRowStart: r + 1,
                        transform: `translate(${offset}px, ${offset}px)`
                    }}
                    onClick={() => {
                        if (isClickable) onTokenClick(token);
                    }}
                 >
                     <div className={`w-[80%] h-[80%] rounded-full shadow-lg border-2 border-white flex items-center justify-center ${COLORS[token.color].base} ${isClickable ? 'animate-bounce ring-2 ring-white' : ''}`}>
                         {/* Optional: Add star icon if safe spot */}
                     </div>
                 </div>
             );
         })}
      </div>
      
      {/* --- CELL OVERLAYS (For visuals like Stars/Arrows) --- */}
       <div className="absolute inset-0 grid grid-cols-15 grid-rows-15 pointer-events-none" style={{ gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)' }}>
            {/* Safe Spots Visuals */}
            <div className="col-start-3 row-start-7 bg-transparent flex items-center justify-center"><span className="text-gray-300 text-xs">★</span></div>
            <div className="col-start-7 row-start-3 bg-transparent flex items-center justify-center"><span className="text-gray-300 text-xs">★</span></div>
            <div className="col-start-9 row-start-13 bg-transparent flex items-center justify-center"><span className="text-gray-300 text-xs">★</span></div>
            <div className="col-start-13 row-start-9 bg-transparent flex items-center justify-center"><span className="text-gray-300 text-xs">★</span></div>
            
            {/* Start Arrows */}
            <div className="col-start-2 row-start-7 bg-red-200 opacity-50"></div>
            <div className="col-start-9 row-start-2 bg-green-200 opacity-50"></div>
            <div className="col-start-14 row-start-9 bg-yellow-100 opacity-50"></div>
            <div className="col-start-7 row-start-14 bg-blue-200 opacity-50"></div>
       </div>

    </div>
  );
};

export default LudoBoard;