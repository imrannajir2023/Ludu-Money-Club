
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  try {
    // Check if process and process.env exist safely
    return (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : "";
  } catch (e) {
    return "";
  }
};

export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "Great move! 🔥";

    const ai = new GoogleGenAI({ apiKey });
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

    return response.text?.trim() || "Amazing play!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great move!";
  }
};
