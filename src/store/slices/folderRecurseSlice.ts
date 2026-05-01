/**
 * Manages recursive folder tree navigation state, enabling drill-down
 * browsing through nested folder hierarchies.
 *
 * This slice implements a breadcrumb-based navigation pattern: as the user
 * descends into subfolders, each folder's children (files and subfolders) are
 * cached in `childrenOf` keyed by the folder's ID (Procore ID or MongoDB _id).
 * A `currentLocation` index tracks where the user is in the breadcrumb trail,
 * allowing forward navigation and backtracking without re-fetching data.
 *
 * State shape:
 * - currentLocation: Zero-based index into the `breadcrumbs` array indicating
 *   which folder the user is currently viewing.
 * - breadcrumbs: Ordered array of folder identifiers starting with "root".
 *   Each entry is a Procore folder ID or MongoDB document ID representing
 *   the navigation path from root to the current folder.
 * - childrenOf: A map keyed by folder ID. Each entry caches that folder's
 *   immediate children:
 *   - folders: Array of subfolder objects
 *   - files: Array of file objects (with _id, documentName, openToPage, etc.)
 *   - position: The breadcrumb index where this folder appears
 *   - folderName: Display name of the folder
 *
 * Navigation flow:
 * 1. User starts at "root" (currentLocation = 0)
 * 2. `chooseFolder` increments currentLocation, adds the folder ID to breadcrumbs,
 *    and caches its children in childrenOf
 * 3. `goBack` decrements currentLocation to return to the parent folder
 * 4. `resetRecurse` clears all navigation state back to the initial root view
 *
 * Used by: Folder swipe view, QR code paginated table, dynamic tool table,
 *          scanned QR route
 */
import { createSlice } from "@reduxjs/toolkit";

/** File item in the folder recurse store */
type FolderRecurseFile = {
  _id?: string;
  documentName?: string;
  openToPage?: number;
  [key: string]: unknown;
};

const initialState: {
  currentLocation: number;
  breadcrumbs: string[];
  childrenOf: Record<
    string,
    {
      folders: unknown[];
      files: FolderRecurseFile[];
      position: number;
      folderName: string;
    }
  >;
} = {
  currentLocation: 0,
  breadcrumbs: ["root"], // 'root' and then folders' procore ids or Mongo document ids
  childrenOf: {
    root: { folders: [], files: [], position: 0, folderName: "Home" },
  }, // TODO: hard-coded, but actually get these from the other slice?
};

const FolderRecurseDataSlice = createSlice({
  name: "folderRecurse",
  initialState,
  reducers: {
    /** Resets all navigation state back to the initial root view */
    resetRecurse: () => {
      return initialState;
    },
    /**
     * Navigates into a subfolder. Increments `currentLocation`, adds the
     * folder ID to the breadcrumb trail, and caches the folder's children
     * (files, subfolders, name) in `childrenOf`. Guards against double-clicks
     * and handles returning to a previously visited folder without duplicating
     * breadcrumb entries.
     */
    chooseFolder: (state, action) => {
      const { id, files, folders, folderName } = action.payload;

      if (id === state.breadcrumbs[state.currentLocation]) return; // for user error/ double clicks

      state.currentLocation++;

      if (id === state.breadcrumbs[state.currentLocation + 1]) return; // for returning to a previously chosen folder

      if (state.currentLocation < state.breadcrumbs.length) {
        state.breadcrumbs[state.currentLocation] = id;
      } else {
        state.breadcrumbs.push(id);
      }

      if (!(id in state.childrenOf)) {
        state.childrenOf = {
          ...state.childrenOf,
          [id]: { files, folders, position: state.currentLocation, folderName },
        };
      }
    },
    /** Navigates one level up in the folder hierarchy by decrementing currentLocation */
    goBack: (state) => {
      if (state.currentLocation === 0) return;
      state.currentLocation--;
    },
    /**
     * Updates a file's metadata (documentName, openToPage) across all cached
     * folder entries where that file exists, keeping the navigation cache
     * consistent after inline edits.
     */
    updateFileInFolder: (
      state,
      action: {
        payload: {
          fileId: string;
          updates: { documentName?: string; openToPage?: number };
        };
      },
    ) => {
      const { fileId, updates } = action.payload;
      // Update file in all folder entries where it exists
      for (const folderId of Object.keys(state.childrenOf)) {
        const folder = state.childrenOf[folderId];
        if (folder.files) {
          const fileIndex = folder.files.findIndex(
            (f: FolderRecurseFile) => f._id === fileId,
          );
          if (fileIndex !== -1) {
            const file = folder.files[fileIndex];
            if (updates.documentName !== undefined) {
              file.documentName = updates.documentName;
            }
            if (updates.openToPage !== undefined) {
              file.openToPage = updates.openToPage;
            } else if (
              updates.openToPage === undefined &&
              "openToPage" in updates
            ) {
              delete file.openToPage;
            }
          }
        }
      }
    },
  },
});

export const { resetRecurse, chooseFolder, goBack, updateFileInFolder } =
  FolderRecurseDataSlice.actions;
export default FolderRecurseDataSlice.reducer;
