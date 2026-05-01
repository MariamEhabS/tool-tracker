/**
 * @fileoverview URL state management for the Create QR wizard and
 * return-to navigation. Reads and writes wizard step, tab, method,
 * and context IDs to/from URL search params.
 */

import type { NavigateOptions } from "@tanstack/react-router";

export type CreateQRState = {
  step?: 1 | 2 | 3;
  tab?: "single" | "bulk" | null;
  sub?: string | null;
  method?: string | null;
  projectId?: string | null;
  groupingId?: string | null;
  groupAction?: "create" | null;
  /**
   * Type-first flow identifier (e.g. "taliho-code", "procore-drawing").
   * Added alongside the existing (tab, sub, method) triple so bookmarked
   * URLs from the old flow keep resolving. Serialized when present.
   */
  typeId?: string | null;
};

/**
 * Parses Create QR wizard state from URL search params (string, URLSearchParams, or object).
 * Defaults step to 1 and nullable fields to null when absent.
 */
export function readCreateQRState(
  search: string | URLSearchParams | Record<string, unknown>,
): CreateQRState {
  const params = ((): URLSearchParams => {
    if (typeof search === "string") return new URLSearchParams(search);
    if (search instanceof URLSearchParams) return new URLSearchParams(search);
    const qp = new URLSearchParams();
    Object.entries(search).forEach(([k, v]) => {
      if (v != null) qp.set(k, String(v));
    });
    return qp;
  })();
  const stepNum = Number(params.get("step") ?? "1");
  return {
    step: stepNum === 2 ? 2 : stepNum === 3 ? 3 : 1,
    tab: (params.get("tab") as CreateQRState["tab"]) ?? null,
    sub: params.get("sub"),
    method: params.get("method"),
    projectId: params.get("projectId") ?? params.get("project") ?? null,
    groupingId: params.get("groupingId"),
    groupAction:
      (params.get("groupAction") as CreateQRState["groupAction"]) ?? null,
    typeId: params.get("typeId"),
  };
}

/**
 * Navigates to /create-qr with the given wizard state encoded as search params.
 * @param navigate - TanStack Router navigate function
 * @param state - Wizard state including an optional `replace` flag
 */
export function writeCreateQRState(
  navigate: (opts: NavigateOptions) => void,
  state: CreateQRState & { replace?: boolean },
) {
  const searchObj: Record<string, unknown> = {};
  if (state.step != null) searchObj.step = String(state.step);
  if (state.tab != null) searchObj.tab = state.tab;
  if (state.sub != null) searchObj.sub = state.sub;
  if (state.method != null) searchObj.method = state.method;
  if (state.projectId != null && state.projectId !== "null")
    searchObj.projectId = state.projectId;
  if (state.groupingId != null && state.groupingId !== "null")
    searchObj.groupingId = state.groupingId;
  if (state.groupAction != null) searchObj.groupAction = state.groupAction;
  if (state.typeId != null && state.typeId !== "null")
    searchObj.typeId = state.typeId;

  const navOptions: NavigateOptions = {
    to: "/create-qr" as const,
    search: searchObj,
    replace: state.replace === true,
  };

  navigate(navOptions);
}

/**
 * Builds returnTo and returnQuery params from the current location,
 * allowing a destination page to navigate back after an action.
 */
export function buildReturnParams(location: {
  pathname: string;
  search: string;
}): { returnTo: string; returnQuery: string } {
  const returnTo = location.pathname;
  const qs = new URLSearchParams(location.search);
  return { returnTo, returnQuery: encodeURIComponent(qs.toString()) };
}

/**
 * Navigates to a target route while embedding returnTo/returnQuery search
 * params so the user can be sent back to their original location.
 */
export function navigateWithReturn(
  navigate: (opts: NavigateOptions) => void,
  to: "/create-qr" | "/projects" | "/dashboard" | "/my-qrcodes",
  location: { pathname: string; search: string },
) {
  const { returnTo, returnQuery } = buildReturnParams(location);
  navigate({
    to,
    search: { returnTo, returnQuery } as unknown as Record<string, unknown>,
  });
}

/**
 * Navigates back to the returnTo destination encoded in the current search params.
 * No-op if returnTo is not present.
 */
export function navigateToReturn(
  navigate: (opts: NavigateOptions) => void,
  search: string | URLSearchParams | Record<string, unknown>,
) {
  const params = ((): URLSearchParams => {
    if (typeof search === "string") return new URLSearchParams(search);
    if (search instanceof URLSearchParams) return new URLSearchParams(search);
    const qp = new URLSearchParams();
    Object.entries(search).forEach(([k, v]) => {
      if (v != null) qp.set(k, String(v));
    });
    return qp;
  })();
  const returnTo = params.get("returnTo") ?? undefined;
  const returnQuery = params.get("returnQuery") ?? undefined;
  if (!returnTo) return;
  const decoded = (() => {
    try {
      return returnQuery ? decodeURIComponent(returnQuery) : "";
    } catch {
      return "";
    }
  })();
  const parsed = new URLSearchParams(decoded);
  const searchObj = Object.fromEntries(parsed.entries()) as Record<
    string,
    unknown
  >;
  const dest = (returnTo.startsWith("/") ? returnTo : `/${returnTo}`) as
    | "/create-qr"
    | "/projects"
    | "/dashboard"
    | "/my-qrcodes";
  navigate({ to: dest, search: searchObj });
}

/**
 * Builds an href string for the Create QR wizard with the given state
 * encoded as query parameters.
 */
export function buildCreateQRHref(state: CreateQRState): string {
  const qp = new URLSearchParams();
  if (state.step != null) qp.set("step", String(state.step));
  if (state.tab != null) qp.set("tab", state.tab);
  if (state.sub != null) qp.set("sub", state.sub);
  if (state.method != null) qp.set("method", state.method);
  if (state.projectId != null) qp.set("projectId", state.projectId);
  if (state.groupingId != null) qp.set("groupingId", state.groupingId);
  if (state.groupAction != null) qp.set("groupAction", state.groupAction);
  if (state.typeId != null) qp.set("typeId", state.typeId);
  const qs = qp.toString();
  return `/create-qr${qs ? `?${qs}` : ""}`;
}
