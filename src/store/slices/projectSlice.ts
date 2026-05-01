/**
 * Manages the currently selected project state across the app.
 *
 * State shape (mirrors the Project type):
 * - _id: MongoDB identifier for the project
 * - projectName: Display name of the project
 * - clientName: Name of the project's client
 * - projectAddress, projectCity, projectState, projectZIP: Project location
 * - createdAt: ISO timestamp of when the project was created
 * - location: Additional location/description string
 * - qrCodes: Count of QR codes generated for this project
 * - mobileScanCount: Number of mobile scans recorded
 * - name: Procore project name (may differ from projectName)
 *
 * Used by: QR code paginated table, scanned QR route, tool item pages,
 *          folder/file views
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Project } from "../../types";

const initialState: Project = {
  _id: "",
  projectName: "",
  clientName: "",
  projectAddress: "",
  projectCity: "",
  projectState: "",
  projectZIP: "",
  createdAt: `${new Date().toISOString()}`,
  location: "",
  qrCodes: 0,
  mobileScanCount: 0,
  name: "",
};

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    /**
     * Merges incoming project data into the current state. If the payload contains
     * a nested `projectData` property, that nested object is spread instead of
     * the top-level payload, allowing the backend response shape to be normalized.
     */
    updateProject: (state, action: PayloadAction<Partial<Project>>) => {
      const payload = action.payload as Project;
      if (payload.projectData) {
        return { ...state, ...payload.projectData };
      }
      return { ...state, ...payload };
    },
  },
});

export const { updateProject } = projectSlice.actions;
export default projectSlice.reducer;
