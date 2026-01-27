
import { Player, Token, TokenState, PlayerColor } from '../types';
import { SAFE_SPOTS, START_POSITIONS } from '../constants';

const BOT_IDENTITIES = [
  { name: "Alex Rivera", country: "USA", flag: "🇺🇸" },
  { name: "Sofia Silva", country: "Brazil", flag: "🇧🇷" },
  { name: "Hiroshi Sato", country: "Japan", flag: "🇯🇵" },
  { name: "Emma Wilson", country: "UK", flag: "🇬🇧" },
  { name: "Hans Müller", country: "Germany", flag: "🇩🇪" },
  { name: "Luca Rossi", country: "Italy", flag: "🇮🇹" },
  { name: "Mateo Garcia", country: "Spain", flag: "🇪🇸" },
  { name: "Chloe Dupont", country: "France", flag: "🇫🇷" },
  { name: "Kim Min-su", country: "South Korea", flag: "🇰🇷" },
  { name: "Zhang Wei", country: "China", flag: "🇨🇳" },
  { name: "Arjun Gupta", country: "India", flag: "🇮🇳" },
  { name: "Rony Khan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Fatima Al-Sayed", country: "Egypt", flag: "🇪🇬" },
  { name: "Oliver Brown", country: "Australia", flag: "🇦🇺" },
  { name: "Elena Petrova", country: "Russia", flag: "🇷🇺" },
  { name: "Diego Messi", country: "Argentina", flag: "🇦🇷" },
  { name: "Isabella Jones", country: "Canada", flag: "🇨🇦" },
  { name: "Youssef Hassan", country: "Morocco", flag: "🇲🇦" }
];

export const getRandomBotIdentity = () => {
  return BOT_IDENTITIES[Math.floor(Math.random() * BOT_IDENTITIES.length)];
};

/**
 * Intelligent Move Calculator for Ludo Bot
 */
export const calculateBestBotMove = (
  validTokens: Token[], 
  diceValue: number, 
  allPlayers: Player[], 
  botPlayerIndex: number
): Token => {
  if (validTokens.length === 1) return validTokens[0];

  const botPlayer = allPlayers[botPlayerIndex];
  
  const scoredMoves = validTokens.map(token => {
    let score = 0;
    const currentDist = token.distanceTraveled;
    const targetDist = token.state === TokenState.HOME ? 0 : currentDist + diceValue;
    const targetAbsPos = (targetDist + START_POSITIONS[token.color]) % 52;

    // 1. Priority: Kill an opponent piece (Aggressive Bot)
    allPlayers.forEach((p, pIdx) => {
      if (pIdx === botPlayerIndex) return;
      p.tokens.forEach(otherT => {
        if (otherT.state === TokenState.PATH) {
          const otherAbsPos = (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52;
          if (otherAbsPos === targetAbsPos && !SAFE_SPOTS.includes(targetAbsPos)) {
            score += 200; // Major priority to kill
          }
        }
      });
    });

    // 2. Priority: Reaching Home
    if (targetDist === 56) score += 150;

    // 3. Priority: Entering Home Lane
    if (targetDist > 51 && currentDist <= 51) score += 100;

    // 4. Priority: Moving to a safe spot
    if (SAFE_SPOTS.includes(targetAbsPos)) score += 60;

    // 5. Priority: Escape a threat (If opponent is behind)
    allPlayers.forEach((p, pIdx) => {
      if (pIdx === botPlayerIndex) return;
      p.tokens.forEach(otherT => {
        if (otherT.state === TokenState.PATH) {
          const currentAbsPos = (currentDist + START_POSITIONS[token.color]) % 52;
          const otherAbsPos = (otherT.distanceTraveled + START_POSITIONS[otherT.color]) % 52;
          const distanceBehind = (currentAbsPos - otherAbsPos + 52) % 52;
          if (distanceBehind > 0 && distanceBehind <= 6) {
             score += 80; // Try to move threatened piece
          }
        }
      });
    });

    // 6. Priority: Releasing from home
    if (token.state === TokenState.HOME && diceValue === 6) score += 90;

    // 7. Small priority for distance (favor pieces closer to home)
    score += currentDist;

    return { token, score };
  });

  // Sort by score and pick the best
  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0].token;
};
