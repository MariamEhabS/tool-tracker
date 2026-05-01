import { useState, useId } from "react";

export type ProcorePreviewState = {
  toolType: string;
  rawItem: Record<string, unknown>;
} | null;

/**
 * Manages the Procore item detail preview state and the hidden form-driven
 * Procore document opener state.
 */
export function useQRCodePreviews() {
  const [procorePreview, setProcorePreview] =
    useState<ProcorePreviewState>(null);

  // Hidden form-driven Procore document open (new tab)
  const [procoreDocToOpen, setProcoreDocToOpen] = useState<{
    procoreUrl?: string;
    procoreId?: string | number;
  } | null>(null);
  const procorePdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;

  return {
    procorePreview,
    setProcorePreview,
    procoreDocToOpen,
    setProcoreDocToOpen,
    procorePdfFormId,
  };
}
