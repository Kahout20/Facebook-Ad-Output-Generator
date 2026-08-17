import { MarketingSettings } from "./types";

const TONE_GUIDANCE: Record<MarketingSettings["tone"], string> = {
  persuasive:
    "Persuasive: emphasize concrete benefits and a clear reason to act now, without hype.",
  friendly:
    "Friendly: warm, conversational, approachable — like a helpful recommendation from a friend.",
  urgent:
    "Urgent: convey timeliness and momentum. Do not invent fake countdowns, stock numbers, or deadlines.",
  premium:
    "Premium: confident, polished, quality-first language. Avoid discount or bargain framing.",
};

const LANGUAGE_NAME: Record<MarketingSettings["language"], string> = {
  sl: "Slovenian",
  en: "English",
};

/**
 * Builds the instruction text sent to Gemini alongside the product image.
 * Keeping this in one place makes the AI's behavior auditable and easy to
 * tune without touching the API route or the frontend.
 */
export function buildAdCopyPrompt(settings: MarketingSettings): string {
  const audienceInstruction =
    settings.targetAudienceMode === "custom" && settings.customAudience.trim()
      ? `Target audience: ${settings.customAudience.trim()}`
      : "Target audience: not specified — infer a reasonable target audience from the product image itself.";

  const productNameInstruction = settings.productName.trim()
    ? `Product name (use exactly as given, for both the "productName" field and anywhere the name appears in the copy): ${settings.productName.trim()}`
    : 'Product name: not provided — identify a short, natural product name from the image for the "productName" field. Do NOT invent a specific brand or model name you cannot reasonably determine from the image; if uncertain, use a generic descriptive name (e.g. "Wireless Earbuds", "Ceramic Plant Pot") instead.';

  const sellingPointInstruction = settings.keySellingPoint.trim()
    ? `Key selling point to foreground (use it, do not contradict it): ${settings.keySellingPoint.trim()}`
    : "Key selling point: not provided — infer 1-2 believable benefits from what is visible in the image.";

  return `You are an experienced performance marketing copywriter who specializes in Facebook and Instagram advertising.

Look at the attached product image and write Facebook/Instagram ad copy for it.

CONTEXT
${productNameInstruction}
${sellingPointInstruction}
${audienceInstruction}
Tone: ${TONE_GUIDANCE[settings.tone]}
Output language: ${LANGUAGE_NAME[settings.language]}. Write ALL fields in this language.

RULES
- Focus on customer benefits, not a literal description of the photo.
- Be persuasive but believable and specific.
- Do NOT invent statistics, discounts, prices, guarantees, certifications, or claims that cannot reasonably be inferred from the image and the context above.
- Do NOT make medical, financial, or other regulated/unsupported claims.
- Do NOT use misleading advertising claims.
- Keep language clean and natural, suitable for Meta ad policies.
- The "cta" field must be one of exactly: "Shop Now", "Learn More", "Order Now", "Get Yours Today" — choose whichever fits best.

OUTPUT FORMAT
Respond with ONLY a single valid JSON object, no markdown fences, no commentary, in exactly this shape:
{
  "productName": "short product name, per the instruction above",
  "primaryText": "the main body of the Facebook ad, 2-4 sentences",
  "headline": "a short, attention-grabbing headline, under 40 characters",
  "description": "a short supporting description, under 30 characters",
  "cta": "one of the four allowed CTA values"
}`;
}
