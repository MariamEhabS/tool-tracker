/**
 * @fileoverview File type detection utilities. Determines the document type
 * label (e.g., "PDF", "JPG", "URL", "Folder") from file paths or row objects.
 */

export type TalihoRow = {
  __isFolder?: boolean;
  documentFile?: string;
  addedLink?: boolean;
};

const knownTypes = [
  "PDF",
  "DOC",
  "DOCX",
  "XLS",
  "XLSX",
  "CSV",
  "PNG",
  "JPG",
  "TXT",
  "ZIP",
  "MP4",
  "MOV",
] as const;
export type KnownType = (typeof knownTypes)[number] | "URL" | "FILE" | "Folder";

/**
 * Normalizes a raw file extension string to a known type label.
 * Maps "JPEG" to "JPG" and returns "FILE" for unrecognized extensions.
 * @param extRaw - Raw extension string (e.g., "pdf", "JPEG", "xlsx")
 */
export function normalizeExtensionLabel(extRaw: string): KnownType {
  const upper = (extRaw || "").toUpperCase();
  if (upper === "JPEG") return "JPG";
  if (knownTypes.includes(upper as (typeof knownTypes)[number]))
    return upper as KnownType;
  return "FILE";
}

/**
 * Determines the document type label from either a TalihoRow object or a
 * file path / URL string. Handles folders, added links, and file extensions.
 * @param input - A TalihoRow object or a file path / URL string
 * @returns The recognized file type label (e.g., "PDF", "URL", "Folder", "FILE")
 */
export function getDocTypeLabel(input: TalihoRow | string): KnownType {
  if (typeof input === "string") {
    const t = input;
    const ext =
      t.startsWith("http") && !/\.[a-zA-Z0-9]+$/.test(t)
        ? "URL"
        : (t.split(".").pop() || "").toUpperCase();
    if (ext === "URL") return "URL";
    return normalizeExtensionLabel(ext);
  }
  const r = input as TalihoRow;
  const isFolder = Boolean(r.__isFolder) || r.documentFile === "Folder";
  if (isFolder) return "Folder";
  if (r.addedLink === true) return "URL";
  const t = r.documentFile || "";
  const ext =
    t.startsWith("http") && !/\.[a-zA-Z0-9]+$/.test(t)
      ? "URL"
      : (t.split(".").pop() || "").toUpperCase();
  if (ext === "URL") return "URL";
  return normalizeExtensionLabel(ext);
}
