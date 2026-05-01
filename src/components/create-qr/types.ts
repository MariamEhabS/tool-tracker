export type ProjectRow = {
  _id: string;
  projectName?: string;
  procoreCompanyID?: string;
  procoreProjectID?: string;
  archived?: boolean;
};

export type GroupRow = {
  _id: string;
  type?: "arrangement" | "equipment" | "procore-drawing-codes" | "group";
  groupName?: string;
  arrangementName?: string;
  equipmentName?: string;
  project?: string;
};

export type ProcoreTool = {
  available_for_user?: boolean;
  name: string;
  friendly_name: string;
};
export type ProcoreLocation = {
  id?: string | number;
  name?: string;
  location_name?: string;
};
export type DrawingEntry = {
  latestRevisionId?: string | number;
  number?: string;
  code?: string;
  title?: string;
  name?: string;
  drawing_area_name?: string;
  area?: string;
  discipline?: string;
  latestRevisionNumber?: string | number;
};

export type StartOptionKey = "single" | "bulk";

export type StepState = "completed" | "current" | "upcoming";
