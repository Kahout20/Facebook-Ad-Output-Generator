import { AdCopyResult, GenerationHistoryEntry, HISTORY_LIMIT } from "./types";

// ---------------------------------------------------------------------------
// Generation history — client-side localStorage persistence for the MVP.
//
// IMPORTANT (see TECHNICAL_SPECIFICATION.md > Recent Generations): this is
// intentionally simple for the assessment. It is per-browser only — no
// database, no auth. A production implementation would associate history
// with authenticated users and store it server-side.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "fbAdGenerator.generationHistory";
// Checks whether window and localStorage are available before any browser-only storage operation,
// preventing errors when this code is executed during Next.js server-side rendering.
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
// Type guard that validates unknown localStorage data against the GenerationHistoryEntry shape,
// filtering out corrupted or outdated entries before they are used by the application.
function isValidEntry(value: unknown): value is GenerationHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.productName === "string" &&
    typeof e.headline === "string" &&
    typeof e.primaryText === "string" &&
    typeof e.description === "string" &&
    typeof e.cta === "string" &&
    typeof e.timestamp === "number"
  );
}

/** Reads generation history from localStorage. Safe to call on the server (returns []) and tolerant of malformed/missing data. */
export function getGenerationHistory(): GenerationHistoryEntry[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidEntry);
  } catch {
    // Malformed JSON or inaccessible storage — treat as empty rather than throwing.
    return [];
  }
}

/** Adds a new entry to the front of the history, trimming to HISTORY_LIMIT. No-op on the server. */
export function saveGeneration(result: AdCopyResult): GenerationHistoryEntry[] {
  if (!isBrowser()) return [];

  const entry: GenerationHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productName: result.productName,
    headline: result.headline,
    primaryText: result.primaryText,
    description: result.description,
    cta: result.cta,
    timestamp: Date.now(),
  };

  const next = [entry, ...getGenerationHistory()].slice(0, HISTORY_LIMIT);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable — history just won't persist this time.
  }

  return next;
}

/** Clears all stored generation history. No-op on the server. */
export function clearGenerationHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing meaningful to recover from here.
  }
}

/** Formats a timestamp as a short relative label ("Just now", "5 min ago", "1 hour ago", ...). */
export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}