import { GoogleGenAI, Type } from "@google/genai";
import { getCachedConfigSync } from "./storageService";
import { ASSET_STATUSES } from "../types";

// Helper to generate a unique ID
const generateId = () => 'ast-' + Math.random().toString(36).substr(2, 9);

export const isAiConfigured = () => {
  try {
    return typeof process !== 'undefined' && process.env && !!process.env.API_KEY;
  } catch (e) {
    return false;
  }
};

export const parseAssetDescription = async (text: string): Promise<Partial<any>> => {
  if (!isAiConfigured()) {
    throw new Error("API Key is missing. AI features are disabled.");
  }

  // Use the sync cache as Gemini service needs immediate config and config is loaded at app boot
  const config = getCachedConfigSync();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an IT Asset Manager assistant for an F&B company 'EatX'.
    Extract asset details from the following text description.
    
    Current Date: ${new Date().toISOString().split('T')[0]}
    
    Configuration (Strictly use these values):
    - Categories: ${config.categories.join(', ')}
    - Locations: ${config.locations.join(', ')}
    - Statuses: ${ASSET_STATUSES.join(', ')}

    Rules:
    - Match 'category' to the closest value in the list above. If unsure, use 'Other'.
    - Match 'location' to the closest value in the list above.
    - If cost is mentioned, extract it. If not, omit it.
    - Extract 'assignedEmployee' if mentioned.
    - Extract 'supplier' or 'vendor' if mentioned (e.g. bought from Amazon).
    
    Input Text: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Short concise name of the asset" },
            description: { type: Type.STRING, description: "Detailed description" },
            category: { type: Type.STRING, description: "One of the configured categories" },
            status: { type: Type.STRING, description: "One of the configured statuses" },
            location: { type: Type.STRING, description: "One of the configured locations" },
            assignedEmployee: { type: Type.STRING, description: "Name of employee assigned" },
            serialNumber: { type: Type.STRING, description: "Serial number if mentioned" },
            supplier: { type: Type.STRING, description: "Vendor or supplier name" },
            purchaseCost: { type: Type.NUMBER, description: "Cost in AED" },
            purchaseDate: { type: Type.STRING, description: "ISO Date YYYY-MM-DD" },
          },
          required: ["name", "category", "status"],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        ...data,
        id: generateId(),
      };
    }
    return {};
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};
