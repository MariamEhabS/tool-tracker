/**
 * @fileoverview Hook for subscribing to real-time admin presence updates via
 * a Socket.IO WebSocket connection. Provides a live snapshot of currently
 * active users (desktop and mobile counts plus user details).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { STATIC_ONLINE_PRESENCE } from "@/api/mockdata/staticApi";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import { safeLocalStorage } from "@/utils/safeStorage";

export interface EnrichedPresenceUser {
  sessionId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  routePath: string;
  isMobileRoute: boolean;
  lastSeenAt: string;
}

export interface EnrichedPresenceSnapshot {
  desktop: number;
  mobile: number;
  users: EnrichedPresenceUser[];
}

interface UseAdminPresenceSocketOptions {
  enabled?: boolean;
}

/**
 * Establishes a Socket.IO WebSocket connection to the admin presence namespace
 * and subscribes to real-time `presence:update` events. Returns the latest
 * presence snapshot and the current connection status.
 *
 * The socket authenticates using the access token from localStorage and
 * automatically reconnects (up to 10 attempts with 2-second intervals).
 *
 * **Lifecycle behavior:**
 * - Connects when `enabled` is `true` and a valid token exists.
 * - Disconnects and cleans up listeners on unmount or when `enabled` becomes `false`.
 *
 * @param options - Configuration options
 * @param options.enabled - Whether the socket connection should be active (defaults to `true`)
 * @returns An object containing:
 *   - `data` - The latest {@link EnrichedPresenceSnapshot} or `null` before first update
 *   - `connected` - Whether the socket is currently connected
 */
export function useAdminPresenceSocket(
  options: UseAdminPresenceSocketOptions = {},
) {
  const { enabled = true } = options;
  const [data, setData] = useState<EnrichedPresenceSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (STATIC_APP_MODE) {
      if (!enabled) {
        setData(null);
        setConnected(false);
        return;
      }
      setData(STATIC_ONLINE_PRESENCE);
      setConnected(true);
      return;
    }

    if (!enabled) {
      disconnect();
      return;
    }

    const token =
      safeLocalStorage.getItem("accessToken") ||
      safeLocalStorage.getItem("token");

    if (!token) {
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL as string;

    const socket = io(`${backendUrl}/admin/presence`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("presence:update", (snapshot: EnrichedPresenceSnapshot) => {
      setData(snapshot);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, disconnect]);

  return { data, connected };
}
