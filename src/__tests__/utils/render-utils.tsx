/**
 * Test render utilities for wrapping components with necessary providers
 * Used by all component tests that need Redux and React Query contexts
 */

import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { ReactElement, ReactNode } from "react";

// Import reducers from store slices
import appReducer from "@/store/slices/appSlice";
import userReducer from "@/store/slices/userSlice";
import companyReducer from "@/store/slices/companySlice";
import projectReducer from "@/store/slices/projectSlice";
import procoreReducer from "@/store/slices/procoreSlice";
import folderFileReducer from "@/store/slices/folderFileSlice";
import folderRecurseReducer from "@/store/slices/folderRecurseSlice";

/**
 * Root reducer combining all Redux slices
 * Matches the structure in src/store/index.ts
 */
const rootReducer = combineReducers({
  app: appReducer,
  user: userReducer,
  company: companyReducer,
  project: projectReducer,
  procore: procoreReducer,
  folderFile: folderFileReducer,
  folderRecurse: folderRecurseReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/**
 * Creates a fresh QueryClient for testing
 * Configured with retry disabled and no caching for predictable tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a test Redux store with optional preloaded state
 */
export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState,
  });
}

export type TestStore = ReturnType<typeof createTestStore>;

/**
 * Extended render options for testing with providers
 */
interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Partial Redux state to preload */
  preloadedState?: Partial<RootState>;
  /** Custom QueryClient instance (created fresh if not provided) */
  queryClient?: QueryClient;
  /** Custom Redux store instance (created from preloadedState if not provided) */
  store?: TestStore;
}

/**
 * Render a component wrapped with all necessary providers:
 * - Redux Provider with configurable initial state
 * - React Query QueryClientProvider
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { getByText } = renderWithProviders(<MyComponent />);
 *
 * // With preloaded Redux state
 * const { getByText } = renderWithProviders(<MyComponent />, {
 *   preloadedState: {
 *     user: { firstName: 'Test', permission: 'admin' },
 *   },
 * });
 *
 * // Access the store for assertions or dispatching
 * const { store } = renderWithProviders(<MyComponent />);
 * expect(store.getState().app.authenticated).toBe(true);
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    queryClient = createTestQueryClient(),
    store = createTestStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Provider>
    );
  }

  return {
    store,
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Creates a wrapper component for use with renderHook
 *
 * @example
 * ```tsx
 * const wrapper = createWrapper({
 *   preloadedState: { company: standardCompany },
 * });
 * const { result } = renderHook(() => useMyHook(), { wrapper });
 * ```
 */
export function createWrapper({
  preloadedState = {},
  queryClient = createTestQueryClient(),
  store = createTestStore(preloadedState),
}: {
  preloadedState?: Partial<RootState>;
  queryClient?: QueryClient;
  store?: TestStore;
} = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Provider>
    );
  };
}

/**
 * Type-safe helper for creating partial Redux state for testing
 * Provides better autocomplete and type checking
 */
export function createPreloadedState(
  state: Partial<RootState>,
): Partial<RootState> {
  return state;
}

// Re-export everything from @testing-library/react for convenience
// eslint-disable-next-line react-refresh/only-export-components
export * from "@testing-library/react";
