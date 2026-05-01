import { JSX } from "react";
import { toolsMap } from "./utils/toolMap";

/** Keys from the Procore tools mapping (e.g., 'drawing', 'rfi', 'submittal') */
export type ToolNames = typeof toolsMap;

// to include a selected Procore tool, local-to-Taliho uploads, or no selection:
/** The currently selected Procore or Taliho tool category, or null when nothing is selected */
export type SelectedCategory =
  | keyof ToolNames
  | "taliho-local"
  | "ball-in-court"
  | null;

type Names = typeof toolsMap;

/**
 * @deprecated Use Group type instead -- arrangements were consolidated into groups
 */
export type Arrangement = {
  /** MongoDB ObjectId */
  _id: string;
  /** Classification label for the arrangement (e.g., type of work area) */
  arrangementClass?: string;
  /** Display name of the arrangement */
  arrangementName: string;
  /** Sub-type of the arrangement (e.g., 'Taliho', 'Procore Drawings') */
  arrangementType?: string;
  /** List of category tags assigned to this arrangement */
  categories: string[];
  /** Timestamp when the arrangement was created */
  createdAt: Date;
  /** Reference to the User who created this arrangement (User._id) */
  createdBy?: string;
  /** Free-text description of the arrangement's purpose */
  description?: string;
  /** Aggregate count of mobile scans across all QR codes in this arrangement */
  mobileScanCount?: number;
  /** Total number of QR codes belonging to this arrangement */
  numberOfCodes?: number;
  /** Reference to the Project this arrangement belongs to (Project._id) */
  project?: string;
  /** Denormalized project name for display purposes */
  projectName?: string;
  /** Password required to access QR codes in this arrangement (when password-protected) */
  password?: string;
  /** Whether password protection is enabled for this arrangement */
  passwordActivated?: boolean;
  /** Whether Procore webhook integration is active for this arrangement */
  procoreWebhookActivated?: boolean;
  /** Procore webhook identifier for sync events */
  procoreWebhookID?: number;
  /** URL endpoint for the Procore webhook */
  procoreWebhookUrl?: string;
  /** IANA timezone string used for time-based password scheduling (e.g., 'America/New_York') */
  timezone?: string;
  /** Timestamp when the arrangement was last updated */
  updatedAt?: Date;
  /** Whether weekday time-based password restriction is enabled */
  weekdayPassword?: boolean;
  /** Start time for weekday password window (HH:mm format) */
  weekdayPasswordTimeStart?: string;
  /** End time for weekday password window (HH:mm format) */
  weekdayPasswordTimeEnd?: string;
  /** Whether weekend time-based password restriction is enabled */
  weekendPassword?: boolean;
  /** Start time for weekend password window (HH:mm format) */
  weekendPasswordTimeStart?: string;
  /** End time for weekend password window (HH:mm format) */
  weekendPasswordTimeEnd?: string;
};

/**
 * @deprecated Use Group type instead -- equipment was consolidated into groups
 */
export type Equipment = {
  /** MongoDB ObjectId */
  _id: string;
  /** Reference to the Company this equipment belongs to (Company._id) */
  company?: string;
  /** Timestamp when the equipment record was created */
  createdAt: Date;
  /** Reference to the User who created this equipment (User._id) */
  createdBy?: string;
  /** Free-text description of the equipment */
  description?: string;
  /** User-defined equipment identifier/serial number */
  equipmentID?: string;
  /** Display name of the equipment */
  equipmentName: string;
  /** Technical specification or model information for the equipment */
  equipmentSpecification?: string;
  /** Origin context indicating how this equipment record was generated (e.g., manual, import) */
  generationOrigin?: string;
  /** Aggregate count of mobile scans across all QR codes for this equipment */
  mobileScanCount?: number;
  /** Total number of QR codes assigned to this equipment */
  numberOfCodes?: number;
  /** Password required to access QR codes for this equipment (when password-protected) */
  password?: string;
  /** Whether password protection is enabled for this equipment */
  passwordActivated?: boolean;
  /** Whether Procore webhook integration is active for this equipment */
  procoreWebhookActivated?: boolean;
  /** Procore webhook identifier for sync events */
  procoreWebhookID?: number;
  /** URL endpoint for the Procore webhook */
  procoreWebhookUrl?: string;
  /** Reference to the Project this equipment belongs to (Project._id) */
  project?: string;
  /** Denormalized project name for display purposes */
  projectName?: string;
  /** IANA timezone string used for time-based password scheduling (e.g., 'America/New_York') */
  timezone?: string;
  /** Timestamp when the equipment record was last updated */
  updatedAt?: Date;
  /** Whether the equipment has been verified by a user */
  userVerified?: boolean;
  /** Whether weekday time-based password restriction is enabled */
  weekdayPassword?: boolean;
  /** Start time for weekday password window (HH:mm format) */
  weekdayPasswordTimeStart?: string;
  /** End time for weekday password window (HH:mm format) */
  weekdayPasswordTimeEnd?: string;
  /** Whether weekend time-based password restriction is enabled */
  weekendPassword?: boolean;
  /** Start time for weekend password window (HH:mm format) */
  weekendPasswordTimeStart?: string;
  /** End time for weekend password window (HH:mm format) */
  weekendPasswordTimeEnd?: string;
};

/** Represents a file entry displayed in the QR code data viewer (drawings, inspections, etc.) */
export type File = {
  /** Original name of the uploaded file */
  fileName: string;
  /** Date the file was uploaded or created (ISO string) */
  date: string;
  /** Unique code identifier for the file */
  fileCode: string;
  /** URL or path to the file's image/thumbnail */
  imgSrc: string;
  /** Size of the document in bytes */
  documentSize?: number;
};

/** A document uploaded to a QR code's folder structure */
export type Document = {
  /** MongoDB ObjectId */
  _id: string;
  /** Display name of the document */
  documentName: string;
  /** URL or S3 key pointing to the actual document file */
  documentFile: string;
  /** File size in bytes */
  documentSize: number;
  /** Reference to the Folder this document belongs to (Folder._id) */
  folder: string;
  /** Page number to open the document to when viewed (for multi-page PDFs) */
  openToPage: number;
  /** Reference to the Project this document belongs to (Project._id) */
  project: string;
  /** Reference to the QR code this document is attached to (QRCode._id) */
  qrcode: string;
  /** ISO date string when the document was created */
  createdAt: string;
  /** Whether this document was added as a linked URL rather than an uploaded file */
  addedLink?: boolean;
};

/** Categorized data structure for QR code file viewer, organized by Procore tool type */
export type Data = {
  /** Drawing files grouped by discipline */
  Drawings: {
    /** Architectural drawing files */
    Architectural: File[];
    /** Electrical drawing files */
    Electrical: File[];
    /** General/uncategorized drawing files */
    General: File[];
  };
  /** Inspection report files */
  Inspections: File[];
  /** Observation report files */
  Observations: File[];
  /** Photo files */
  Photos: File[];
};

/** A construction project that contains QR codes, groups, and documents */
export interface Project {
  /** Display name of the project (alias for projectName in some contexts) */
  name: string;
  /** Full address or location description of the project */
  location: string;
  /** Total number of QR codes in this project */
  qrCodes: number;
  /** Total number of groups (arrangements + equipment) in this project */
  groups?: number;
  /** Aggregate count of mobile QR code scans across the project */
  mobileScanCount: number;
  /** MongoDB ObjectId */
  _id: string;
  /** Official name of the project */
  projectName: string;
  /** Name of the client/owner for this project */
  clientName: string;
  /** Street address of the project site */
  projectAddress: string;
  /** City where the project is located */
  projectCity: string;
  /** State/province where the project is located */
  projectState: string;
  /** ZIP/postal code of the project location */
  projectZIP: string;
  /** Current status of the project: 'active' | 'on-hold' | 'completed' | 'archived' */
  projectStatus?: string;
  /** @deprecated use projectStatus instead */
  status?: string;
  /** Reference to the Company that owns this project (Company._id) */
  company?: string;
  /** Whether the project has been archived */
  archived?: boolean;
  /** Timestamp when the project was archived */
  archivedDate?: Date;
  /** Procore company ID linked to this project for integration */
  procoreCompanyID?: string;
  /** Procore project ID linked to this project for integration */
  procoreProjectID?: string;
  /** ISO date string when the project was created */
  createdAt: string;
  /** TTL expiration date for free trial projects (auto-deleted after expiry) */
  expireAt?: Date;
  /** Legacy dynamic project data container */
  projectData?: object;
  /** Dynamic project data container */
  data?: Record<string, unknown>;
}

/**
 * Union of all observed project status values.
 * Used for badge variant helpers and status filtering.
 */
export type ProjectStatus =
  | "active"
  | "on-hold"
  | "completed"
  | "archived"
  | "others"
  | "none";

/** A company account that owns projects, QR codes, and manages users */
export interface Company {
  /** MongoDB ObjectId */
  _id: string;
  /** Official company name */
  companyName: string;
  /** Street address of the company */
  companyAddress: string;
  /** City where the company is located */
  companyCity: string;
  /** State/province where the company is located */
  companyState: string;
  /** ZIP/postal code of the company */
  companyZIP: string;
  /** Company website URL */
  companyWebsite: string;
  /** Company phone number */
  companyPhone?: string;
  /** Industry sector the company operates in (e.g., 'Construction', 'Engineering') */
  companyIndustry: string;
  /** URL of the company logo image (square 1:1 ratio, embedded in QR codes) */
  companyLogo: string;
  /** AWS S3 object ID for the company logo */
  companyLogoAWSId: string;
  /** AWS S3 object key for the company logo */
  companyLogoAWSKey: string;
  /** Whether the company is currently on a free trial */
  freeTrialActive: boolean;
  /** Whether the company has an active paid subscription */
  paidAccount: boolean;
  /** Whether the company's subscription has been canceled */
  subscriptionCanceled: boolean;
  /** When subscription became active */
  subscribedAt?: Date;
  /** When subscription was canceled */
  cancelledAt?: Date;
  /** When free trial was refreshed by a Taliho admin (employee) for an account */
  freeTrialRefreshDate?: Date;
  /** Stripe customer identifier for billing */
  stripeCustomerID: string;
  /** Stripe subscription identifier */
  stripeSubscriptionID: string;
  /** Stripe product identifier for the subscription tier */
  stripeProductID: string;
  /** Stripe price identifier for the current billing plan */
  stripePriceID?: string;
  /** Stripe subscription status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused' */
  stripeSubscriptionStatus?: string;
  /** Stored Procore OAuth access token payload for API integration */
  procoreAccess: Record<string, string>;
  /** Procore company ID for integration (numeric identifier from Procore) */
  procoreCompanyID: number;
  /** Whether company has active Procore integration */
  procoreIntegration?: boolean;
  /** Company creation date */
  createdAt?: Date;
  /** Last update timestamp */
  updatedAt?: Date;
  /** Whether the company account has been deactivated by an admin */
  deactivated: boolean;
  /** Legacy dynamic company data container */
  companyData: object;
  /** Whether users are allowed to edit Procore items directly from Taliho */
  editProcoreItemsAllowed: boolean;
  /** Total QR code image storage used in bytes */
  qrCodeStorageUsed?: number;
  /** Total document storage used in bytes */
  documentStorageUsed?: number;
  /** Maximum document storage capacity in bytes (default ~50 GB) */
  documentStorageCapacity?: number;
  /** Maximum QR code image storage capacity in bytes (default ~10 GB) */
  qrCodeStorageCapacity?: number;
  /** Array of Stripe add-on products attached to the subscription */
  stripeAddons?: Array<Record<string, unknown>>;
  /** Total number of QR codes owned by this company (cached count) */
  qrCodesCount?: number;
  /** Total number of documents owned by this company (cached count) */
  documentsCount?: number;
  /** Whether styled QR codes are enabled */
  useStyledQRCodes?: boolean;
  /** QR style configuration */
  qrStyleConfig?: Record<string, unknown>;
  /** URL for print branding logo */
  printBrandingLogo?: string;
  /** Persisted AWS object id */
  printBrandingLogoAWSId?: string;
  /** Persisted AWS object key */
  printBrandingLogoAWSKey?: string;
  /** Aspect ratio for print branding logo (e.g., "1:1", "2:1") */
  printBrandingLogoAspectRatio?: string;
}

/** A QR code that can link to documents, Procore tools, URLs, or static content */
export interface QRCode {
  /** Type of group this QR code belongs to: 'arrangement' | 'equipment' | 'group' | undefined */
  groupingType: string | undefined;
  /** MongoDB ObjectId */
  _id: string;
  /** Display name of the QR code */
  qrcodeName: string;
  /** Classification type of the QR code (e.g., 'file', 'url', 'procore-tool') */
  qrcodeType?: string;
  /** Target URL the QR code redirects to when scanned */
  url?: string;
  /** Reference to the Company that owns this QR code (Company._id) */
  company: string;
  /** Alternate display name field */
  name?: string;
  /** Reference to the Group this QR code belongs to (Group._id) */
  group?: string;
  /** Base64 or data URI of the generated QR code image */
  qrimage?: string;
  /** Public URL of the QR code image hosted on S3 */
  qrImageUrl?: string;
  /** Reference to the Project this QR code belongs to (Project._id) */
  project?: string;
  /** Whether this is a quick-generated code (simplified creation flow) */
  quickCode?: boolean;
  /** Content type of the QR code: 'file' | 'folder' | 'url' | 'static' | 'procore' | 'procore-tool' | 'procore-location' | 'procore-drawing' | 'procore-drawing-code' */
  type?: string;
  /** @deprecated Reference to the legacy Arrangement this QR code belongs to (Arrangement._id) */
  arrangement?: string;
  /** @deprecated Reference to the legacy Equipment this QR code belongs to (Equipment._id) */
  equipment?: string;
  /** Whether password protection is enabled for this QR code */
  passwordActivated?: boolean;
  /** Password required to view QR code content (when password-protected) */
  password?: string;
  /** Denormalized project name for display purposes */
  projectName?: string;
  /** IANA timezone string used for time-based password scheduling (e.g., 'America/New_York') */
  timezone?: string;
  /** Whether weekday time-based password restriction is enabled */
  weekdayPassword?: boolean;
  /** Start time for weekday password window (HH:mm format) */
  weekdayPasswordTimeStart?: string;
  /** End time for weekday password window (HH:mm format) */
  weekdayPasswordTimeEnd?: string;
  /** Whether weekend time-based password restriction is enabled */
  weekendPassword?: boolean;
  /** Start time for weekend password window (HH:mm format) */
  weekendPasswordTimeStart?: string;
  /** End time for weekend password window (HH:mm format) */
  weekendPasswordTimeEnd?: string;
  /** Whether this QR code is connected to Procore for data sync */
  procoreConnect?: boolean;
  /** The Procore tool category linked to this QR code (e.g., 'drawings', 'rfis', 'submittals') */
  procoreCategory?: string;
  /** Whether Procore data is fetched and displayed on this QR code's page */
  procoreFetch?: boolean;
  /** Total number of times this QR code has been scanned on mobile devices */
  mobileScanCount?: number;
  /** Reference to the User who created this QR code (User._id) */
  createdBy?: string;
  /** Timestamp when the QR code was created */
  createdAt: Date;
  /** TTL expiration date for free trial QR codes (auto-deleted after expiry) */
  expireAt?: Date;
  /** Denormalized snapshot of QR code data returned by aggregate queries */
  data?: {
    /** MongoDB ObjectId */
    _id: string;
    /** Reference to the Project (Project._id) */
    project: string;
    /** Base64 or data URI of the generated QR code image */
    qrimage?: string;
    /** Public URL of the QR code image hosted on S3 */
    qrImageUrl?: string;
    /** Display name of the QR code */
    qrcodeName?: string;
    /** Content type of the QR code */
    type?: string;
    /** Denormalized project name */
    projectName?: string;
    /** Free-text description of the QR code */
    description?: string;
    /** ISO date string when the QR code was created */
    createdAt?: string;
    /** Total number of mobile scans */
    mobileScanCount?: number;
    /** Target URL the QR code redirects to */
    url?: string;
  };
}

/** Aggregated QR code data with populated project, company, Procore tools, and folder/document info */
export interface QRCodeAggregate {
  /** Whether this QR code is connected to Procore */
  procoreConnect?: boolean;
  /** Whether Procore data is fetched for this QR code */
  procoreFetch?: boolean;
  /** Populated project details for this QR code */
  project: {
    /** Street address of the project */
    projectAddress: string | undefined;
    /** City of the project */
    projectCity?: string;
    /** State of the project */
    projectState?: string;
    /** ZIP code of the project */
    projectZIP?: string;
    /** Project MongoDB ObjectId */
    _id: string;
    /** Official project name */
    projectName: string;
    /** Client/owner name */
    clientName: string;
    /** Procore company ID for integration */
    procoreCompanyID: string;
    /** Procore project ID for integration */
    procoreProjectID: string;
  };
  /** Populated company details for this QR code */
  company: {
    /** Company MongoDB ObjectId */
    _id: string;
    /** Whether the company is on a free trial */
    freeTrialActive: boolean;
    /** Whether the company has a paid subscription */
    paidAccount: boolean;
    /** Timestamp of the company's last login */
    lastLoggedIn: Date;
    /** Company street address */
    companyAddress: string;
    /** Company city */
    companyCity: string;
    /** Company name */
    companyName: string;
    /** Company state */
    companyState: string;
    /** Company ZIP code */
    companyZIP: string;
    /** Procore company ID for integration */
    procoreCompanyID: string;
    /** Procore OAuth access token payload */
    procoreAccess: Record<string, object>;
    /** Whether editing Procore items from Taliho is allowed */
    editProcoreItemsAllowed?: boolean;
  };
  /** Denormalized QR code data with nested project and company info */
  data: {
    /** QR code MongoDB ObjectId */
    _id: string;
    /** Display name of the QR code */
    qrcodeName: string;
    /** Base64 or data URI of the generated QR code image */
    qrimage?: string;
    /** Public URL of the QR code image hosted on S3 */
    qrImageUrl?: string;
    /** @deprecated Reference to the legacy Arrangement (Arrangement._id) */
    arrangement?: string;
    /** @deprecated Reference to the legacy Equipment (Equipment._id) */
    equipment?: string;
    /** Type of group this QR code belongs to: 'arrangement' | 'equipment' | 'group' */
    groupingType?: string;
    /** Content type of the QR code (e.g., 'file', 'url', 'procore-tool') */
    type?: string;
    /** Whether this QR code is connected to Procore */
    procoreConnect?: boolean;
    /** Whether Procore data is fetched for this QR code */
    procoreFetch?: boolean;
    /** The selected Procore tool category for this QR code */
    procoreCategory?: SelectedCategory;
    /** Nested project information */
    project: {
      /** City of the project */
      projectCity?: string;
      /** State of the project */
      projectState?: string;
      /** ZIP code of the project */
      projectZIP?: string;
      /** Street address of the project */
      projectAddress?: string;
      /** Project MongoDB ObjectId */
      _id?: string;
      /** Official project name */
      projectName: string;
      /** Client/owner name */
      clientName: string;
      /** Procore company ID */
      procoreCompanyID?: string;
      /** Procore project ID */
      procoreProjectID?: string;
    };
    /** Nested company information */
    company: {
      /** Company MongoDB ObjectId */
      _id?: string;
      /** Whether the company is on a free trial */
      freeTrialActive?: boolean;
      /** Whether the company has a paid subscription */
      paidAccount?: boolean;
      /** Timestamp of last login */
      lastLoggedIn?: Date;
      /** Company street address */
      companyAddress?: string;
      /** Company city */
      companyCity?: string;
      /** Company name */
      companyName: string;
      /** Company state */
      companyState?: string;
      /** Company ZIP code */
      companyZIP?: string;
      /** Procore company ID */
      procoreCompanyID?: string;
      /** Procore OAuth access token payload */
      procoreAccess?: Record<string, object>;
      /** Whether editing Procore items is allowed */
      editProcoreItemsAllowed?: boolean;
    };
  };
  /** Array of Procore tools linked to this QR code with their item counts */
  procoreTools: {
    /** Procore tool key from the toolsMap (e.g., 'drawing', 'rfi', 'submittal') */
    tool: keyof Names;
    /** Number of items fetched from Procore for this tool, or null if not yet loaded */
    count: number | null;
    /** Array of Procore item IDs that are linked to this QR code */
    linkedIds?: string[];
  }[];
  /** Array of folders belonging to this QR code with their contents */
  folders: {
    /** Folder MongoDB ObjectId */
    _id: string;
    /** Array of Document ObjectIds in this folder */
    files: string[];
    /** Array of child Folder ObjectIds */
    subfolders: string[];
    /** Display name of the folder */
    folderName: string;
    /** Reference to the QR code this folder belongs to (QRCode._id) */
    qrcode: string;
    /** Reference to the Project this folder belongs to (Project._id) */
    project: string;
    /** Populated Document objects linked to this folder */
    linkedFiles: Document[];
  }[];
  /** Array of documents directly associated with this QR code */
  documents: Document[];
  /** Ball-in-court workflow summaries associated with this QR code */
  ballInCourtWorkflows?: BicWorkflowSummary[];
}

/** Identifier for modal dialog types used in the Procore tool info system */
export type ModalType = "tool-more-info-modal";

/** An answer to a Procore RFI question, containing rich text body and optional attachments */
export type Answer = {
  /** Name or identifier of the user who created the answer */
  created_by: string;
  /** Date when the answer was submitted */
  answer_date: string | number | Date;
  /** Whether this is marked as the official/accepted answer */
  official?: boolean;
  /** HTML-formatted answer body */
  rich_text_body: string;
  /** Plain text version of the answer body */
  plain_text_body: string;
  /** Files attached to this answer */
  attachments: Attachment[];
};

/** A file attachment on a Procore item (answer, RFI, etc.) */
interface Attachment {
  /** Download URL for the attachment */
  url: string;
  /** MIME type of the attachment (e.g., 'application/pdf', 'image/png') */
  content_type: string;
  /** Original filename of the attachment */
  name: string;
}

/** A specific version of a Procore document file */
export type ProcoreDocumentFileVersion = {
  /** Download URL for this file version */
  url?: string;
  /** Additional Procore API fields */
  [key: string]: unknown;
};

/** A file within a Procore document folder */
export type ProcoreDocumentFile = {
  /** Procore file identifier */
  id?: string | number;
  /** MongoDB ObjectId (when stored locally as a procore-item) */
  _id?: string;
  /** Display name of the file */
  name?: string;
  /** Array of file version records with download URLs */
  file_versions?: ProcoreDocumentFileVersion[];
  /** Additional Procore API fields */
  [key: string]: unknown;
};

/** A folder in the Procore documents hierarchy, which can contain nested subfolders and files */
export type ProcoreDocumentFolder = {
  /** Procore folder identifier */
  id?: string | number;
  /** MongoDB ObjectId (when stored locally as a procore-item) */
  _id?: string;
  /** Procore item identifier for the folder */
  procoreItemID?: string | number;
  /** Display name from Procore API */
  name?: string;
  /** Display name from local storage */
  folderName?: string;
  /** Nested subfolders within this folder */
  folders?: ProcoreDocumentFolder[];
  /** Files contained in this folder */
  files?: ProcoreDocumentFile[];
  /** Additional Procore API fields */
  [key: string]: unknown;
};

/**
 * A single item from any Procore tool (RFIs, submittals, drawings, inspections, etc.).
 * Fields are optional because different Procore tools return different field sets.
 */
export type ProcoreToolItem = {
  /** Allow arbitrary properties for flexible API responses */
  [key: string]: unknown;
  /** Nested issue object (used by coordination issues) */
  issue?: {
    /** Title of the issue */
    title?: string;
    /** Additional issue fields */
    [key: string]: unknown;
  };
  /** Procore item identifier */
  id?: string;
  /** Title or name of the Procore item */
  title?: string;
  /** Item number (e.g., RFI number, submittal number) */
  number?: string;
  /** Local Procore item identifier (when stored in Taliho backend) */
  procoreItemID?: string;
  /** Name of the Procore tool this item belongs to */
  procoreToolName?: string;
  /** Whether this item is connected/linked to a QR code */
  procoreConnect?: boolean;
  /** Whether the item has been marked as obsolete in Procore */
  obsolete?: boolean;
  /** Issue number for coordination issues */
  issue_number?: string;
  /** Last update timestamp from Procore */
  update_at?: string;
  /** Description or body text of the item */
  description?: string;
  /** Sort position within its parent context */
  position?: string;
  /** Display name of the item */
  name?: string;
  /** Current workflow status (e.g., 'Open', 'Closed', 'Draft') */
  workflow_status?: string;
  /** Unique identifier string (e.g., drawing identifier) */
  identifier?: string;
  /** Revision number for drawings and submittals */
  revision?: string;
  /** Priority level (e.g., 'Normal', 'High', 'Low') */
  priority?: string;
  /** Engineering discipline (e.g., 'Architectural', 'Structural', 'Mechanical') */
  discipline?: string;
  /** Date of the event (used by incidents) */
  event_date?: string;
  /** Whether the incident is OSHA recordable */
  recordable?: boolean;
  /** Current status of the item (e.g., 'Open', 'Closed', 'Pending') */
  status?: string;
  /** Dollar amount of cost impact */
  cost_impact_amount?: number;
  /** Due date for the item */
  due_date?: string;
  /** Whether the item is past its due date */
  overdue?: boolean;
  /** Number of schedule impact days */
  schedule_impact_days?: number;
  /** Total number of checklist items (used by inspections) */
  item_count?: number;
  /** Number of conforming/passing checklist items */
  conforming_item_count?: number;
  /** Number of deficient/failing checklist items */
  deficient_item_count?: number;
  /** Number of neutral checklist items */
  neutral_item_count?: number;
  /** Number of not-applicable checklist items */
  not_applicable_item_count?: number;
  /** Date the inspection was performed */
  inspection_date?: string;
  /** File type (e.g., 'pdf', 'dwg') for document/drawing items */
  file_type?: string;
  /** Full path including parent folders for document items */
  name_with_path?: string;
  /** File size in bytes */
  size?: number;
  /** ISO timestamp of last update */
  updated_at?: string;
  /** Whether the item has been deleted in Procore */
  is_deleted?: boolean;
  /** Formatted full number (e.g., 'RFI-001', 'SUB-002') */
  full_number?: string;
  /** Subject line for RFIs and submittals */
  subject?: string;
  /** Human-readable status translation */
  translated_status?: string;
  /** Reference to a specification section (Procore ID) */
  specification_section_id?: string;
  /** Reference to a specification set (Procore ID) */
  specification_set_id?: string;
  /** Specification set this item belongs to */
  specification_set?: {
    /** Procore specification set ID */
    id: number;
    /** Specification set name */
    name: string;
  };
  /** Date the item was issued */
  issued_date?: string;
  /** Date the item was received */
  received_date?: string;
  /** Date of issue (alternate field used by some tools) */
  issue_date?: string;
  /** Deadline for submission */
  submit_by?: string;
  /** Formatted display number */
  formatted_number?: string;
  /** URL link to the item in Procore */
  url?: string;
  /** Business phone number (used by directory contacts) */
  business_phone?: string;
  /** Mobile phone number (used by directory contacts) */
  mobile_phone?: string;
  /** Job title (used by directory contacts) */
  job_title?: string;
  /** Email address (used by directory contacts) */
  email_address?: string;
  /** Type of issue (used by coordination issues) */
  issue_type?: string;
  /** Plain text version of the description field */
  plain_text_description?: string;
  /** Date/time a photo was taken */
  taken_at?: string;
  /** Reference identifier linking to another item */
  reference?: string;
  /** Date/time the item was closed */
  closed_at?: string;
  /** Date the item was issued (alternate field) */
  date_issued?: string;
  /** Name of the form template used */
  form_template_name?: string;
  /** Date the item was received (alternate field) */
  date_received?: string;
  /** Timestamp when the manager was notified about an incident */
  manager_notified_at?: string;
  /** User initials (used by directory) */
  initials?: string;
  /** Street address (used by directory contacts) */
  address?: string;
  /** City (used by directory contacts) */
  city?: string;
  /** State code (used by directory contacts) */
  state_code?: string;
  /** Timestamp when the item was initiated */
  initiated_at?: string;
  /** Type of instruction */
  instruction_type?: {
    /** Instruction type name */
    name: string;
  };
  /** Trades associated with this item */
  trades?: {
    /** Trade name */
    name: string;
  }[];
  /** User or company the instruction originates from */
  instruction_from?: {
    /** Name of the instruction sender */
    name: string;
  };
  /** Parties who need to pay attention to this item */
  attentions: {
    /** Attention party name */
    name: string;
  }[];
  /** Vendor/subcontractor associated with this item */
  vendor?: {
    /** Vendor name */
    name: string;
  };
  /** Files attached to this item (with Procore item IDs) */
  files?: {
    /** Procore item identifier for the file */
    procoreItemID: string | number;
  }[];
  /** Document folders associated with this item */
  folders?: ProcoreDocumentFolder[];

  /** Division data for specification items */
  divisionData?: {
    /** Division identifier */
    id: string;
    /** Division number (e.g., '03', '09') */
    number: string;
    /** Division description (e.g., 'Concrete', 'Finishes') */
    description: string;
  };
  /** File attachments on this Procore item */
  attachment?: {
    /** Original filename */
    filename: string;
    /** Display name */
    name: string;
    /** Download URL */
    url: string;
    /** MIME type */
    content_type: string;
  }[];
  /** Attachments associated through related items */
  associated_attachments?: {
    /** Attachment identifier */
    id: string;
    /** Display name */
    name: string;
    /** Download URL */
    url: string;
    /** MIME type */
    content_type: string;
  }[];
  /** Project stage or phase */
  project_stage?: {
    /** Formatted stage name */
    formatted_name: string;
  };
  /** Specification section linked to this item */
  specification_section?: {
    /** Section name */
    name: string;
    /** Section label/number */
    label: string;
  };
  /** Cost impact assessment */
  cost_impact?: {
    /** Cost impact status: 'Yes' | 'No' | 'TBD' */
    status: string;
  };
  /** Manager responsible for the submittal */
  submittal_manager?: {
    /** Manager's name */
    name: string;
  };
  /** Schedule impact assessment */
  schedule_impact?: {
    /** Schedule impact status: 'Yes' | 'No' | 'TBD' */
    status: string;
  };
  /** Manager responsible for the RFI */
  rfi_manager?: {
    /** Manager's name */
    name: string;
  };
  /** Person or company the item was received from */
  received_from?: {
    /** Name of the sender */
    name: string;
  };
  /** Contractor responsible for resolving the item */
  responsible_contractor?: {
    /** Contractor name */
    name: string;
  };
  /** Current ball-in-court assignment (who needs to act next) */
  ball_in_courts?: {
    /** Assignee identifier */
    id: string;
    /** Assignee name */
    name: string;
  };
  /** Questions associated with an RFI */
  questions?: {
    /** Question identifier */
    id: string;
    /** Question body text */
    body: string;
    /** Name of the user who asked the question */
    created_by: string;
    /** Date the question was asked */
    question_date: string;
  }[];
  /** Hazard type for safety-related items (observations, incidents) */
  hazard?: {
    /** Hazard name */
    name: string;
  };
  /** ISO timestamp when the item was created in Procore */
  created_at?: string;
  /** Current drawing revision details */
  current_revision?: {
    /** Revision number */
    revision_number?: string;
    /** Last update timestamp */
    updated_at?: string;
    /** URL to the drawing thumbnail image */
    thumbnail_url?: string;
    /** URL to the drawing PDF */
    pdf_url?: string;
  };
  /** Contributing behavior for safety observations */
  contributing_behavior?: {
    /** Behavior name */
    name?: string;
  };
  /** User who created this item in Procore */
  created_by?: {
    /** Creator's name */
    name?: string;
    /** Creator's company name */
    company_name?: string;
  };
  /** Location where the item is relevant */
  location?: {
    /** Location node name in the hierarchy */
    node_name?: string;
    /** Location display name */
    name: string;
    /** Last update timestamp */
    updated_at?: string;
  };
  /** Contributing condition for safety observations */
  contributing_condition?: {
    /** Condition name */
    name?: string;
  };
  /** Cost code assigned to this item */
  cost_code?: {
    /** Cost code name */
    name?: string;
  };
  /** Manager responsible for the punch list item */
  punch_item_manager?: {
    /** Manager's name */
    name?: string;
  };
  /** Single ball-in-court assignment (alternate format) */
  ball_in_court?: {
    /** Assignee name */
    name?: string;
  };
  /** File attachments (alternate format) */
  attachments?: {
    /** Original filename */
    filename: string;
    /** Display name */
    name: string;
    /** Download URL */
    url: string;
    /** MIME type */
    content_type: string;
  }[];
  /** Category for task items */
  task_item_category?: {
    /** Category name */
    name?: string;
  };
  /** Type of inspection performed */
  inspection_type?: {
    /** Inspection type name */
    name?: string;
  };
  /** Users who performed the inspection */
  inspectors?: {
    /** Inspector's name */
    name?: string;
  }[];
  /** Item type with associated category */
  type?: {
    /** Type name */
    name: string;
    /** Type category */
    category: string;
  };
  /** Trade associated with this item */
  trade?: {
    /** Trade name */
    name: string;
  };
  /** User or company assigned to this item */
  assignee?: {
    /** Assignee's name */
    name: string;
    /** Assignee's company name */
    company_name: string;
  };
  /** Punch item type classification */
  punch_item_type?: {
    /** Type name */
    name: string;
  };

  /** Reference to a drawing area in Procore */
  drawing_area_id?: string;
};

/** Array of Procore tool items with optional top-level document files and folders */
export interface ProcoreToolData extends Array<ProcoreToolItem> {
  /** Document files at the root level (for Procore Documents tool) */
  files?: ProcoreDocumentFile[];
  /** Document folders at the root level (for Procore Documents tool) */
  folders?: ProcoreDocumentFolder[];
}

/** Generic data item interface for table components, requiring an id and allowing arbitrary fields */
export interface DataItem {
  /** Unique identifier for the data row */
  id: string | number;

  /** Additional dynamic fields */
  [key: string]: unknown;
}

/** Column definition for the DataTable component */
export interface Column<T extends DataItem = DataItem> {
  /** Property key on the data item to display in this column */
  key: keyof T & string;
  /** Header label displayed at the top of the column */
  label: string;
  /** Whether this column supports sorting */
  sortable?: boolean;
  /** Custom render function for cell content */
  render?: (value: T[keyof T], item: T) => React.ReactNode;
}

/** Action button definition for individual row actions in the DataTable */
export interface Action<T extends DataItem = DataItem> {
  /** Tooltip or accessible label for the action button */
  label: string;
  /** Icon element displayed in the action button */
  icon: React.ReactNode;
  /** Additional CSS class names for styling the action button */
  className?: string;
  /** Callback invoked when the action button is clicked */
  onClick: (item: T) => void;
}

/** Action definition for bulk operations on multiple selected rows in the DataTable */
export interface GroupAction {
  /** Tooltip or accessible label for the group action button */
  label: string;
  /** Icon element displayed in the group action button */
  icon: React.ReactNode;
  /** Additional CSS class names for styling the group action button */
  className?: string;
  /** Callback invoked with the IDs of all selected rows */
  onClick: (selectedIds: (string | number)[]) => void;
}

/** Filter configuration for a dropdown filter in the DataTable */
export interface Filter {
  /** Property key on data items to filter by */
  key: string;
  /** Display label for the filter dropdown */
  label: string;
  /** Available filter options */
  options: { value: string; label: string }[];
}

/** Props for the DataTable component, supporting pagination, search, filtering, and row actions */
export interface DataTableProps<T extends DataItem = DataItem> {
  /** Title displayed above the table */
  title?: string;
  /** Subtitle or description text displayed below the title */
  description?: string;
  /** Icon displayed next to the table title */
  titleIcon?: React.ReactNode;
  /** Array of data items to display in the table */
  data?: T[];
  /** Column definitions controlling which fields are displayed and how */
  columns: Column<T>[];
  /** Individual row action buttons (e.g., edit, delete) */
  actions?: Action<T>[];
  /** Bulk action buttons for multi-select operations */
  groupActions?: GroupAction[];
  /** Filter dropdown configurations */
  filters?: Filter[];
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Options for the "items per page" dropdown (e.g., [10, 25, 50]) */
  itemsPerPageOptions?: number[];
  /** Callback invoked when a table row is clicked */
  onRowClick?: (item: T) => void;
  /** Callback invoked when the "Create New" button is clicked */
  onCreateNew?: () => void;
  /** Label for the "Create New" button */
  createButtonText?: string;
  /** CSS color for the "Create New" button */
  createButtonColor?: string;
  /** Total number of items (for server-side pagination) */
  totalItems?: number;
  /** Whether pagination is handled server-side */
  serverSidePagination?: boolean;
  /** Current page number (1-based, for server-side pagination) */
  currentPage?: number;
  /** Callback invoked when the page changes */
  onPageChange?: (page: number) => void;
  /** Callback invoked when items per page changes */
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  /** Current search term value (controlled) */
  searchTerm?: string;
  /** Setter for the search term (controlled) */
  setSearchTerm?: (term: string) => void | "";
  /** Whether the table is in a loading state */
  isLoading?: boolean;
}

/** Data shape for an item displayed in action menus or item lists */
export interface ItemActionData {
  /** Unique identifier for the item */
  id: string;
  /** Display name of the item */
  name: string;
  /** Type/category of the item (e.g., 'file', 'url', 'procore-tool') */
  type: string;
  /** Name of the group this item belongs to */
  group: string;
  /** Reference to the project (numeric ID) */
  project: number;
  /** ISO date string when the item was created */
  createdAt: string;
  /** Number of mobile scans (displayed as string) */
  scans: string;
  /** Icon name or identifier for the item */
  icon: string;
  /** Background color for the icon container */
  iconBg: string;
  /** Foreground color for the icon */
  iconColor: string;
  /** Additional dynamic fields */
  [key: string]: string | number;
}

/** Data shape for a "recent items" section displayed on dashboard pages */
export interface RecentItemData {
  /** Category label for the section (e.g., 'QR Codes', 'Documents') */
  category: string;
  /** Navigation link for the "View All" action */
  linkTo: string;
  /** Display label for the section header */
  label: string;
  /** Array of recent items to display */
  items: {
    /** Unique identifier for the item */
    id: string;
    /** Display name */
    name: string;
    /** Detail text (e.g., project name, date) */
    detail: string;
    /** Formatted date string */
    date: string;
    /** Icon JSX element */
    icon: JSX.Element;
    /** Icon foreground color */
    color: string;
    /** Icon background color */
    bg: string;
  }[];
}

/** Props for a navigation item in the sidebar */
export interface NavItemProps {
  /** Icon element for the nav item */
  icon: React.ReactNode;
  /** Display label for the nav item */
  label: string;
  /** Route path the nav item links to */
  path: string;
  /** Whether this nav item is currently active/selected */
  isActive: boolean;
  /** Additional CSS class names */
  className?: string;
}

/** DTO for patching/updating an equipment record via the API */
export interface PatchEquipmentDto {
  /** Reference to the Project (Project._id) */
  projectId: string;
  /** Reference to the Company (Company._id) */
  companyId: string;
  /** Updated equipment display name */
  equipmentName?: string;
  /** Updated user-defined equipment identifier */
  equipmentID?: string;
  /** Updated technical specification */
  equipmentSpecification?: string;
  /** Updated description */
  description?: string;
}

/** Response DTO returned when fetching a single equipment record from the API */
export interface SingleEquipmentResponseDto {
  /** Success message from the API */
  success_message: string;
  /** Equipment data payload */
  data: {
    /** MongoDB ObjectId */
    _id: string;
    /** Display name of the equipment */
    equipmentName: string;
    /** User-defined equipment identifier */
    equipmentID?: string;
    /** Technical specification */
    equipmentSpecification?: string;
    /** Free-text description */
    description?: string;
    /** Populated project reference */
    project: {
      /** Project MongoDB ObjectId */
      _id: string;
      /** Project display name */
      name: string;
    };
    /** ISO date string when the equipment was created */
    createdAt: string;
    /** ISO date string when the equipment was last updated */
    updatedAt: string;
  };
}

// ─── Ball In Court Types ───────────────────────────────────────────────────────

export type BicTaskStatus = 'pending' | 'complete';
export type BicTradeStatus = 'pending' | 'active' | 'complete';
export type BicWorkflowStatus = 'active' | 'complete';
export type BicDateMode = 'none' | 'pm' | 'foreman';
export type BicScheduleTier = 'anticipated' | 'planned' | 'none';

export type BicTrade = {
  _id: string;
  order: number;
  foremanProcoreId: string;
  foremanName: string;
  foremanEmail?: string;
  foremanCompany: string;
  tradeName: string;
  status: BicTradeStatus;
  completedAt?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualCompletedAt?: string;
  projectedStart?: string;
  scheduleTier?: BicScheduleTier;
};

export type BallInCourtWorkflow = {
  _id: string;
  name: string;
  qrCodeId: string;
  companyId: string;
  projectId?: string;
  procoreProjectId?: string;
  createdBy?: string;
  pmEmail?: string;
  status: BicWorkflowStatus;
  currentTradeIndex: number;
  trades: BicTrade[];
  createdAt: string;
  updatedAt: string;
};

export type BallInCourtTask = {
  _id: string;
  workflowId: string;
  tradeIndex: number;
  order: number;
  description: string;
  requirePicture: boolean;
  requireNotes: boolean;
  datesAssignedByPm: boolean;
  dateMode?: BicDateMode;
  startDate?: string;
  endDate?: string;
  status: BicTaskStatus;
  completedAt?: string;
  photoUrl?: string;
  notes?: string;
  foremanStartDate?: string;
  foremanEndDate?: string;
};

export type BicWorkflowTradeSummary = {
  foremanName: string;
  foremanCompany?: string;
  tradeName?: string;
};

export type BicWorkflowSummary = {
  _id: string;
  name: string;
  status: BicWorkflowStatus;
  currentTradeIndex: number;
  tradeCount: number;
  completedStepCount?: number;
  progressPercent?: number;
  currentTrade?: BicWorkflowTradeSummary;
  onDeckTrade?: BicWorkflowTradeSummary;
};

export type BicWorkflowWithTasks = {
  workflow: BallInCourtWorkflow;
  tasks: BallInCourtTask[];
};
