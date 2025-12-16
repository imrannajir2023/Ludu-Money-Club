import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateGameCommentary = async (eventDescription: string, playerName: string): Promise<string> => {
  const client = getClient();
  if (!client) return "What a move!";

  try {
    const model = client.models;
    const prompt = `
      You are an energetic esports commentator for a high-stakes Ludo game.
      The player "${playerName}" just performed this action: "${eventDescription}".
      Generate a very short, witty, excited 1-sentence comment about this. 
      Use emojis.
    `;

    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed
      }
    });

    return response.text?.trim() || "Amazing play!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great move!";
  }
};