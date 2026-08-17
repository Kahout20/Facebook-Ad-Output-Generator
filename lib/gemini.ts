import { GoogleGenAI } from "@google/genai";
import { AdCopyResult, MarketingSettings } from "./types";
import { buildAdCopyPrompt } from "./prompt";

// gemini-3.6-flash: current stable multimodal model — reads the product
// image and writes the JSON ad copy in one call.
const MODEL_NAME = "gemini-3.6-flash";

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}
export class GeminiParseError extends Error {}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Never leak this detail to the client — the API route maps this to a
    // generic message. It's thrown with a specific type only so server
    // logs are useful.
    throw new GeminiConfigError("GEMINI_API_KEY is not set on the server.");
  }
  return new GoogleGenAI({ apiKey });
}

/** Strips ```json fences etc. in case the model doesn't obey the "no markdown" instruction. */
function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function parseAdCopyResponse(raw: string): AdCopyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(raw));
  } catch {
    throw new GeminiParseError("Gemini did not return valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new GeminiParseError("Gemini response was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;
  const { productName, primaryText, headline, description, cta } = obj;

  if (
    typeof primaryText !== "string" ||
    typeof headline !== "string" ||
    typeof description !== "string" ||
    typeof cta !== "string" ||
    !primaryText.trim() ||
    !headline.trim() ||
    !description.trim() ||
    !cta.trim()
  ) {
    throw new GeminiParseError("Gemini response is missing required fields.");
  }

  // productName is treated as best-effort: fall back to a generic label
  // rather than failing the whole generation if Gemini omits it.
  const normalizedProductName =
    typeof productName === "string" && productName.trim()
      ? productName.trim()
      : "Uploaded Product";

  return {
    productName: normalizedProductName,
    primaryText: primaryText.trim(),
    headline: headline.trim(),
    description: description.trim(),
    cta: cta.trim(),
  };
}

export async function generateAdCopy(
  imageBase64: string,
  mimeType: string,
  settings: MarketingSettings
): Promise<AdCopyResult> {
  const client = getClient();
  const prompt = buildAdCopyPrompt(settings);

  let responseText: string;
  try {
    const result = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }],
        },
      ],
    });
    responseText = result.text ?? "";
  } catch (err) {
    throw new GeminiRequestError(
      err instanceof Error ? err.message : "Unknown Gemini request failure."
    );
  }

  const parsed = parseAdCopyResponse(responseText);

  // The selected CTA always wins — Gemini is instructed to echo it back,
  // but we never trust that; the user's pill selection is authoritative.
  const withCta: AdCopyResult = { ...parsed, cta: settings.cta };

  // A user-supplied product name always takes priority over AI identification.
  if (settings.productName.trim()) {
    return { ...withCta, productName: settings.productName.trim() };
  }
  return withCta;
}