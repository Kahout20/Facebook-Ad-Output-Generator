// Core domain types shared between the frontend, the API route, and the
// Gemini integration layer.
// Shared type definitions and application-wide constants used by the frontend,
// API route, and Gemini integration. Defines the expected structure of marketing
// settings, generated ad results, and history entries, while constants such as
// CTA_OPTIONS, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, and HISTORY_LIMIT
// centralize supported values and validation limits so different parts of the
// application use the same data shapes and rules.
export type TargetAudienceMode = "auto" | "custom";

export type Tone = "persuasive" | "friendly" | "urgent" | "premium";

export type Language = "sl" | "en";

export type CtaOption = "Shop Now" | "Learn More" | "Get Offer";

export interface MarketingSettings {
  targetAudienceMode: TargetAudienceMode;
  customAudience: string; // only used when targetAudienceMode === "custom"
  tone: Tone;
  language: Language;
  cta: CtaOption;
  productName: string; // optional, may be ""
  keySellingPoint: string; // optional, may be ""
}

export interface AdCopyResult {
  productName: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
}

export interface GenerationHistoryEntry {
  id: string;
  productName: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  timestamp: number;
}

export const HISTORY_LIMIT = 10;

export interface GenerateAdRequestBody {
  imageBase64: string; // raw base64, no data: prefix
  mimeType: string;
  settings: MarketingSettings;
}

export interface GenerateAdSuccessResponse {
  ok: true;
  result: AdCopyResult;
}

export interface GenerateAdErrorResponse {
  ok: false;
  error: string;
}

export type GenerateAdResponse =
  | GenerateAdSuccessResponse
  | GenerateAdErrorResponse;

export const CTA_OPTIONS: CtaOption[] = ["Shop Now", "Learn More", "Get Offer"];

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
