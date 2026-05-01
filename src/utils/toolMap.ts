/**
 * @fileoverview Central registry mapping Procore tool keys to their API
 * fetchers, display titles, Procore API names, and backend enum values.
 * Also provides reverse-lookup maps for converting between naming conventions.
 */

import {
  getCoordinationIssues,
  getDocuments,
  getDrawings,
  getIncidents,
  getInspections,
  getObservations,
  getPhotos,
  getRFIs,
  getSubmittals,
  getPunchLists,
  getSpecifications,
  getForms,
  getInstructions,
  getTasks,
  getDirectory,
} from "../api/endpoints/tools";

import { DrawingsPageComponent } from "../components/secondary-page-components/drawings";

/**
 * Primary map from internal tool key to its configuration:
 * title, API fetcher, Procore API name, optional page component, and backend enum value.
 */
export const toolsMap = {
  "coordination-issue": {
    title: "Coordination Issues",
    fetch: getCoordinationIssues,
    procoreApiName: "coordination_issues",
    backendEnumValue: "coordination-issues",
  },
  document: {
    title: "Documents",
    fetch: getDocuments,
    procoreApiName: "documents",
    backendEnumValue: "documents",
  },
  drawing: {
    title: "Drawings",
    fetch: getDrawings,
    pageComponent: DrawingsPageComponent,
    procoreApiName: "drawings",
    backendEnumValue: "drawings",
  },
  form: {
    title: "Forms",
    fetch: getForms,
    procoreApiName: "forms",
    backendEnumValue: "forms",
  },
  incident: {
    title: "Incidents",
    fetch: getIncidents,
    procoreApiName: "incidents",
    backendEnumValue: "incidents",
  },
  inspection: {
    title: "Inspections",
    fetch: getInspections,
    procoreApiName: "inspections",
    backendEnumValue: "inspections",
  },
  instruction: {
    title: "Instructions",
    fetch: getInstructions,
    procoreApiName: "instructions",
    backendEnumValue: "instructions",
  },
  observation: {
    title: "Observations",
    fetch: getObservations,
    procoreApiName: "observations",
    backendEnumValue: "observations",
  },
  photo: {
    title: "Photos",
    fetch: getPhotos,
    procoreApiName: "photos",
    backendEnumValue: "photos",
  },
  "punch-list": {
    title: "Punch List",
    fetch: getPunchLists,
    procoreApiName: "punch_list",
    backendEnumValue: "punch-list",
  },
  rfi: {
    title: `RFI's`,
    fetch: getRFIs,
    procoreApiName: "rfi",
    backendEnumValue: "rfis",
  },
  submittal: {
    title: "Submittals",
    fetch: getSubmittals,
    procoreApiName: "submittals",
    backendEnumValue: "submittals",
  },
  specification: {
    title: "Specifications",
    fetch: getSpecifications,
    procoreApiName: "specifications",
    backendEnumValue: "specifications",
  },
  task: {
    title: "Tasks",
    fetch: getTasks,
    procoreApiName: "tasks",
    backendEnumValue: "tasks",
  },
  directory: {
    title: "Directory",
    fetch: getDirectory,
    procoreApiName: "directory",
    backendEnumValue: "directory",
  },
};

/** Reverse lookup: display title -> internal tool key. */
export const toolsMapTitles = Object.keys(toolsMap).reduce((acc, tool) => {
  const { title } = toolsMap[tool as keyof typeof toolsMap];
  Object.assign(acc, { [title]: tool });
  return acc;
}, {});

// Map from Procore API name to backend enum value
// This mapping includes both the canonical names from toolsMap and additional
// aliases to handle variations in how Procore's permissions API returns tool names.
export const procoreApiNameToBackendEnum = Object.keys(toolsMap).reduce(
  (acc, tool) => {
    const { procoreApiName, backendEnumValue } =
      toolsMap[tool as keyof typeof toolsMap];
    Object.assign(acc, { [procoreApiName]: backendEnumValue });
    return acc;
  },
  // Include additional aliases for Procore API name variations
  // The Procore permissions API may return different name formats than what
  // we use in toolsMap.procoreApiName. These aliases ensure all tools are matched.
  {
    // RFIs - Procore returns "rfis" but toolsMap uses "rfi"
    rfis: "rfis",
    // Punch Lists - Procore may return "punch_lists" (plural)
    punch_lists: "punch-list",
    // Coordination Issues - alternate formats
    coordination_issue: "coordination-issues",
    // Directory - alternate formats
    project_directory: "directory",
    // Additional plural/alternate forms that Procore might return
    document: "documents",
    drawing: "drawings",
    form: "forms",
    incident: "incidents",
    inspection: "inspections",
    instruction: "instructions",
    observation: "observations",
    photo: "photos",
    submittal: "submittals",
    specification: "specifications",
    task: "tasks",
  } as Record<string, string>,
);

// Map from Procore API name to internal tool key
export const procoreApiNameToToolKey = Object.keys(toolsMap).reduce(
  (acc, tool) => {
    const { procoreApiName } = toolsMap[tool as keyof typeof toolsMap];
    Object.assign(acc, { [procoreApiName]: tool });
    return acc;
  },
  {} as Record<string, string>,
);

// Map from backend enum value (stored in procoreCategory) to internal tool key
export const backendEnumToToolKey = Object.keys(toolsMap).reduce(
  (acc, tool) => {
    const { backendEnumValue } = toolsMap[tool as keyof typeof toolsMap];
    Object.assign(acc, { [backendEnumValue]: tool });
    return acc;
  },
  {} as Record<string, string>,
);
