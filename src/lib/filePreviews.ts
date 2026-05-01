/**
 * @fileoverview Maps file types to preview-friendly assets/URLs.
 */

import type { KnownType } from "./files";

/**
 * Returns a preview URL for the given file type. Currently only URL types
 * return a preview (the URL itself); other types return undefined.
 * @param ext - The normalized file type label
 * @param src - The source URL for URL-type documents
 */
export function mapFileTypeToPreviewAsset(
  ext: KnownType,
  src?: string,
): string | undefined {
  if (ext === "URL") {
    const trimmed = src?.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
}
