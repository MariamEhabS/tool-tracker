/**
 * @fileoverview Hook that automatically selects the appropriate Procore view
 * based on QR type, available Procore tools, and document presence.
 */

import { useEffect } from "react";

/**
 * Automatically determines and sets the active Procore view based on the
 * QR code type, whether Taliho documents exist, and which Procore tools are
 * available. Runs as a side-effect whenever its dependencies change.
 *
 * - For QR codes without Taliho documents, defaults to the first available
 *   Procore tool (or the tool matching `procoreCategory` for procore-tool/location types).
 * - When Taliho documents are present and documents or tool view is forced,
 *   clears the Procore view so the native view takes precedence.
 *
 * @param params - Configuration object
 * @param params.qrType - The QR code type string (e.g. "procore-tool", "procore-location")
 * @param params.hasTalihoDocs - Whether the QR code has any Taliho documents
 * @param params.procoreToolNames - List of available Procore tool names
 * @param params.procoreCategory - The Procore category to prefer, if any
 * @param params.forceDocsView - Whether the documents view is being forced
 * @param params.showToolType - Whether the tool-type view is active
 * @param params.showDocs - Whether the documents view is active
 * @param params.setProcoreView - Setter to update the active Procore view
 */
export function useProcoreViewAuto(params: {
  qrType?: string | null;
  hasTalihoDocs: boolean;
  procoreToolNames: string[];
  procoreCategory?: string | null;
  forceDocsView: boolean;
  showToolType: boolean;
  showDocs: boolean;
  setProcoreView: (v: string | null) => void;
}) {
  const {
    qrType,
    hasTalihoDocs,
    procoreToolNames,
    procoreCategory,
    forceDocsView,
    showToolType,
    showDocs,
    setProcoreView,
  } = params;

  useEffect(() => {
    const t = (qrType || "").toLowerCase();
    if (!hasTalihoDocs) {
      if (t === "procore-tool" || t === "procore-location") {
        setProcoreView(procoreCategory ?? procoreToolNames[0] ?? null);
      } else if (procoreToolNames.length > 0) {
        setProcoreView(procoreToolNames[0]);
      }
    } else if (forceDocsView || showToolType || showDocs) {
      setProcoreView(null);
    }
  }, [
    qrType,
    procoreCategory,
    hasTalihoDocs,
    forceDocsView,
    showToolType,
    showDocs,
    procoreToolNames,
    setProcoreView,
  ]);
}
