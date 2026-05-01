import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "@tanstack/react-router";
import { PdfViewer } from "./PdfViewer";

/** A Procore file object containing version URLs for document access. */
type ProcoreClickedFile = {
  file_versions?: Array<{
    url?: string;
  }>;
};

/**
 * Props for the PdfOpener component -- handles PDF viewing via either a hidden form POST
 * (legacy flow for Procore-hosted documents) or an inline PDF.js viewer (modern flow for
 * presigned S3 URLs with page navigation support).
 */
interface PdfOpenerProps {
  /** Procore file object with version URLs; used to extract the document URL for the legacy form flow */
  clickedFile?: ProcoreClickedFile | null;
  /** Direct Procore URL for the document; used as fallback when clickedFile has no version URL */
  procoreUrl?: string;
  /** Taliho document ID; when set, the form POSTs to the Taliho document endpoint instead of the Procore endpoint */
  documentId?: string;
  /**
   * Optional form id to avoid duplicate IDs when multiple PdfOpener instances
   * are rendered on the same page. Defaults to "pdf-form-submit" for backwards
   * compatibility with existing `form="pdf-form-submit"` buttons.
   */
  formId?: string;
  /** Page number to open the PDF to (1-based) */
  openToPage?: number;
  /**
   * When true, renders an inline PDF.js viewer instead of opening via form POST.
   * This provides reliable page navigation across all platforms including mobile.
   */
  useInlineViewer?: boolean;
  /**
   * Presigned URL for the PDF. Required when useInlineViewer is true.
   * This URL is used directly by PDF.js to load the document.
   */
  presignedUrl?: string;
  /**
   * Callback fired when the inline viewer is closed.
   * Use this to clear parent state (documentId, presignedUrl, etc.) to prevent
   * the viewer from auto-reopening.
   */
  onViewerClose?: () => void;
  /**
   * Optional QR code ID to use for Procore document signing.
   * If provided, takes precedence over URL search params.
   * This is needed for pages like /qrcode/$qrcodeId where the ID is in the path.
   */
  qrCodeId?: string;
  /** Callback to navigate to the next document (e.g. next drawing in same discipline) */
  onNextDocument?: () => void;
  /** Callback to navigate to the previous document */
  onPreviousDocument?: () => void;
  /** Whether there is a next document available */
  hasNextDocument?: boolean;
  /** Whether there is a previous document available */
  hasPreviousDocument?: boolean;
  /** Label for the current document position (e.g. "Drawing 3 of 12") */
  documentLabel?: string;
}

export const PdfOpener = ({
  clickedFile,
  procoreUrl,
  documentId,
  formId,
  openToPage,
  useInlineViewer = false,
  presignedUrl,
  onViewerClose,
  qrCodeId,
  onNextDocument,
  onPreviousDocument,
  hasNextDocument,
  hasPreviousDocument,
  documentLabel,
}: PdfOpenerProps) => {
  const [showInlineViewer, setShowInlineViewer] = useState(false);
  const router = useRouter();
  const qrCodeIdFromUrl =
    router.parseLocation().search.qrcodeId ||
    router.parseLocation().search.qrCodeId;
  const qrCodeIdInURL = qrCodeId || qrCodeIdFromUrl;

  const encodeUrl = clickedFile?.file_versions?.[0]?.url ?? procoreUrl;

  let postUrl = `${import.meta.env.VITE_BACKEND_URL as string}/document/`;
  if (!documentId) {
    postUrl += "procore/";
  }

  const resolvedFormId =
    typeof formId === "string" && formId.trim()
      ? formId
      : // Keep legacy default unless a custom ID is provided.
        "pdf-form-submit";

  /**
   * Opens the PDF in the inline viewer.
   * Can be called programmatically via ref or through a custom trigger.
   */
  const openInlineViewer = () => {
    if (useInlineViewer && presignedUrl) {
      setShowInlineViewer(true);
    }
  };

  const closeInlineViewer = () => {
    setShowInlineViewer(false);
    onViewerClose?.();
  };

  // Auto-open inline viewer when presigned URL becomes available (mobile flow)
  useEffect(() => {
    if (useInlineViewer && presignedUrl && !showInlineViewer) {
      setShowInlineViewer(true);
    }
  }, [useInlineViewer, presignedUrl, showInlineViewer]);

  // Reset viewer state when document changes or is cleared
  useEffect(() => {
    if (!presignedUrl && !documentId && !clickedFile && !procoreUrl) {
      setShowInlineViewer(false);
    }
  }, [presignedUrl, documentId, clickedFile, procoreUrl]);

  return (
    <>
      {/* Inline PDF.js Viewer */}
      {useInlineViewer && showInlineViewer && presignedUrl && (
        <PdfViewer
          url={presignedUrl}
          initialPage={openToPage}
          onClose={closeInlineViewer}
          onNextDocument={onNextDocument}
          onPreviousDocument={onPreviousDocument}
          hasNextDocument={hasNextDocument}
          hasPreviousDocument={hasPreviousDocument}
          documentLabel={documentLabel}
        />
      )}
      {/* Hidden form for legacy/fallback PDF opening */}
      <div className="hidden">
        <form
          action={postUrl}
          method="POST"
          target="_blank"
          id={resolvedFormId}
          onSubmit={(e) => {
            // If using inline viewer, prevent form submission and open viewer instead
            if (useInlineViewer && presignedUrl) {
              e.preventDefault();
              openInlineViewer();
              return;
            }
            if (!clickedFile && !procoreUrl && !documentId) {
              e.preventDefault();
              toast.error("Somethingsss went wrong");
              return;
            }
          }}
        >
          <input name="formQr" readOnly value={qrCodeIdInURL} />
          <input name="formPdfUrl" readOnly value={encodeUrl} />
          <input name="formTalihoDocId" readOnly value={documentId} />
          <input
            name="talihoApiKey"
            readOnly
            value={import.meta.env.VITE_TALIHO_API_KEY}
          />
          {openToPage !== undefined && (
            <input name="openToPage" readOnly value={openToPage} />
          )}
        </form>
      </div>
    </>
  );
};
