import type {
  Company,
  Document,
  ProcoreDocumentFile,
  ProcoreDocumentFolder,
  ProcoreToolData,
  ProcoreToolItem,
  Project,
  QRCode,
  QRCodeAggregate,
} from "@/types";

const BUSINESS_PRODUCT_ID =
  import.meta.env.VITE_STRIPE_PRODUCT_ID_BUSINESS || "prod_static_business";
const BUSINESS_PRICE_ID =
  import.meta.env.VITE_STRIPE_PRICE_BUSINESS_MONTHLY ||
  "price_static_business_monthly";

const QR_STYLE_LOGO_URL = "/images/taliho-logo.png";
const PROCORE_COMPANY_ID = "procore-company-440";
const PROCORE_PROJECT_ID = "procore-project-991";
export const COMPANY_ID = "company-static-001";
const USER_ID = "user-static-001";

function svgDataUrl(
  label: string,
  primary: string,
  secondary: string = "#111827",
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="28" fill="#ffffff" />
      <rect x="24" y="24" width="272" height="272" rx="24" fill="${secondary}" />
      <rect x="54" y="54" width="212" height="212" rx="18" fill="#ffffff" />
      <rect x="74" y="74" width="172" height="172" rx="12" fill="${primary}" opacity="0.16" />
      <path d="M96 96h40v40H96zM184 96h40v40h-40zM96 184h40v40H96z" fill="${secondary}" />
      <path d="M154 118h22v18h-22zM154 146h48v18h-48zM154 174h34v18h-34zM154 202h56v18h-56z" fill="${secondary}" opacity="0.78" />
      <text x="160" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#ffffff">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function iso(daysOffset: number): string {
  return new Date(
    Date.UTC(2026, 3, 30 + daysOffset, 14, Math.max(0, 20 - daysOffset), 0),
  ).toISOString();
}

export function cloneMockValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export const STATIC_ACCESS_TOKEN = "static-redesign-access-token";

export const STATIC_USER = {
  _id: USER_ID,
  userId: USER_ID,
  firstName: "Mariam",
  lastName: "Review",
  email: "team@taliho.design",
  permission: "admin" as const,
  isVerified: true,
  company: "Taliho Redesign Studio",
  companyId: COMPANY_ID,
  isTalihoEmployee: true,
  accessToken: STATIC_ACCESS_TOKEN,
};

export const STATIC_COMPANY = {
  _id: COMPANY_ID,
  companyName: "Taliho Redesign Studio",
  companyAddress: "400 Harbor Avenue",
  companyCity: "Boston",
  companyState: "MA",
  companyZIP: "02118",
  companyWebsite: "https://taliho.design",
  companyIndustry: "Construction Technology",
  companyLogo: QR_STYLE_LOGO_URL,
  companyLogoAWSId: "logo-static-001",
  companyLogoAWSKey: "static/logo.png",
  procoreAccess: {
    refreshToken: "static-refresh-token",
    documents: "read",
    drawings: "read",
    rfis: "read",
  },
  procoreCompanyID: Number(PROCORE_COMPANY_ID.replace(/\D/g, "")),
  freeTrialActive: false,
  paidAccount: true,
  subscriptionCanceled: false,
  stripeCustomerID: "cus_static_review",
  stripeSubscriptionID: "sub_static_review",
  stripeProductID: BUSINESS_PRODUCT_ID,
  stripePriceID: BUSINESS_PRICE_ID,
  stripeSubscriptionStatus: "active",
  deactivated: false,
  companyData: {},
  editProcoreItemsAllowed: true,
  procoreIntegration: true,
  stripeAddons: [
    {
      name: "Document Storage Pack",
      quantity: 1,
    },
  ],
  qrCodeStorageUsed: 125 * 1024 * 1024,
  documentStorageUsed: 4_300 * 1024 * 1024,
  qrCodeStorageCapacity: 2 * 1024 * 1024 * 1024,
  documentStorageCapacity: 80 * 1024 * 1024 * 1024,
  qrCodesCount: 18,
  documentsCount: 47,
} as Company;

export const STATIC_PROJECTS = [
  {
    _id: "project-static-001",
    name: "Terminal A Renovation",
    projectName: "Terminal A Renovation",
    clientName: "Harbor City Aviation",
    location: "11 Seaport Boulevard, Boston, MA 02110",
    projectAddress: "11 Seaport Boulevard",
    projectCity: "Boston",
    projectState: "MA",
    projectZIP: "02110",
    projectStatus: "active",
    qrCodes: 7,
    groups: 3,
    mobileScanCount: 412,
    createdAt: iso(-90),
    company: COMPANY_ID,
    archived: false,
    procoreCompanyID: PROCORE_COMPANY_ID,
    procoreProjectID: PROCORE_PROJECT_ID,
  },
  {
    _id: "project-static-002",
    name: "Riverfront Tower Interiors",
    projectName: "Riverfront Tower Interiors",
    clientName: "Northline Development",
    location: "220 River Street, Providence, RI 02903",
    projectAddress: "220 River Street",
    projectCity: "Providence",
    projectState: "RI",
    projectZIP: "02903",
    projectStatus: "on-hold",
    qrCodes: 5,
    groups: 2,
    mobileScanCount: 268,
    createdAt: iso(-65),
    company: COMPANY_ID,
    archived: false,
    procoreCompanyID: PROCORE_COMPANY_ID,
    procoreProjectID: "procore-project-992",
  },
  {
    _id: "project-static-003",
    name: "North Yard Equipment Program",
    projectName: "North Yard Equipment Program",
    clientName: "Taliho Ops",
    location: "15 Foundry Road, Worcester, MA 01608",
    projectAddress: "15 Foundry Road",
    projectCity: "Worcester",
    projectState: "MA",
    projectZIP: "01608",
    projectStatus: "completed",
    qrCodes: 6,
    groups: 2,
    mobileScanCount: 191,
    createdAt: iso(-120),
    company: COMPANY_ID,
    archived: false,
    procoreCompanyID: PROCORE_COMPANY_ID,
    procoreProjectID: "procore-project-993",
  },
] as Project[];

export type StaticGroup = {
  _id: string;
  type: "arrangement" | "equipment";
  arrangementName?: string;
  arrangementType?: string;
  equipmentID?: string;
  equipmentName?: string;
  groupName: string;
  project: string;
  numberOfCodes: number;
  mobileScanCount: number;
  createdAt: string;
  company: string;
  categories: string[];
  description?: string;
};

export const STATIC_GROUPS: StaticGroup[] = [
  {
    _id: "group-static-001",
    type: "arrangement",
    arrangementName: "Level 2 Electrical Rooms",
    arrangementType: "Site Binder",
    groupName: "Level 2 Electrical Rooms",
    project: "project-static-001",
    numberOfCodes: 4,
    mobileScanCount: 201,
    createdAt: iso(-44),
    company: COMPANY_ID,
    categories: ["Safety", "Drawings", "Submittals"],
    description: "Static review grouping for electrical room documentation.",
  },
  {
    _id: "group-static-002",
    type: "arrangement",
    arrangementName: "Issued Drawing Boards",
    arrangementType: "Procore Drawings Codes",
    groupName: "Issued Drawing Boards",
    project: "project-static-002",
    numberOfCodes: 3,
    mobileScanCount: 114,
    createdAt: iso(-33),
    company: COMPANY_ID,
    categories: ["Drawings", "RFIs"],
    description: "Drawing board stations synced from Procore.",
  },
  {
    _id: "group-static-003",
    type: "equipment",
    equipmentID: "EQ-24",
    equipmentName: "North Yard Access Fleet",
    groupName: "North Yard Access Fleet",
    project: "project-static-003",
    numberOfCodes: 5,
    mobileScanCount: 88,
    createdAt: iso(-28),
    company: COMPANY_ID,
    categories: ["Equipment", "Operations"],
    description: "Lift and access equipment for static redesign demos.",
  },
];

export const STATIC_QR_CODES = [
  {
    _id: "qr-static-001",
    groupingType: "group",
    qrcodeName: "Terminal A Site Binder",
    company: COMPANY_ID,
    project: "project-static-001",
    projectName: "Terminal A Renovation",
    type: "folder",
    group: "group-static-001",
    qrimage: svgDataUrl("SITE", "#f59e0b"),
    qrImageUrl: svgDataUrl("SITE", "#f59e0b"),
    mobileScanCount: 189,
    passwordActivated: false,
    procoreConnect: true,
    procoreFetch: true,
    createdBy: USER_ID,
    createdAt: new Date(iso(-25)),
  },
  {
    _id: "qr-static-002",
    groupingType: "group",
    qrcodeName: "Riverfront Drawings Board",
    company: COMPANY_ID,
    project: "project-static-002",
    projectName: "Riverfront Tower Interiors",
    type: "procore-drawing",
    group: "group-static-002",
    qrimage: svgDataUrl("DRAW", "#0f766e"),
    qrImageUrl: svgDataUrl("DRAW", "#0f766e"),
    mobileScanCount: 124,
    passwordActivated: false,
    procoreConnect: true,
    procoreFetch: true,
    procoreCategory: "drawings",
    createdBy: USER_ID,
    createdAt: new Date(iso(-20)),
  },
  {
    _id: "qr-static-003",
    groupingType: "group",
    qrcodeName: "North Yard Equipment Check-In",
    company: COMPANY_ID,
    project: "project-static-003",
    projectName: "North Yard Equipment Program",
    type: "procore-tool",
    group: "group-static-003",
    qrimage: svgDataUrl("TOOLS", "#2563eb"),
    qrImageUrl: svgDataUrl("TOOLS", "#2563eb"),
    mobileScanCount: 76,
    passwordActivated: false,
    procoreConnect: true,
    procoreFetch: true,
    procoreCategory: "punch-list",
    createdBy: USER_ID,
    createdAt: new Date(iso(-18)),
  },
  {
    _id: "qr-static-004",
    groupingType: "group",
    qrcodeName: "Review Team Contact Card",
    company: COMPANY_ID,
    project: "project-static-001",
    projectName: "Terminal A Renovation",
    type: "vcard",
    group: "group-static-001",
    qrimage: svgDataUrl("VCARD", "#9333ea"),
    qrImageUrl: svgDataUrl("VCARD", "#9333ea"),
    mobileScanCount: 33,
    passwordActivated: false,
    createdBy: USER_ID,
    createdAt: new Date(iso(-11)),
  },
] as QRCode[];

export const STATIC_DOCUMENTS = [
  {
    _id: "doc-static-001",
    documentName: "Site Safety Orientation.pdf",
    documentFile: QR_STYLE_LOGO_URL,
    documentSize: 2_350_000,
    folder: "folder-static-001",
    openToPage: 1,
    project: "project-static-001",
    qrcode: "qr-static-001",
    createdAt: iso(-26),
    addedLink: false,
  },
  {
    _id: "doc-static-002",
    documentName: "Electrical Shutdown Plan.pdf",
    documentFile: QR_STYLE_LOGO_URL,
    documentSize: 3_900_000,
    folder: "folder-static-001",
    openToPage: 2,
    project: "project-static-001",
    qrcode: "qr-static-001",
    createdAt: iso(-24),
    addedLink: false,
  },
  {
    _id: "doc-static-003",
    documentName: "Commissioning Checklist.pdf",
    documentFile: QR_STYLE_LOGO_URL,
    documentSize: 1_800_000,
    folder: "folder-static-002",
    openToPage: 1,
    project: "project-static-001",
    qrcode: "qr-static-001",
    createdAt: iso(-21),
    addedLink: false,
  },
  {
    _id: "doc-static-004",
    documentName: "Design Review Notes",
    documentFile: "https://www.taliho.com",
    documentSize: 0,
    folder: "folder-static-001",
    openToPage: 1,
    project: "project-static-001",
    qrcode: "qr-static-001",
    createdAt: iso(-9),
    addedLink: true,
  },
] as Document[];

export const STATIC_FOLDERS = [
  {
    _id: "folder-static-001",
    files: ["doc-static-001", "doc-static-002", "doc-static-004"],
    subfolders: ["folder-static-002"],
    folderName: "Binder Core",
    qrcode: "qr-static-001",
    project: "project-static-001",
    linkedFiles: STATIC_DOCUMENTS.filter((doc) =>
      ["doc-static-001", "doc-static-002", "doc-static-004"].includes(doc._id),
    ),
  },
  {
    _id: "folder-static-002",
    files: ["doc-static-003"],
    subfolders: [],
    folderName: "Commissioning",
    qrcode: "qr-static-001",
    project: "project-static-001",
    linkedFiles: STATIC_DOCUMENTS.filter((doc) => doc._id === "doc-static-003"),
  },
];

const procoreDocumentsFolders = [
  {
    id: 501,
    name: "Architectural",
    folders: [
      {
        id: 502,
        name: "Issued For Review",
        folders: [],
        files: [
          {
            id: "pdoc-file-001",
            name: "A1.01 Lobby Elevations.pdf",
            file_versions: [{ url: QR_STYLE_LOGO_URL }],
          },
        ],
      },
    ],
    files: [
      {
        id: "pdoc-file-000",
        name: "Transmittal Package.pdf",
        file_versions: [{ url: QR_STYLE_LOGO_URL }],
      },
    ],
  },
] as ProcoreDocumentFolder[];

const procoreDocumentsFiles = [
  {
    id: "pdoc-file-010",
    name: "MEP Coordination Matrix.xlsx",
    file_versions: [{ url: QR_STYLE_LOGO_URL }],
  },
] as ProcoreDocumentFile[];

const baseToolItem = {
  created_by: {
    name: "Jordan Miles",
    company_name: "Taliho Redesign Studio",
  },
  assignee: {
    name: "Avery Hart",
    company_name: "Taliho Redesign Studio",
  },
  updated_at: iso(-2),
  created_at: iso(-30),
  attentions: [],
};

export const STATIC_PROCORE_ITEMS = {
  drawings: [
    {
      ...baseToolItem,
      id: "draw-001",
      procoreItemID: "draw-001",
      title: "A1.01",
      name: "Main Lobby Floor Plan",
      discipline: "Architectural",
      revision: "7",
      status: "current",
      current_revision: {
        revision_number: "7",
        updated_at: iso(-6),
        pdf_url: QR_STYLE_LOGO_URL,
        thumbnail_url: QR_STYLE_LOGO_URL,
      },
    },
    {
      ...baseToolItem,
      id: "draw-002",
      procoreItemID: "draw-002",
      title: "E2.10",
      name: "Electrical Room Layout",
      discipline: "Electrical",
      revision: "2",
      status: "current",
      current_revision: {
        revision_number: "2",
        updated_at: iso(-5),
        pdf_url: QR_STYLE_LOGO_URL,
        thumbnail_url: QR_STYLE_LOGO_URL,
      },
    },
  ] as ProcoreToolItem[],
  rfis: [
    {
      ...baseToolItem,
      id: "rfi-001",
      procoreItemID: "rfi-001",
      title: "Clarify wall finish at vestibule",
      full_number: "RFI-013",
      subject: "Wall finish sequencing",
      status: "open",
      due_date: iso(7).slice(0, 10),
      ball_in_court: { name: "Architect" },
    },
  ] as ProcoreToolItem[],
  submittals: [
    {
      ...baseToolItem,
      id: "sub-001",
      procoreItemID: "sub-001",
      title: "Storefront framing package",
      formatted_number: "SUB-108",
      status: "pending",
      specification_section: {
        name: "08 44 13",
        label: "Glazed Aluminum Curtain Walls",
      },
    },
  ] as ProcoreToolItem[],
  inspections: [
    {
      ...baseToolItem,
      id: "insp-001",
      procoreItemID: "insp-001",
      title: "Pre-close inspection",
      status: "completed",
      inspection_date: iso(-3).slice(0, 10),
      inspection_type: { name: "Quality" },
      item_count: 16,
      conforming_item_count: 14,
      deficient_item_count: 2,
    },
  ] as ProcoreToolItem[],
  punchLists: [
    {
      ...baseToolItem,
      id: "punch-001",
      procoreItemID: "punch-001",
      title: "Replace damaged ceiling tile",
      status: "open",
      priority: "medium",
      location: { name: "Level 2 Corridor" },
      due_date: iso(5).slice(0, 10),
    },
  ] as ProcoreToolItem[],
  photos: [
    {
      ...baseToolItem,
      id: "photo-001",
      procoreItemID: "photo-001",
      title: "North entry before paint",
      description: "Used for static redesign gallery conversations.",
      image_url: QR_STYLE_LOGO_URL,
      status: "published",
    },
  ] as ProcoreToolItem[],
  observations: [
    {
      ...baseToolItem,
      id: "obs-001",
      procoreItemID: "obs-001",
      title: "Ceiling access panel misaligned",
      status: "open",
      priority: "normal",
    },
  ] as ProcoreToolItem[],
  incidents: [
    {
      ...baseToolItem,
      id: "inc-001",
      procoreItemID: "inc-001",
      title: "Slip near loading dock",
      status: "closed",
      event_date: iso(-12).slice(0, 10),
    },
  ] as ProcoreToolItem[],
  instructions: [
    {
      ...baseToolItem,
      id: "inst-001",
      procoreItemID: "inst-001",
      title: "Shift temporary fencing lane",
      status: "sent",
    },
  ] as ProcoreToolItem[],
  tasks: [
    {
      ...baseToolItem,
      id: "task-001",
      procoreItemID: "task-001",
      title: "Confirm lobby signage install date",
      status: "in_progress",
      due_date: iso(3).slice(0, 10),
    },
  ] as ProcoreToolItem[],
  forms: [
    {
      ...baseToolItem,
      id: "form-001",
      procoreItemID: "form-001",
      title: "Daily startup checklist",
      status: "draft",
    },
  ] as ProcoreToolItem[],
  specifications: [
    {
      ...baseToolItem,
      id: "spec-001",
      procoreItemID: "spec-001",
      title: "Division 08 Openings",
      status: "issued",
      section_number: "08 11 13",
    },
  ] as ProcoreToolItem[],
  coordinationIssues: [
    {
      ...baseToolItem,
      id: "coord-001",
      procoreItemID: "coord-001",
      title: "Duct clash at beam pocket",
      issue_number: "CI-24",
      status: "open",
    },
  ] as ProcoreToolItem[],
  directory: [
    {
      id: "dir-001",
      procoreItemID: "dir-001",
      name: "Avery Morgan",
      attentions: [],
      login_information: { name: "Avery Morgan" },
      job_title: "Project Engineer",
      company: { name: "Harbor City Aviation" },
      trades: [{ name: "Owner" }],
      business_phone: "(617) 555-0171",
      email_address: "avery.morgan@example.com",
    },
    {
      id: "dir-002",
      procoreItemID: "dir-002",
      name: "Chris Patel",
      attentions: [],
      login_information: { name: "Chris Patel" },
      job_title: "Superintendent",
      company: { name: "Northline Development" },
      trades: [{ name: "GC" }],
      business_phone: "(617) 555-0149",
      email_address: "chris.patel@example.com",
    },
  ] as ProcoreToolItem[],
  documents: {
    files: procoreDocumentsFiles,
    folders: procoreDocumentsFolders,
  },
};

export type StaticCategory = {
  _id: string;
  categoryName: string;
  categoryClass: string;
  company: string;
  procoreTool?: string;
  createdAt: string;
  updatedAt?: string;
};

export const STATIC_CATEGORIES: StaticCategory[] = [
  {
    _id: "cat-static-001",
    categoryName: "Safety",
    categoryClass: "General",
    company: COMPANY_ID,
    createdAt: iso(-100),
    updatedAt: iso(-30),
  },
  {
    _id: "cat-static-002",
    categoryName: "Drawings",
    categoryClass: "Documentation",
    company: COMPANY_ID,
    procoreTool: "drawings",
    createdAt: iso(-98),
    updatedAt: iso(-22),
  },
  {
    _id: "cat-static-003",
    categoryName: "RFIs",
    categoryClass: "Coordination",
    company: COMPANY_ID,
    procoreTool: "rfis",
    createdAt: iso(-97),
    updatedAt: iso(-16),
  },
  {
    _id: "cat-static-004",
    categoryName: "Operations",
    categoryClass: "Field",
    company: COMPANY_ID,
    createdAt: iso(-90),
    updatedAt: iso(-12),
  },
];

export type StaticUserRecord = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  permission: "admin" | "pm" | "user";
  isVerified: boolean;
  createdAt: string;
  lastLoggedIn?: string;
};

export const STATIC_USERS: StaticUserRecord[] = [
  {
    _id: USER_ID,
    email: "team@taliho.design",
    firstName: "Mariam",
    lastName: "Review",
    permission: "admin",
    isVerified: true,
    phoneNumber: "(617) 555-0100",
    createdAt: iso(-220),
    lastLoggedIn: iso(-1),
  },
  {
    _id: "user-static-002",
    email: "alex@taliho.design",
    firstName: "Alex",
    lastName: "Marshall",
    permission: "pm",
    isVerified: true,
    phoneNumber: "(617) 555-0101",
    createdAt: iso(-180),
    lastLoggedIn: iso(-2),
  },
  {
    _id: "user-static-003",
    email: "sam@taliho.design",
    firstName: "Sam",
    lastName: "Nguyen",
    permission: "user",
    isVerified: true,
    phoneNumber: "(617) 555-0102",
    createdAt: iso(-160),
    lastLoggedIn: iso(-3),
  },
];

export const STATIC_NOTIFICATION_PREFERENCES = {
  email: {
    projectUpdates: true,
    inspectionReminders: true,
    documentUploads: true,
    teamActivity: false,
    weeklyDigest: true,
  },
  push: {
    projectUpdates: true,
    inspectionReminders: false,
    documentUploads: true,
    teamActivity: false,
  },
  frequency: "daily",
  quietHoursEnabled: true,
  quietHoursStart: "18:00",
  quietHoursEnd: "07:00",
};

export const STATIC_ACTIVITY_LOG = [
  {
    _id: "activity-static-001",
    companyId: COMPANY_ID,
    userId: USER_ID,
    userName: "Mariam Review",
    action: "settings_updated",
    category: "settings",
    details: { section: "Company info" },
    createdAt: iso(-4),
  },
  {
    _id: "activity-static-002",
    companyId: COMPANY_ID,
    userId: "user-static-002",
    userName: "Alex Marshall",
    action: "procore_sync_completed",
    category: "integrations",
    details: { projectName: "Terminal A Renovation" },
    createdAt: iso(-3),
  },
  {
    _id: "activity-static-003",
    companyId: COMPANY_ID,
    userId: USER_ID,
    userName: "Mariam Review",
    action: "user_invited",
    category: "users",
    details: { email: "sam@taliho.design" },
    createdAt: iso(-2),
  },
  {
    _id: "activity-static-004",
    companyId: COMPANY_ID,
    userId: USER_ID,
    userName: "Mariam Review",
    action: "login_success",
    category: "security",
    details: { mode: "static" },
    createdAt: iso(-1),
  },
];

export const STATIC_ADMIN_COMPANIES = [
  {
    _id: COMPANY_ID,
    companyName: STATIC_COMPANY.companyName,
    usersCount: STATIC_USERS.length,
    projectsCount: STATIC_PROJECTS.length,
    qrCodesCount: STATIC_QR_CODES.length,
    documentsCount: STATIC_DOCUMENTS.length,
    paidAccount: true,
    freeTrialActive: false,
    planTier: "business",
    subscriptionCanceled: false,
    procoreIntegration: true,
    emailDomains: ["taliho.design"],
    createdAt: iso(-220),
    deactivated: false,
    oldestAdminEmail: "team@taliho.design",
    oldestAdminFirstName: "Mariam",
    oldestAdminLastName: "Review",
  },
  {
    _id: "company-static-002",
    companyName: "Workshop Preview Co.",
    usersCount: 4,
    projectsCount: 2,
    qrCodesCount: 9,
    documentsCount: 14,
    paidAccount: false,
    freeTrialActive: true,
    planTier: "trial",
    subscriptionCanceled: false,
    procoreIntegration: false,
    emailDomains: ["preview.team"],
    createdAt: iso(-75),
    deactivated: false,
    oldestAdminEmail: "owner@preview.team",
    oldestAdminFirstName: "Jamie",
    oldestAdminLastName: "Stone",
  },
];

export const STATIC_QR_STYLE_PRESETS = {
  presets: ["clean-grid", "field-signal", "bold-frame", "sunset-band"],
  presetsByCategory: {
    basic: [
      {
        name: "clean-grid",
        displayName: "Clean Grid",
        description: "Minimal QR styling for crisp prototype discussions.",
        category: "basic",
      },
    ],
    color: [
      {
        name: "field-signal",
        displayName: "Field Signal",
        description: "High-contrast amber and slate treatment.",
        category: "color",
      },
      {
        name: "sunset-band",
        displayName: "Sunset Band",
        description: "Warm footer band with a lighter code well.",
        category: "color",
      },
    ],
    advanced: [
      {
        name: "bold-frame",
        displayName: "Bold Frame",
        description: "Thicker corner treatment for print-first comps.",
        category: "advanced",
      },
    ],
  },
};

export const STATIC_QR_STYLE_CONFIG = {
  useStyledQRCodes: true,
  qrStyleConfig: {
    presetName: "field-signal",
    logo: {
      logoUrl: QR_STYLE_LOGO_URL,
      awsKey: "static/qr-style/logo.png",
      awsId: "qr-style-logo-static",
    },
  },
};

export const STATIC_INSPECTION_TEMPLATES = [
  {
    id: "template-001",
    name: "Pre-close Checklist",
  },
  {
    id: "template-002",
    name: "Substantial Completion Walk",
  },
];

export const STATIC_INSPECTION_ITEMS = [
  {
    id: "inspection-item-001",
    status: "conforming",
    description: "Verify door hardware installation.",
  },
  {
    id: "inspection-item-002",
    status: "deficient",
    description: "Patch ceiling grid paint scratch.",
  },
];

export const STATIC_PUNCH_ASSIGNEES = [
  {
    id: "dir-001",
    name: "Avery Morgan",
    login_information: { name: "Avery Morgan" },
  },
  {
    id: "dir-002",
    name: "Chris Patel",
    login_information: { name: "Chris Patel" },
  },
];

export const STATIC_ONLINE_PRESENCE = {
  desktop: 3,
  mobile: 2,
  users: [
    {
      sessionId: "user:user-static-001",
      firstName: "Mariam",
      lastName: "Review",
      email: "team@taliho.design",
      companyName: STATIC_COMPANY.companyName,
      routePath: "/dashboard",
      isMobileRoute: false,
      lastSeenAt: iso(-1),
    },
    {
      sessionId: "anon:qr-static-001",
      firstName: "Field",
      lastName: "Visitor",
      email: "guest@static.local",
      companyName: STATIC_COMPANY.companyName,
      routePath: "/scannedQR",
      isMobileRoute: true,
      lastSeenAt: iso(-1),
    },
  ],
};

export const STATIC_PLATFORM_STATS = {
  totalCompanies: 2,
  totalUsers: 7,
  totalProjects: 5,
  totalQrCodes: 27,
  totalDocuments: 61,
  totalQrGroups: 8,
  totalQrScans: 1_148,
  totalDocumentStorageUsed: 4_900 * 1024 * 1024,
  totalDocumentStorageCapacity: 120 * 1024 * 1024 * 1024,
  totalQrCodeStorageUsed: 182 * 1024 * 1024,
  totalQrCodeStorageCapacity: 4 * 1024 * 1024 * 1024,
  planBreakdown: {
    freeTrial: 1,
    trialRefreshed: 0,
    standard: 0,
    professional: 0,
    business: 1,
    earlyAdopter: 0,
    expired: 0,
    cancelled: 0,
  },
  procoreConnected: 1,
  procoreNotConnected: 1,
  deactivatedCompanies: 0,
};

export function computeDashboardStats(qrCodes: QRCode[] = STATIC_QR_CODES) {
  return {
    qrCodesCount: qrCodes.length,
    qrScansCount: qrCodes.reduce(
      (total, qrCode) => total + (qrCode.mobileScanCount ?? 0),
      0,
    ),
    documentsCount: STATIC_DOCUMENTS.length,
    projectsCount: STATIC_PROJECTS.length,
    groupsCount: STATIC_GROUPS.length,
    arrangementsCount: STATIC_GROUPS.filter((group) => group.type === "arrangement")
      .length,
    equipmentCount: STATIC_GROUPS.filter((group) => group.type === "equipment")
      .length,
  };
}

export function computeStorageStats() {
  return {
    documentStorageUsed: STATIC_COMPANY.documentStorageUsed ?? 0,
    qrCodeStorageUsed: STATIC_COMPANY.qrCodeStorageUsed ?? 0,
    documentsCount: STATIC_DOCUMENTS.length,
    qrCodesCount: STATIC_QR_CODES.length,
    documentStorageCapacity: STATIC_COMPANY.documentStorageCapacity ?? 0,
    qrCodeStorageCapacity: STATIC_COMPANY.qrCodeStorageCapacity ?? 0,
    documentsWithoutSize: STATIC_DOCUMENTS.filter((doc) => !doc.documentSize)
      .length,
  };
}

export function createScannedQrAggregate(
  qrCodeId: string = "qr-static-001",
): QRCodeAggregate {
  const qrCode =
    STATIC_QR_CODES.find((item) => item._id === qrCodeId) ?? STATIC_QR_CODES[0];
  const project =
    STATIC_PROJECTS.find((item) => item._id === qrCode.project) ??
    STATIC_PROJECTS[0];

  return {
    procoreConnect: true,
    procoreFetch: true,
    project: {
      projectAddress: project.projectAddress,
      projectCity: project.projectCity,
      projectState: project.projectState,
      projectZIP: project.projectZIP,
      _id: project._id,
      projectName: project.projectName,
      clientName: project.clientName,
      procoreCompanyID: project.procoreCompanyID ?? PROCORE_COMPANY_ID,
      procoreProjectID: project.procoreProjectID ?? PROCORE_PROJECT_ID,
    },
    company: {
      _id: STATIC_COMPANY._id,
      freeTrialActive: STATIC_COMPANY.freeTrialActive,
      paidAccount: STATIC_COMPANY.paidAccount,
      lastLoggedIn: new Date(iso(-1)),
      companyAddress: STATIC_COMPANY.companyAddress,
      companyCity: STATIC_COMPANY.companyCity,
      companyName: STATIC_COMPANY.companyName,
      companyState: STATIC_COMPANY.companyState,
      companyZIP: STATIC_COMPANY.companyZIP,
      procoreCompanyID: String(STATIC_COMPANY.procoreCompanyID),
      procoreAccess: STATIC_COMPANY.procoreAccess as unknown as Record<
        string,
        object
      >,
      editProcoreItemsAllowed: STATIC_COMPANY.editProcoreItemsAllowed,
    },
    data: {
      _id: qrCode._id,
      qrcodeName: qrCode.qrcodeName,
      qrimage: qrCode.qrimage,
      qrImageUrl: qrCode.qrImageUrl,
      groupingType: qrCode.groupingType,
      type: qrCode.type,
      procoreConnect: qrCode.procoreConnect,
      procoreFetch: qrCode.procoreFetch,
      procoreCategory: qrCode.procoreCategory as QRCodeAggregate["data"]["procoreCategory"],
      project: {
        projectCity: project.projectCity,
        projectState: project.projectState,
        projectZIP: project.projectZIP,
        projectAddress: project.projectAddress,
        _id: project._id,
        projectName: project.projectName,
        clientName: project.clientName,
        procoreCompanyID: project.procoreCompanyID,
        procoreProjectID: project.procoreProjectID,
      },
      company: {
        _id: STATIC_COMPANY._id,
        freeTrialActive: STATIC_COMPANY.freeTrialActive,
        paidAccount: STATIC_COMPANY.paidAccount,
        lastLoggedIn: new Date(iso(-1)),
        companyAddress: STATIC_COMPANY.companyAddress,
        companyCity: STATIC_COMPANY.companyCity,
        companyName: STATIC_COMPANY.companyName,
        companyState: STATIC_COMPANY.companyState,
        companyZIP: STATIC_COMPANY.companyZIP,
        procoreCompanyID: String(STATIC_COMPANY.procoreCompanyID),
        procoreAccess: STATIC_COMPANY.procoreAccess as unknown as Record<
          string,
          object
        >,
        editProcoreItemsAllowed: STATIC_COMPANY.editProcoreItemsAllowed,
      },
    },
    procoreTools: [
      { tool: "drawing", count: 2, linkedIds: ["draw-001", "draw-002"] },
      { tool: "rfi", count: 1, linkedIds: ["rfi-001"] },
      { tool: "submittal", count: 1, linkedIds: ["sub-001"] },
      { tool: "inspection", count: 1, linkedIds: ["insp-001"] },
      { tool: "photo", count: 1, linkedIds: ["photo-001"] },
      { tool: "directory", count: 2, linkedIds: ["dir-001", "dir-002"] },
      { tool: "document", count: 2, linkedIds: [] },
    ],
    folders: cloneMockValue(STATIC_FOLDERS),
    documents: cloneMockValue(
      STATIC_DOCUMENTS.filter((document) => document.qrcode === qrCode._id),
    ),
    ballInCourtWorkflows: [],
  };
}

export function createProjectCompanyAggregation(qrCodeId: string) {
  return [createScannedQrAggregate(qrCodeId)];
}

export function createQrProcoreToolsResponse(qrCodeId: string) {
  const aggregate = createScannedQrAggregate(qrCodeId);
  return {
    procoreTools: aggregate.procoreTools.map((tool) => ({
      tool: tool.tool,
      count: tool.count,
      linkedIds: tool.linkedIds ?? [],
    })),
    qrType: aggregate.data.type || "folder",
    procoreCategory:
      typeof aggregate.data.procoreCategory === "string"
        ? aggregate.data.procoreCategory
        : null,
  };
}

export function createProcoreDocumentData(): ProcoreToolData {
  const data: ProcoreToolData = [];
  data.files = cloneMockValue(procoreDocumentsFiles);
  data.folders = cloneMockValue(procoreDocumentsFolders);
  return data;
}

export function createStaticSession() {
  return {
    user: cloneMockValue(STATIC_USER),
    company: cloneMockValue(STATIC_COMPANY),
    accessToken: STATIC_ACCESS_TOKEN,
  };
}

export type StaticApiState = {
  company: Company;
  users: StaticUserRecord[];
  projects: Project[];
  groups: StaticGroup[];
  qrCodes: QRCode[];
  documents: Document[];
  folders: QRCodeAggregate["folders"];
  categories: StaticCategory[];
  activityLog: typeof STATIC_ACTIVITY_LOG;
  adminCompanies: typeof STATIC_ADMIN_COMPANIES;
  qrStyleConfig: typeof STATIC_QR_STYLE_CONFIG;
};

export function createStaticApiState(): StaticApiState {
  return {
    company: cloneMockValue(STATIC_COMPANY),
    users: cloneMockValue(STATIC_USERS),
    projects: cloneMockValue(STATIC_PROJECTS),
    groups: cloneMockValue(STATIC_GROUPS),
    qrCodes: cloneMockValue(STATIC_QR_CODES),
    documents: cloneMockValue(STATIC_DOCUMENTS),
    folders: cloneMockValue(STATIC_FOLDERS),
    categories: cloneMockValue(STATIC_CATEGORIES),
    activityLog: cloneMockValue(STATIC_ACTIVITY_LOG),
    adminCompanies: cloneMockValue(STATIC_ADMIN_COMPANIES),
    qrStyleConfig: cloneMockValue(STATIC_QR_STYLE_CONFIG),
  };
}
