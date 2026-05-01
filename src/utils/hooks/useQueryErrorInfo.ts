/**
 * @fileoverview Utility for parsing React Query errors into standardized
 * error info objects with convenient boolean flags for common HTTP statuses.
 */

import { parseHttpError, HttpErrorResult } from "@/utils/httpErrors";

export interface QueryErrorInfo extends HttpErrorResult {
  isNotFound: boolean;
  isForbidden: boolean;
  isServerError: boolean;
}

/**
 * Parses a query error into a standardized error info object.
 * Use this to get consistent error information from React Query errors.
 *
 * Extracts the HTTP status code, title, and message from the error, and adds
 * convenience boolean flags for 404 (Not Found), 403 (Forbidden), and 5xx
 * (Server Error) statuses.
 *
 * @param error - The error thrown by a React Query query or mutation
 * @returns A {@link QueryErrorInfo} object with parsed error details and
 *   boolean status flags, or `null` if the error is falsy
 *
 * @example
 * ```tsx
 * const { data, error, isError } = useSingleGroup(groupId);
 *
 * if (isError) {
 *   const errorInfo = getQueryErrorInfo(error);
 *   if (errorInfo.isNotFound) {
 *     return <InlineError title="Group Not Found" ... />;
 *   }
 *   if (errorInfo.isServerError) {
 *     return <InlineError title={errorInfo.title} onRetry={refetch} />;
 *   }
 * }
 * ```
 */
export function getQueryErrorInfo(error: unknown): QueryErrorInfo | null {
  if (!error) return null;

  const parsed = parseHttpError(error);

  return {
    ...parsed,
    isNotFound: parsed.statusCode === 404,
    isForbidden: parsed.statusCode === 403,
    isServerError: parsed.statusCode !== null && parsed.statusCode >= 500,
  };
}
