/**
 * Mock data for E2E tests
 * Based on the Visual End-to-End Test Plan
 */
import { getFrontendBaseUrl } from "../utils/runtime-env";
import { getE2EStripeProductIds } from "../utils/e2e-env";

// ============================================================================
// SHARED TEST CONSTANTS
// These constants are used across multiple mock objects and can be imported
// directly by tests to avoid hardcoding values that might change.
// ============================================================================

/** Default project address used in mock QR data */
export const mockProjectAddress = "123 Main St";
const E2E_BUSINESS_PRODUCT_ID = getE2EStripeProductIds().BUSINESS;

// ============================================================================
// QR CODE RESPONSES
// ============================================================================

export const mockMultiToolQR = {
  data: {
    qrcodeName: "Multi-Tool QR",
    project: {
      _id: "proj123",
      projectName: "Test Project",
      projectAddress: mockProjectAddress,
      projectCity: "Los Angeles",
      projectState: "CA",
      projectZIP: "90001",
    },
    company: { _id: "comp123", editProcoreItemsAllowed: true },
  },
  procoreTools: [
    { tool: "inspection", count: 12 },
    { tool: "punch-list", count: 5 },
    { tool: "form", count: 3 },
    { tool: "drawing", count: 45 },
  ],
  // Folders and documents used by files-folders tests
  folders: [
    { _id: "f1", folderName: "Safety Documents" },
    { _id: "f2", folderName: "Plans" },
    { _id: "f3", folderName: "Reports" },
  ],
  documents: [
    { _id: "d1", documentName: "Site Overview.pdf", documentSize: 1024000 },
    { _id: "d2", documentName: "Contact List.xlsx", documentSize: 51200 },
  ],
};

export const mockSingleToolQR = {
  data: {
    qrcodeName: "Single Tool QR",
    project: { _id: "proj123", projectName: "Test Project" },
    company: { _id: "comp123", editProcoreItemsAllowed: true },
  },
  procoreTools: [{ tool: "inspection", count: 5 }],
  folders: [],
  documents: [],
};

export const mockEmptyQR = {
  data: {
    qrcodeName: "Empty QR",
    project: { _id: "proj123", projectName: "Test Project" },
    company: { _id: "comp123", editProcoreItemsAllowed: false },
  },
  procoreTools: [],
  folders: [],
  documents: [],
};

export const mockNoEditPermissionQR = {
  data: {
    qrcodeName: "Read Only QR",
    project: { _id: "proj123", projectName: "Test Project" },
    company: { _id: "comp123", editProcoreItemsAllowed: false },
  },
  procoreTools: [{ tool: "inspection", count: 5 }],
  folders: [],
  documents: [],
};

// ============================================================================
// PASSWORD RESPONSES
// ============================================================================

export const mockPasswordRequired = {
  requirePassword: true,
  requiredBy: "qrcode",
};

export const mockPasswordRequiredByEquipment = {
  requirePassword: true,
  requiredBy: "equipment",
};

export const mockPasswordRequiredByArrangement = {
  requirePassword: true,
  requiredBy: "arrangement",
};

export const mockPasswordValid = {
  valid: true,
  requiredBy: "qrcode",
  verifyToken: "mock-verify-token-e2e",
};

export const mockPasswordInvalid = {
  valid: false,
};

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export const mock404Error = {
  statusCode: 404,
  message: "QR code not found",
  error: "Not Found",
};

export const mock500Error = {
  statusCode: 500,
  message: "Internal server error",
  error: "Internal Server Error",
};

// ============================================================================
// AGGREGATION RESPONSES
// Note: The aggregation endpoint returns an array, and code accesses data[0]
// ============================================================================

export const mockAggregation = [
  {
    company: {
      _id: "comp123",
      editProcoreItemsAllowed: true,
      procoreAccess: {
        accessToken: "mock-token",
        refreshToken: "mock-refresh",
      },
    },
    project: { _id: "proj123", projectName: "Test Project" },
  },
];

export const mockAggregationNoEdit = [
  {
    company: {
      _id: "comp123",
      editProcoreItemsAllowed: false,
      procoreAccess: {
        accessToken: "mock-token",
        refreshToken: "mock-refresh",
      },
    },
    project: { _id: "proj123", projectName: "Test Project" },
  },
];

// ============================================================================
// INSPECTION DATA
// ============================================================================

export const mockInspectionData = {
  procoreItemID: "INSP-001",
  name: "Fire Safety Inspection",
  number: "INS-2024-001",
  status: "Ready for Review",
  inspection_type: { name: "Fire Safety" },
  identifier: "BUILDING-A",
  inspection_date: "2024-01-15",
  created_at: "2024-01-15T09:00:00Z",
  inspectors: [{ name: "John Inspector" }],
  conforming_item_count: 15,
  deficient_item_count: 2,
  description: "Annual fire safety inspection",
  attachments: [
    { filename: "report.pdf", url: "https://example.com/report.pdf" },
  ],
};

export const mockInspectionMinimal = {
  procoreItemID: "INSP-002",
  name: "Basic Inspection",
  status: "Open",
};

export const mockInspectionItems = {
  sections: [
    { id: 1, name: "Fire Exits" },
    { id: 2, name: "Fire Extinguishers" },
  ],
  items: [
    {
      id: 101,
      section_id: 1,
      name: "Exit Signs Illuminated",
      item_type: { category: "multiple_choice", name: "default" },
      responses: [
        {
          status: "Pass",
          responder: { name: "John" },
          created_at: "2024-01-15T10:00:00Z",
        },
      ],
    },
    {
      id: 102,
      section_id: 2,
      name: "Extinguisher Charge Level",
      item_type: { category: "open_ended", name: "number" },
      responses: [],
    },
  ],
};

// ============================================================================
// PUNCH LIST DATA
// ============================================================================

export const mockPunchListData = {
  procoreItemID: "PL-001",
  name: "Touch up paint in lobby",
  location: { node_name: "Main Lobby" }, // Component uses node_name not name
  status: "unresolved",
  workflow_status: "open", // Used for status label display
  priority: "Medium",
  due_date: "2024-01-20",
  overdue: false,
  punch_item_manager: { name: "Project Manager" },
  punch_item_type: { name: "Finishes" },
  ball_in_court: [{ name: "Paint Contractor" }], // Must be an array
  assignments: [
    {
      id: 1,
      assignee: { name: "John Painter" },
      vendor: { name: "ABC Painting" },
      status: "unresolved",
      formatted_status: "Work Required",
      updated_at: "2024-01-15T10:00:00Z",
    },
  ],
  description: "Multiple areas need touch up",
};

export const mockPunchListOverdue = {
  ...mockPunchListData,
  procoreItemID: "PL-002",
  name: "Overdue punch item",
  due_date: "2024-01-10",
  overdue: true,
};

export const mockPunchListResolved = {
  ...mockPunchListData,
  procoreItemID: "PL-003",
  name: "Completed punch item",
  status: "resolved",
  workflow_status: "closed", // Closed workflow status
  assignments: [
    {
      id: 1,
      assignee: { name: "John Painter" },
      vendor: { name: "ABC Painting" },
      status: "resolved",
      formatted_status: "Resolved",
      updated_at: "2024-01-18T10:00:00Z",
    },
  ],
};

export const mockPunchListMinimal = {
  procoreItemID: "PL-MIN-001",
  name: "Simple Punch Item",
  status: "unresolved",
};

// ============================================================================
// FORM DATA
// ============================================================================

export const mockFormData = {
  procoreItemID: "FORM-001",
  name: "Daily Safety Report",
  form_template_name: "Safety Checklist Template",
  created_by: { name: "Site Manager" },
  description: "Daily safety inspection form",
  attachments: [
    { filename: "filled_form.pdf", url: "https://example.com/filled_form.pdf" },
  ],
};

export const mockFormMinimal = {
  procoreItemID: "FORM-MIN-001",
  name: "Basic Form",
};

export const mockFormTemplates = [
  { id: 1, name: "Safety Checklist" },
  { id: 2, name: "Equipment Inspection" },
  { id: 3, name: "Daily Report" },
];

// ============================================================================
// INSPECTION TEMPLATES
// ============================================================================

export const mockInspectionTemplates = [
  { id: 101, name: "Fire Safety Inspection" },
  { id: 102, name: "Quality Assurance Check" },
  { id: 103, name: "Site Safety Inspection" },
];

// ============================================================================
// ASSIGNEES
// ============================================================================

export const mockAssignees = [
  { id: 1, name: "John Smith" },
  { id: 2, name: "Jane Doe" },
  { id: 3, name: "Bob Johnson" },
  { id: 4, name: "Alice Williams" },
  { id: 5, name: "Charlie Brown" },
];

// ============================================================================
// FILES AND FOLDERS
// ============================================================================

export const mockFoldersAndFiles = {
  folders: [
    { _id: "f1", folderName: "Safety Documents", files: ["d1", "d2"] },
    { _id: "f2", folderName: "Plans", files: [] },
    { _id: "f3", folderName: "Reports", files: ["d3"] },
  ],
  documents: [
    { _id: "d1", documentName: "Site Overview.pdf", documentSize: 1024000 },
    { _id: "d2", documentName: "Contact List.xlsx", documentSize: 51200 },
  ],
};

export const mockNestedFolder = {
  success_message: "Nested folder fetched",
  data: {
    linkedFiles: [
      { _id: "d5", documentName: "Nested File.pdf", documentSize: 256000 },
    ],
    linkedFolders: [{ _id: "f4", folderName: "Sub-subfolder", files: [] }],
  },
};

export const mockEmptyFolder = {
  success_message: "Nested folder fetched",
  data: {
    linkedFiles: [],
    linkedFolders: [],
  },
};

// ============================================================================
// COORDINATION ISSUE DATA
// ============================================================================

export const mockCoordinationIssueData = {
  procoreItemID: "CI-001",
  title: "HVAC Conflict with Structural Beam",
  issue_number: "CI-2024-001",
  status: "Open",
  trade: { name: "HVAC" },
  priority: "High",
  location: { node_name: "Floor 3" },
  description: "Duct routing conflicts with structural beam at grid line B-4",
  assignee: { name: "John Smith", company_name: "HVAC Contractors Inc" },
  created_at: "2024-01-15T10:00:00Z",
  due_date: "2024-01-30T00:00:00Z",
  issue_type: { name: "Clash" },
  attachments: [
    {
      filename: "conflict_screenshot.jpg",
      url: "https://example.com/conflict.jpg",
    },
  ],
};

export const mockCoordinationIssueMinimal = {
  procoreItemID: "CI-002",
  title: "Minor Coordination Issue",
  status: "Closed",
};

// ============================================================================
// DRAWING DATA
// ============================================================================

export const mockDrawingData = {
  procoreItemID: "DWG-001",
  number: "A-101",
  title: "Floor Plan Level 1",
  discipline: "Architectural",
  current_revision: {
    revision_number: "3",
    updated_at: "2024-01-10T00:00:00Z",
    thumbnail_url: "https://example.com/thumbnail.jpg",
    pdf_url: "https://example.com/drawing.pdf",
  },
  obsolete: false,
  drawing_set: { name: "Bid Set" },
  drawing_date: "2024-01-10",
};

export const mockDrawingObsolete = {
  procoreItemID: "DWG-002",
  number: "A-100",
  title: "Old Site Plan",
  discipline: "Architectural",
  obsolete: true,
  current_revision: {
    revision_number: "1",
    updated_at: "2023-06-15T00:00:00Z",
  },
};

export const mockDrawingMinimal = {
  procoreItemID: "DWG-MIN-001",
  number: "A-001",
  title: "Basic Drawing",
};

// ============================================================================
// DOCUMENT DATA (Procore Documents, not Taliho files)
// ============================================================================

export const mockDocumentData = {
  procoreItemID: "DOC-001",
  name: "Project Specifications.pdf",
  file_type: "pdf",
  name_with_path: "/Project/Specs/Project Specifications.pdf",
  size: 5242880,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
  is_deleted: false,
};

export const mockDocumentDeleted = {
  procoreItemID: "DOC-002",
  name: "Old Document.pdf",
  file_type: "pdf",
  name_with_path: "/Project/Old Document.pdf",
  size: 1024000,
  created_at: "2023-06-01T00:00:00Z",
  updated_at: "2023-12-01T00:00:00Z",
  is_deleted: true,
};

export const mockDocumentMinimal = {
  procoreItemID: "DOC-MIN-001",
  name: "Simple Document.pdf",
};

// ============================================================================
// INCIDENT DATA
// ============================================================================

export const mockIncidentData = {
  procoreItemID: "INC-001",
  title: "Slip and Fall Incident",
  // Component uses location.node_name, not location.name
  location: { node_name: "Parking Lot B", name: "Parking Lot B" },
  status: "Under Investigation",
  // Component uses formatTime(event_date) to extract time, so include time in event_date
  event_date: "2024-01-10T14:30:00Z",
  event_time: "14:30",
  recordable: true,
  hazard: { name: "Wet Surface" },
  contributing_behavior: { name: "Rushing" },
  contributing_condition: { name: "Weather" },
  description: "Employee slipped on icy surface near entrance",
  created_by: { name: "Safety Officer" },
  created_at: "2024-01-10T15:00:00Z",
  attachments: [
    { filename: "incident_photo.jpg", url: "https://example.com/incident.jpg" },
  ],
};

export const mockIncidentMinimal = {
  procoreItemID: "INC-002",
  title: "Minor First Aid",
  status: "Closed",
  recordable: false,
};

// ============================================================================
// INSTRUCTION DATA
// ============================================================================

export const mockInstructionData = {
  procoreItemID: "INST-001",
  title: "Concrete Pour Procedure Update",
  number: "INS-2024-001",
  status: "Open",
  instruction_from: { name: "Project Manager" },
  attentions: [{ name: "Concrete Team" }, { name: "QA Inspector" }],
  date_issued: "2024-01-10",
  instruction_type: { name: "Procedure" },
  trades: [{ name: "Concrete" }],
  plain_text_description:
    "Follow these updated steps for concrete pour operations on Level 3.",
  created_at: "2024-01-10T08:00:00Z",
  attachments: [
    { filename: "procedure_doc.pdf", url: "https://example.com/procedure.pdf" },
  ],
};

export const mockInstructionMinimal = {
  procoreItemID: "INST-002",
  title: "Basic Instruction",
  status: "Closed",
};

// ============================================================================
// OBSERVATION DATA
// ============================================================================

export const mockObservationData = {
  procoreItemID: "OBS-001",
  name: "Missing Handrail on Stairwell B",
  number: "OB-2024-001",
  status: "ready_for_review",
  location: { name: "Stairwell B" },
  priority: "High",
  trade: { name: "Carpentry" },
  type: { name: "Safety", category: "Deficiency" },
  assignee: { name: "Bob Builder", company_name: "Build Co" },
  description:
    "Handrail missing on north side of stairwell between floors 2 and 3",
  created_at: "2024-01-12T09:00:00Z",
  attachments: [
    {
      filename: "stairwell_photo.jpg",
      url: "https://example.com/stairwell.jpg",
    },
  ],
};

export const mockObservationMinimal = {
  procoreItemID: "OBS-002",
  name: "Minor Observation",
  status: "closed",
};

// ============================================================================
// PHOTO DATA
// ============================================================================

export const mockPhotoData = {
  procoreItemID: "PHOTO-001",
  issue_number: "P-2024-001",
  title: "Site Progress January 15",
  description: "Weekly progress photos for Level 3 construction",
  created_at: "2024-01-15T16:00:00Z",
  attachments: [
    { filename: "progress_1.jpg", url: "https://example.com/progress1.jpg" },
    { filename: "progress_2.jpg", url: "https://example.com/progress2.jpg" },
    { filename: "progress_3.jpg", url: "https://example.com/progress3.jpg" },
  ],
};

export const mockPhotoMinimal = {
  procoreItemID: "PHOTO-002",
  title: "Quick Site Photo",
  attachments: [],
};

// ============================================================================
// RFI DATA
// ============================================================================

export const mockRfiData = {
  procoreItemID: "RFI-001",
  subject: "Clarification on Steel Connection Detail A-5",
  number: "RFI-2024-001",
  status: "Open",
  // Component uses location.node_name, not location.name
  location: { node_name: "Level 3 - Grid B4", name: "Level 3 - Grid B4" },
  priority: { name: "High" },
  specification_section_id: "05 12 00",
  assignee: { name: "Structural Engineer", company_name: "Engineering Co" },
  created_at: "2024-01-10T09:00:00Z",
  due_date: "2024-01-17T00:00:00Z",
  questions: [
    {
      id: 1,
      body: 'Please clarify the bolt size for connection detail A-5. Drawing shows 3/4" but spec calls for 7/8".',
      // Component expects created_by as a string, not an object
      created_by: "Steel Contractor",
      created_at: "2024-01-10T09:00:00Z",
    },
  ],
  attachments: [
    { filename: "detail_markup.pdf", url: "https://example.com/markup.pdf" },
  ],
};

export const mockRfiAnswers = [
  {
    question_id: 1,
    answer_date: "2024-01-12",
    created_by: { name: "Structural Engineer" },
    plain_text_body:
      'Use 3/4" A325 bolts per specification detail. Drawing is correct, spec will be updated.',
    attachments: [],
  },
];

export const mockRfiMinimal = {
  procoreItemID: "RFI-002",
  subject: "Simple Question",
  status: "Closed",
  questions: [],
};

// ============================================================================
// SPECIFICATION DATA
// ============================================================================

export const mockSpecificationData = {
  procoreItemID: "SPEC-001",
  divisionData: {
    id: "05",
    number: "05 12 00",
    description: "Structural Steel Framing",
  },
  revision: "2",
  description:
    "This section covers requirements for structural steel framing including materials, fabrication, erection, and quality assurance procedures.",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-10T00:00:00Z",
};

export const mockSpecificationMinimal = {
  procoreItemID: "SPEC-002",
  divisionData: {
    number: "03 30 00",
    description: "Cast-in-Place Concrete",
  },
};

// ============================================================================
// SUBMITTAL DATA
// ============================================================================

export const mockSubmittalData = {
  procoreItemID: "SUB-001",
  title: "Structural Steel Shop Drawings",
  formatted_number: "05-001",
  status: { name: "Pending Review" },
  number: "SUB-2024-001",
  revision: "A",
  description:
    "Shop drawings for structural steel package including connections and details",
  submittal_manager: { name: "Project Manager" },
  // Component expects ball_in_court to be an array
  ball_in_court: [{ name: "Architect" }],
  responsible_contractor: { name: "Steel Contractor" },
  created_at: "2024-01-05T00:00:00Z",
  due_date: "2024-01-20T00:00:00Z",
  associated_attachments: [
    {
      filename: "shop_drawings.pdf",
      url: "https://example.com/shop_drawings.pdf",
    },
  ],
};

export const mockSubmittalMinimal = {
  procoreItemID: "SUB-002",
  title: "Basic Submittal",
  status: { name: "Approved" },
};

// ============================================================================
// TASK DATA
// ============================================================================

export const mockTaskData = {
  procoreItemID: "TASK-001",
  title: "Review Structural Drawings for Level 3",
  number: "T-2024-001",
  status: "In Progress",
  task_item_category: { name: "Design Review" },
  assignee: { name: "Senior Engineer" },
  due_date: "2024-01-20",
  description:
    "Complete review of all structural drawings for Level 3 and provide comments",
  created_at: "2024-01-10T00:00:00Z",
  created_by: { name: "Project Manager" },
  attachments: [
    {
      filename: "review_checklist.pdf",
      url: "https://example.com/checklist.pdf",
    },
  ],
};

export const mockTaskMinimal = {
  procoreItemID: "TASK-002",
  title: "Simple Task",
  status: "Completed",
};

// ============================================================================
// DIRECTORY DATA
// ============================================================================

export const mockDirectoryData = {
  procoreItemID: "DIR-001",
  name: "John Smith",
  initials: "JS", // Derived from first letter of first and last name
  title: "Project Manager",
  // Component uses vendor.name for company display
  vendor: { name: "ABC Construction" },
  company: { name: "ABC Construction" }, // Keep for compatibility
  address: "123 Construction Way",
  city: "Los Angeles",
  state_code: "CA", // Component uses state_code not state
  business_phone: "555-123-4567",
  email_address: "john.smith@abcconstruction.com",
};

export const mockDirectoryMinimal = {
  procoreItemID: "DIR-002",
  name: "Jane Doe",
  initials: "JD",
  vendor: { name: "XYZ Engineering" },
  company: { name: "XYZ Engineering" },
};

// ============================================================================
// PASSWORD RESET RESPONSES
// ============================================================================

export const mockPasswordResetRequestSuccess = {
  success: true,
  message: "Verification code sent to your email.",
};

export const mockPasswordResetRequestFail = {
  success: false,
  message: "No account found with that email address.",
};

export const mockPasswordResetVerifySuccess = {
  success: true,
  message: "Code verified.",
};

export const mockPasswordResetVerifyInvalid = {
  success: false,
  message: "Invalid code.",
};

export const mockPasswordResetVerifyExpired = {
  success: false,
  message: "Code expired.",
  restartFlow: true,
};

export const mockPasswordResetCompleteSuccess = {
  success: true,
  message: "Password updated. Please log in.",
};

export const mockPasswordResetCompleteFail = {
  success: false,
  message: "Failed to update password.",
};

// ============================================================================
// EMAIL VERIFICATION / INVITED SIGNUP RESPONSES
// ============================================================================

export const mockTokenVerificationSuccess = {
  success: true,
  user: {
    _id: "usr-invited-001",
    email: "invited@testcompany.com",
    firstName: "Invited",
    lastName: "User",
  },
  company: {
    _id: "comp-test-001",
    companyName: "Test Company",
  },
};

export const mockTokenVerificationExpired = {
  success: false,
  expired: true,
  message: "This invitation link has expired.",
};

export const mockTokenVerificationInvalid = {
  success: false,
  invalid: true,
  message: "This invitation link is invalid.",
};

export const mockTokenVerificationAlreadyUsed = {
  success: false,
  alreadyVerified: true,
  message: "This invitation has already been used.",
};

export const mockInvitedSignupComplete = {
  success: true,
  message: "Account created successfully!",
  accessToken: "mock-jwt-access-token-invited",
  user: {
    _id: "usr-invited-001",
    id: "usr-invited-001",
    email: "invited@testcompany.com",
    firstName: "Invited",
    lastName: "User",
    permission: "user",
  },
  company: {
    _id: "comp-test-001",
    companyName: "Test Company",
  },
};

// ============================================================================
// STRIPE / CHECKOUT RESPONSES
// ============================================================================

export const mockStripeProduct = [
  {
    id: "prod_test_pro",
    name: "Professional Plan",
    description:
      "Unlimited QR Codes, priority support, advanced analytics, 200 GB storage.",
    default_price: "price_test_monthly",
    default_price_data: {
      unit_amount: 6900,
      currency: "USD",
      recurring: { interval: "month" },
    },
    images: [],
  },
];

export const mockCheckoutSessionSuccess = {
  url: "https://checkout.stripe.com/mock-session-url",
  sessionId: "cs_test_mock_session",
};

export const mockStripeAddonSuccess = {
  success: true,
  message: "Storage addon activated.",
};

// ============================================================================
// PROCORE COMPANY SELECTION DATA
// ============================================================================

/** JWT payload encoded as base64 for select-company route */
export const mockProcoreCompanies = [
  { id: 1001, name: "ABC Construction Corp", is_active: true },
  { id: 1002, name: "XYZ Builders LLC", is_active: true },
  { id: 1003, name: "Old Inactive Co", is_active: false },
];

/** Pre-built mock JWT with the above companies encoded in the payload */
export const mockProcoreJWT = (() => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({ procoreCompanies: mockProcoreCompanies }),
  );
  const signature = "mock-signature";
  return `${header}.${payload}.${signature}`;
})();

const mockFrontendBaseUrl = getFrontendBaseUrl().replace(/\/$/, "");

export const mockProcoreSelectCompanySuccess = {
  redirectUrl: `${mockFrontendBaseUrl}/procore/oauth-success?userId=user-test-001`,
};

// ============================================================================
// SETTINGS: SECURITY OTP RESPONSES
// ============================================================================

export const mockOtpRequestSuccess = {
  success: true,
  message: "Verification code sent.",
};

export const mockOtpVerifySuccess = {
  success: true,
  message: "Code verified.",
};

export const mockOtpVerifyInvalid = {
  success: false,
  code: "INVALID_OTP",
  message: "Invalid verification code. Please check and try again.",
};

export const mockPasswordChangeComplete = {
  success: true,
  message: "Password changed successfully.",
};

export const mockEmailChangeComplete = {
  success: true,
  message: "Email changed successfully.",
  accessToken: "mock-new-access-token",
  user: {
    _id: "user-test-001",
    email: "newemail@testcompany.com",
    firstName: "Test",
    lastName: "Admin",
  },
};

// ============================================================================
// SETTINGS: USER MANAGEMENT RESPONSES
// ============================================================================

// API response format for /user/ endpoint
// listCompanyUsers transforms: res.data.data → users, res.data.total_items → total
export const mockCompanyUsersApiResponse = {
  data: [
    {
      _id: "user-test-001",
      email: "admin@testcompany.com",
      firstName: "Test",
      lastName: "Admin",
      permission: "admin",
      isVerified: true,
    },
    {
      _id: "user-test-002",
      email: "pm@testcompany.com",
      firstName: "Project",
      lastName: "Manager",
      permission: "pm",
      isVerified: true,
    },
    {
      _id: "user-test-003",
      email: "pending@testcompany.com",
      firstName: "",
      lastName: "",
      permission: "user",
      isVerified: false,
    },
  ],
  total_items: 3,
  current_page: 1,
  total_pages: 1,
};

// Convenience alias for tests that reference users directly
export const mockCompanyUsers = {
  users: mockCompanyUsersApiResponse.data,
  total: mockCompanyUsersApiResponse.total_items,
  current_page: mockCompanyUsersApiResponse.current_page,
  per_page: 100,
};

export const mockInviteUserSuccess = {
  success: true,
  message: "Invitation sent successfully",
};

export const mockInviteUserDuplicate = {
  success: false,
  message: "This email address is already associated with an account.",
};

// ============================================================================
// SETTINGS: SUBSCRIPTION / PLAN RESPONSES
// ============================================================================

export const mockSubscriptionTrial = {
  _id: "comp-trial-001",
  companyName: "Trial Company",
  freeTrialActive: true,
  paidAccount: false,
  subscriptionCanceled: false,
  stripeCustomerID: "",
  stripeSubscriptionID: "",
  stripeProductID: "",
};

export const mockSubscriptionPaid = {
  _id: "comp-test-001",
  companyName: "Test Company",
  freeTrialActive: false,
  paidAccount: true,
  subscriptionCanceled: false,
  stripeCustomerID: "cus_test123",
  stripeSubscriptionID: "sub_test123",
  stripeProductID: E2E_BUSINESS_PRODUCT_ID,
};

// ============================================================================
// STORAGE STATS RESPONSES
// ============================================================================

export const mockStorageStats = {
  documentStorageUsed: 536870912, // 512 MB
  qrCodeStorageUsed: 10485760, // 10 MB
  documentStorageCapacity: 10737418240, // 10 GB
  qrCodeStorageCapacity: 5368709120, // 5 GB
  documentsCount: 142,
  qrCodesCount: 38,
  activeAddons: 0,
};

// ============================================================================
// QR DESIGN STUDIO RESPONSES
// ============================================================================

export const mockQRStyleConfig = {
  useStyledQRCodes: true,
  qrStyleConfig: {
    moduleShape: "rounded-square",
    moduleCornerRadius: 0.5,
    foreground: "#000000",
    background: "#ffffff",
    eyeStyle: {
      style: "square",
      outerColor: "#000000",
      innerColor: "#000000",
    },
    quietZoneModules: 2,
    outerBorderRadius: 0,
    errorCorrectionLevel: "M",
    logo: { enabled: false },
  },
};

export const mockQRStyleConfigDisabled = {
  useStyledQRCodes: false,
  qrStyleConfig: null,
};

export const mockQRStylePreview = {
  previewUrl: "https://example.com/preview-qr.svg",
};

export const mockBatchRegenerateSuccess = {
  success: 25,
  failed: 0,
  total: 25,
};

// ============================================================================
// ADMIN TRANSFER RESPONSES
// ============================================================================

export const mockAdminTransferSuccess = {
  success: true,
  message: "Admin role transferred successfully.",
};

// ============================================================================
// PROCORE FETCH CONFIGURATION RESPONSES
// ============================================================================

export const mockProcorePermissions = {
  permissions: {
    inspection: true,
    "punch-list": true,
    form: true,
    drawing: true,
    document: true,
    rfi: false,
    submittal: false,
    "coordination-issue": false,
    observation: false,
    photo: true,
    incident: false,
    instruction: false,
    task: false,
    directory: true,
    specification: false,
  },
};

export const mockProcoreToolsList = [
  { key: "inspection", label: "Inspections", count: 12 },
  { key: "punch-list", label: "Punch Lists", count: 5 },
  { key: "form", label: "Forms", count: 3 },
  { key: "drawing", label: "Drawings", count: 45 },
  { key: "photo", label: "Photos", count: 20 },
  { key: "document", label: "Documents", count: 8 },
  { key: "directory", label: "Directory", count: 15 },
];

export const mockProcoreFetchItems = {
  data: [
    {
      id: 1,
      procoreItemID: "FETCH-001",
      name: "Safety Inspection January",
      status: "Open",
    },
    {
      id: 2,
      procoreItemID: "FETCH-002",
      name: "Weekly Safety Report",
      status: "Closed",
    },
    {
      id: 3,
      procoreItemID: "FETCH-003",
      name: "Equipment Check",
      status: "Open",
    },
  ],
  total: 3,
};

// ============================================================================
// CHECKOUT RETURN / SUBSCRIPTION VERIFICATION RESPONSES
// ============================================================================

export const mockCheckoutVerifySuccess = {
  success: true,
  message: "Subscription activated.",
  plan: "Professional",
};

export const mockCheckoutVerifyInvalid = {
  success: false,
  message: "Invalid or expired checkout session.",
};

// ============================================================================
// BILLING PORTAL RESPONSES
// ============================================================================

export const mockBillingPortalSuccess = {
  url: "https://billing.stripe.com/mock-portal-url",
};

// ============================================================================
// ACTIVITY LOG RESPONSES
// ============================================================================

export const mockActivityLogEntries = {
  success_message: "Activity log fetched.",
  total_pages: 3,
  current_page: 1,
  total_items: 42,
  has_next: true,
  has_prev: false,
  data: [
    {
      _id: "log-001",
      companyId: "comp-test-001",
      userId: "user-test-001",
      userName: "Test Admin",
      action: "password_changed",
      category: "security",
      details: {},
      createdAt: "2026-01-30T14:30:00Z",
    },
    {
      _id: "log-002",
      companyId: "comp-test-001",
      userId: "user-test-002",
      userName: "Project Manager",
      action: "user_invited",
      category: "users",
      details: { targetEmail: "newuser@testcompany.com" },
      createdAt: "2026-01-29T10:00:00Z",
    },
    {
      _id: "log-003",
      companyId: "comp-test-001",
      userId: "user-test-001",
      userName: "Test Admin",
      action: "procore_connected",
      category: "integrations",
      details: {},
      createdAt: "2026-01-28T09:15:00Z",
    },
  ],
};

export const mockActivityLogPage2 = {
  success_message: "Activity log fetched.",
  total_pages: 3,
  current_page: 2,
  total_items: 42,
  has_next: true,
  has_prev: true,
  data: [
    {
      _id: "log-004",
      companyId: "comp-test-001",
      userId: "user-test-001",
      userName: "Test Admin",
      action: "settings_updated",
      category: "settings",
      details: { settingName: "QR Design" },
      createdAt: "2026-01-27T16:00:00Z",
    },
  ],
};

export const mockActivityLogEmpty = {
  success_message: "Activity log fetched.",
  total_pages: 1,
  current_page: 1,
  total_items: 0,
  has_next: false,
  has_prev: false,
  data: [],
};

// ============================================================================
// NOTIFICATION PREFERENCES RESPONSES
// ============================================================================

export const mockNotificationPreferences = {
  email: {
    projectUpdates: true,
    inspectionReminders: true,
    documentUploads: false,
    teamActivity: true,
    weeklyDigest: true,
  },
  push: {
    projectUpdates: true,
    inspectionReminders: false,
    documentUploads: true,
    teamActivity: true,
  },
  frequency: "immediate",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

export const mockNotificationPreferencesUpdated = {
  ...mockNotificationPreferences,
  email: {
    ...mockNotificationPreferences.email,
    documentUploads: true,
  },
};

// ============================================================================
// PROJECT DETAIL / EDIT RESPONSES
// ============================================================================

export const mockProjectDetail = {
  _id: "proj-001",
  projectName: "Downtown Office Tower",
  projectAddress: "100 Main Street",
  projectCity: "San Francisco",
  projectState: "CA",
  projectZIP: "94105",
  clientName: "Acme Corp",
  status: "active",
  company: "comp-test-001",
  qrCodesCount: 12,
  groupsCount: 3,
};

export const mockProjectEditSuccess = {
  success: true,
  message: "Project updated successfully.",
  data: {
    _id: "proj-001",
    projectName: "Downtown Office Tower - Phase 2",
    projectAddress: "100 Main Street",
    projectCity: "San Francisco",
    projectState: "CA",
    projectZIP: "94105",
    clientName: "Acme Corp",
    status: "active",
    company: "comp-test-001",
  },
};

export const mockProjectArchiveSuccess = {
  success: true,
  message: "Project archived successfully.",
};

export const mockProjectUnarchiveSuccess = {
  success: true,
  message: "Project unarchived successfully.",
};

// ============================================================================
// DASHBOARD STATS RESPONSES
// ============================================================================

export const mockDashboardStats = {
  totalQrCodes: 38,
  activeQrCodes: 32,
  totalScans: 1247,
  totalDocuments: 142,
  storageUsedMB: 547,
};

// ============================================================================
// STORAGE HISTORY RESPONSES
// ============================================================================

export const mockStorageHistory = [
  {
    date: "2026-01-01",
    usedMB: 450,
    limitMB: 10240,
  },
  {
    date: "2026-01-08",
    usedMB: 478,
    limitMB: 10240,
  },
  {
    date: "2026-01-15",
    usedMB: 512,
    limitMB: 10240,
  },
  {
    date: "2026-01-22",
    usedMB: 530,
    limitMB: 10240,
  },
  {
    date: "2026-01-29",
    usedMB: 547,
    limitMB: 10240,
  },
];

// ============================================================================
// STRIPE PRODUCTS RESPONSES (ALIAS)
// ============================================================================

/** Alias for mockStripeProduct to match /stripe/storage-products endpoint naming */
export const mockStripeProducts = [
  {
    id: "prod_storage_50gb",
    name: "50GB Storage Add-on",
    description: "Add 50GB of additional storage to your account.",
    priceMonthly: 999,
    priceAnnual: 9990,
  },
  {
    id: "prod_storage_100gb",
    name: "100GB Storage Add-on",
    description: "Add 100GB of additional storage to your account.",
    priceMonthly: 1799,
    priceAnnual: 17990,
  },
  {
    id: "prod_storage_250gb",
    name: "250GB Storage Add-on",
    description: "Add 250GB of additional storage to your account.",
    priceMonthly: 3999,
    priceAnnual: 39990,
  },
];

// ============================================================================
// ACTIVITY LOG ALIAS
// ============================================================================

/** Alias for mockActivityLogEntries to match /activity-log endpoint naming */
export const mockActivityLog = mockActivityLogEntries;

// ============================================================================
// GROUPS LIST RESPONSES
// ============================================================================

export const mockGroups = {
  success_message: "Groups retrieved",
  total_items: 3,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
  data: [
    {
      _id: "grp-001",
      groupName: "Level 1 Drawings",
      type: "arrangement",
      numberOfCodes: 8,
      mobileScanCount: 50,
      createdAt: "2025-01-10T09:00:00Z",
    },
    {
      _id: "grp-002",
      groupName: "HVAC Equipment",
      type: "equipment",
      numberOfCodes: 3,
      mobileScanCount: 15,
      createdAt: "2025-01-09T09:00:00Z",
    },
    {
      _id: "grp-003",
      groupName: "Safety Signage",
      type: "arrangement",
      numberOfCodes: 12,
      mobileScanCount: 100,
      createdAt: "2025-01-08T09:00:00Z",
    },
  ],
};

// ============================================================================
// CATEGORIES RESPONSES
// ============================================================================

export const mockCategories = [
  {
    _id: "cat-001",
    categoryName: "Electrical Panel",
    categoryClass: "Electrical",
    companyId: "comp-test-001",
  },
  {
    _id: "cat-002",
    categoryName: "Fire Extinguisher",
    categoryClass: "Safety",
    companyId: "comp-test-001",
  },
  {
    _id: "cat-003",
    categoryName: "HVAC Unit",
    categoryClass: "Mechanical",
    companyId: "comp-test-001",
  },
];
