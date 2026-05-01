/**
 * @fileoverview Hook for managing file preview modal state, including text
 * file content fetching and cleanup.
 */

import { useEffect, useState } from "react";

/**
 * Manages the state for a file preview modal, including visibility, the
 * currently previewed file metadata, and text-file content loading.
 *
 * When a text file (type `"TXT"`) is set for preview and has a `src` URL,
 * this hook automatically fetches the file content and stores it in
 * `textPreview`. The fetch is re-triggered whenever the file type or
 * source URL changes.
 *
 * @returns An object containing:
 *   - `showFilePreview` - Whether the preview modal is visible
 *   - `setShowFilePreview` - Toggle modal visibility
 *   - `filePreview` - The file metadata (name, type, src, downloadHref) or `null`
 *   - `setFilePreview` - Set the file to preview
 *   - `textPreview` - Text content state `{ loading, content?, error? }` or `null`
 *   - `setTextPreview` - Direct setter for text preview state
 *   - `closePreview` - Resets all preview state and hides the modal
 */
export function useFilePreview() {
  const [showFilePreview, setShowFilePreview] = useState<boolean>(false);
  const [filePreview, setFilePreview] = useState<{
    name: string;
    type: string;
    src?: string;
    downloadHref?: string;
  } | null>(null);
  const [textPreview, setTextPreview] = useState<{
    loading: boolean;
    content?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (filePreview?.type === "TXT" && filePreview.src) {
      setTextPreview({ loading: true });
      void fetch(filePreview.src)
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const text = await res.text();
          setTextPreview({ loading: false, content: text });
        })
        .catch(() => {
          setTextPreview({
            loading: false,
            error: "Unable to load text preview.",
          });
        });
    } else {
      setTextPreview(null);
    }
  }, [filePreview?.type, filePreview?.src]);

  function closePreview() {
    setShowFilePreview(false);
    setFilePreview(null);
    setTextPreview(null);
  }

  return {
    showFilePreview,
    setShowFilePreview,
    filePreview,
    setFilePreview,
    textPreview,
    setTextPreview,
    closePreview,
  };
}
