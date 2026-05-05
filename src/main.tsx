import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Provider } from "react-redux";
import { store } from "./store";
import { routeTree } from "./routeTree.gen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api";
import Rollbar from "rollbar";
import {
  Provider as RollbarProvider,
  ErrorBoundary as RollbarErrorBoundary,
} from "@rollbar/react";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { setRollbarInstance, rollbar, buildUserContext } from "@/utils/rollbar";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import { installStaticFetchMock } from "@/api/mockdata/staticApi";
import { bootstrapAppSession } from "./bootstrapAppSession";

bootstrapAppSession();

if (STATIC_APP_MODE) {
  installStaticFetchMock();
}

const router = createRouter({
  routeTree,
  // Preload route chunks when the user hovers a Link, so clicking the
  // sidebar doesn't show a brief blank flash while the lazy chunk loads.
  defaultPreload: "intent",
  defaultPreloadDelay: 50,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rollbarConfig = {
  accessToken: import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN,
  enabled:
    !STATIC_APP_MODE &&
    import.meta.env.PROD &&
    !!import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN &&
    import.meta.env.VITE_ENVIRONMENT !== "test" &&
    import.meta.env.VITE_ENVIRONMENT !== "ci",
  captureUncaught: true,
  captureUnhandledRejections: true,
  environment: import.meta.env.VITE_ENVIRONMENT,

  tracing: {
    enabled: true,
    endpoint: "api.rollbar.com/api/1/session/",
  },
  replay: {
    enabled: true,
    autoStart: true,
    triggers: [
      {
        type: "occurrence",
        level: ["error", "critical"],
        samplingRatio: 1.0,
        preDuration: 60,
        postDuration: 5,
      },
    ],
    maskInputOptions: { password: true },
    blockClass: "rb-block",
    maskTextClass: "rb-mask",
    debug: { logEmits: true, logErrors: true },
  },

  payload: {
    client: {
      javascript: {
        code_version: "1.0.0",
        source_map_enabled: true,
      },
    },
  },
  checkIgnore: (_isUncaught: boolean, _args: unknown[], item: unknown) => {
    const payload = item as Rollbar.Payload;
    const message =
      (payload?.body as { message?: { body?: string } })?.message?.body ||
      (payload?.body as { trace?: { exception?: { message?: string } } })?.trace
        ?.exception?.message ||
      "";
    if (message.includes("PROJECT_ARCHIVED")) return true;
    if (message.includes("CanceledError")) return true;
    if (message.includes("ERR_CANCELED")) return true;
    return false;
  },

  // Transform payload to add person tracking for Rollbar's "People" feature
  transform: (payloadData: Rollbar.Dictionary) => {
    try {
      const payload = payloadData as Rollbar.Payload;
      const userContext = buildUserContext();

      // Set person for Rollbar's built-in person tracking
      payload.person = userContext.person;

      // Merge custom context into payload
      if (!payload.custom) {
        payload.custom = {};
      }
      Object.assign(payload.custom, userContext.custom);
      (payload.custom as Record<string, unknown>).isAnonymous =
        userContext.isAnonymous;
    } catch {
      // If context building fails, continue without person tracking
      // This prevents errors in the error handler from breaking error reporting
    }
  },
} as Rollbar.Configuration;

const shouldMountRollbar =
  !STATIC_APP_MODE &&
  !!import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN &&
  import.meta.env.VITE_ENVIRONMENT !== "test" &&
  import.meta.env.VITE_ENVIRONMENT !== "ci";

// Only create the Rollbar React provider when a real token is present.
// Otherwise @rollbar/react throws an invariant error during app bootstrap.
const rollbarInstance = shouldMountRollbar
  ? new Rollbar(rollbarConfig)
  : null;

if (rollbarInstance) {
  setRollbarInstance(rollbarInstance);
}

// Handle stale chunk errors after deployments: when a cached index.html
// references chunk hashes that no longer exist, Vite fires this event.
// Auto-reload fetches the new index.html with correct chunk references.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  // Guard against infinite reload loops (10-second cooldown)
  const lastReload = sessionStorage.getItem("chunk-reload-timestamp");
  const now = Date.now();
  if (lastReload && now - parseInt(lastReload, 10) < 10_000) {
    return;
  }

  sessionStorage.setItem("chunk-reload-timestamp", now.toString());
  window.location.reload();
});

// Global error handler for errors outside React
window.addEventListener("error", (event) => {
  rollbar.error(event.error || new Error(event.message), {
    feature: "global",
    action: "unhandled-error",
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
});

// Global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
  rollbar.error(error, {
    feature: "global",
    action: "unhandled-rejection",
  });
});

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  const app = (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );

  root.render(
    <StrictMode>
      {rollbarInstance ? (
        <RollbarProvider instance={rollbarInstance}>
          <RollbarErrorBoundary>{app}</RollbarErrorBoundary>
        </RollbarProvider>
      ) : (
        app
      )}
    </StrictMode>,
  );
}
