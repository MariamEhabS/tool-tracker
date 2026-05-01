/**
 * Manages global application UI state shared across the entire app.
 *
 * State shape:
 * - selectedTool: The currently active Procore tool key (e.g. "document", "drawing"),
 *   used to determine which tool view to render in dashboard and secondary pages.
 * - authenticated: Whether the current user session is authenticated.
 *
 * Used by: Root layout, tool route pages, QR code views, signup/login flows,
 *          secondary page components (inspections, forms, specifications, etc.)
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../index";

interface AppState {
  selectedTool: string;
  authenticated: boolean;
}

const initialState: AppState = {
  selectedTool: "",
  authenticated: false,
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    /** Sets the currently active Procore tool key (e.g. "document", "drawing") */
    setSelectedTool: (state, action: PayloadAction<string>) => {
      state.selectedTool = action.payload;
    },
    /** Clears the selected tool, resetting it to an empty string */
    clearSelectedTool: (state) => {
      state.selectedTool = "";
    },
    /** Sets the authentication flag indicating whether the user is logged in */
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.authenticated = action.payload;
    },
    /** Clears the authentication flag, marking the user as unauthenticated */
    clearAuthenticated: (state) => {
      state.authenticated = false;
    },
  },
});

export const {
  setSelectedTool,
  clearSelectedTool,
  setAuthenticated,
  clearAuthenticated,
} = appSlice.actions;

export const selectSelectedTool = (state: RootState) => state.app.selectedTool;

export default appSlice.reducer;
