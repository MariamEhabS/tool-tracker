/**
 * Redux store configuration for Taliho V3.
 *
 * State management strategy:
 * - Redux: Client-side UI state (selected items, folder navigation, Procore context)
 * - TanStack Query: Server state (API data, caching, background refetch)
 * - React Context: Upload queue management
 *
 * Store slices:
 * - procore: Cached Procore tool data arrays (documents, drawings, RFIs, etc.)
 * - folderFile: Flat folder/file listings for both local and Procore document sources
 * - folderRecurse: Recursive folder tree navigation with breadcrumb history
 * - project: Currently selected project details
 * - company: Current company profile, billing, and Procore access configuration
 * - user: Authenticated user identity and permissions
 * - app: Global UI state (selected tool, authentication flag)
 */
import { configureStore } from "@reduxjs/toolkit";
import projectReducer from "./slices/projectSlice";
import folderFileReducer from "./slices/folderFileSlice";
import folderRecurseReducer from "./slices/folderRecurseSlice";
import procoreDataReducer from "./slices/procoreSlice";
import companyReducer from "./slices/companySlice";
import appReducer from "./slices/appSlice";
import userReducer from "./slices/userSlice";

export const store = configureStore({
  reducer: {
    procore: procoreDataReducer,
    folderFile: folderFileReducer,
    folderRecurse: folderRecurseReducer,
    project: projectReducer,
    company: companyReducer,
    user: userReducer,
    app: appReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
