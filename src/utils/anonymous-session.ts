/**
 * Anonymous Session Tracking for QR Scanner Users
 *
 * This utility provides stable session identification for users who access
 * the app without authentication (e.g., scanning QR codes publicly).
 *
 * Uses sessionStorage so it:
 * - Persists across page refreshes during a scan session
 * - Resets when browser is closed (privacy-friendly)
 * - Does not persist across browser sessions
 */

const ANON_SESSION_KEY = "taliho_anon_session";
const ANON_ENTRY_POINT_KEY = "taliho_anon_entry";
const ANON_QR_CODES_KEY = "taliho_anon_qrcodes";

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface AnonymousContext {
  sessionId: string;
  deviceType: DeviceType;
  userAgent: string;
  screenSize: string;
  language: string;
  timezone: string;
  entryPoint?: string;
  scannedQrCodeIds: string[];
  createdAt: string;
}

/**
 * Detect device type based on user agent and screen size
 */
export const detectDeviceType = (): DeviceType => {
  const ua = navigator.userAgent.toLowerCase();
  const screenWidth = window.screen.width;

  // Check for mobile devices
  const isMobile =
    /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua);

  // Also check screen width as a fallback
  if (isTablet || (screenWidth >= 768 && screenWidth < 1024 && isMobile)) {
    return "tablet";
  }

  if (isMobile || screenWidth < 768) {
    return "mobile";
  }

  return "desktop";
};

/**
 * Generate a unique anonymous session ID
 * Format: anon_{timestamp}_{random}
 */
const generateSessionId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `anon_${timestamp}_${random}`;
};

/**
 * Get the user's timezone safely
 */
const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "unknown";
  }
};

/**
 * Get or create an anonymous session
 * Creates a new session if one doesn't exist in sessionStorage
 */
export const getOrCreateAnonymousSession = (): AnonymousContext => {
  try {
    // Try to retrieve existing session
    const existingSession = sessionStorage.getItem(ANON_SESSION_KEY);
    if (existingSession) {
      const parsed = JSON.parse(existingSession) as AnonymousContext;
      // Update scanned QR codes and entry point from separate storage (may have been updated)
      const qrCodes = getScannedQrCodeIds();
      const entryPoint = getAnonymousEntryPoint();
      return {
        ...parsed,
        scannedQrCodeIds: qrCodes,
        entryPoint: entryPoint ?? parsed.entryPoint,
      };
    }
  } catch {
    // If parsing fails, create a new session
  }

  // Create new session (include any already-tracked QR codes and entry point)
  const existingQrCodes = getScannedQrCodeIds();
  const existingEntryPoint = getAnonymousEntryPoint();
  const newSession: AnonymousContext = {
    sessionId: generateSessionId(),
    deviceType: detectDeviceType(),
    userAgent: navigator.userAgent.slice(0, 200), // Truncate for storage
    screenSize: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || "unknown",
    timezone: getTimezone(),
    scannedQrCodeIds: existingQrCodes,
    entryPoint: existingEntryPoint,
    createdAt: new Date().toISOString(),
  };

  // Store the session
  try {
    sessionStorage.setItem(ANON_SESSION_KEY, JSON.stringify(newSession));
  } catch {
    // sessionStorage might be disabled - continue without persistence
  }

  return newSession;
};

/**
 * Get the current session ID (creates one if it doesn't exist)
 */
export const getAnonymousSessionId = (): string => {
  return getOrCreateAnonymousSession().sessionId;
};

/**
 * Set the entry point for the anonymous session
 * @param entryPoint - How the user entered the app (e.g., 'qr-scan', 'direct-link')
 */
export const setAnonymousEntryPoint = (entryPoint: string): void => {
  try {
    sessionStorage.setItem(ANON_ENTRY_POINT_KEY, entryPoint);

    // Also update the session object
    const existingSession = sessionStorage.getItem(ANON_SESSION_KEY);
    if (existingSession) {
      const parsed = JSON.parse(existingSession) as AnonymousContext;
      parsed.entryPoint = entryPoint;
      sessionStorage.setItem(ANON_SESSION_KEY, JSON.stringify(parsed));
    }
  } catch {
    // sessionStorage might be disabled
  }
};

/**
 * Get the entry point for the current anonymous session
 */
export const getAnonymousEntryPoint = (): string | undefined => {
  try {
    return sessionStorage.getItem(ANON_ENTRY_POINT_KEY) || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Track a scanned QR code for the anonymous session
 * @param qrCodeId - The ID of the QR code that was scanned
 */
export const trackScannedQrCode = (qrCodeId: string): void => {
  try {
    const existingCodes = sessionStorage.getItem(ANON_QR_CODES_KEY);
    const codes: string[] = existingCodes ? JSON.parse(existingCodes) : [];

    // Add the new code if not already tracked (avoid duplicates)
    if (!codes.includes(qrCodeId)) {
      codes.push(qrCodeId);
      sessionStorage.setItem(ANON_QR_CODES_KEY, JSON.stringify(codes));
    }
  } catch {
    // sessionStorage might be disabled
  }
};

/**
 * Get all scanned QR code IDs for this anonymous session
 */
export const getScannedQrCodeIds = (): string[] => {
  try {
    const existingCodes = sessionStorage.getItem(ANON_QR_CODES_KEY);
    return existingCodes ? JSON.parse(existingCodes) : [];
  } catch {
    return [];
  }
};

/**
 * Get the most recently scanned QR code ID
 */
export const getLastScannedQrCodeId = (): string | undefined => {
  const codes = getScannedQrCodeIds();
  return codes.length > 0 ? codes[codes.length - 1] : undefined;
};

/**
 * Check if the current session is anonymous (no authenticated user)
 * This checks localStorage for user data
 */
export const isAnonymousSession = (): boolean => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return true;

    const user = JSON.parse(userStr);
    // Check if user has a valid ID (authenticated)
    return !user?._id && !user?.userId;
  } catch {
    return true;
  }
};

/**
 * Clear the anonymous session
 * Useful for when a user logs in or explicitly clears their session
 */
export const clearAnonymousSession = (): void => {
  try {
    sessionStorage.removeItem(ANON_SESSION_KEY);
    sessionStorage.removeItem(ANON_ENTRY_POINT_KEY);
    sessionStorage.removeItem(ANON_QR_CODES_KEY);
  } catch {
    // sessionStorage might be disabled
  }
};
