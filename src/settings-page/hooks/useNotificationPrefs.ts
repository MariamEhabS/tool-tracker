/**
 * @fileoverview Hook for reading and updating user notification preferences
 * with optimistic updates, debounced frequency changes, and per-channel
 * toggle helpers.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationFrequency,
  type PatchNotificationPreferencesDto,
} from "@/api/endpoints/user";

export type { NotificationPreferences, NotificationFrequency };

// Re-export individual preference types for convenience
export type {
  EmailNotificationPreferences,
  PushNotificationPreferences,
} from "@/api/endpoints/user";

// Debounce delay for frequency changes (ms)
const FREQUENCY_DEBOUNCE_MS = 500;

/**
 * Fetches and manages notification preferences for a user, with optimistic
 * updates on mutations, automatic cache invalidation, and toast notifications
 * for success/failure.
 *
 * Provides convenience methods for toggling individual email and push
 * notification channels, changing the notification frequency (debounced to
 * 500ms), and managing quiet hours.
 *
 * @param userId - The user ID whose preferences to manage
 * @param companyId - The company ID (included in mutation payloads)
 * @returns An object containing:
 *   - `data` - The current {@link NotificationPreferences} or `undefined`
 *   - `isLoading` - Whether the initial fetch is in progress
 *   - `isError` - Whether the query is in an error state
 *   - `error` - The query error, if any
 *   - `isUpdating` - Whether a mutation is currently in flight
 *   - `updatePrefs` - Save arbitrary preference updates immediately
 *   - `updateFrequency` - Change notification frequency (debounced)
 *   - `toggleEmailPref` - Toggle a specific email notification channel
 *   - `togglePushPref` - Toggle a specific push notification channel
 *   - `toggleQuietHours` - Toggle quiet hours on/off
 *   - `updateQuietHours` - Set quiet hours start and end times
 */
export function useNotificationPrefs(userId: string, companyId: string) {
  const queryClient = useQueryClient();
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = useMemo(() => ["notification-prefs", userId], [userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => getNotificationPreferences(userId, companyId),
    enabled: Boolean(userId && companyId),
  });

  const mutation = useMutation({
    mutationFn: (payload: PatchNotificationPreferencesDto) =>
      updateNotificationPreferences(userId, payload),
    onMutate: async (newPrefs) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous =
        queryClient.getQueryData<NotificationPreferences>(queryKey);

      // Optimistically update to the new value
      if (previous) {
        const optimisticUpdate: NotificationPreferences = {
          ...previous,
          email: {
            ...previous.email,
            ...newPrefs.email,
          },
          push: {
            ...previous.push,
            ...newPrefs.push,
          },
          frequency: newPrefs.frequency ?? previous.frequency,
          quietHoursEnabled:
            newPrefs.quietHoursEnabled ?? previous.quietHoursEnabled,
          quietHoursStart: newPrefs.quietHoursStart ?? previous.quietHoursStart,
          quietHoursEnd: newPrefs.quietHoursEnd ?? previous.quietHoursEnd,
        };
        queryClient.setQueryData(queryKey, optimisticUpdate);
      }

      return { previous };
    },
    onError: (_err, _newPrefs, context) => {
      // Rollback to the previous value on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Failed to update notification preferences");
    },
    onSuccess: () => {
      toast.success("Notification preferences updated");
    },
    onSettled: () => {
      // Refetch after mutation to ensure server state is in sync
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Direct update function for toggle changes (saves immediately)
  const updatePrefs = useCallback(
    (updates: Omit<PatchNotificationPreferencesDto, "companyId">) => {
      mutation.mutate({ ...updates, companyId });
    },
    [mutation, companyId],
  );

  // Debounced update function for frequency selector changes
  const updateFrequency = useCallback(
    (frequency: NotificationFrequency) => {
      // Clear any pending debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Optimistically update the UI immediately
      const previous =
        queryClient.getQueryData<NotificationPreferences>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, { ...previous, frequency });
      }

      // Debounce the actual API call
      debounceTimeoutRef.current = setTimeout(() => {
        mutation.mutate({ frequency, companyId });
      }, FREQUENCY_DEBOUNCE_MS);
    },
    [mutation, companyId, queryClient, queryKey],
  );

  // Toggle a specific email notification preference
  const toggleEmailPref = useCallback(
    (key: keyof NotificationPreferences["email"]) => {
      const current = query.data?.email[key];
      if (current !== undefined) {
        updatePrefs({ email: { [key]: !current } });
      }
    },
    [query.data?.email, updatePrefs],
  );

  // Toggle a specific push notification preference
  const togglePushPref = useCallback(
    (key: keyof NotificationPreferences["push"]) => {
      const current = query.data?.push[key];
      if (current !== undefined) {
        updatePrefs({ push: { [key]: !current } });
      }
    },
    [query.data?.push, updatePrefs],
  );

  // Toggle quiet hours
  const toggleQuietHours = useCallback(() => {
    const current = query.data?.quietHoursEnabled;
    if (current !== undefined) {
      updatePrefs({ quietHoursEnabled: !current });
    }
  }, [query.data?.quietHoursEnabled, updatePrefs]);

  // Update quiet hours time range
  const updateQuietHours = useCallback(
    (start: string, end: string) => {
      updatePrefs({ quietHoursStart: start, quietHoursEnd: end });
    },
    [updatePrefs],
  );

  return {
    // Query state
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    // Mutation state
    isUpdating: mutation.isPending,

    // Update functions
    updatePrefs,
    updateFrequency,
    toggleEmailPref,
    togglePushPref,
    toggleQuietHours,
    updateQuietHours,
  };
}
