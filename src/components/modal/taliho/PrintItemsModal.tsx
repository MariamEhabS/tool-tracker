import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";
import PortalTooltip from "@components/ui/PortalTooltip";
import talihoLogo from "@assets/images/taliho-logo.png";
import toast from "react-hot-toast";
import { logApiError } from "@/utils/rollbar";

// localStorage key for persisting user's items-per-page preference
const PRINT_ITEMS_PER_PAGE_KEY = "print-modal-items-per-page";

// Module-level cache for preloaded images
// Key: qrCodeId or imgSrc, Value: resolved working URL
const imageCache = new Map<string, string>();

// Module-level cache for brand logo preload status
// Key: logo URL, Value: true if successfully loaded
const brandLogoCache = new Map<string, boolean>();

// Helper to get cache key for an item
const getCacheKey = (item: { imgSrc: string; qrCodeId?: string }): string => {
  return item.qrCodeId || item.imgSrc;
};

const setStoredItemsPerPage = (value: number): void => {
  try {
    localStorage.setItem(PRINT_ITEMS_PER_PAGE_KEY, String(value));
  } catch {
    // localStorage unavailable
  }
};

type PaperSize = "letter" | "elevenByFourteen";
type Orientation = "portrait" | "landscape";
type TemplateType = "letter" | "avery-6871" | "zebra-a8";

/** Group of items with their own header info for grouped printing */
export type PrintItemGroup = {
  groupId: string;
  groupName: string;
  projectName: string;
  clientName?: string;
  addressLine?: string;
  items: Array<{
    name: string;
    imgSrc: string;
    fallbackSrc?: string;
    qrCodeId?: string;
  }>;
};

type PrintItemsModalProps = {
  open: boolean;
  onConfirm: (settings: {
    paperSize: PaperSize;
    orientation: Orientation;
    includeCaptions: boolean;
    itemsPerPage?: number;
    template: TemplateType;
    headerProjectName?: boolean;
    headerGroupName?: boolean;
    footerShowCompanyName?: boolean;
    footerShowLogo?: boolean;
    footerMode?: "logo" | "address";
  }) => void;
  onClose: () => void;
  /** Optional count for subtitle */
  selectedCount?: number;
  /** Optional explicit title/subtitle */
  title?: string;
  subtitle?: ReactNode;
  /** Initial settings */
  initialPaperSize?: PaperSize;
  initialOrientation?: Orientation;
  /** Allow selecting multiple items per page (for group pages) */
  allowMultiple?: boolean;
  initialItemsPerPage?: number;
  maxItemsPerPage?: number;
  /** If provided, the modal will perform inline printing without opening a new window */
  buildHtml?: (settings: {
    paperSize: PaperSize;
    orientation: Orientation;
    includeCaptions: boolean;
    itemsPerPage?: number;
  }) => string;
  /** Controls whether inline printing is used when buildHtml is provided (default: true) */
  inlinePrint?: boolean;
  /** Default builder inputs (used when buildHtml is not provided) */
  companyName?: string;
  /** Company website URL for Zebra template header */
  companyWebsite?: string;
  clientName?: string;
  projectLine?: string;
  groupLine?: string;
  addressLine?: string;
  items?: Array<{
    name: string;
    imgSrc: string;
    fallbackSrc?: string;
    qrCodeId?: string;
  }>;
  /** Callback to refetch a signed URL when image load fails */
  onRefetchUrl?: (qrCodeId: string) => Promise<string | null>;
  brandLogoSrc?: string;
  /** Labels */
  paperSizeLabel?: string;
  orientationLabel?: string;
  itemsPerPageLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Indicates items are being loaded externally (disables print, shows loading) */
  isLoadingItems?: boolean;
  /**
   * When provided, renders each group separately with page breaks between groups.
   * Each group displays its own project/group header info.
   * Takes precedence over the flat `items` prop.
   */
  itemGroups?: PrintItemGroup[];
};

export default function PrintItemsModal(props: PrintItemsModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    selectedCount,
    title = "Print Items",
    subtitle,
    initialPaperSize = "letter",
    initialOrientation = "portrait",

    paperSizeLabel = "Paper size",
    orientationLabel = "Orientation",

    itemsPerPageLabel = "Items per page",
    confirmLabel = "Print",
    cancelLabel = "Cancel",
    // initialItemsPerPage is deprecated - now computed dynamically from selectedCount
    maxItemsPerPage = 12,
    buildHtml,
    inlinePrint = true,
    companyName,
    companyWebsite,
    clientName,
    projectLine,
    groupLine,
    addressLine,
    items,
    onRefetchUrl,
    brandLogoSrc,
    size = "xl",
    isLoadingItems = false,
    itemGroups,
  } = props;

  // Grouped mode detection and computed values
  const isGroupedMode = Boolean(itemGroups && itemGroups.length > 0);

  // Flatten itemGroups for image preloading (preserves index mapping back to groups)
  const flattenedGroupItems = useMemo(() => {
    if (!itemGroups) return [];
    return itemGroups.flatMap((group) => group.items);
  }, [itemGroups]);

  // In grouped mode, use flattened items; otherwise use regular items
  const effectiveItems = isGroupedMode ? flattenedGroupItems : items;

  // Total count for display (considers grouped vs flat mode)
  const effectiveTotalCount = useMemo(() => {
    if (isGroupedMode && itemGroups) {
      return itemGroups.reduce((sum, g) => sum + g.items.length, 0);
    }
    return selectedCount ?? items?.length ?? 0;
  }, [isGroupedMode, itemGroups, selectedCount, items?.length]);

  const [paperSize, setPaperSize] = useState<PaperSize>(initialPaperSize);
  const [orientation, setOrientation] =
    useState<Orientation>(initialOrientation);
  const [template, setTemplate] = useState<TemplateType>("letter");
  const includeCaptions = true;

  // Compute smart initial items per page value
  const computeInitialItemsPerPage = useCallback((): number => {
    const countToUse = effectiveTotalCount ?? maxItemsPerPage;
    const effectiveMax = Math.max(1, Math.min(countToUse, maxItemsPerPage));

    // Single item: always 1
    if (effectiveMax === 1) {
      return 1;
    }

    // Always default to maximum for optimal bulk printing
    // Users can adjust down if they prefer fewer per page
    return effectiveMax;
  }, [effectiveTotalCount, maxItemsPerPage]);

  const [itemsPerPage, setItemsPerPage] = useState<number>(
    computeInitialItemsPerPage,
  );

  // Recalculate itemsPerPage when modal opens or count changes
  useEffect(() => {
    if (open) {
      setItemsPerPage(computeInitialItemsPerPage());
    }
  }, [open, effectiveTotalCount, maxItemsPerPage, computeInitialItemsPerPage]);

  const [headerProjectName, setHeaderProjectName] = useState<boolean>(true);
  const [headerGroupName, setHeaderGroupName] = useState<boolean>(true);
  const [footerShowCompanyName, setFooterShowCompanyName] =
    useState<boolean>(true);
  const [footerShowLogo, setFooterShowLogo] = useState<boolean>(true);
  // Debug overlay for Avery 6871 template alignment verification
  const [showAveryOverlay, setShowAveryOverlay] = useState<boolean>(false);

  // Image loading state management
  // Key is item index (stable), value is loading status
  const [loadingState, setLoadingState] = useState<
    Record<number, "loading" | "loaded" | "error">
  >({});
  const [allImagesReady, setAllImagesReady] = useState(false);
  // Track brand logo loading status (for Zebra and Letter templates)
  const [brandLogoReady, setBrandLogoReady] = useState(false);
  // Track which items successfully loaded with fallback (maps index to working src)
  const [resolvedSources, setResolvedSources] = useState<
    Record<number, string>
  >({});

  // Preload all images when modal opens (with caching)
  // Uses effectiveItems which handles both grouped and flat modes
  useEffect(() => {
    if (!open || !effectiveItems || effectiveItems.length === 0) {
      setLoadingState({});
      setAllImagesReady(false);
      setResolvedSources({});
      return;
    }

    const newLoadingState: Record<number, "loading" | "loaded" | "error"> = {};

    // Check cache first for each item
    effectiveItems.forEach((item, idx) => {
      const cacheKey = getCacheKey(item);
      const cachedUrl = imageCache.get(cacheKey);
      if (cachedUrl) {
        // Mark as loaded from cache initially (will verify below)
        newLoadingState[idx] = "loading";
      } else {
        newLoadingState[idx] = "loading";
      }
    });

    setLoadingState(newLoadingState);
    setAllImagesReady(false);
    setResolvedSources({});

    // Preload all images with fallback support and caching
    let loadedCount = 0;
    let errorCount = 0;
    const totalItems = effectiveItems.length;

    const checkComplete = () => {
      if (loadedCount + errorCount === totalItems) {
        setAllImagesReady(true);

        if (errorCount === totalItems) {
          toast.error("All images failed to load. Cannot print.");
        } else if (errorCount > 0) {
          toast.error(
            `${errorCount} of ${totalItems} image${totalItems === 1 ? "" : "s"} failed to load. Some QR codes may not appear in the print.`,
          );
        }
      }
    };

    effectiveItems.forEach((item, idx) => {
      const cacheKey = getCacheKey(item);
      const cachedUrl = imageCache.get(cacheKey);

      const img = new Image();
      let triedFallback = false;
      let triedRefetch = false;
      let triedCachedUrl = false;

      const markSuccess = (workingUrl: string) => {
        setLoadingState((prev) => ({ ...prev, [idx]: "loaded" }));
        setResolvedSources((prev) => ({ ...prev, [idx]: workingUrl }));
        // Update cache with working URL
        imageCache.set(cacheKey, workingUrl);
        loadedCount++;
        checkComplete();
      };

      const markError = () => {
        // Log image load failure to Rollbar for tracking
        logApiError(
          new Error("Print preview image load failed"),
          "print-preview-image-load-failed",
          {
            imageIndex: idx,
            hasQrCodeId: !!item.qrCodeId,
            hasFallbackSrc: !!item.fallbackSrc,
          },
        );

        // Clear bad cache entry if it existed
        imageCache.delete(cacheKey);
        setLoadingState((prev) => ({ ...prev, [idx]: "error" }));
        errorCount++;
        checkComplete();
      };

      img.onload = () => {
        markSuccess(img.src);
      };

      img.onerror = () => {
        // If cached URL failed, clear cache and try original
        if (triedCachedUrl && cachedUrl && img.src === cachedUrl) {
          imageCache.delete(cacheKey);
          img.src = item.imgSrc;
          return;
        }

        // Step 1: Try to refetch a new signed URL if qrCodeId and callback are available
        if (!triedRefetch && item.qrCodeId && onRefetchUrl) {
          triedRefetch = true;
          onRefetchUrl(item.qrCodeId)
            .then((newUrl) => {
              if (newUrl) {
                img.src = newUrl;
              } else {
                // Refetch returned null, try fallback
                if (!triedFallback && item.fallbackSrc) {
                  triedFallback = true;
                  img.src = item.fallbackSrc;
                } else {
                  markError();
                }
              }
            })
            .catch(() => {
              // Refetch threw error, try fallback
              if (!triedFallback && item.fallbackSrc) {
                triedFallback = true;
                img.src = item.fallbackSrc;
              } else {
                markError();
              }
            });
          return;
        }

        // Step 2: Try fallback SVG if available and not already tried
        if (!triedFallback && item.fallbackSrc) {
          triedFallback = true;
          img.src = item.fallbackSrc;
          return;
        }

        // Step 3: All attempts failed
        markError();
      };

      // Try cached URL first if available, otherwise start with primary image
      if (cachedUrl) {
        triedCachedUrl = true;
        img.src = cachedUrl;
      } else {
        img.src = item.imgSrc;
      }
    });
  }, [open, effectiveItems, onRefetchUrl]);

  // Preload brand logo when modal opens (for Zebra and Letter templates)
  useEffect(() => {
    if (!open) {
      setBrandLogoReady(false);
      return;
    }

    // Determine which logo URL will be used (prop or fallback)
    const logoUrl = brandLogoSrc || talihoLogo;

    // Check if already cached
    if (brandLogoCache.has(logoUrl)) {
      setBrandLogoReady(true);
      return;
    }

    // Preload the brand logo
    const img = new Image();
    img.onload = () => {
      brandLogoCache.set(logoUrl, true);
      setBrandLogoReady(true);
    };
    img.onerror = () => {
      // If custom logo fails, try fallback to taliho logo
      if (logoUrl !== talihoLogo) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          brandLogoCache.set(talihoLogo, true);
          setBrandLogoReady(true);
        };
        fallbackImg.onerror = () => {
          // Even fallback failed, but allow printing anyway
          setBrandLogoReady(true);
        };
        fallbackImg.src = talihoLogo;
      } else {
        // Fallback logo failed, but allow printing anyway
        setBrandLogoReady(true);
      }
    };
    img.src = logoUrl;
  }, [open, brandLogoSrc]);

  // Memoized items with resolved sources (uses fallback if primary failed)
  // In grouped mode, this is the flattened list; in flat mode, it's the regular items
  const resolvedItems = useMemo(() => {
    if (!effectiveItems) return [];
    return effectiveItems.map((item, idx) => ({
      ...item,
      imgSrc: resolvedSources[idx] ?? item.imgSrc,
    }));
  }, [effectiveItems, resolvedSources]);

  function printInline(html: string) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow;
    const cleanup = () => {
      window.removeEventListener("afterprint", cleanup);
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 0);
    };
    window.addEventListener("afterprint", cleanup);
    win?.focus();

    // Guard flag to prevent duplicate print dialogs
    // Multiple code paths can trigger print (cached images, async loads, timeout fallback)
    // This ensures only the first successful path actually prints
    let printed = false;
    const safePrint = () => {
      if (!printed) {
        printed = true;
        win?.print();
      }
    };

    // Wait for all images in the iframe to load before printing
    // This ensures S3 signed URLs are fully loaded
    const images = doc.querySelectorAll("img");
    if (images.length === 0) {
      // No images, print immediately
      safePrint();
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length;
    const MAX_WAIT_MS = 10000; // Maximum 10 seconds to wait
    const startTime = Date.now();

    const checkAndPrint = () => {
      if (loadedCount >= totalImages || Date.now() - startTime > MAX_WAIT_MS) {
        safePrint();
      }
    };

    images.forEach((img) => {
      if (img.complete && img.naturalHeight !== 0) {
        // Image already loaded (from cache)
        loadedCount++;
      } else {
        // Wait for image to load
        img.onload = () => {
          loadedCount++;
          checkAndPrint();
        };
        img.onerror = () => {
          // Count errors as "loaded" to avoid blocking print
          loadedCount++;
          checkAndPrint();
        };
      }
    });

    if (loadedCount >= totalImages) {
      // All images loaded from cache, print with small delay for rendering
      setTimeout(() => safePrint(), 50);
    } else {
      // Fallback: if not all images load within MAX_WAIT_MS, print anyway
      setTimeout(checkAndPrint, MAX_WAIT_MS);
    }
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  }

  // Compute descriptive print title based on what's being printed
  function computePrintTitle(): string {
    if (isGroupedMode && itemGroups) {
      if (itemGroups.length === 1) {
        const group = itemGroups[0];
        if (group.items.length === 1) {
          // Single item in single group - use item name
          return group.items[0].name || "Taliho QR Code";
        }
        // Single group with multiple items - use group name
        return group.groupName || "Taliho QR Codes";
      }
      // Multiple groups
      return `Taliho QR Codes (${itemGroups.length} Groups)`;
    }

    // Non-grouped mode
    if (resolvedItems.length === 1) {
      return resolvedItems[0].name || "Taliho QR Code";
    }

    return `Taliho QR Codes (${resolvedItems.length} Codes)`;
  }
  function colsFor(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n <= 4) return 2;
    if (n <= 6) return 3;
    if (n <= 9) return 3;
    return 4;
  }
  function buildStylesMulti(
    paperSize: PaperSize,
    orientation: Orientation,
    cols: number,
  ): string {
    const dims = paperSize === "letter" ? { w: 8.5, h: 11 } : { w: 11, h: 14 };
    const widthIn = orientation === "portrait" ? dims.w : dims.h;
    const heightIn = orientation === "portrait" ? dims.h : dims.w;
    const isSinglePerPage = cols === 1;
    const sheetPaddingIn = isSinglePerPage ? 0.75 : 0.5;
    const gapIn = isSinglePerPage ? 0.4 : 0.3;
    const companyFontPx = isSinglePerPage ? 18 : 16;
    const addressFontPx = isSinglePerPage ? 12 : 11;
    const subheaderFontPx = isSinglePerPage ? 14 : 13;
    const brandHeightPx = isSinglePerPage ? 20 : 18;
    const qrMaxWidthIn = isSinglePerPage
      ? Math.max(widthIn, heightIn) / 2.2
      : Math.max(widthIn, heightIn) / (cols * 1.8);
    const gridExtra = isSinglePerPage
      ? "place-items: center;"
      : "align-items: start; justify-items: center;";
    const qrNameFont = isSinglePerPage ? "" : "font-size: 12px;";
    const pageRule =
      paperSize === "letter"
        ? `@page { size: ${widthIn}in ${heightIn}in; margin: 0; }`
        : `@page { margin: 0; }`;
    return `
      ${pageRule}
      html, body { height: 100%; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; color: #111827; }
      .sheet { box-sizing: border-box; width: 100vw; height: 100vh; padding: ${sheetPaddingIn}in; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: ${gapIn}in; page-break-after: always; overflow: hidden; }
      .header { display: flex; flex-direction: column; }
      .headerRow { display: flex; justify-content: space-between; align-items: center; }
      .company { font-size: ${companyFontPx}px; font-weight: 700; }
      .address { font-size: ${addressFontPx}px; color: #4b5563; margin-top: 2px; }
      .subheader { font-size: ${subheaderFontPx}px; font-weight: 600; color: #374151; }
      .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${gapIn}in; ${gridExtra} overflow: hidden; min-height: 0; }
      .tile { width: 100%; display: flex; flex-direction: column; align-items: center; overflow: hidden; min-height: 0; }
      .qrimg { width: 100%; height: auto; display: block; max-width: ${qrMaxWidthIn}in; object-fit: contain; }
      .qrname { text-align: center; margin-top: 0.15in; font-weight: 800; letter-spacing: 0.06em; ${qrNameFont} overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
      .footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; font-size: 11px; color: #4b5563; }
      .footer-left { text-align: left; }
      .footer-center { text-align: center; font-size: 10px; }
      .footer-right { text-align: right; }
      .brand { height: ${brandHeightPx}px; }
      .hidden-content { visibility: hidden; }
    `;
  }
  function buildStylesSingle(
    paperSize: PaperSize,
    orientation: Orientation,
  ): string {
    const dims = paperSize === "letter" ? { w: 8.5, h: 11 } : { w: 11, h: 14 };
    const widthIn = orientation === "portrait" ? dims.w : dims.h;
    const heightIn = orientation === "portrait" ? dims.h : dims.w;
    const pageRule =
      paperSize === "letter"
        ? `@page { size: ${widthIn}in ${heightIn}in; margin: 0; }`
        : `@page { margin: 0; }`;
    return `
      ${pageRule}
      html, body { height: 100%; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; color: #111827; }
      .sheet { box-sizing: border-box; width: 100vw; height: 100vh; padding: 0.75in; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 0.4in; overflow: hidden; }
      .header { display: flex; flex-direction: column; }
      .headerRow { display: flex; justify-content: space-between; align-items: center; }
      .company { font-size: 18px; font-weight: 700; }
      .address { font-size: 12px; color: #4b5563; margin-top: 2px; }
      .subheader { font-size: 14px; font-weight: 600; color: #374151; }
      .qrwrap { display: grid; place-items: center; overflow: hidden; min-height: 0; }
      .qrbox { width: ${Math.max(widthIn, heightIn) / 2.2}in; max-width: 100%; }
      .qrimg { width: 100%; height: auto; display: block; }
      .qrname { text-align: center; margin-top: 0.25in; font-weight: 800; letter-spacing: 0.06em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
      .footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; font-size: 11px; color: #4b5563; }
      .footer-left { text-align: left; }
      .footer-center { text-align: center; font-size: 10px; }
      .footer-right { text-align: right; }
      .brand { height: 20px; }
      .hidden-content { visibility: hidden; }
    `;
  }
  function buildDefaultHtml(payload: {
    paperSize: PaperSize;
    orientation: Orientation;
    includeCaptions: boolean;
    itemsPerPage?: number;
    headerProjectName?: boolean;
    headerGroupName?: boolean;
    footerShowCompanyName?: boolean;
    footerShowLogo?: boolean;
  }): string {
    // Template-aware builder
    if (template === "avery-6871") {
      // Avery 6871: 3 cols x 6 rows on letter paper
      // Label dimensions: 2-3/8" x 1-1/4" (2.375" x 1.25")
      // Sheet size: 8.5" x 11"
      // Official Avery template measurements (from Avery6871AddressLabels.doc):
      //   - Horizontal gap between labels: 0.3125" (5/16")
      //   - Vertical gap between labels: 0.25" (1/4")
      //   - Top margin: 1.125"
      // Horizontal: 0.375" margins + 3×2.375" labels + 2×0.3125" gaps = 8.5"
      // Vertical: 1.125" margins + 6×1.25" labels + 5×0.25" gaps = 11"
      const layout = {
        marginX: 0.375,
        gapX: 0.3125,
        marginY: 1.125,
        gapY: 0.25,
        labelWidth: 2.375,
        labelHeight: 1.25,
        rows: 6,
        cols: 3,
      };
      const perPage = layout.rows * layout.cols;
      // QR code size: maximize within label height minus padding
      // Using 1.05" allows for small padding while keeping QR scannable
      const qrSize = 1.05;
      const pages = chunk(resolvedItems, perPage);

      // Overlay styles for alignment verification (shows label boundaries)
      const overlayStyles = showAveryOverlay
        ? `
        .page { position: relative; }
        .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; padding: ${layout.marginY}in ${layout.marginX}in; display: grid; grid-template-columns: repeat(${layout.cols}, ${layout.labelWidth}in); grid-template-rows: repeat(${layout.rows}, ${layout.labelHeight}in); column-gap: ${layout.gapX}in; row-gap: ${layout.gapY}in; }
        .overlay-label { width: ${layout.labelWidth}in; height: ${layout.labelHeight}in; border: 2px solid rgba(255, 0, 0, 0.6); border-radius: 8px; background: rgba(255, 0, 0, 0.08); }
      `
        : "";

      const styles = `
        @page { size: 8.5in 11in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .page { page-break-after: always; padding: ${layout.marginY}in ${layout.marginX}in; display: grid; grid-template-columns: repeat(${layout.cols}, ${layout.labelWidth}in); grid-template-rows: repeat(${layout.rows}, ${layout.labelHeight}in); column-gap: ${layout.gapX}in; row-gap: ${layout.gapY}in; }
        .page:first-child { page-break-before: avoid; }
        .label { width: ${layout.labelWidth}in; height: ${layout.labelHeight}in; display: flex; align-items: center; padding: 0.08in 0.12in; gap: 0.12in; overflow: hidden; }
        .qr-wrap { flex-shrink: 0; width: ${qrSize}in; height: ${qrSize}in; display: flex; align-items: center; justify-content: center; }
        .qr-img { width: 100%; height: 100%; object-fit: contain; }
        .name-wrap { flex: 1; min-width: 0; display: flex; align-items: center; }
        .name { font-size: 11px; font-weight: 600; color: #1a1a1a; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; }
        ${overlayStyles}
      `;

      // Generate overlay HTML (18 empty label boundaries)
      const overlayHtml = showAveryOverlay
        ? `<div class="overlay">${Array(perPage).fill('<div class="overlay-label"></div>').join("")}</div>`
        : "";

      const sheets = pages
        .map((pageItems) => {
          const tiles = pageItems
            .map((i) => {
              const qr = i.imgSrc || "";
              const nm = String(i.name ?? "").toUpperCase();
              return `<div class="label"><div class="qr-wrap"><img class="qr-img" src="${qr}" alt="QR"/></div><div class="name-wrap"><span class="name">${nm}</span></div></div>`;
            })
            .join("");
          return `<section class="page">${tiles}${overlayHtml}</section>`;
        })
        .join("");
      return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${sheets}</body></html>`;
    }
    if (template === "zebra-a8") {
      // Zebra label layout: 48mm x 69mm portrait (1.89in x 2.717in)
      const dims = { w: 1.89, h: 2.717 };
      const brand = brandLogoSrc || talihoLogo;
      const websiteUrl = companyWebsite || "www.taliho.com";
      // Border box dimensions to fit QR and label name
      const borderW = 1.5;
      const borderH = 1.65;
      const qrSizeIn = 1.1;
      const styles = `
        @page { size: ${dims.w}in ${dims.h}in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; }
        .sheet { width: ${dims.w}in; height: ${dims.h}in; padding: 0.1in; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
        .header { display: flex; flex-direction: column; align-items: center; gap: 0.02in; margin-bottom: 0.08in; }
        .logo { height: 0.45in; max-width: 1.5in; object-fit: contain; }
        .website { font-size: 10px; font-weight: 700; text-align: center; }
        .labelbox { border: 2px solid #111; border-radius: 6px; width: ${borderW}in; height: ${borderH}in; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.08in; }
        .qrimg { width: ${qrSizeIn}in; height: ${qrSizeIn}in; object-fit: contain; }
        .qrname { font-size: 11px; font-weight: 700; margin-top: 0.06in; text-align: center; letter-spacing: 0.02em; }
      `;
      const sheets = resolvedItems
        .map((i) => {
          const nm = String(i.name ?? "");
          return `<section class="sheet"><header class="header"><img class="logo" src="${brand}" alt="Logo"/><div class="website">${websiteUrl}</div></header><main class="labelbox"><img class="qrimg" src="${i.imgSrc}" alt="QR"/><div class="qrname">${nm.toUpperCase()}</div></main></section>`;
        })
        .join("");
      return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${sheets}</body></html>`;
    }
    // Default Letter (multi or single) - keep existing behavior
    const brand = brandLogoSrc || talihoLogo;
    const headerSub = [groupLine].filter(Boolean).join(" • ");
    const itemsArr = resolvedItems.map((i) => ({ ...i }));
    const perPage = Math.max(
      1,
      Math.min(payload.itemsPerPage ?? 1, maxItemsPerPage),
    );

    // Build header HTML based on toggles
    // Use visibility:hidden instead of removing content to preserve layout spacing
    const showProjectName = payload.headerProjectName !== false;
    const showGroupName = payload.headerGroupName !== false;
    const headerHiddenClass = !showProjectName ? " hidden-content" : "";
    const subheaderHiddenClass = !showGroupName ? " hidden-content" : "";
    const headerHtml = `<header class="header${headerHiddenClass}"><div class="headerRow"><div class="company">${projectLine ?? ""}</div><div class="company">${clientName ?? ""}</div></div><div class="address">${addressLine ?? ""}</div></header><div class="subheader${subheaderHiddenClass}">${headerSub}</div>`;

    // Build footer HTML with 3 columns: company name (left), copyright (center), logo (right)
    const showCompanyName = payload.footerShowCompanyName !== false;
    const showLogo = payload.footerShowLogo !== false;
    const companyNameHtml = showCompanyName ? (companyName ?? "") : "";
    const logoHtml = showLogo
      ? `<img class="brand" src="${brand}" alt="Taliho"/>`
      : "";
    const footerHtml = `<footer class="footer"><div class="footer-left">${companyNameHtml}</div><div class="footer-center">Powered by Taliho</div><div class="footer-right">${logoHtml}</div></footer>`;

    if (perPage === 1 && itemsArr.length <= 1) {
      const styles = buildStylesSingle(payload.paperSize, payload.orientation);
      const itm = itemsArr[0] ?? { name: "", imgSrc: "" };
      const title = String(itm.name ?? "").toUpperCase();
      return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body><section class="sheet">${headerHtml}<main class="qrwrap"><div class="qrbox"><img class="qrimg" src="${itm.imgSrc}" alt="QR"/>${payload.includeCaptions ? `<div class="qrname">${title}</div>` : ""}</div></main>${footerHtml}</section></body></html>`;
    }
    const cols = colsFor(perPage);
    const styles = buildStylesMulti(
      payload.paperSize,
      payload.orientation,
      cols,
    );
    const pages = chunk(itemsArr, perPage);
    const sheets = pages
      .map((pageItems) => {
        const tiles = pageItems
          .map((i) => {
            const name = String(i.name ?? "").toUpperCase();
            return `<div class="tile"><img class="qrimg" src="${i.imgSrc}" alt="QR"/>${payload.includeCaptions ? `<div class="qrname">${name}</div>` : ""}</div>`;
          })
          .join("");
        return `<section class="sheet">${headerHtml}<main class="grid">${tiles}</main>${footerHtml}</section>`;
      })
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${sheets}</body></html>`;
  }

  /**
   * Builds HTML for grouped printing where each group gets its own pages
   * with group-specific header info (project name, group name, etc.)
   * Supports all template types: letter, avery-6871, and zebra-a8
   */
  function buildGroupedHtml(payload: {
    paperSize: PaperSize;
    orientation: Orientation;
    includeCaptions: boolean;
    itemsPerPage?: number;
    headerProjectName?: boolean;
    headerGroupName?: boolean;
    footerShowCompanyName?: boolean;
    footerShowLogo?: boolean;
  }): string {
    if (!itemGroups || itemGroups.length === 0) return "";

    // Track running index into resolvedItems (flattened array)
    let flatIndex = 0;

    // Get all resolved items across all groups (for templates that don't support per-group headers)
    const getAllResolvedItems = () => {
      const allItems: Array<{ name: string; imgSrc: string }> = [];
      let idx = 0;
      itemGroups.forEach((group) => {
        group.items.forEach((item) => {
          allItems.push({
            ...item,
            imgSrc: resolvedSources[idx] ?? item.imgSrc,
          });
          idx++;
        });
      });
      return allItems;
    };

    // Avery 6871 template: 3 cols x 6 rows on letter paper
    // For grouped mode, we flatten all items since Avery doesn't support per-group headers
    if (template === "avery-6871") {
      const allItems = getAllResolvedItems();
      const layout = {
        marginX: 0.375,
        gapX: 0.3125,
        marginY: 1.125,
        gapY: 0.25,
        labelWidth: 2.375,
        labelHeight: 1.25,
        rows: 6,
        cols: 3,
      };
      const perPage = layout.rows * layout.cols;
      const qrSize = 1.05;
      const pages = chunk(allItems, perPage);

      const overlayStyles = showAveryOverlay
        ? `
        .page { position: relative; }
        .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; padding: ${layout.marginY}in ${layout.marginX}in; display: grid; grid-template-columns: repeat(${layout.cols}, ${layout.labelWidth}in); grid-template-rows: repeat(${layout.rows}, ${layout.labelHeight}in); column-gap: ${layout.gapX}in; row-gap: ${layout.gapY}in; }
        .overlay-label { width: ${layout.labelWidth}in; height: ${layout.labelHeight}in; border: 2px solid rgba(255, 0, 0, 0.6); border-radius: 8px; background: rgba(255, 0, 0, 0.08); }
      `
        : "";

      const styles = `
        @page { size: 8.5in 11in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .page { page-break-after: always; padding: ${layout.marginY}in ${layout.marginX}in; display: grid; grid-template-columns: repeat(${layout.cols}, ${layout.labelWidth}in); grid-template-rows: repeat(${layout.rows}, ${layout.labelHeight}in); column-gap: ${layout.gapX}in; row-gap: ${layout.gapY}in; }
        .page:first-child { page-break-before: avoid; }
        .label { width: ${layout.labelWidth}in; height: ${layout.labelHeight}in; display: flex; align-items: center; padding: 0.08in 0.12in; gap: 0.12in; overflow: hidden; }
        .qr-wrap { flex-shrink: 0; width: ${qrSize}in; height: ${qrSize}in; display: flex; align-items: center; justify-content: center; }
        .qr-img { width: 100%; height: 100%; object-fit: contain; }
        .name-wrap { flex: 1; min-width: 0; display: flex; align-items: center; }
        .name { font-size: 11px; font-weight: 600; color: #1a1a1a; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; }
        ${overlayStyles}
      `;

      const overlayHtml = showAveryOverlay
        ? `<div class="overlay">${Array(perPage).fill('<div class="overlay-label"></div>').join("")}</div>`
        : "";

      const sheets = pages
        .map((pageItems) => {
          const tiles = pageItems
            .map((i) => {
              const qr = i.imgSrc || "";
              const nm = String(i.name ?? "").toUpperCase();
              return `<div class="label"><div class="qr-wrap"><img class="qr-img" src="${qr}" alt="QR"/></div><div class="name-wrap"><span class="name">${nm}</span></div></div>`;
            })
            .join("");
          return `<section class="page">${tiles}${overlayHtml}</section>`;
        })
        .join("");

      return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${sheets}</body></html>`;
    }

    // Zebra A8 template: single label per page (48mm x 69mm)
    // For grouped mode, we flatten all items since Zebra prints one item per page
    if (template === "zebra-a8") {
      const allItems = getAllResolvedItems();
      const brand = brandLogoSrc || talihoLogo;
      const websiteUrl = companyWebsite || "www.taliho.com";
      const dims = { w: 1.89, h: 2.717 };
      const borderW = 1.5;
      const borderH = 1.65;
      const qrSizeIn = 1.1;

      const styles = `
        @page { size: ${dims.w}in ${dims.h}in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; }
        .sheet { width: ${dims.w}in; height: ${dims.h}in; padding: 0.1in; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
        .header { display: flex; flex-direction: column; align-items: center; gap: 0.02in; margin-bottom: 0.08in; }
        .logo { height: 0.45in; max-width: 1.5in; object-fit: contain; }
        .website { font-size: 10px; font-weight: 700; text-align: center; }
        .labelbox { border: 2px solid #111; border-radius: 6px; width: ${borderW}in; height: ${borderH}in; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.08in; }
        .qrimg { width: ${qrSizeIn}in; height: ${qrSizeIn}in; object-fit: contain; }
        .qrname { font-size: 11px; font-weight: 700; margin-top: 0.06in; text-align: center; letter-spacing: 0.02em; }
      `;

      const sheets = allItems
        .map((i) => {
          const nm = String(i.name ?? "");
          return `<section class="sheet"><header class="header"><img class="logo" src="${brand}" alt="Logo"/><div class="website">${websiteUrl}</div></header><main class="labelbox"><img class="qrimg" src="${i.imgSrc}" alt="QR"/><div class="qrname">${nm.toUpperCase()}</div></main></section>`;
        })
        .join("");

      return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${sheets}</body></html>`;
    }

    // Default Letter template with grouped printing (each group gets its own pages with headers)
    const brand = brandLogoSrc || talihoLogo;
    const perPage = Math.max(
      1,
      Math.min(payload.itemsPerPage ?? 1, maxItemsPerPage),
    );
    const cols = colsFor(perPage);

    // Use multi-item styles for grouped printing
    const styles = buildStylesMulti(
      payload.paperSize,
      payload.orientation,
      cols,
    );

    // Generate sheets for each group
    const allSheets: string[] = [];

    itemGroups.forEach((group) => {
      // Get resolved image sources for this group's items
      const groupResolvedItems = group.items.map((item) => {
        const resolved = {
          ...item,
          imgSrc: resolvedSources[flatIndex] ?? item.imgSrc,
        };
        flatIndex++;
        return resolved;
      });

      // Skip groups with no items
      if (groupResolvedItems.length === 0) return;

      // Build header HTML for this group
      const showProjectName = payload.headerProjectName !== false;
      const showGroupName = payload.headerGroupName !== false;
      const headerHiddenClass = !showProjectName ? " hidden-content" : "";
      const subheaderHiddenClass = !showGroupName ? " hidden-content" : "";

      const headerHtml = `<header class="header${headerHiddenClass}"><div class="headerRow"><div class="company">${group.projectName ?? ""}</div><div class="company">${group.clientName ?? ""}</div></div><div class="address">${group.addressLine ?? ""}</div></header><div class="subheader${subheaderHiddenClass}">${group.groupName ?? ""}</div>`;

      // Build footer HTML with 3 columns: company name (left), copyright (center), logo (right)
      const showCompanyNameFooter = payload.footerShowCompanyName !== false;
      const showLogoFooter = payload.footerShowLogo !== false;
      const companyNameHtml = showCompanyNameFooter ? (companyName ?? "") : "";
      const logoHtml = showLogoFooter
        ? `<img class="brand" src="${brand}" alt="Taliho"/>`
        : "";
      const footerHtml = `<footer class="footer"><div class="footer-left">${companyNameHtml}</div><div class="footer-center">Powered by Taliho</div><div class="footer-right">${logoHtml}</div></footer>`;

      // Chunk this group's items into pages
      const pages = chunk(groupResolvedItems, perPage);

      // Generate sheets for this group
      pages.forEach((pageItems) => {
        const tiles = pageItems
          .map((i) => {
            const name = String(i.name ?? "").toUpperCase();
            return `<div class="tile"><img class="qrimg" src="${i.imgSrc}" alt="QR"/>${payload.includeCaptions ? `<div class="qrname">${name}</div>` : ""}</div>`;
          })
          .join("");
        allSheets.push(
          `<section class="sheet">${headerHtml}<main class="grid">${tiles}</main>${footerHtml}</section>`,
        );
      });
    });

    return `<!doctype html><html><head><meta charset="utf-8"/><title>${computePrintTitle()}</title><style>${styles}</style></head><body>${allSheets.join("")}</body></html>`;
  }

  const computedSubtitle: ReactNode = subtitle ?? (
    <span>
      Configure print settings
      {effectiveTotalCount > 0
        ? ` for ${effectiveTotalCount} selected item${effectiveTotalCount === 1 ? "" : "s"}`
        : ""}
      {isGroupedMode && itemGroups
        ? ` across ${itemGroups.length} group${itemGroups.length === 1 ? "" : "s"}`
        : ""}
      .
    </span>
  );

  const isLetter = template === "letter";
  const isAvery = template === "avery-6871";
  const isZebra = template === "zebra-a8";
  const effectiveAllowMultiple = isLetter;
  // Compute dynamic max: min(effectiveTotalCount, maxItemsPerPage)
  // This ensures slider max never exceeds actual item count
  const computedMaxItemsPerPage = Math.max(
    1,
    Math.min(effectiveTotalCount ?? maxItemsPerPage, maxItemsPerPage),
  );
  const effectiveMaxItemsPerPage = isLetter
    ? computedMaxItemsPerPage
    : isAvery
      ? Math.min(18, effectiveTotalCount ?? 18)
      : 1;
  const effectiveItemsPerPage = isLetter ? itemsPerPage : isAvery ? 18 : 1;

  // Compute loading stats
  const loadingStats = useMemo(() => {
    const values = Object.values(loadingState);
    return {
      loadedCount: values.filter((s) => s === "loaded").length,
      errorCount: values.filter((s) => s === "error").length,
      total: effectiveItems?.length ?? 0,
    };
  }, [loadingState, effectiveItems?.length]);

  // Detect when items exist but loading hasn't started tracking yet
  const isInitialLoading =
    effectiveItems &&
    effectiveItems.length > 0 &&
    Object.keys(loadingState).length === 0;

  // Detect when loading is complete but there are no printable items at all
  const hasNoItems =
    !isLoadingItems && (!effectiveItems || effectiveItems.length === 0);

  // In grouped mode, detect groups with no items for targeted warnings
  const emptyGroupNames = useMemo(() => {
    if (!isGroupedMode || !itemGroups) return [];
    return itemGroups
      .filter((g) => g.items.length === 0)
      .map((g) => g.groupName);
  }, [isGroupedMode, itemGroups]);

  // Collapse preview when there are many items (default to collapsed)
  const [previewCollapsed, setPreviewCollapsed] = useState(true);
  const showPreview =
    effectiveItems && effectiveItems.length > 0 && effectiveItems.length <= 20;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={computedSubtitle}
      scrollable
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-printer"
            disabled={
              isLoadingItems ||
              // Disable when there are no printable items
              hasNoItems ||
              // Disable until brand logo is ready (for Zebra and Letter templates that use it)
              ((isLetter || isZebra) && !brandLogoReady) ||
              (effectiveItems &&
                effectiveItems.length > 0 &&
                (isInitialLoading ||
                  !allImagesReady ||
                  Object.values(loadingState).every((s) => s === "error")))
            }
            onClick={() => {
              // Validate brand logo is ready for templates that use it
              if ((isLetter || isZebra) && !brandLogoReady) {
                toast.error("Logo is still loading. Please wait.");
                return;
              }

              // Validate images are ready
              if (effectiveItems && effectiveItems.length > 0) {
                if (!allImagesReady) {
                  toast.error("Images are still loading. Please wait.");
                  return;
                }

                const failedCount = Object.values(loadingState).filter(
                  (state) => state === "error",
                ).length;

                if (failedCount === effectiveItems.length) {
                  toast.error("Cannot print: all images failed to load.");
                  return;
                }

                if (failedCount > 0) {
                  // Show confirmation if some images failed
                  const totalItems = effectiveItems.length;
                  const confirmed = confirm(
                    `${failedCount} of ${totalItems} image${totalItems === 1 ? "" : "s"} failed to load. Print anyway?`,
                  );
                  if (!confirmed) return;
                }
              }

              const payload = {
                paperSize: isZebra ? "letter" : paperSize,
                orientation: isZebra ? "landscape" : orientation,
                includeCaptions,
                itemsPerPage: effectiveItemsPerPage,
                template,
                headerProjectName,
                headerGroupName,
                footerShowCompanyName,
                footerShowLogo,
              };
              const hasDefaultInputs = Boolean(
                companyName ||
                  projectLine ||
                  groupLine ||
                  addressLine ||
                  (effectiveItems && effectiveItems.length > 0),
              );
              if (
                inlinePrint &&
                (buildHtml || hasDefaultInputs || isGroupedMode)
              ) {
                let html: string;
                if (buildHtml) {
                  html = buildHtml(payload);
                } else if (isGroupedMode) {
                  html = buildGroupedHtml(payload);
                } else {
                  html = buildDefaultHtml(payload);
                }
                printInline(html);
                // Call onConfirm (not onClose) to signal successful print completion
                // This allows parent components to handle post-print cleanup (e.g., exit bulk mode)
                onConfirm(payload);
                return;
              }
              onConfirm(payload);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-4">
        {/* External loading state - parent is fetching items */}
        {isLoadingItems && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-brand-50 border-b border-brand-100">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
                  <i className="bx bx-loader-alt animate-spin text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-800">
                    Loading QR codes...
                  </p>
                  <p className="text-xs text-brand-600">
                    Fetching items for print
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Empty state - no printable QR codes */}
        {hasNoItems && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <i className="bx bx-info-circle text-gray-500 text-lg" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    No QR codes to print
                  </p>
                  <p className="text-xs text-gray-500">
                    {emptyGroupNames.length > 0
                      ? `The following group${emptyGroupNames.length === 1 ? " has" : "s have"} no QR codes: ${emptyGroupNames.join(", ")}`
                      : "The selected group does not contain any QR codes. Add QR codes to this group before printing."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Internal loading state - items provided but images loading */}
        {!isLoadingItems &&
          effectiveItems &&
          effectiveItems.length > 0 &&
          isInitialLoading && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-brand-50 border-b border-brand-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
                    <i className="bx bx-loader-alt animate-spin text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-brand-800">
                      Preparing QR codes...
                    </p>
                    <p className="text-xs text-brand-600">
                      Setting up {effectiveItems?.length ?? 0} item
                      {effectiveItems?.length === 1 ? "" : "s"} for print
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        {!isLoadingItems &&
          effectiveItems &&
          effectiveItems.length > 0 &&
          !isInitialLoading && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Status Header */}
              <div
                className={`px-4 py-3 flex items-center justify-between ${
                  !allImagesReady
                    ? "bg-brand-50 border-b border-brand-100"
                    : loadingStats.errorCount > 0
                      ? "bg-amber-50 border-b border-amber-100"
                      : "bg-emerald-50 border-b border-emerald-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  {!allImagesReady ? (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
                        <i className="bx bx-loader-alt animate-spin text-brand-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-800">
                          Loading images...
                        </p>
                        <p className="text-xs text-brand-600">
                          {loadingStats.loadedCount} of {loadingStats.total}{" "}
                          ready
                        </p>
                      </div>
                    </>
                  ) : loadingStats.errorCount > 0 ? (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                        <i className="bx bx-error text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          {loadingStats.errorCount} image
                          {loadingStats.errorCount === 1 ? "" : "s"} failed to
                          load
                        </p>
                        <p className="text-xs text-amber-600">
                          {loadingStats.loadedCount} of {loadingStats.total}{" "}
                          will print
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                        <i className="bx bx-check text-emerald-600 text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">
                          All images ready
                        </p>
                        <p className="text-xs text-emerald-600">
                          {loadingStats.total} QR code
                          {loadingStats.total === 1 ? "" : "s"} to print
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {showPreview && (
                  <button
                    type="button"
                    onClick={() => setPreviewCollapsed(!previewCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <span>{previewCollapsed ? "Show" : "Hide"} preview</span>
                    <i
                      className={`bx bx-chevron-down transition-transform duration-200 ${
                        previewCollapsed ? "rotate-0" : "rotate-180"
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Collapsible Preview Grid with Animation */}
              {showPreview && (
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                    previewCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`p-3 bg-gray-50 max-h-40 overflow-y-auto transition-opacity duration-200 ${
                        previewCollapsed ? "opacity-0" : "opacity-100"
                      }`}
                    >
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {resolvedItems.map((item, index) => {
                          const status = loadingState[index];
                          return (
                            <PortalTooltip
                              key={index}
                              content={item.name}
                              maxWidth={150}
                            >
                              <div
                                className={`aspect-square rounded-md border-2 flex items-center justify-center bg-white overflow-hidden cursor-default ${
                                  status === "error"
                                    ? "border-red-200"
                                    : status === "loaded"
                                      ? "border-gray-200"
                                      : "border-brand-200"
                                }`}
                              >
                                {status === "loading" && (
                                  <i className="bx bx-loader-alt animate-spin text-brand-400" />
                                )}
                                {status === "loaded" && (
                                  <img
                                    src={item.imgSrc}
                                    alt={item.name}
                                    className="w-full h-full object-contain p-1"
                                  />
                                )}
                                {status === "error" && (
                                  <i className="bx bx-error-circle text-red-400 text-lg" />
                                )}
                              </div>
                            </PortalTooltip>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Warning for grouped mode when some groups have no QR codes */}
        {!hasNoItems && emptyGroupNames.length > 0 && (
          <div className="rounded-lg border border-amber-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 flex-shrink-0">
                  <i className="bx bx-error text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {emptyGroupNames.length} group
                    {emptyGroupNames.length === 1 ? "" : "s"} with no QR codes
                  </p>
                  <p className="text-xs text-amber-600">
                    {emptyGroupNames.join(", ")} will be skipped during
                    printing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Settings - Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div>
            {/* Template Selection */}
            <fieldset>
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Template
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: "letter", label: "Standard" },
                  { value: "avery-6871", label: "Avery 6871" },
                  { value: "zebra-a8", label: "Zebra" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTemplate(opt.value as TemplateType)}
                    className={`px-2 py-2 text-xs font-medium rounded-md border-2 transition-all ${
                      template === opt.value
                        ? "bg-brand-50 text-brand-700 border-brand-400"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Paper Size - only show for Letter template */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out ${
                isLetter
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {paperSizeLabel}
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: "letter", label: "8.5 × 11 (Letter)" },
                      { value: "elevenByFourteen", label: "11 × 14" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaperSize(opt.value as PaperSize)}
                        className={`px-2 py-2 text-xs font-medium rounded-md border-2 transition-all ${
                          paperSize === opt.value
                            ? "bg-brand-50 text-brand-700 border-brand-400"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {paperSize === "elevenByFourteen" && (
                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <i className="bx bx-info-circle text-sm" />
                      Select &quot;11 × 14&quot; in your print dialog&apos;s
                      paper size dropdown for correct sizing.
                    </p>
                  )}
                </fieldset>
              </div>
            </div>

            {/* Orientation - only show for Letter template */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out ${
                isLetter
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {orientationLabel}
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        value: "portrait",
                        label: "Portrait",
                        icon: "bx-rectangle-landscape rotate-90",
                      },
                      {
                        value: "landscape",
                        label: "Landscape",
                        icon: "bx-rectangle-landscape",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOrientation(opt.value as Orientation)}
                        className={`px-2 py-2 text-xs font-medium rounded-md border-2 transition-all flex items-center justify-center gap-1.5 ${
                          orientation === opt.value
                            ? "bg-brand-50 text-brand-700 border-brand-400"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <i className={`bx ${opt.icon} text-sm`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Header Content */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                isLetter
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Header Content
                  </legend>
                  <div className="space-y-2 bg-gray-50 rounded-md p-3">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={headerProjectName}
                        onChange={(e) => setHeaderProjectName(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Show Project Name
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={headerGroupName}
                        onChange={(e) => setHeaderGroupName(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Show Group Name
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Footer Content */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out ${
                isLetter
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Footer Content
                  </legend>
                  <div className="space-y-2 bg-gray-50 rounded-md p-3">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={footerShowCompanyName}
                        onChange={(e) =>
                          setFooterShowCompanyName(e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Show Company Name
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={footerShowLogo}
                        onChange={(e) => setFooterShowLogo(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Show Company Logo
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Items Per Page */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out ${
                effectiveAllowMultiple
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {itemsPerPageLabel}
                  </legend>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={effectiveMaxItemsPerPage}
                        value={effectiveItemsPerPage}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setItemsPerPage(newValue);
                          // Persist preference for multi-item scenarios
                          if (effectiveMaxItemsPerPage > 1) {
                            setStoredItemsPerPage(newValue);
                          }
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                      />
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] rounded-md px-2 py-1 text-sm font-semibold bg-brand-100 text-brand-700 ring-1 ring-brand-200">
                        {effectiveItemsPerPage}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      QR codes per printed page
                    </p>
                  </div>
                </fieldset>
              </div>
            </div>

            {/* Template Info - shows fixed paper size/orientation for non-Letter templates */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                !isLetter
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <div className="flex items-start gap-2">
                    <i className="bx bx-info-circle text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {isAvery ? "Avery 6871" : "Zebra"} Template
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isAvery
                          ? '3×6 grid layout (18 labels per page) on 8.5" × 11" paper'
                          : "Single label format (48mm × 69mm portrait)"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avery 6871 Alignment Overlay Option */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out ${
                isAvery
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Alignment Verification
                  </legend>
                  <div className="space-y-2 bg-amber-50 rounded-md p-3 border border-amber-200">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showAveryOverlay}
                        onChange={(e) => setShowAveryOverlay(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Show template overlay
                      </span>
                    </label>
                    <p className="text-xs text-amber-700">
                      Prints red label boundaries to verify alignment with Avery
                      6871 sticker sheets. Disable for final prints.
                    </p>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
