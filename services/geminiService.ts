
import { GoogleGenAI } from "@google/genai";

/**
 * Generates a short esports commentary for a game event using Gemini AI.
 * Strictly follows the SDK initialization guidelines using process.env.API_KEY.
 */
export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are an energetic esports commentator for a high-stakes Ludo game.
      The player "${playerName}" just performed this action: "${eventDescription}".
      Generate a very short, witty, excited 1-sentence comment about this. 
      Use emojis.
    `;

    // Using gemini-3-flash-preview for basic text task as recommended.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Directly access .text property from GenerateContentResponse.
    return response.text?.trim() || "Amazing play!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great move!";
  }
};
