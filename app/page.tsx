"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { MarketingSettingsForm } from "@/components/MarketingSettingsForm";
import { AdResults } from "@/components/AdResults";
import { RecentGenerations } from "@/components/RecentGenerations";
import { HistoryEntryModal } from "@/components/HistoryEntryModal";
import { useGenerationHistory } from "@/lib/useGenerationHistory";
import { fileToBase64 } from "@/lib/utils";
import {
  AdCopyResult,
  GenerateAdResponse,
  GenerationHistoryEntry,
  MarketingSettings,
} from "@/lib/types";

const DEFAULT_SETTINGS: MarketingSettings = {
  targetAudienceMode: "auto",
  customAudience: "",
  tone: "persuasive",
  language: "en",
  productName: "",
  keySellingPoint: "",
};

type GenerationState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<MarketingSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<GenerationState>("idle");
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<GenerationHistoryEntry | null>(null);

  const history = useGenerationHistory();

  const canGenerate = useMemo(() => {
    if (!file) return false;
    if (settings.targetAudienceMode === "custom" && !settings.customAudience.trim()) return false;
    return true;
  }, [file, settings]);

  const handleFileSelected = useCallback((selected: File) => {
    setFile(selected);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
    setResult(null);
    setState("idle");
    setGenerateError(null);
  }, []);

  const handleClearImage = useCallback(() => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setState("idle");
    setGenerateError(null);
  }, []);

  const runGeneration = useCallback(
    async (isRegenerate: boolean) => {
      if (!file) return;

      isRegenerate ? setRegenerating(true) : setState("loading");
      setGenerateError(null);

      try {
        const imageBase64 = await fileToBase64(file);
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            mimeType: file.type,
            settings,
          }),
        });

        const data: GenerateAdResponse = await res.json();

        if (!data.ok) {
          setState("error");
          setGenerateError(data.error);
          return;
        }

        history.addEntry(data.result);
        setResult(data.result);
        setState("success");
      } catch {
        setState("error");
        setGenerateError("Network error. Please check your connection and try again.");
      } finally {
        setRegenerating(false);
      }
    },
    [file, settings, history]
  );

  const handleGenerate = () => runGeneration(false);
  const handleRegenerate = () => runGeneration(true);

  const handleGenerateAnother = () => {
    handleClearImage();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
          </svg>
          AI-powered
        </p>
        <h1 className="bg-gradient-to-r from-accent via-ink to-brand bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          AI Facebook Ad Copy Generator
        </h1>
        <p className="mt-2 max-w-xl text-base text-muted">
          Upload a product image to instantly generate compelling Facebook ad variations.
        </p>
      </header>

      <div className="space-y-6">
        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="sr-only">
            Upload a product image
          </h2>
          <ImageUpload
            previewUrl={previewUrl}
            onFileSelected={handleFileSelected}
            onClear={handleClearImage}
            error={uploadError}
            setError={setUploadError}
          />
        </section>

        {file && state !== "success" && (
          <>
            <MarketingSettingsForm settings={settings} onChange={setSettings} />

            <div className="rounded-xl2 border border-line bg-surface p-5 shadow-card sm:p-6">
              {generateError && (
                <p role="alert" className="mb-4 text-sm font-medium text-danger">
                  {generateError}
                </p>
              )}
              <button
                type="button"
                disabled={!canGenerate || state === "loading"}
                onClick={handleGenerate}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white shadow-pop transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
              >
                {state === "loading" ? (
                  <>
                    <span className="h-2 w-2 animate-pulseSoft rounded-full bg-white" />
                    Generating…
                  </>
                ) : (
                  "Generate Facebook Ad"
                )}
              </button>
              {state === "loading" && (
                <p className="mt-3 text-xs text-muted">
                  Gemini is analyzing your product image — this usually takes a few seconds.
                </p>
              )}
            </div>
          </>
        )}

        {state === "success" && result && previewUrl && (
          <AdResults
            result={result}
            imagePreviewUrl={previewUrl}
            onRegenerate={handleRegenerate}
            onGenerateAnother={handleGenerateAnother}
            regenerating={regenerating}
          />
        )}

        <RecentGenerations
          entries={history.entries}
          hydrated={history.hydrated}
          onView={setViewingEntry}
          onClear={history.clearAll}
        />
      </div>

      <HistoryEntryModal entry={viewingEntry} onClose={() => setViewingEntry(null)} />
    </main>
  );
}
