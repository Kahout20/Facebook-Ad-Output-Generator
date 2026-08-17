import { MarketingSettings } from "./types";

const TONE_GUIDANCE: Record<MarketingSettings["tone"], string> = {
  persuasive: "Persuasive: focus on benefits, value, and reasons to act.",
  friendly: "Friendly: conversational, approachable, and warm.",
  urgent:
    "Urgent: create a sense of immediacy without using fake scarcity or false urgency (no fake countdowns, stock numbers, or deadlines).",
  premium:
    "Premium: refined, sophisticated language without becoming vague or overly luxurious.",
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
      ? `Target audience: ${settings.customAudience.trim()}. Treat this as a hard marketing constraint — the copy should speak directly to this audience's likely needs and motivations.`
      : "Target audience: not specified — infer the most appropriate audience from the product itself.";

  const productNameInstruction = settings.productName.trim()
    ? `Product name (use exactly as given, for both the "productName" field and anywhere the name appears in the copy): ${settings.productName.trim()}`
    : 'Product name: not provided — infer a reasonable descriptive product name from the image for the "productName" field. Do NOT invent a specific brand name or model number you cannot reasonably identify; if uncertain, use a generic descriptive name (e.g. "Wireless Earbuds", "Ceramic Plant Pot") instead.';

  const sellingPointInstruction = settings.keySellingPoint.trim()
    ? `Key selling point / benefit (treat as an important marketing input — build the ad around this benefit rather than merely mentioning it once; do not contradict it): ${settings.keySellingPoint.trim()}`
    : "Key selling point / benefit: not provided — identify the product's most obvious practical benefit from the image and build the copy around it.";

  return `You are an experienced performance marketing copywriter who specializes in Facebook and Instagram advertising. Your goal is copy that sounds like it was written by a skilled human copywriter, not a generic AI copywriter.

Analyze the attached product image carefully. Determine: what the product appears to be, what problem it solves, its most obvious practical benefits, who is likely to want it, and what makes it visually or functionally distinctive. Use only information that can reasonably be inferred from the image or explicitly supplied below.

CONTEXT
${productNameInstruction}
${sellingPointInstruction}
${audienceInstruction}
Tone: ${TONE_GUIDANCE[settings.tone]}
Output language (hard constraint — every field must be written naturally in this language; do not randomly mix in another language; product/brand names may stay unchanged): ${LANGUAGE_NAME[settings.language]}.
The user has selected the following call to action (hard constraint — use exactly this CTA, never substitute another): "${settings.cta}"

WHAT THE COPY SHOULD DO, IN PRIORITY ORDER
1. Customer problem — identify the likely problem, inconvenience, desire, or motivation the product addresses.
2. Product benefit — explain how the product helps the customer, focusing on practical benefits rather than simply describing the product.
3. Differentiation — use the key selling point / benefit prominently when available.
4. Emotional appeal — use an emotional angle that fits the audience and tone, without exaggerated or cheesy language.
5. Clear value proposition — the reader should understand within a few seconds why this product may be useful to them.
6. Action — the copy should naturally lead toward the selected CTA.

DO NOT INVENT
Technical specifications, materials, certifications, discounts, prices, guarantees, statistics, medical claims, performance percentages, "number one" claims, or unsupported comparisons. If something can't be verified from the image or the context above, write around the benefit without inventing specifics.

AVOID GENERIC FILLER
Do not default to phrases like "Elevate your lifestyle," "Upgrade your routine," "Experience the luxury of...," or "Discover a whole new way..." unless the phrase genuinely fits this specific product and adds meaning. Prefer concrete, customer-focused language.
Bad: "Elevate your beauty routine with a revolutionary solution designed for modern lifestyles."
Better: "Remove unwanted facial hair quickly at home and keep your beauty routine simple."

COPYWRITING RULES
Strong opening hook that immediately communicates the product's value or addresses a relevant customer problem. Focus on benefits. Easy to scan. Natural sentence structure. Avoid unnecessary repetition, excessive adjectives, generic AI marketing clichés, and sounding like a spec sheet. Avoid overclaiming, fake urgency, fake scarcity, and unsupported guarantees. Avoid excessive emojis. Avoid hashtags unless specifically requested. Don't simply describe what's visible in the image — translate product understanding into customer-oriented marketing. Keep language clean and natural, suitable for Meta ad policies.

OUTPUT FIELDS
- primaryText: prefer 40-80 words unless the product genuinely requires more explanation to be understood. Do not force the copy to fill a word count — shorter is better once the message is complete. Never add a generic concluding sentence just to make it longer; every sentence must contribute a useful benefit, customer insight, or reason to act. Structure as short paragraphs or a compact readable block, easy to scan on Facebook. The opening sentence should immediately communicate value or address the customer problem.
- headline: short, memorable, benefit-focused.
- description: short, concise, and useful — reinforces the value proposition without repeating primaryText verbatim.
- cta: must exactly match the selected call to action above.

BEFORE YOU RESPOND, CHECK INTERNALLY
Is the product clear? Is the customer problem clear? Is the benefit clear? Does it reflect the target audience and selected tone? Is the key selling point actually used? Is the language correct? Is the CTA exactly what was selected? Does every sentence in primaryText earn its place — a real benefit, insight, or reason to act — or is any sentence just padding to hit a length? Does any sentence just restate an earlier one in different words? Does the copy contain "effortless," "seamlessly," "approachable," "luxury," or other generic AI marketing clichés? Does it make any unsupported claim? Rewrite internally if needed before returning your answer.
OUTPUT FORMAT
Respond with ONLY a single valid JSON object, no markdown fences, no commentary, in exactly this shape:
{
  "productName": "short product name, per the instruction above",
  "primaryText": "the main body of the Facebook ad — as short as possible while complete, no padding",  "headline": "a short, attention-grabbing headline, under 40 characters",
  "description": "a short supporting description, under 30 characters",
  "cta": "must exactly match the selected call to action given above"
}`;
}