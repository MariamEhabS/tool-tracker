/**
 * Mock data fixtures for testing
 * Provides reusable mock objects for all major entity types
 */

import type {
  QRCode,
  Project,
  Company,
  Document,
  Arrangement,
  Equipment,
  ProcoreToolItem,
} from "@/types";

// ============================================================================
// QR Code Mocks
// ============================================================================

/** Basic QR code for testing */
export const mockQRCode: QRCode = {
  _id: "qr-test-001",
  qrcodeName: "Test QR Code",
  qrimage: "https://example.com/qr/qr-test-001.png",
  qrImageUrl: "https://example.com/qr/qr-test-001.svg",
  company: "company-test-001",
  project: "proj-test-001",
  type: "multi-tool",
  groupingType: "arrangement",
  arrangement: "arr-test-001",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  mobileScanCount: 42,
  passwordActivated: false,
  procoreConnect: false,
  procoreFetch: false,
  createdBy: "user-test-001",
};

/** QR code with Procore integration */
export const mockProcoreQRCode: QRCode = {
  ...mockQRCode,
  _id: "qr-procore-001",
  qrcodeName: "Procore QR Code",
  type: "procore-drawings",
  procoreConnect: true,
  procoreFetch: true,
  procoreCategory: "drawings",
};

/** QR code with password protection */
export const mockPasswordProtectedQRCode: QRCode = {
  ...mockQRCode,
  _id: "qr-password-001",
  qrcodeName: "Protected QR Code",
  passwordActivated: true,
  password: "hashed-password",
  weekdayPassword: true,
  weekendPassword: false,
  timezone: "America/New_York",
};

/** QR code with equipment grouping */
export const mockEquipmentQRCode: QRCode = {
  ...mockQRCode,
  _id: "qr-equipment-001",
  qrcodeName: "Equipment QR Code",
  groupingType: "equipment",
  equipment: "equip-test-001",
  arrangement: undefined,
};

/** Array of QR codes for list/table tests */
export const mockQRCodeList: QRCode[] = [
  mockQRCode,
  mockProcoreQRCode,
  mockPasswordProtectedQRCode,
  {
    ...mockQRCode,
    _id: "qr-test-002",
    qrcodeName: "Another QR Code",
    mobileScanCount: 15,
    createdAt: new Date("2024-01-20T14:30:00Z"),
  },
  {
    ...mockQRCode,
    _id: "qr-test-003",
    qrcodeName: "Third QR Code",
    mobileScanCount: 0,
    createdAt: new Date("2024-01-25T09:00:00Z"),
  },
];

// ============================================================================
// Group Mocks (Arrangements and Equipment)
// ============================================================================

/** Basic arrangement/group for testing */
export const mockArrangement: Arrangement = {
  _id: "arr-test-001",
  arrangementName: "Test Arrangement",
  arrangementType: "location",
  arrangementClass: "floor",
  categories: ["drawings", "documents"],
  createdAt: new Date("2024-01-10T08:00:00Z"),
  updatedAt: new Date("2024-01-18T12:00:00Z"),
  createdBy: "user-test-001",
  description: "A test arrangement for unit tests",
  numberOfCodes: 5,
  mobileScanCount: 120,
  project: "proj-test-001",
  projectName: "Test Project",
  passwordActivated: false,
};

/** Equipment group for testing */
export const mockEquipment: Equipment = {
  _id: "equip-test-001",
  equipmentName: "Test Equipment",
  equipmentID: "EQ-001",
  equipmentSpecification: "Heavy machinery",
  company: "company-test-001",
  project: "proj-test-001",
  projectName: "Test Project",
  createdAt: new Date("2024-01-12T10:00:00Z"),
  updatedAt: new Date("2024-01-19T14:00:00Z"),
  createdBy: "user-test-001",
  description: "Test equipment for unit tests",
  numberOfCodes: 3,
  mobileScanCount: 45,
  passwordActivated: false,
};

/** Array of arrangements for list tests */
export const mockArrangementList: Arrangement[] = [
  mockArrangement,
  {
    ...mockArrangement,
    _id: "arr-test-002",
    arrangementName: "Second Arrangement",
    numberOfCodes: 10,
  },
  {
    ...mockArrangement,
    _id: "arr-test-003",
    arrangementName: "Third Arrangement",
    numberOfCodes: 2,
  },
];

// ============================================================================
// Project Mocks
// ============================================================================

/** Basic project for testing */
export const mockProject: Project = {
  _id: "proj-test-001",
  name: "Test Project",
  projectName: "Test Project",
  clientName: "Test Client Inc.",
  location: "123 Test St, Test City, TS 12345",
  projectAddress: "123 Test St",
  projectCity: "Test City",
  projectState: "TS",
  projectZIP: "12345",
  projectStatus: "active",
  qrCodes: 10,
  groups: 3,
  mobileScanCount: 250,
  createdAt: "2024-01-05T09:00:00Z",
  company: "company-test-001",
  archived: false,
};

/** Project with Procore integration */
export const mockProcoreProject: Project = {
  ...mockProject,
  _id: "proj-procore-001",
  projectName: "Procore Project",
  procoreCompanyID: "12345",
  procoreProjectID: "67890",
};

/** Archived project */
export const mockArchivedProject: Project = {
  ...mockProject,
  _id: "proj-archived-001",
  projectName: "Archived Project",
  projectStatus: "archived",
  archived: true,
  archivedDate: new Date("2024-01-01T00:00:00Z"),
};

/** Array of projects for list tests */
export const mockProjectList: Project[] = [
  mockProject,
  mockProcoreProject,
  {
    ...mockProject,
    _id: "proj-test-002",
    projectName: "Second Project",
    projectStatus: "on-hold",
    qrCodes: 5,
  },
  {
    ...mockProject,
    _id: "proj-test-003",
    projectName: "Completed Project",
    projectStatus: "completed",
    qrCodes: 25,
  },
];

// ============================================================================
// User Mocks
// ============================================================================

/** User state for Redux store testing */
export const mockUserState = {
  firstName: "Test",
  company: "company-test-001",
  permission: "admin" as const,
  isVerified: true,
  email: "test@example.com",
  userId: "user-test-001",
};

/** Standard user (non-admin) */
export const mockStandardUser = {
  ...mockUserState,
  permission: "user" as const,
};

/** Project manager user */
export const mockPMUser = {
  ...mockUserState,
  permission: "pm" as const,
};

// ============================================================================
// Company Mocks
// ============================================================================

/** Base company data for testing */
const baseCompany: Partial<Company> = {
  _id: "company-test-001",
  companyName: "Test Company",
  companyAddress: "456 Business Ave",
  companyCity: "Enterprise City",
  companyState: "EC",
  companyZIP: "54321",
  companyWebsite: "https://testcompany.com",
  companyIndustry: "Construction",
  companyLogo: "https://example.com/logo.png",
  companyLogoAWSId: "aws-logo-id",
  companyLogoAWSKey: "aws-logo-key",
  stripeCustomerID: "cus_test123",
  stripeSubscriptionID: "sub_test123",
  stripeProductID: "prod_standard",
  procoreAccess: {},
  procoreCompanyID: 0,
  procoreIntegration: false,
  editProcoreItemsAllowed: false,
  deactivated: false,
  companyData: {},
  stripeAddons: [],
  qrCodeStorageUsed: 1024 * 1024 * 100, // 100MB
  documentStorageUsed: 1024 * 1024 * 500, // 500MB
  qrCodeStorageCapacity: 1024 * 1024 * 1024 * 5, // 5GB
  documentStorageCapacity: 1024 * 1024 * 1024 * 50, // 50GB
  qrCodesCount: 50,
  documentsCount: 120,
};

/** Active paid company */
export const mockCompany: Company = {
  ...baseCompany,
  freeTrialActive: false,
  paidAccount: true,
  subscriptionCanceled: false,
} as Company;

/** Free trial company */
export const mockFreeTrialCompany: Company = {
  ...baseCompany,
  _id: "company-trial-001",
  companyName: "Trial Company",
  freeTrialActive: true,
  paidAccount: false,
  subscriptionCanceled: false,
  documentStorageCapacity: 1024 * 1024 * 50, // 50MB
  qrCodeStorageCapacity: 1024 * 1024 * 50, // 50MB
} as Company;

/** Company with Procore integration */
export const mockProcoreCompany: Company = {
  ...mockCompany,
  _id: "company-procore-001",
  companyName: "Procore Company",
  procoreIntegration: true,
  procoreCompanyID: 12345,
  editProcoreItemsAllowed: true,
  procoreAccess: {
    documents: "read",
    drawings: "read",
    rfis: "readwrite",
  },
} as Company;

// ============================================================================
// Document Mocks
// ============================================================================

/** Basic document for testing */
export const mockDocument: Document = {
  _id: "doc-test-001",
  documentName: "Test Document.pdf",
  documentFile: "https://example.com/docs/test.pdf",
  documentSize: 1024 * 1024 * 2, // 2MB
  folder: "folder-test-001",
  openToPage: 1,
  project: "proj-test-001",
  qrcode: "qr-test-001",
  createdAt: "2024-01-12T11:00:00Z",
  addedLink: false,
};

/** Array of documents for list tests */
export const mockDocumentList: Document[] = [
  mockDocument,
  {
    ...mockDocument,
    _id: "doc-test-002",
    documentName: "Specifications.pdf",
    documentSize: 1024 * 1024 * 5, // 5MB
    createdAt: "2024-01-14T09:30:00Z",
  },
  {
    ...mockDocument,
    _id: "doc-test-003",
    documentName: "Floor Plan.pdf",
    documentSize: 1024 * 1024 * 10, // 10MB
    createdAt: "2024-01-16T14:00:00Z",
  },
];

// ============================================================================
// Procore Item Mocks
// ============================================================================

/** Generic Procore item for testing */
export const mockProcoreItem: ProcoreToolItem = {
  id: "12345",
  title: "Test Procore Item",
  status: "open",
  created_at: "2024-01-08T10:00:00Z",
  updated_at: "2024-01-16T16:00:00Z",
  assignee: {
    name: "John Doe",
    company_name: "Test Company",
  },
  created_by: {
    name: "Jane Smith",
    company_name: "Test Company",
  },
};

/** Procore RFI mock */
export const mockProcoreRFI: ProcoreToolItem = {
  ...mockProcoreItem,
  id: "rfi-001",
  title: "Foundation Clarification",
  full_number: "RFI-001",
  subject: "Need clarification on foundation depth",
  status: "open",
  due_date: "2024-02-01",
  overdue: false,
  rfi_manager: { name: "RFI Manager" },
  ball_in_court: { name: "Architect" },
  cost_impact: { status: "unknown" },
  schedule_impact: { status: "unknown" },
};

/** Procore Submittal mock */
export const mockProcoreSubmittal: ProcoreToolItem = {
  ...mockProcoreItem,
  id: "sub-001",
  title: "Steel Shop Drawings",
  formatted_number: "001-A",
  status: "pending",
  submit_by: "2024-01-25",
  submittal_manager: { name: "Submittal Manager" },
  specification_section: {
    name: "05 12 00",
    label: "Structural Steel Framing",
  },
};

/** Procore Punch List item mock */
export const mockProcorePunchItem: ProcoreToolItem = {
  ...mockProcoreItem,
  id: "punch-001",
  title: "Touch up paint in lobby",
  status: "open",
  priority: "high",
  punch_item_manager: { name: "Punch Manager" },
  punch_item_type: { name: "Painting" },
  location: { name: "Level 1 - Lobby" },
  due_date: "2024-01-30",
};

/** Procore Inspection mock */
export const mockProcoreInspection: ProcoreToolItem = {
  ...mockProcoreItem,
  id: "insp-001",
  title: "Pre-pour Inspection",
  status: "completed",
  inspection_date: "2024-01-15",
  inspection_type: { name: "Structural" },
  inspectors: [{ name: "Inspector One" }, { name: "Inspector Two" }],
  item_count: 25,
  conforming_item_count: 22,
  deficient_item_count: 3,
};

/** Procore Drawing mock */
export const mockProcoreDrawing: ProcoreToolItem = {
  ...mockProcoreItem,
  id: "draw-001",
  title: "A-101",
  name: "Floor Plan - Level 1",
  discipline: "Architectural",
  revision: "3",
  current_revision: {
    revision_number: "3",
    updated_at: "2024-01-20T10:00:00Z",
    pdf_url: "https://example.com/drawings/a-101-r3.pdf",
    thumbnail_url: "https://example.com/drawings/a-101-r3-thumb.png",
  },
};

/** Array of Procore items for list tests */
export const mockProcoreItemList: ProcoreToolItem[] = [
  mockProcoreRFI,
  mockProcoreSubmittal,
  mockProcorePunchItem,
  mockProcoreInspection,
  mockProcoreDrawing,
];

// ============================================================================
// DataTable Column and Row Mocks
// ============================================================================

/** Generic column definitions for DataTable tests */
export const mockColumns = [
  { id: "name", header: "Name", accessorKey: "name", sortable: true },
  { id: "status", header: "Status", accessorKey: "status", sortable: true },
  { id: "date", header: "Date", accessorKey: "createdAt", sortable: true },
  { id: "count", header: "Count", accessorKey: "count", sortable: false },
];

/** Generic row data for DataTable tests */
export const mockTableRows = [
  {
    id: "1",
    name: "Item Alpha",
    status: "active",
    createdAt: "2024-01-01",
    count: 10,
  },
  {
    id: "2",
    name: "Item Beta",
    status: "pending",
    createdAt: "2024-01-02",
    count: 5,
  },
  {
    id: "3",
    name: "Item Gamma",
    status: "completed",
    createdAt: "2024-01-03",
    count: 15,
  },
  {
    id: "4",
    name: "Item Delta",
    status: "active",
    createdAt: "2024-01-04",
    count: 8,
  },
  {
    id: "5",
    name: "Item Epsilon",
    status: "archived",
    createdAt: "2024-01-05",
    count: 0,
  },
];

/** Large dataset for pagination tests */
export const mockLargeTableRows = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1),
  name: `Item ${i + 1}`,
  status: ["active", "pending", "completed", "archived"][i % 4],
  createdAt: new Date(2024, 0, (i % 28) + 1).toISOString().split("T")[0],
  count: Math.floor(Math.random() * 100),
}));

// ============================================================================
// App State Mocks
// ============================================================================

/** Default app state */
export const mockAppState = {
  selectedTool: null as string | null,
  authenticated: true,
};

/** App state with selected Procore tool */
export const mockAppStateWithTool = {
  ...mockAppState,
  selectedTool: "drawings",
};

// ============================================================================
// Folder Structure Mocks
// ============================================================================

/** Mock folder structure for file browser tests */
export const mockFolderStructure = {
  folders: [
    {
      _id: "folder-001",
      folderName: "Documents",
      files: ["doc-test-001", "doc-test-002"],
      subfolders: ["folder-002"],
      qrcode: "qr-test-001",
      project: "proj-test-001",
    },
    {
      _id: "folder-002",
      folderName: "Specifications",
      files: ["doc-test-003"],
      subfolders: [],
      qrcode: "qr-test-001",
      project: "proj-test-001",
    },
  ],
  files: mockDocumentList,
};

// ============================================================================
// Procore State Mock
// ============================================================================

/** Mock Procore Redux state */
export const mockProcoreState = {
  documents: [],
  drawings: [mockProcoreDrawing],
  forms: [],
  inspections: [mockProcoreInspection],
  "punch-lists": [mockProcorePunchItem],
  rfis: [mockProcoreRFI],
  submittals: [mockProcoreSubmittal],
  "coordination-issues": [],
  observations: [],
  photos: [],
  incidents: [],
  instructions: [],
  tasks: [],
  directory: [],
  specifications: [],
};
