/**
 * Test data builder functions for E2E tests.
 *
 * Each builder returns a realistic mock object with sensible defaults.
 * Pass a partial override object to customise any fields:
 *
 *   createMockUser({ permission: 'pm' })
 *   createMockCompany({ freeTrialActive: true })
 *   createMockQRCode({ qrcodeName: 'Custom QR' })
 */
import { getE2EStripeProductIds } from "../utils/e2e-env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
const E2E_BUSINESS_PRODUCT_ID = getE2EStripeProductIds().BUSINESS;

/** Generate a unique hex-style ID (24-char, similar to MongoDB ObjectId). */
function uniqueId(prefix = ""): string {
  _idCounter += 1;
  const hex = _idCounter.toString(16).padStart(24, "0");
  return prefix ? `${prefix}_${hex}` : hex;
}

/** Reset the internal counter — useful between test files if determinism is needed. */
export function resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Types  (self-contained so the e2e directory has no import dependency on src)
// ---------------------------------------------------------------------------

export type MockUser = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  permission: "admin" | "pm" | "user";
  isVerified: boolean;
  company: string;
};

export type MockCompany = {
  _id: string;
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZIP: string;
  companyWebsite: string;
  companyPhone: string;
  companyIndustry: string;
  companyLogo: string;
  companyLogoAWSId: string;
  companyLogoAWSKey: string;
  freeTrialActive: boolean;
  paidAccount: boolean;
  subscriptionCanceled: boolean;
  stripeCustomerID: string;
  stripeSubscriptionID: string;
  stripeProductID: string;
  procoreAccess: Record<string, string>;
  procoreCompanyID: number;
  procoreIntegration: boolean;
  deactivated: boolean;
  companyData: object;
  editProcoreItemsAllowed: boolean;
  qrCodeStorageUsed: number;
  documentStorageUsed: number;
  documentStorageCapacity: number;
  qrCodeStorageCapacity: number;
  qrCodesCount: number;
  documentsCount: number;
  useStyledQRCodes: boolean;
};

export type MockQRCode = {
  _id: string;
  qrcodeName: string;
  qrcodeType: string;
  url: string;
  company: string;
  group: string;
  project: string;
  projectName: string;
  groupingType: string;
  qrimage: string;
  qrImageUrl: string;
  passwordActivated: boolean;
  procoreConnect: boolean;
  procoreFetch: boolean;
  mobileScanCount: number;
  createdAt: string;
};

export type MockGroup = {
  _id: string;
  groupName: string;
  type: "arrangement" | "equipment";
  project: string;
  company: string;
  numberOfCodes: number;
  mobileScanCount: number;
  categories: string[];
  passwordActivated: boolean;
  createdAt: string;
};

export type MockProject = {
  _id: string;
  projectName: string;
  clientName: string;
  projectAddress: string;
  projectCity: string;
  projectState: string;
  projectZIP: string;
  projectStatus: string;
  company: string;
  archived: boolean;
  qrCodes: number;
  groups: number;
  mobileScanCount: number;
  name: string;
  location: string;
  createdAt: string;
  // Optional Procore integration fields
  procoreProjectID?: string;
  procoreCompanyID?: string;
};

export type MockDocument = {
  _id: string;
  documentName: string;
  documentFile: string;
  documentSize: number;
  folder: string;
  openToPage: number;
  project: string;
  qrcode: string;
  createdAt: string;
};

export type MockFolder = {
  _id: string;
  folderName: string;
  parentFolderId: string;
  files: string[];
  subfolders: string[];
  qrcode: string;
  project: string;
};

export type MockScannedQRResponse = {
  data: {
    _id: string;
    qrcodeName: string;
    qrimage?: string;
    qrImageUrl?: string;
    project: {
      _id: string;
      projectName: string;
      projectAddress?: string;
      projectCity?: string;
      projectState?: string;
      projectZIP?: string;
    };
    company: {
      _id: string;
      editProcoreItemsAllowed: boolean;
    };
  };
  procoreTools: { tool: string; count: number }[];
  folders: { _id: string; folderName: string; files?: string[] }[];
  documents: {
    _id: string;
    documentName: string;
    documentSize: number;
  }[];
};

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const id = overrides._id ?? uniqueId("usr");
  return {
    _id: id,
    email: `user-${id}@test.taliho.com`,
    firstName: "Test",
    lastName: "User",
    phoneNumber: "555-000-0000",
    permission: "admin",
    isVerified: true,
    company: "comp_000000000000000000000001",
    ...overrides,
  };
}

export function createMockCompany(
  overrides: Partial<MockCompany> = {},
): MockCompany {
  return {
    _id: overrides._id ?? uniqueId("comp"),
    companyName: "Taliho Test Company",
    companyAddress: "100 Test Ave",
    companyCity: "Los Angeles",
    companyState: "CA",
    companyZIP: "90001",
    companyWebsite: "https://test.taliho.com",
    companyPhone: "555-123-4567",
    companyIndustry: "Construction",
    companyLogo: "",
    companyLogoAWSId: "",
    companyLogoAWSKey: "",
    freeTrialActive: false,
    paidAccount: true,
    subscriptionCanceled: false,
    stripeCustomerID: "cus_test_123",
    stripeSubscriptionID: "sub_test_123",
    stripeProductID: E2E_BUSINESS_PRODUCT_ID,
    procoreAccess: {},
    procoreCompanyID: 12345,
    procoreIntegration: false,
    deactivated: false,
    companyData: {},
    editProcoreItemsAllowed: true,
    qrCodeStorageUsed: 0,
    documentStorageUsed: 0,
    documentStorageCapacity: 10737418240, // 10 GB
    qrCodeStorageCapacity: 5368709120, // 5 GB
    qrCodesCount: 0,
    documentsCount: 0,
    useStyledQRCodes: false,
    ...overrides,
  };
}

export function createMockQRCode(
  overrides: Partial<MockQRCode> = {},
): MockQRCode {
  const id = overrides._id ?? uniqueId("qr");
  return {
    _id: id,
    qrcodeName: `QR Code ${id.slice(-4)}`,
    qrcodeType: "standard",
    url: `https://app.taliho.com/scannedQR/${id}`,
    company: "comp_000000000000000000000001",
    group: "grp_000000000000000000000001",
    project: "proj_000000000000000000000001",
    projectName: "Test Project",
    groupingType: "arrangement",
    qrimage: "",
    qrImageUrl: "",
    passwordActivated: false,
    procoreConnect: false,
    procoreFetch: false,
    mobileScanCount: 0,
    createdAt: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}

export function createMockGroup(overrides: Partial<MockGroup> = {}): MockGroup {
  const id = overrides._id ?? uniqueId("grp");
  return {
    _id: id,
    groupName: `Group ${id.slice(-4)}`,
    type: "arrangement",
    project: "proj_000000000000000000000001",
    company: "comp_000000000000000000000001",
    numberOfCodes: 0,
    mobileScanCount: 0,
    categories: [],
    passwordActivated: false,
    createdAt: "2025-01-10T09:00:00Z",
    ...overrides,
  };
}

export function createMockProject(
  overrides: Partial<MockProject> = {},
): MockProject {
  const id = overrides._id ?? uniqueId("proj");
  const name = overrides.projectName ?? `Project ${id.slice(-4)}`;
  return {
    _id: id,
    projectName: name,
    clientName: "Test Client",
    projectAddress: "200 Project Blvd",
    projectCity: "San Francisco",
    projectState: "CA",
    projectZIP: "94105",
    projectStatus: "active",
    company: "comp_000000000000000000000001",
    archived: false,
    qrCodes: 0,
    groups: 0,
    mobileScanCount: 0,
    name,
    location: "San Francisco, CA",
    createdAt: "2025-01-01T09:00:00Z",
    ...overrides,
  };
}

export function createMockDocument(
  overrides: Partial<MockDocument> = {},
): MockDocument {
  const id = overrides._id ?? uniqueId("doc");
  return {
    _id: id,
    documentName: `Document-${id.slice(-4)}.pdf`,
    documentFile: `uploads/${id}.pdf`,
    documentSize: 1048576, // 1 MB
    folder: "",
    openToPage: 1,
    project: "proj_000000000000000000000001",
    qrcode: "qr_000000000000000000000001",
    createdAt: "2025-01-20T09:00:00Z",
    ...overrides,
  };
}

export function createMockFolder(
  overrides: Partial<MockFolder> = {},
): MockFolder {
  const id = overrides._id ?? uniqueId("fld");
  return {
    _id: id,
    folderName: `Folder ${id.slice(-4)}`,
    parentFolderId: "",
    files: [],
    subfolders: [],
    qrcode: "qr_000000000000000000000001",
    project: "proj_000000000000000000000001",
    ...overrides,
  };
}

export function createMockScannedQRResponse(
  overrides: Partial<MockScannedQRResponse> = {},
): MockScannedQRResponse {
  const defaults: MockScannedQRResponse = {
    data: {
      _id: "qr_000000000000000000000001",
      qrcodeName: "Test QR",
      project: {
        _id: "proj_000000000000000000000001",
        projectName: "Test Project",
        projectAddress: "123 Main St",
        projectCity: "Los Angeles",
        projectState: "CA",
        projectZIP: "90001",
      },
      company: {
        _id: "comp_000000000000000000000001",
        editProcoreItemsAllowed: true,
      },
    },
    procoreTools: [],
    folders: [],
    documents: [],
  };

  return {
    ...defaults,
    ...overrides,
    // Deep-merge data so callers can override nested fields without
    // having to spread the entire data object themselves.
    data: {
      ...defaults.data,
      ...(overrides.data ?? {}),
      project: {
        ...defaults.data.project,
        ...(overrides.data?.project ?? {}),
      },
      company: {
        ...defaults.data.company,
        ...(overrides.data?.company ?? {}),
      },
    },
  };
}
