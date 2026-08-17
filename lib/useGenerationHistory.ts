"use client";

import { useCallback, useEffect, useState } from "react";
import { AdCopyResult, GenerationHistoryEntry } from "./types";
import { clearGenerationHistory, getGenerationHistory, saveGeneration } from "./history";

/**
 * React wrapper around lib/history.ts. Starts with an empty array on both
 * server and first client render (so SSR output matches initial hydration),
 * then loads the real localStorage contents in an effect — this avoids
 * Next.js hydration mismatches.
 */
export function useGenerationHistory() {
  const [entries, setEntries] = useState<GenerationHistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(getGenerationHistory());
    setHydrated(true);
  }, []);

  const addEntry = useCallback((result: AdCopyResult) => {
    setEntries(saveGeneration(result));
  }, []);

  const clearAll = useCallback(() => {
    clearGenerationHistory();
    setEntries([]);
  }, []);

  return { entries, hydrated, addEntry, clearAll };
}