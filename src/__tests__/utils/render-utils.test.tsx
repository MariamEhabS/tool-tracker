/**
 * Tests for render utilities
 * Verifies that the test wrapper utilities work correctly
 */

import { describe, it, expect, vi } from "vitest";
import { useSelector, useDispatch } from "react-redux";
import { renderHook, screen, act } from "@testing-library/react";
import {
  renderWithProviders,
  createWrapper,
  createTestStore,
  createTestQueryClient,
  RootState,
} from "./render-utils";
import { useQuery } from "@tanstack/react-query";
import { mockUserState } from "../fixtures/mock-data";

describe("render-utils", () => {
  describe("createTestQueryClient", () => {
    it("creates a QueryClient with retry disabled", () => {
      const client = createTestQueryClient();
      const defaultOptions = client.getDefaultOptions();
      expect(defaultOptions.queries?.retry).toBe(false);
      expect(defaultOptions.mutations?.retry).toBe(false);
    });

    it("creates a QueryClient with no caching", () => {
      const client = createTestQueryClient();
      const defaultOptions = client.getDefaultOptions();
      expect(defaultOptions.queries?.gcTime).toBe(0);
      expect(defaultOptions.queries?.staleTime).toBe(0);
    });
  });

  describe("createTestStore", () => {
    it("creates a store with default state", () => {
      const store = createTestStore();
      const state = store.getState();

      expect(state).toHaveProperty("app");
      expect(state).toHaveProperty("user");
      expect(state).toHaveProperty("company");
      expect(state).toHaveProperty("project");
      expect(state).toHaveProperty("procore");
      expect(state).toHaveProperty("folderFile");
      expect(state).toHaveProperty("folderRecurse");
    });

    it("creates a store with preloaded state", () => {
      const preloadedState = {
        user: mockUserState,
      };
      const store = createTestStore(preloadedState);
      const state = store.getState();

      expect(state.user.firstName).toBe("Test");
      expect(state.user.email).toBe("test@example.com");
    });
  });

  describe("renderWithProviders", () => {
    it("renders a component with providers", () => {
      function TestComponent() {
        return <div data-testid="test">Hello World</div>;
      }

      renderWithProviders(<TestComponent />);
      expect(screen.getByTestId("test")).toHaveTextContent("Hello World");
    });

    it("provides access to Redux store", () => {
      function TestComponent() {
        const user = useSelector((state: RootState) => state.user);
        return <div data-testid="user">{user.firstName || "No user"}</div>;
      }

      const { store } = renderWithProviders(<TestComponent />, {
        preloadedState: { user: mockUserState },
      });

      expect(screen.getByTestId("user")).toHaveTextContent("Test");
      expect(store.getState().user.firstName).toBe("Test");
    });

    it("allows dispatching actions", () => {
      function TestComponent() {
        const dispatch = useDispatch();
        const authenticated = useSelector(
          (state: RootState) => state.app.authenticated,
        );

        return (
          <div>
            <span data-testid="auth">{authenticated ? "yes" : "no"}</span>
            <button
              onClick={() =>
                dispatch({ type: "app/setAuthenticated", payload: true })
              }
            >
              Login
            </button>
          </div>
        );
      }

      const { store } = renderWithProviders(<TestComponent />);

      // Initial state
      expect(screen.getByTestId("auth")).toHaveTextContent("no");

      // Dispatch action via button click
      act(() => {
        screen.getByRole("button", { name: "Login" }).click();
      });

      // State updated
      expect(store.getState().app.authenticated).toBe(true);
    });

    it("provides React Query context", () => {
      const mockFetch = vi.fn().mockResolvedValue({ data: "test" });

      function TestComponent() {
        const { data, isLoading } = useQuery({
          queryKey: ["test"],
          queryFn: mockFetch,
        });

        if (isLoading) return <div>Loading...</div>;
        return <div data-testid="data">{JSON.stringify(data)}</div>;
      }

      renderWithProviders(<TestComponent />);

      // Query should be triggered
      expect(mockFetch).toHaveBeenCalled();
    });

    it("returns the store instance", () => {
      function TestComponent() {
        return <div>Test</div>;
      }

      const { store } = renderWithProviders(<TestComponent />);
      expect(store.getState).toBeDefined();
      expect(store.dispatch).toBeDefined();
    });

    it("returns the queryClient instance", () => {
      function TestComponent() {
        return <div>Test</div>;
      }

      const { queryClient } = renderWithProviders(<TestComponent />);
      expect(queryClient.getQueryCache).toBeDefined();
      expect(queryClient.getMutationCache).toBeDefined();
    });
  });

  describe("createWrapper", () => {
    it("creates a wrapper for renderHook", () => {
      const wrapper = createWrapper({
        preloadedState: { user: mockUserState },
      });

      const { result } = renderHook(
        () => useSelector((state: RootState) => state.user),
        { wrapper },
      );

      expect(result.current.firstName).toBe("Test");
      expect(result.current.email).toBe("test@example.com");
    });

    it("works with custom queryClient", () => {
      const customClient = createTestQueryClient();
      const wrapper = createWrapper({ queryClient: customClient });

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ["test"],
            queryFn: () => Promise.resolve("data"),
            enabled: false,
          }),
        { wrapper },
      );

      expect(result.current.isLoading).toBe(false);
    });

    it("works with custom store", () => {
      const customStore = createTestStore({
        user: { ...mockUserState, firstName: "Custom" },
      });
      const wrapper = createWrapper({ store: customStore });

      const { result } = renderHook(
        () => useSelector((state: RootState) => state.user.firstName),
        { wrapper },
      );

      expect(result.current).toBe("Custom");
    });
  });
});
