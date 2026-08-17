"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/types";

interface ImageUploadProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  error: string | null;
  setError: (message: string | null) => void;
}
// Pure helper that formats byte counts for display using the shared MAX_IMAGE_SIZE_BYTES limit.
function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export function ImageUpload({
  previewUrl,
  onFileSelected,
  onClear,
  error,
  setError,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


// Validates selected files using constants from lib/types.ts, then passes valid files to the parent via onFileSelected.
  const validateAndUse = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
        setError("That file type isn't supported. Please use JPG, PNG, or WEBP.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError(`That image is too large. Please use a file under ${formatMb(MAX_IMAGE_SIZE_BYTES)}.`);
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected, setError]
  );
//he rest of the component is conditional JSX: if `previewUrl` is set, it renders the uploaded-image preview with a "Remove" button; otherwise it renders the empty dashed-border drop zone with the upload icon and instructions.
  if (previewUrl) {
    return (
      <div className="animate-fadeUp">
        <div className="relative overflow-hidden rounded-xl2 border border-line bg-surface shadow-card">
          <div className="relative aspect-[4/3] w-full bg-brand-light">
            <Image
              src={previewUrl}
              alt="Uploaded product"
              fill
              className="object-contain p-6"
              unoptimized
            />
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <span className="text-sm text-muted">Image ready</span>
            <button
              type="button"
              onClick={onClear}
              className="focus-ring rounded-md px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-brand/60" aria-hidden="true" />
        <span className="absolute right-4 top-6 h-1 w-1 rounded-full bg-brand/40" aria-hidden="true" />
        <span className="absolute bottom-5 left-6 h-1 w-1 rounded-full bg-brand/40" aria-hidden="true" />
        <span className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-brand/60" aria-hidden="true" />
        <label
          htmlFor="product-image-input"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            validateAndUse(e.dataTransfer.files?.[0]);
          }}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-16 text-center transition-colors ${
            isDragging
              ? "border-brand bg-brand-light"
              : "border-brand/30 bg-surface hover:border-brand/60 hover:bg-brand-light/40"
          }`}
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-brand shadow-pop transition-transform group-hover:scale-105">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 15V6M12 6l-3.5 3.5M12 6l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.5 15.5A3.5 3.5 0 017 8.6 5 5 0 0116.9 10 3.5 3.5 0 0117.5 17H7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="font-display text-xl font-bold text-ink">Turn your product into an ad</p>
          <p className="mt-1.5 text-sm text-muted">Drop your product image here or browse your files</p>
          <p className="mt-4 text-sm text-muted">
            <span className="font-medium text-brand underline-offset-2 group-hover:underline">
              Browse files
            </span>
            . JPG, PNG or WEBP. Up to {formatMb(MAX_IMAGE_SIZE_BYTES)}.
          </p>
          <input
            ref={inputRef}
            id="product-image-input"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => validateAndUse(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
