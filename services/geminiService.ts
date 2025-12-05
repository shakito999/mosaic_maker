import { GoogleGenAI, Type } from "@google/genai";
import { MosaicStyle, AnalysisData, PhysicalDimensions } from "../types";

// Helper to extract the mime type from the data URL
const getMimeType = (base64: string): string => {
  const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  return match ? match[1] : 'image/jpeg'; // Default to jpeg if not found
};

// Helper to strip the data:image prefix if present
const cleanBase64 = (base64: string): string => {
  if (base64.includes(',')) {
      return base64.split(',')[1];
  }
  return base64;
};

const getStylePrompt = (style: MosaicStyle): string => {
  switch (style) {
    case MosaicStyle.ROMAN_CLASSIC:
      return "Roman mosaic style, earthy tones, uniform square tesserae, traditional andamento flow. Classic antiquity aesthetic.";
    case MosaicStyle.BYZANTINE_ICON:
      return "Byzantine icon mosaic style, gold leaf background, deep blues, rich reds, spiritual atmosphere. Detailed facial features.";
    case MosaicStyle.MODERN_ABSTRACT:
      return "Modern abstract mosaic style, vibrant smalti glass, misshapen tesserae, expressive flow, contemporary art style.";
    case MosaicStyle.NATURAL_STONE:
      return "Natural stone mosaic style, marble, slate, granite, greyscale, rough texture, organic placement.";
    default:
      return "Mosaic art style";
  }
};

export const generateMosaicImage = async (
  apiKey: string,
  imageBase64: string,
  style: MosaicStyle,
  dimensions: PhysicalDimensions
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Using 'gemini-2.5-flash-image' 
  const model = "gemini-2.5-flash-image";
  const mimeType = getMimeType(imageBase64);
  const cleanData = cleanBase64(imageBase64);

  // Construct a prompt that incorporates the physical size to influence "resolution" (tile density)
  const sizeString = `${dimensions.width} ${dimensions.unit} by ${dimensions.height} ${dimensions.unit}`;
  
  const prompt = `Transform this image into a professional mosaic design.
  
  Physical Scale: The final piece is intended to be ${sizeString}. 
  Tile Density: Adjust the size of the tesserae (tiles) to be realistic for a ${sizeString} artwork.
  - If the size is large (e.g., 100cm+), use many small tiles for high detail.
  - If the size is small (e.g., 20cm), use fewer, larger tiles for a coarser look.
  
  Style: ${getStylePrompt(style)}.
  
  Please output the visual mosaic design.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanData,
            },
          },
          { text: prompt },
        ],
      },
    });

    const candidate = response.candidates?.[0];

    // Check for safety blockage
    if (candidate?.finishReason === 'SAFETY') {
        throw new Error("Generation blocked by safety filters. Please try a different image.");
    }

    // Extract the image from the response
    let textOutput = "";
    for (const part of candidate?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
      if (part.text) {
          textOutput += part.text;
      }
    }
    
    // If we got text but no image, throw the text as the error
    if (textOutput) {
        throw new Error(`Gemini returned text instead of an image: "${textOutput.substring(0, 100)}..."`);
    }
    
    throw new Error(`No image data received. Status: ${candidate?.finishReason || 'UNKNOWN'}`);

  } catch (error: any) {
    console.error("Gemini Image Gen Error:", error);
    if (error.message && (error.message.includes("Safety") || error.message.includes("text instead of"))) {
        throw error;
    }
    throw new Error("The model failed to generate an image. Please try again or use a different photo.");
  }
};

export const analyzeMosaicMaterials = async (
  apiKey: string,
  imageBase64: string,
  style: MosaicStyle,
  dimensions: PhysicalDimensions
): Promise<AnalysisData> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash"; 
  const mimeType = getMimeType(imageBase64);
  const cleanData = cleanBase64(imageBase64);

  const sizeString = `${dimensions.width} ${dimensions.unit} by ${dimensions.height} ${dimensions.unit}`;

  const prompt = `Analyze this image as a reference for a ${style} mosaic project.
  The intended physical size is ${sizeString}.
  
  Provide a JSON output estimating the materials needed.
  
  For 'estimatedTesseraeCount', calculate the approximate number of tiles needed for a ${sizeString} area, assuming standard tesserae size (approx 1.5cm²) plus spacing.
  
  Return ONLY valid JSON.
  
  Schema:
  {
    "materials": [
      { "name": "Material Name (e.g. Carrara Marble)", "percentage": number, "color": "Hex Code" }
    ],
    "estimatedTesseraeCount": number,
    "complexityScore": number (1-10)
  }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanData,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          materials: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                percentage: { type: Type.NUMBER },
                color: { type: Type.STRING },
              }
            }
          },
          estimatedTesseraeCount: { type: Type.NUMBER },
          complexityScore: { type: Type.NUMBER }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No analysis text returned");
  
  try {
      const data = JSON.parse(text) as AnalysisData;
      // Inject dimensions into the result for display purposes
      return { ...data, dimensions };
  } catch (e) {
      console.error("Failed to parse JSON", text);
      throw new Error("Analysis failed: Invalid JSON response");
  }
};