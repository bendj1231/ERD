import { GoogleGenAI, Type } from "@google/genai";
import { Table, Relationship, Field } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert database architect. 
Your goal is to generate a database schema based on the user's description.
Return a JSON object containing a list of 'tables' and 'relationships'.
Each table should have a sensible list of fields with types (INT, VARCHAR, TEXT, BOOLEAN, DATE, TIMESTAMP, DECIMAL, UUID).
IMPORTANT: Provide a brief 'description' for each table explaining its purpose.
IMPORTANT: Provide a brief 'description' for complex fields if necessary.
Position the tables (x, y) so they are spread out in a visually pleasing, non-overlapping layout (approx 0-800 range).
`;

export const generateSchemaFromPrompt = async (prompt: string): Promise<{ tables: Table[], relationships: Relationship[] }> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  fields: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        type: { type: Type.STRING }, // FieldType enum as string
                        isPrimaryKey: { type: Type.BOOLEAN },
                        isForeignKey: { type: Type.BOOLEAN },
                        isNullable: { type: Type.BOOLEAN },
                        description: { type: Type.STRING }
                      },
                      required: ["id", "name", "type", "isPrimaryKey", "isForeignKey", "isNullable"]
                    }
                  }
                },
                required: ["id", "name", "x", "y", "fields"]
              }
            },
            relationships: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sourceTableId: { type: Type.STRING },
                  targetTableId: { type: Type.STRING },
                  cardinality: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ["id", "sourceTableId", "targetTableId", "cardinality"]
              }
            }
          },
          required: ["tables", "relationships"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as { tables: Table[], relationships: Relationship[] };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};