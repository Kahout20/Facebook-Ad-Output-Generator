import { NextRequest, NextResponse } from "next/server";
import {
  generateAdCopy,
  GeminiConfigError,
  GeminiParseError,
  GeminiRequestError,
} from "@/lib/gemini";
import {
  ACCEPTED_IMAGE_TYPES,
  GenerateAdRequestBody,
  GenerateAdResponse,
  MAX_IMAGE_SIZE_BYTES,
  MarketingSettings,
} from "@/lib/types";

export const runtime = "nodejs";

function jsonError(message: string, status: number): NextResponse<GenerateAdResponse> {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isValidSettings(settings: unknown): settings is MarketingSettings {
  if (typeof settings !== "object" || settings === null) return false;
  const s = settings as Record<string, unknown>;
  return (
    (s.targetAudienceMode === "auto" || s.targetAudienceMode === "custom") &&
    typeof s.customAudience === "string" &&
    ["persuasive", "friendly", "urgent", "premium"].includes(s.tone as string) &&
    (s.language === "sl" || s.language === "en") &&
    typeof s.productName === "string" &&
    typeof s.keySellingPoint === "string"
  );
}

// Rough base64 -> byte size check without decoding the whole payload.
function estimateBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

export async function POST(req: NextRequest) {
  let body: GenerateAdRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("The request body was not valid JSON.", 400);
  }

  const { imageBase64, mimeType, settings } = body ?? {};

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return jsonError("No image was provided.", 400);
  }

  if (!mimeType || !ACCEPTED_IMAGE_TYPES.includes(mimeType as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return jsonError("Unsupported image format. Use JPG, PNG, or WEBP.", 400);
  }

  if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_SIZE_BYTES) {
    return jsonError("The image is too large. Please use a file under 8MB.", 400);
  }

  if (!isValidSettings(settings)) {
    return jsonError("Marketing settings were missing or invalid.", 400);
  }

  if (settings.targetAudienceMode === "custom" && !settings.customAudience.trim()) {
    return jsonError("Please describe your target audience, or switch to Auto.", 400);
  }

  try {
    const result = await generateAdCopy(imageBase64, mimeType, settings);
    return NextResponse.json({ ok: true, result } satisfies GenerateAdResponse);
  } catch (err) {
    // Never leak provider error details, stack traces, or config state to
    // the client — log server-side, return a clean generic message.
    console.error("[api/generate]", err);

    if (err instanceof GeminiConfigError) {
      return jsonError(
        "The ad generator is not configured yet. Please contact the site owner.",
        500
      );
    }
    if (err instanceof GeminiParseError) {
      return jsonError(
        "The AI response could not be understood. Please try Regenerate.",
        502
      );
    }
    if (err instanceof GeminiRequestError) {
      return jsonError(
        "The AI service is unavailable right now. Please try again in a moment.",
        502
      );
    }
    return jsonError("Something went wrong while generating your ad.", 500);
  }
}
