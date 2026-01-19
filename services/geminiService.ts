
import { GoogleGenAI } from "@google/genai";

// Always use the required initialization with a named parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  try {
    const prompt = `
      You are an energetic esports commentator for a high-stakes Ludo game.
      The player "${playerName}" just performed this action: "${eventDescription}".
      Generate a very short, witty, excited 1-sentence comment about this. 
      Use emojis.
    `;

    // Use ai.models.generateContent with the correct Gemini 3 model name
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed for real-time commentary
      }
    });

    // Access the .text property directly as per the latest SDK
    return response.text?.trim() || "Amazing play!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great move!";
  }
};
