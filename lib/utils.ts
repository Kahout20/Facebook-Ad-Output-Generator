/** Reads a File as a base64 string (no "data:...;base64," prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/** Fetches a same-origin image URL (e.g. a demo product) and returns it as a File. */
export async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  // Use the blob's real content type rather than guessing — the placeholder
  // demo images ship as SVG (which the generator intentionally rejects,
  // since it isn't a real product photo); once replaced with a real JPG/PNG
  // this resolves correctly on its own.
  return new File([blob], filename, { type: blob.type });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
