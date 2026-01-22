
import { GoogleGenAI } from "@google/genai";

// Safe access to API KEY for browser environments
const getApiKey = () => {
  try {
    return process.env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "Great move! 🔥";

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
