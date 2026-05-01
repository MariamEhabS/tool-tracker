import type { QRCodeTableRow } from "@components/table/taliho/QRCodesTable";
import type { GroupTableRow } from "@components/table/taliho/GroupsTable";

export type QuickRow = QRCodeTableRow;
export type GroupRow = GroupTableRow;

/** Shape of a single QR code item returned by the aggregation endpoint */
export type QRRow = {
  _id: string;
  qrcodeName?: string;
  type?: string;
  resolvedType?: string;
  createdAt?: string | Date;
  mobileScanCount?: number;
  arrangement?: string;
  equipment?: string;
  groupLabel?: string;
  groupType?: string;
  groupArrangementType?: string;
  groupName?: string;
};

/** Shape of a single QR code row used for image mapping */
export type QRImageRow = {
  _id: string;
  qrImageUrl?: string;
  qrimage?: string;
};

/** Shape of a single group row returned by the groups list endpoint */
export type GroupApiRow = {
  _id: string;
  type?: "arrangement" | "equipment";
  groupName?: string;
  arrangementName?: string;
  arrangementType?: string;
  equipmentName?: string;
  equipmentID?: string;
  numberOfCodes?: number;
  mobileScanCount?: number;
  createdAt?: string;
};

/** Typed shape of the project data object */
export type ProjectDataType = {
  projectName?: string;
  clientName?: string;
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  projectZIP?: string;
  projectStatus?: string;
  status?: string;
  procoreProjectID?: string;
  procoreCompanyID?: string;
};

/** Grouped QR codes for the group print modal */
export type GroupedQrCodeEntry = {
  groupId: string;
  groupName: string;
  projectId?: string;
  projectName: string;
  clientName?: string;
  addressLine?: string;
  items: Array<{
    id: string;
    name: string;
    qrImageUrl?: string;
    qrimage?: string;
  }>;
};
