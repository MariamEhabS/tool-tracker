/**
 * Manages flat folder and file listings for the two document storage sources:
 * Procore documents and Taliho-local (native) documents.
 *
 * This slice stores the immediate children (folders and files) at the current
 * navigation level. It does NOT track recursive/nested folder trees -- that
 * responsibility belongs to `folderRecurseSlice`.
 *
 * State shape:
 * - document: { folders, files } -- Procore Documents tool data (the "document"
 *   key corresponds to the Procore tool key in toolsMap)
 * - taliho-local: { folders, files } -- Taliho-native document storage data
 *
 * Used by: Display category data component, folder/file views, QR code paginated
 *          table, scanned QR route
 */
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  document: {
    // 'document' is the procore tool; TODO: track layers with parent_id
    folders: [],
    files: [],
  },
  "taliho-local": {
    folders: [],
    files: [],
  },
};

const FolderFileDataSlice = createSlice({
  name: "folderFile",
  initialState,
  reducers: {
    // separate local and Procore because of types?
    /** Updates the folder listing for the Taliho-local document source */
    updateLocalFolders: (state, action) => {
      const folderList = action.payload.folders;
      state["taliho-local"].folders =
        folderList as (typeof state)["taliho-local"]["folders"];
    },
    /** Updates the file listing for the Taliho-local document source */
    updateLocalFiles: (state, action) => {
      const fileList = action.payload.files;
      state["taliho-local"].files =
        fileList as (typeof state)["taliho-local"]["files"];
    },
    /** Updates the folder listing for the Procore Documents tool source */
    updateProcoreFolders: (state, action) => {
      const folderList = action.payload.folders;
      state["document"].folders =
        folderList as (typeof state)["document"]["folders"];
    },
    /** Updates the file listing for the Procore Documents tool source */
    updateProcoreFiles: (state, action) => {
      const fileList = action.payload.files;
      state["document"].files = fileList as (typeof state)["document"]["files"];
    },
  },
});

export const {
  updateLocalFolders,
  updateLocalFiles,
  updateProcoreFolders,
  updateProcoreFiles,
} = FolderFileDataSlice.actions;
export default FolderFileDataSlice.reducer;
