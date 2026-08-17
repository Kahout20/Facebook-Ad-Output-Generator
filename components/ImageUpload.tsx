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
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-14 text-center transition-colors ${
          isDragging
            ? "border-brand bg-brand-light"
            : "border-line bg-surface hover:border-brand/50 hover:bg-brand-light/40"
        }`}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand transition-transform group-hover:scale-105">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4M12 4L7 9M12 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-display text-base font-semibold text-ink">
          Drag a product photo here
        </p>
        <p className="mt-1 text-sm text-muted">
          or{" "}
          <span className="font-medium text-brand underline-offset-2 group-hover:underline">
            browse your files
          </span>
        </p>
        <p className="mt-4 text-xs text-muted">
          JPG, PNG or WEBP · up to {formatMb(MAX_IMAGE_SIZE_BYTES)}
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
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
