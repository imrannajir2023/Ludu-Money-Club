
import { GoogleGenAI } from "@google/genai";

const FALLBACK_COMMENTARIES = [
  "What a move! The crowd is going wild! 🎲",
  "Strategy at its finest! 🧠🔥",
  "Did you see that? Unbelievable! 😱⚡",
  "The tension is rising in the arena! 🏟️✨",
  "Calculated. Precise. Masterful. 🎯🙌",
  "A bold play that might just pay off! 🚀💎",
  "The dice are dancing in their favor today! 🎲💃",
  "Classic Ludo brilliance! 🌟👑"
];

/**
 * Generates a short esports commentary for a game event using Gemini AI.
 * Includes a local fallback system to handle quota limits or API failures.
 */
export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are an energetic esports commentator for a high-stakes Ludo game.
      The player "${playerName}" just performed this action: "${eventDescription}".
      Generate a very short, witty, excited 1-sentence comment about this. 
      Use emojis.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text?.trim() || FALLBACK_COMMENTARIES[Math.floor(Math.random() * FALLBACK_COMMENTARIES.length)];
  } catch (error: any) {
    // Log the error but don't crash the app
    console.warn("Gemini Commentary Fallback Triggered:", error?.message || error);
    
    // Check if it's a quota issue (429) or other API error
    return FALLBACK_COMMENTARIES[Math.floor(Math.random() * FALLBACK_COMMENTARIES.length)];
  }
};
