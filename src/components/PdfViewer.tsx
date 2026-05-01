import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
import { logDocumentError } from "@/utils/rollbar";

// Use jsDelivr CDN which has PDF.js v5.4.530 with proper .mjs ES module files
// jsDelivr serves npm packages directly with correct CORS headers
// Note: CDNJS doesn't have v5.4.530 or .mjs files, so we use jsDelivr instead
const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Props for the PdfViewer component -- a fullscreen, portal-rendered PDF viewer using PDF.js
 * with page navigation, pinch-to-zoom, keyboard shortcuts, and a download link.
 */
type PdfViewerProps = {
  /** URL of the PDF document to load (typically a presigned S3 URL) */
  url: string;
  /** Page number to display initially (1-based). Defaults to 1. */
  initialPage?: number;
  /** Callback fired when the viewer is closed via the X button or Escape key */
  onClose?: () => void;
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
};

type LoadingState = "loading" | "ready" | "error";

export const PdfViewer = ({
  url,
  initialPage = 1,
  onClose,
  onNextDocument,
  onPreviousDocument,
  hasNextDocument = false,
  hasPreviousDocument = false,
  documentLabel,
}: PdfViewerProps) => {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [userScale, setUserScale] = useState(1);
  const [isImmersive, setIsImmersive] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pageViewportRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  // Touch gesture state for pinch-to-zoom (refs to avoid re-renders during gesture)
  const pinchRef = useRef<{
    initialDistance: number;
    initialScale: number;
  } | null>(null);

  // Touch gesture state for horizontal swipe (document navigation)
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  // Prevent synthetic click after touch tap (fixes double-toggle in portrait)
  const touchHandledRef = useRef(false);

  // Portal container
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Lock body scroll when viewer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoadingState("loading");
        setErrorMessage("");

        const loadingTask = pdfjsLib.getDocument({
          url,
          // Disable range requests which can cause issues with some S3 configurations
          disableRange: true,
          // Disable streaming which can also cause issues
          disableStream: true,
        });

        const pdf = await loadingTask.promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        // Ensure initial page is within bounds
        const validInitialPage = Math.min(
          Math.max(1, initialPage),
          pdf.numPages,
        );
        setCurrentPage(validInitialPage);
        setLoadingState("ready");
      } catch (error) {
        if (cancelled) return;
        logDocumentError(error, "pdf-load", { url });
        setLoadingState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load PDF",
        );
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [url, initialPage]);

  // Compute the scale that fits the PDF page within the container, then apply user zoom
  const computeFitScale = useCallback(
    (
      pageWidth: number,
      pageHeight: number,
      containerWidth: number,
      containerHeight: number,
    ) => {
      if (!pageWidth || !pageHeight || !containerWidth || !containerHeight)
        return 1;
      const scaleX = containerWidth / pageWidth;
      const scaleY = containerHeight / pageHeight;
      return Math.min(scaleX, scaleY);
    },
    [],
  );

  // Render current page with fit-to-container scaling
  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    // Cancel any ongoing render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdf.getPage(currentPage);

      // Get natural page dimensions (scale=1)
      const baseViewport = page.getViewport({ scale: 1 });
      pageViewportRef.current = {
        width: baseViewport.width,
        height: baseViewport.height,
      };

      // Compute fit scale based on container size
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const fitScale = computeFitScale(
        baseViewport.width,
        baseViewport.height,
        containerWidth,
        containerHeight,
      );

      // Apply user zoom on top of the fit scale
      const finalScale = fitScale * userScale;

      // Render at higher resolution for crisp output:
      // - dpr accounts for device pixel density (e.g. 3x on iPhones)
      // - quality multiplier renders extra detail so fine lines stay sharp
      //   even when the fit scale is very small (large drawing on small screen)
      const dpr = window.devicePixelRatio || 1;
      const qualityMultiplier = 2;
      const renderScale = finalScale * dpr * qualityMultiplier;
      const viewport = page.getViewport({ scale: renderScale });
      const context = canvas.getContext("2d");
      if (!context) return;

      // Set canvas backing store to full resolution
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Scale canvas element down to CSS size so it displays at the right size
      const cssScale = dpr * qualityMultiplier;
      canvas.style.width = `${viewport.width / cssScale}px`;
      canvas.style.height = `${viewport.height / cssScale}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (error) {
      // Ignore cancelled render errors
      if (error instanceof Error && error.message.includes("cancelled")) {
        return;
      }
      logDocumentError(error, "pdf-render", { currentPage, userScale });
    }
  }, [currentPage, userScale, computeFitScale]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (loadingState === "ready") {
      renderPage();
    }
  }, [loadingState, renderPage]);

  // Re-render on window resize / orientation change so the drawing fits the new screen size
  useEffect(() => {
    if (loadingState !== "ready") return;
    const handleResize = () => renderPage();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [loadingState, renderPage]);

  // Also re-render when immersive mode toggles (container size changes)
  useEffect(() => {
    if (loadingState === "ready") {
      // Small delay to let the DOM update after hiding/showing chrome
      const id = requestAnimationFrame(() => renderPage());
      return () => cancelAnimationFrame(id);
    }
  }, [isImmersive, loadingState, renderPage]);

  // Navigation handlers
  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // TODO: Add goToPage function if needed after V3 launch
  // const goToPage = useCallback(
  //   (page: number) => {
  //     const validPage = Math.min(Math.max(1, page), totalPages);
  //     setCurrentPage(validPage);
  //   },
  //   [totalPages],
  // );

  // Zoom handlers (userScale is a multiplier on top of the fit-to-container scale)
  const zoomIn = useCallback(() => {
    setUserScale((prev) => Math.min(5, prev + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setUserScale((prev) => Math.max(0.5, prev - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setUserScale(1);
  }, []);

  // Touch event handlers for pinch-to-zoom, horizontal swipe, and tap-to-immersive
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinchRef.current = { initialDistance: distance, initialScale: userScale };
      swipeStartRef.current = null;
    } else if (e.touches.length === 1) {
      swipeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const scaleChange = distance / pinchRef.current.initialDistance;
      const newScale = Math.min(
        5,
        Math.max(0.5, pinchRef.current.initialScale * scaleChange),
      );

      // Use CSS transform for instant visual feedback (no PDF re-render)
      const canvas = canvasRef.current;
      if (canvas) {
        const cssScale = newScale / userScale;
        canvas.style.transform = `scale(${cssScale})`;
        canvas.style.transformOrigin = "center center";
      }

      // Store the pending scale so touchEnd can commit it
      pinchRef.current = {
        ...pinchRef.current,
        pendingScale: newScale,
      } as typeof pinchRef.current & { pendingScale: number };
      swipeStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Commit pinch zoom: reset CSS transform and do a single PDF re-render
    if (pinchRef.current) {
      const pending = (
        pinchRef.current as typeof pinchRef.current & {
          pendingScale?: number;
        }
      )?.pendingScale;
      if (pending !== undefined) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.transform = "";
          canvas.style.transformOrigin = "";
        }
        setUserScale(pending);
      }
      pinchRef.current = null;
    }

    if (swipeStartRef.current && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
      const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
      const elapsed = Date.now() - swipeStartRef.current.time;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Detect horizontal swipe for document navigation
      if (absDx > 80 && absDx > absDy * 1.5 && elapsed < 500) {
        if (dx < 0 && hasNextDocument) {
          onNextDocument?.();
        } else if (dx > 0 && hasPreviousDocument) {
          onPreviousDocument?.();
        }
      }
      // Detect tap (minimal movement, short duration) → toggle immersive mode
      else if (absDx < 10 && absDy < 10 && elapsed < 300) {
        touchHandledRef.current = true;
        setIsImmersive((prev) => !prev);
      }
    }
    swipeStartRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          goToPreviousPage();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          goToNextPage();
          break;
        case "Escape":
          onClose?.();
          break;
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
        case "0":
          resetZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToPreviousPage, goToNextPage, zoomIn, zoomOut, resetZoom]);

  if (!portalContainer) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex flex-col ${isImmersive ? "bg-black" : "bg-black/90"}`}
      style={{ zIndex: 10000 }}
    >
      {/* Header/Toolbar — hidden in immersive mode */}
      <div
        className={`flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 transition-all duration-200 ${isImmersive ? "hidden" : ""}`}
      >
        {/* Close button - Left */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onClose}
            onTouchEnd={(e) => {
              e.preventDefault();
              onClose?.();
            }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Zoom controls - Center */}
        {/* TODO: Fix zoom controls */}
        {/*<div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            onTouchEnd={(e) => {
              e.preventDefault();
              zoomOut();
            }}
            disabled={userScale <= 0.5}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={resetZoom}
            onTouchEnd={(e) => {
              e.preventDefault();
              resetZoom();
            }}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition min-w-[3rem]"
            aria-label="Reset zoom"
          >
            {Math.round(userScale * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            onTouchEnd={(e) => {
              e.preventDefault();
              zoomIn();
            }}
            disabled={userScale >= 5}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>*/}

        {/* Download button - Right */}
        <div className="flex items-center">
          <a
            href={url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
            aria-label="Download PDF"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Document-level navigation (e.g. next/previous drawing) — hidden in immersive mode */}
      {(onNextDocument || onPreviousDocument) && !isImmersive && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <button
            type="button"
            onClick={onPreviousDocument}
            onTouchEnd={(e) => {
              e.preventDefault();
              onPreviousDocument?.();
            }}
            disabled={!hasPreviousDocument}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>
          {documentLabel && (
            <span className="text-sm font-medium text-gray-600">{documentLabel}</span>
          )}
          <button
            type="button"
            onClick={onNextDocument}
            onTouchEnd={(e) => {
              e.preventDefault();
              onNextDocument?.();
            }}
            disabled={!hasNextDocument}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* PDF Content Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loadingState === "loading" && (
          <div className="flex flex-col items-center gap-3 text-white">
            <svg
              className="w-10 h-10 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Loading PDF...</span>
          </div>
        )}

        {loadingState === "error" && (
          <div className="flex flex-col items-center gap-3 text-white p-6 text-center">
            <svg
              className="w-12 h-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium">Failed to load PDF</p>
              <p className="text-sm text-gray-400 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-100 transition"
            >
              Close
            </button>
          </div>
        )}

        {loadingState === "ready" && (
          <canvas
            ref={canvasRef}
            onClick={() => {
              // Skip if touch handler already handled this tap (prevents double-toggle on mobile)
              if (touchHandledRef.current) {
                touchHandledRef.current = false;
                return;
              }
              setIsImmersive((prev) => !prev);
            }}
            className={
              isImmersive
                ? "cursor-pointer"
                : "max-w-full shadow-2xl cursor-pointer"
            }
            style={{ background: isImmersive ? "transparent" : "white" }}
          />
        )}
      </div>

      {/* Mobile-friendly bottom navigation — hidden in immersive mode */}
      <div
        className={`sm:hidden flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 ${isImmersive ? "hidden" : ""}`}
      >
        <button
          type="button"
          onClick={goToPreviousPage}
          onTouchEnd={(e) => {
            e.preventDefault();
            goToPreviousPage();
          }}
          disabled={currentPage <= 1}
          className="flex-1 py-2 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="px-4 text-gray-600">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goToNextPage}
          onTouchEnd={(e) => {
            e.preventDefault();
            goToNextPage();
          }}
          disabled={currentPage >= totalPages}
          className="flex-1 py-2 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>,
    portalContainer,
  );
};

export default PdfViewer;
