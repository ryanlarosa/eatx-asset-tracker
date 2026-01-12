
// Fix: Updated model to gemini-3-pro-preview for complex reasoning tasks as per guidelines
import { GoogleGenAI, Type } from "@google/genai";
import { getCachedConfigSync } from "./storageService";
import { ASSET_STATUSES } from "../types";

// Helper to generate a unique ID
const generateId = () => 'ast-' + Math.random().toString(36).substr(2, 9);

export const isAiConfigured = () => {
  try {
    // API key is a hard requirement as per guidelines
    return !!process.env.API_KEY;
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
    You are an AI assistant for 'EatX IT Hub', a complete IT operations platform.
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
      // Upgraded to gemini-3-pro-preview for complex text tasks involving reasoning/extraction
      model: 'gemini-3-pro-preview',
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

    // Safely extract text output from response
    const jsonStr = response.text?.trim();
    if (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        return {
          ...data,
          id: generateId(),
        };
      } catch (parseErr) {
        console.error("Failed to parse Gemini JSON output:", parseErr);
        throw new Error("Invalid response format from AI.");
      }
    }
    return {};
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};