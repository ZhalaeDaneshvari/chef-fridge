import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  title: string;
  ingredients: string[];
  instructions: string;
  nutrition: NutritionInfo;
}

export const getNutritionInfo = async (itemName: string, quantity: string): Promise<NutritionInfo> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Estimate the nutritional information for ${quantity} of ${itemName}. Provide the response in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER }
        },
        required: ["calories", "protein", "carbs", "fat"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateRecipes = async (
  ingredients: string[], 
  preferences: { likes: string[], dislikes: string[], dietaryRestrictions: string[] },
  savedRecipes: string[] = []
): Promise<Recipe[]> => {
  const savedContext = savedRecipes.length > 0 
    ? `The user has previously saved these recipes: ${savedRecipes.join(", ")}. Use these as inspiration for their taste profile.`
    : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 3 recipes using some or all of these ingredients: ${ingredients.join(", ")}. 
    User preferences: Likes ${preferences.likes.join(", ")}, Dislikes ${preferences.dislikes.join(", ")}, Dietary Restrictions ${preferences.dietaryRestrictions.join(", ")}.
    ${savedContext}
    Provide the response as an array of recipe objects.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.STRING },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              },
              required: ["calories", "protein", "carbs", "fat"]
            }
          },
          required: ["title", "ingredients", "instructions", "nutrition"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};
