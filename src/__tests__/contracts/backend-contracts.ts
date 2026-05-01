/**
 * Backend API Contract Definitions
 *
 * These types mirror the backend DTOs, enums, and response shapes from
 * taliho-v3-backend. They serve as the "source of truth" for contract tests
 * that validate frontend API usage aligns with the backend specification.
 *
 * When the backend changes a DTO or enum, update this file first, then
 * run the contract tests to see which frontend code needs updating.
 *
 * Last synced: 2026-01-31
 * Backend repo: taliho-v3-backend
 */

// ============================================================
// Enums (from backend src/common/enums and module-level enums)
// ============================================================

/** src/common/enums/common.enum.ts */
export enum BackendGroupingTypeEnum {
  ARRANGEMENT = "arrangement",
  EQUIPMENT = "equipment",
  GROUP = "group",
  PROCORE_DRAWING_CODES = "procore-drawing-codes",
}

/** src/modules/qr-code/enums/qr-code.enum.ts */
export enum BackendQRCodeTypeEnum {
  FILE = "file",
  FOLDER = "folder",
  URL = "url",
  STATIC = "static",
  PROCORE_TOOL = "procore-tool",
  PROCORE_LOCATION = "procore-location",
  PROCORE_DRAWING_CODE = "procore-drawing-code",
}

/** src/modules/project/enums/project.enum.ts */
export enum BackendProjectStatusEnum {
  ACTIVE = "active",
  ON_HOLD = "on-hold",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

/** src/modules/user/enums/user.enum.ts */
export enum BackendUserPermissionEnum {
  ADMIN = "admin",
  PROJECT_MANAGER = "pm",
  USER = "user",
  PM = "PM",
}

/** src/modules/procore-item/enums/procore-item.enum.ts */
export enum BackendProcoreToolEnum {
  COORDINATION_ISSUES = "coordination-issues",
  DIRECTORY = "directory",
  DOCUMENTS = "documents",
  DRAWINGS = "drawings",
  FORMS = "forms",
  INCIDENTS = "incidents",
  INSPECTIONS = "inspections",
  INSTRUCTIONS = "instructions",
  LOCATION = "location",
  NONE = "none",
  OBSERVATIONS = "observations",
  PHOTOS = "photos",
  PUNCH_LIST = "punch-list",
  RFIS = "rfis",
  SPECIFICATIONS = "specifications",
  SUBMITTALS = "submittals",
  TASKS = "tasks",
}

/** src/modules/document/enums/document.enum.ts */
export enum BackendDocumentPurposeEnum {
  FOLDER_QRCODE = "folder-qrcode",
  FILE_QRCODE = "file-qrcode",
  EQUIPMENT_CODE_EXTRACTION = "equipment-code-extraction",
  TO_BE_SORTED = "to-be-sorted",
  CAN_BE_SORTED = "can-be-sorted",
}

/** src/modules/activity-log/enums/activity-log.enum.ts */
export enum BackendActivityActionEnum {
  USER_INVITED = "user_invited",
  USER_REMOVED = "user_removed",
  USER_ACTIVATED = "user_activated",
  USER_DEACTIVATED = "user_deactivated",
  ROLE_CHANGED = "role_changed",
  SETTINGS_UPDATED = "settings_updated",
  LOGO_CHANGED = "logo_changed",
  COMPANY_INFO_UPDATED = "company_info_updated",
  PASSWORD_CHANGED = "password_changed",
  EMAIL_CHANGED = "email_changed",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",
  PROCORE_CONNECTED = "procore_connected",
  PROCORE_DISCONNECTED = "procore_disconnected",
  PROCORE_USER_DISCONNECTED = "procore_user_disconnected",
  PROCORE_OWNER_CHANGED = "procore_owner_changed",
  PROCORE_SYNC_STARTED = "procore_sync_started",
  PROCORE_SYNC_COMPLETED = "procore_sync_completed",
  STRIPE_SUBSCRIPTION_CREATED = "stripe_subscription_created",
  STRIPE_SUBSCRIPTION_UPDATED = "stripe_subscription_updated",
  STRIPE_SUBSCRIPTION_CANCELLED = "stripe_subscription_cancelled",
  RESOURCE_UPDATED = "resource_updated",
  RESOURCE_DELETED = "resource_deleted",
  BACKFILL_EXECUTED = "backfill_executed",
}

/** src/modules/activity-log/enums/activity-log.enum.ts */
export enum BackendActivityCategoryEnum {
  USERS = "users",
  SETTINGS = "settings",
  SECURITY = "security",
  INTEGRATIONS = "integrations",
  ADMIN = "admin",
  GROUPS = "groups",
  QR_CODES = "qr_codes",
  PROJECTS = "projects",
  DOCUMENTS = "documents",
  FOLDERS = "folders",
  PROCORE_ITEMS = "procore_items",
  CATEGORIES = "categories",
}

// ============================================================
// Request DTOs (what the backend expects)
// ============================================================

/** POST /qr-code — CreateQRCodeDto */
export interface BackendCreateQRCodeDto {
  companyId: string; // @IsMongoId, required
  projectId?: string; // @IsMongoId, optional
  name: string; // @IsString @IsNotEmpty, required
  type: BackendQRCodeTypeEnum; // @IsEnum, required
  groupingId?: string; // @IsMongoId, optional
  groupingType?: BackendGroupingTypeEnum; // @IsEnum, optional
  url?: string; // @IsUrl, required when type=URL
  description?: string; // optional
  procoreTool?: BackendProcoreToolEnum; // required when type=PROCORE_TOOL
  procoreLinkedItemId?: string; // required when type=PROCORE_LOCATION|PROCORE_DRAWING_CODE
}

/** GET /qr-code — QRCodeListDto */
export interface BackendQRCodeListDto {
  companyId: string; // @IsString @IsNotEmpty, required
  projectId?: string; // @IsString @IsNotEmpty @IsOptional
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  groupingTypes?: string[];
  quickCode?: string;
  filter_ids?: string[];
  current_page?: number; // default 1
  per_page?: number; // default 100
  search?: string;
  sortBy?: string; // 'name' | 'type' | 'createdAt' | 'date' | 'scans' | 'project' | 'group'
  sortDir?: "asc" | "desc";
  sort_by?: string; // alternative naming
  sort_dir?: "asc" | "desc"; // alternative naming
  types?: string[];
  type?: string | string[];
  arrangementType?: string;
  projectStatus?: string[];
}

/** PATCH /qr-code/:id — PatchQRCodeDto */
export interface BackendPatchQRCodeDto {
  companyId: string; // required
  projectId?: string; // optional, validated as MongoId only when non-empty
  qrcodeName?: string;
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  description?: string;
  procoreFetch?: boolean;
  passwordActivated?: boolean;
  password?: string; // @MinLength(6) when passwordActivated !== false
  timezone?: string;
  weekdayPassword?: boolean;
  weekdayPasswordTimeStart?: string;
  weekdayPasswordTimeEnd?: string;
  weekendPassword?: boolean;
  weekendPasswordTimeStart?: string;
  weekendPasswordTimeEnd?: string;
}

/** DELETE /qr-code/bulk — DeleteManyQRCodesDto */
export interface BackendDeleteManyQRCodesDto {
  companyId: string; // required
  qrcodeIds?: string[]; // @IsMongoId each
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  projectId?: string;
}

/** PATCH /qr-code/bulk-assign — BulkAssignQRCodesDto */
export interface BackendBulkAssignQRCodesDto {
  qrCodeIds: string[]; // @ArrayMinSize(1) @IsMongoId each
  groupingId: string; // required
  groupingType: BackendGroupingTypeEnum; // required
  companyId: string; // required
  projectId: string; // required
}

/** PATCH /qr-code/bulk-assign-project — BulkAssignQRCodesToProjectDto */
export interface BackendBulkAssignQRCodesToProjectDto {
  qrCodeIds: string[]; // @ArrayMinSize(1) @IsMongoId each
  projectId: string; // required
  companyId: string; // required
}

/** PATCH /qr-code/bulk-password — BulkSetPasswordDto */
export interface BackendBulkSetPasswordDto {
  qrCodeIds: string[]; // @ArrayMinSize(1) @IsMongoId each
  companyId: string; // required
  passwordActivated: boolean; // required
  password?: string; // @MinLength(6) when passwordActivated !== false
  timezone?: string;
  weekdayPassword?: boolean;
  weekdayPasswordTimeStart?: string;
  weekdayPasswordTimeEnd?: string;
  weekendPassword?: boolean;
  weekendPasswordTimeStart?: string;
  weekendPasswordTimeEnd?: string;
}

/** POST /qr-code/download — DownloadQRCodesDto */
export interface BackendDownloadQRCodesDto {
  qrCodeIds: string[]; // @ArrayMinSize(1) @IsMongoId each
}

/** POST /qr-code/bulk-async — CreateBulkAsyncDto */
export interface BackendCreateBulkAsyncDto {
  equipmentId: string; // required
  projectId: string; // required
  numberOfCodes: number; // required
  companyId: string; // required
  createdBy?: string;
  groupName?: string;
  startNumber?: number;
  excludeNumbers?: number[];
}

// --- Groups ---

/** POST /groups — CreateGroupDto */
export interface BackendCreateGroupDto {
  companyId: string; // required
  projectId: string; // required
  groupName: string; // required
  type?: "arrangement" | "equipment" | "group" | "procore-drawing-codes";
  arrangementType?: string; // @deprecated
  equipmentID?: string;
  description?: string;
  categories?: string[];
}

/** GET /groups — GetGroupsDto */
export interface BackendGetGroupsDto {
  companyId?: string;
  projectId?: string;
  type?: "arrangement" | "equipment" | "procore-drawing-codes";
  types?: Array<"arrangement" | "equipment" | "procore-drawing-codes">;
  arrangementType?: string; // @deprecated
  excludeArrangementTypes?: string[];
  filter_ids?: string[];
  current_page?: number; // default 1
  per_page?: number; // default 100
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  excludeArchivedProjects?: boolean;
}

/** PATCH /groups/:id — PatchGroupDto */
export interface BackendPatchGroupDto {
  companyId: string; // required
  projectId?: string; // optional, validated as MongoId only when non-empty
  groupName?: string;
  description?: string;
  equipmentID?: string;
  type?: "arrangement" | "equipment";
  passwordActivated?: boolean;
  password?: string; // @MinLength(6) when passwordActivated !== false
  timezone?: string;
  weekdayPassword?: boolean;
  weekdayPasswordTimeStart?: string;
  weekdayPasswordTimeEnd?: string;
  weekendPassword?: boolean;
  weekendPasswordTimeStart?: string;
  weekendPasswordTimeEnd?: string;
}

/** DELETE /groups/bulk — DeleteManyGroupsDto */
export interface BackendDeleteManyGroupsDto {
  companyId: string; // required (inherited from BasicRequestDto)
  projectId?: string;
  groupIds?: string[]; // @IsMongoId each
}

// --- Projects ---

/** POST /project — CreateProjectDto */
export interface BackendCreateProjectDto {
  companyId: string; // required
  userId?: string; // optional on backend
  projectName: string; // required
  projectAddress?: string;
  projectCity: string; // required
  projectState: string; // required
  projectZIP: string; // required
  clientName?: string;
}

/** GET /project — ProjectListDto */
export interface BackendProjectListDto {
  companyId: string; // required
  status?: string;
  is_archived?: string;
  filter_ids?: string | string[];
  current_page?: number; // default 1
  per_page?: number; // default 100
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

/** PATCH /project/:id — PatchProjectDto */
export interface BackendPatchProjectDto {
  companyId: string; // required
  projectName?: string;
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  projectZIP?: string;
  clientName?: string;
  archived?: string;
  status?: BackendProjectStatusEnum;
  projectStatus?: BackendProjectStatusEnum;
  procoreCompanyID?: string;
  procoreProjectID?: string;
}

/** DELETE /project/bulk — DeleteManyProjectsDto */
export interface BackendDeleteManyProjectsDto {
  companyId: string; // required
  projectIds?: string[]; // @IsMongoId each
}

// --- Auth ---

/** POST /auth/signup — RegisterRequestDto */
export interface BackendRegisterRequestDto {
  email: string; // @IsEmail, required
  firstName: string; // required
  lastName: string; // required
  company?: string;
}

/** POST /auth/verify-otp — VerifyOtpDto
 *
 * NOTE: The backend DTO class (signup.dto.ts) declares `userId` with @IsMongoId @IsNotEmpty,
 * but the actual service implementation (auth.service.ts verifyOTP method) NEVER uses userId.
 * The user is resolved from OTP storage via email. The frontend correctly sends only { email, otp }.
 *
 * The DTO validators are bypassed because the controller passes req.body directly to the service
 * without explicit DTO validation. This interface reflects ACTUAL runtime behavior.
 */
export interface BackendVerifyOtpDto {
  email: string; // @IsEmail, required
  otp: string; // required
}

/** POST /auth/resend-otp — ResendOtpDto */
export interface BackendResendOtpDto {
  email: string; // @IsEmail, required
}

/** POST /auth/complete-signup — SetPasswordDto */
export interface BackendSetPasswordDto {
  email: string; // required
  password: string; // required
}

/** POST /auth/verify-email-token — inline body */
export interface BackendVerifyEmailTokenDto {
  token: string; // required
}

/** POST /auth/complete-invited-signup — inline body */
export interface BackendCompleteInvitedSignupDto {
  token: string; // required
  password: string; // required
  firstName?: string; // optional
  lastName?: string; // optional
}

// --- Company ---

/** PATCH /company/:id — PatchCompanyDto */
export interface BackendPatchCompanyDto {
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZIP?: string;
  companyIndustry?: string;
  companyWebsite?: string;
  companyPhone?: string;
  procoreCompanyID?: string;
  stripeAddons?: Record<string, unknown>[];
}

/** POST /company/:id/addons — AddAddonDto */
export interface BackendAddAddonDto {
  sessionId: string; // required
}

/** PATCH /company/:companyId/procore-settings — UpdateProcoreSettingsDto */
export interface BackendUpdateProcoreSettingsDto {
  editProcoreItemsAllowed: boolean; // required
}

/** POST /oauth/procore/logout — ProcoreLogoutDto */
export interface BackendProcoreLogoutDto {
  companyId: string; // required
}

/** PUT /company/:companyId/procore-integration-owner — ChangeIntegrationOwnerDto */
export interface BackendChangeIntegrationOwnerDto {
  newOwnerUserId: string; // required
  requestingUserId: string; // required
}

// --- Categories ---

/** POST /categories — CreateCategoryDto */
export interface BackendCreateCategoryDto {
  categoryName: string; // required, 1-100 chars
  categoryClass: string; // required, 1-100 chars
  companyId: string; // required
  procoreTool?: BackendProcoreToolEnum;
}

/** PATCH /categories/:id — UpdateCategoryDto */
export interface BackendUpdateCategoryDto {
  categoryName?: string; // 1-100 chars
  categoryClass?: string; // 1-100 chars
  procoreTool?: BackendProcoreToolEnum | null;
}

/** DELETE /categories/bulk — DeleteManyCategoriesDto */
export interface BackendDeleteManyCategoriesDto {
  companyId: string; // required
  categoryIds?: string[]; // @IsMongoId each
}

// --- Activity Log ---

/** GET /company/:companyId/activity-log — GetActivityLogDto */
export interface BackendGetActivityLogDto {
  page?: number; // default 1
  limit?: number; // default 20
  category?: BackendActivityCategoryEnum;
  action?: BackendActivityActionEnum;
  userId?: string;
  startDate?: string; // @IsDateString
  endDate?: string; // @IsDateString
}

// --- Documents ---

/** POST /document/upload — UploadFileDto */
export interface BackendUploadFileDto {
  companyId: string; // required
  projectId?: string;
  documentName: string; // required
  documentPurpose: BackendDocumentPurposeEnum; // required
  qrcodeId?: string;
  folderId?: string;
  openToPage?: number;
}

/** PATCH /document/:id — PatchDocumentDto */
export interface BackendPatchDocumentDto {
  companyId: string; // required
  projectId: string; // required
  documentName?: string;
  documentPurpose?: BackendDocumentPurposeEnum;
  qrcodeId?: string;
  folderId?: string;
  openToPage?: number; // @IsPositive
}

/** DELETE /document/bulk — DeleteManyDocumentsDto */
export interface BackendDeleteManyDocumentsDto {
  companyId: string; // required
  documentIds?: string[]; // @IsMongoId each
  folderId?: string;
  qrcodeId?: string;
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  projectId?: string;
}

/** PATCH /document/restore/bulk — RestoreDocumentsDto */
export interface BackendRestoreDocumentsDto {
  companyId: string; // required
  documentIds: string[]; // @ArrayNotEmpty @IsMongoId each
}

/** POST /document/multipart/init — MultipartInitDto */
export interface BackendMultipartInitDto {
  companyId: string; // required
  projectId?: string;
  qrcodeId: string; // required
  folderId?: string;
  documentName: string; // required
  documentPurpose: string; // BackendDocumentPurposeEnum | 'file-qrcode' | 'folder-qrcode'
  contentType?: string;
  openToPage?: number;
}

/** POST /document/multipart/part-url — MultipartPartUrlDto */
export interface BackendMultipartPartUrlDto {
  s3Key: string; // required
  uploadId: string; // required
  partNumber: number; // required
  bucket: string; // required
  contentType: string; // required
}

/** POST /document/multipart/complete — MultipartCompleteDto */
export interface BackendMultipartCompleteDto {
  s3Key: string; // required
  uploadId: string; // required
  parts: Array<{ ETag: string; PartNumber: number }>; // required
  companyId: string; // required
  projectId?: string;
  qrcodeId: string; // required
  folderId?: string;
  documentName: string; // required
  documentPurpose: string; // required
  openToPage?: number;
}

/** POST /document/multipart/abort — MultipartAbortDto */
export interface BackendMultipartAbortDto {
  s3Key: string; // required
  uploadId: string; // required
}

// --- Folders ---

/** POST /folder — CreateFolderDto */
export interface BackendCreateFolderDto {
  companyId: string; // required
  projectId?: string;
  qrcodeId: string; // required
  folderName: string; // required
  parentFolderId?: string;
}

/** PATCH /folder/:id — PatchFolderDto */
export interface BackendPatchFolderDto {
  companyId: string; // required
  projectId: string; // required
  folderName?: string;
  qrcodeId?: string;
}

/** DELETE /folder/bulk — DeleteManyFoldersDto */
export interface BackendDeleteManyFoldersDto {
  companyId: string; // required
  folderIds?: string[]; // @IsMongoId each
  qrcodeId?: string;
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  projectId?: string;
}

// --- Users ---

/** POST /user/add-user — AddUserDto */
export interface BackendAddUserDto {
  companyId: string; // required
  email: string; // @IsEmail, required
  firstName?: string;
  lastName?: string;
  permission?: BackendUserPermissionEnum;
  inviterUserId?: string;
}

/** PATCH /user/:id — PatchUserDto */
export interface BackendPatchUserDto {
  companyId: string; // required
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string; // @Matches(/^[\d\s\-()+ ]*$/)
  permission?: BackendUserPermissionEnum;
}

/** DELETE /user/bulk — DeleteManyUsersDto */
export interface BackendDeleteManyUsersDto {
  companyId: string; // required
  userIds?: string[]; // @IsMongoId each
}

/** POST /user/:id/email-change-otp — RequestEmailChangeDto */
export interface BackendRequestEmailChangeDto {
  companyId: string; // required
  newEmail: string; // @IsEmail, required
  currentPassword: string; // required
}

/** POST /user/:id/email-change-verify — VerifyEmailChangeDto */
export interface BackendVerifyEmailChangeDto {
  companyId: string; // required
  newEmail: string; // @IsEmail, required
  otp: string; // @Length(6, 6), required
}

/** GET /user — ListUsersParams (query parameters) */
export interface BackendListUsersParams {
  companyId: string; // required
  current_page?: number; // default 1
  per_page?: number; // default 100
  search?: string;
}

// --- Stripe ---

/** POST /stripe/checkout/sessions — body passed through to Stripe checkout */
export interface BackendCreateCheckoutSessionDto {
  priceId: string; // required
  quantity?: number;
  successUrl: string; // required
  cancelUrl: string; // required
  customerId?: string;
  companyId?: string;
}

/** POST /stripe/billing-portal/sessions — body passed through to Stripe billing portal */
export interface BackendCreateBillingPortalSessionDto {
  customer?: string;
  userId?: string;
  return_url?: string;
  success_url?: string;
  mode?: string;
}

/** POST /stripe/checkout/storage-extension — storage addon checkout */
export interface BackendStorageExtensionDto {
  customer?: string;
  priceId?: string;
  quantity?: number;
  success_url?: string;
  cancel_url?: string;
}

/** POST /stripe/checkout/verify — verify completed checkout session */
export interface BackendVerifyCheckoutDto {
  sessionId: string; // required
}

// --- Procore Items ---

/** POST /procore-item — CreateProcoreItemDto */
export interface BackendCreateProcoreItemDto {
  companyId: string; // required
  projectId: string; // required
  groupingType?: BackendGroupingTypeEnum;
  groupingId?: string;
  qrcodeId: string; // required
  procoreToolName: string; // required (ProcoreItemTypeEnum)
  procoreItemID: string; // required
  hidden?: string;
}

/** Bulk entry for creating many procore items */
export interface BackendBulkProcoreItemEntry {
  qrcodeId: string; // required
  procoreToolName: string; // required (ProcoreItemTypeEnum)
  procoreItemID: string; // required
}

/** POST /procore-item/bulk — CreateManyProcoreItemsDto */
export interface BackendCreateManyProcoreItemsDto {
  companyId: string; // required
  projectId: string; // required
  items: BackendBulkProcoreItemEntry[]; // @ArrayMinSize(1)
}

/** PATCH /procore-item/:id — PatchProcoreItemDto */
export interface BackendPatchProcoreItemDto {
  companyId: string; // required
  projectId: string; // required
  qrcodeId?: string;
  hidden?: boolean;
}

/** DELETE /procore-item/delete/single — DeleteSingleProcoreItemDto */
export interface BackendDeleteSingleProcoreItemDto {
  companyId: string; // required
  projectId: string; // required
  procoreItemID: string; // required
  qrcodeId: string; // required
}

/** DELETE /procore-item/bulk — DeleteManyProcoreItemsPublicDto */
export interface BackendDeleteManyProcoreItemsDto {
  companyId: string; // required
  procoreItemIdsDB?: string[]; // @IsMongoId each
  qrcodeId?: string;
  groupingId?: string;
  groupingType?: BackendGroupingTypeEnum;
  projectId?: string;
  dryRun?: boolean;
}

/** PATCH /procore-item/toggle-visibility/single — ToggleVisibilitySingleProcoreItemDto */
export interface BackendToggleVisibilitySingleProcoreItemDto {
  companyId: string; // required
  projectId: string; // required
  procoreItemID: string; // required
  qrcodeId: string; // required
  hidden: boolean; // required
  procoreToolName?: string;
}

/** PATCH /procore-item/toggle-visibility/bulk — ToggleVisibilityBulkProcoreItemDto */
export interface BackendToggleVisibilityBulkProcoreItemDto {
  companyId: string; // required
  projectId: string; // required
  procoreItemIDs: string[]; // required
  qrcodeId: string; // required
  hidden: boolean; // required
}

// --- Procore ---

/** GET /procore/locations — query params (BasicRequestDto) */
export interface BackendProcoreLocationsParams {
  companyId: string; // required
  projectId: string; // required
}

/** GET /procore/permissions — query params (BasicRequestDto) */
export interface BackendProcorePermissionsParams {
  companyId: string; // required
  projectId: string; // required
}

/** GET /procore/tools — query params (BasicRequestDto) */
export interface BackendProcoreToolsParams {
  companyId: string; // required
  projectId: string; // required
}

/** GET /procore/inspection-templates — query params */
export interface BackendProcoreInspectionTemplatesParams {
  companyId: string; // required
  projectId: string; // required
}

/** GET /procore/drawings — query params */
export interface BackendProcoreDrawingsParams {
  qrCodeId: string; // required
  companyId: string; // required
  projectId: string; // required
  desktop?: string;
  fetchPage?: string;
  paginated?: boolean;
  perPage?: number;
  cursor?: string;
}

/** GET /procore/projects/search — query params */
export interface BackendProcoreProjectSearchParams {
  companyId: string; // required
  search?: string;
}

/** POST /procore/sync — request body */
export interface BackendProcoreSyncDto {
  groupingId: string; // required
  groupingType?: "arrangement" | "equipment";
}

/** POST /procore/sync — query params */
export interface BackendProcoreSyncParams {
  companyId: string; // required
  projectId: string; // required
}

/** POST /procore/inspections/bulk — request body */
export interface BackendProcoreCreateBulkInspectionsDto {
  groupingId: string; // required
  inspectionTemplateId: string; // required
  groupingType?: "arrangement" | "equipment" | "group";
  qrCodeIds?: string[];
}

/** POST /procore/inspections/bulk — query params */
export interface BackendProcoreCreateBulkInspectionsParams {
  companyId: string; // required
  projectId: string; // required
}

// --- QR Style ---

/** POST /qr-code/admin/preview — PreviewQRStyleDto */
export interface BackendPreviewQRStyleDto {
  text: string; // required
  presetName?: string;
  customStyle?: Record<string, unknown>;
}

/** PATCH /company/:companyId/qr-style — UpdateCompanyQRStyleDto */
export interface BackendUpdateCompanyQRStyleDto {
  companyId: string; // required
  useStyledQRCodes: boolean; // required
  presetName?: string;
  customStyle?: Record<string, unknown>;
}

/** POST /qr-code/admin/batch-regenerate — body */
export interface BackendBatchRegenerateDto {
  companyId: string; // required
  qrcodeIds?: string[];
  applyToAll?: boolean;
  enableLogo?: boolean;
}

// --- Print ---

/** POST /print/group/:groupId/letter — body */
export interface BackendPrintLetterDto {
  perPage?: number;
  headerProjectName?: boolean;
  headerGroupName?: boolean;
  footerMode?: "logo" | "address";
  qrCodeIds?: string[];
}

/** POST /print/group/:groupId/labels/avery — body */
export interface BackendPrintLabelDto {
  qrCodeIds?: string[];
}

// ============================================================
// Common DTO
// ============================================================

/** BasicRequestDto — used for single-item deletes and simple requests */
export interface BackendBasicRequestDto {
  companyId: string; // required
  projectId?: string;
}

// ============================================================
// Response DTOs (standard shapes)
// ============================================================

/** Standard single-item response */
export interface BackendSingleResponseDto<T> {
  success_message: string;
  data: T | null;
}

/** Standard multiple-items response */
export interface BackendMultipleResponseDto<T> {
  success_message: string;
  total_items: number;
  data: T[];
}

/** Standard paginated response */
export interface BackendPaginatedResponseDto<T> {
  success_message: string;
  total_pages: number;
  current_page: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
  data: T[];
}

// ============================================================
// Route Contract Definitions
// ============================================================

export interface RouteContract {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** Fields the backend requires (will 400 if missing) */
  requiredFields?: string[];
  /** Fields the backend accepts but doesn't require */
  optionalFields?: string[];
}

export const BACKEND_ROUTES: Record<string, RouteContract> = {
  // QR Codes
  "qr-code.list": {
    method: "GET",
    path: "/qr-code",
    requiredFields: ["companyId"],
  },
  "qr-code.create": {
    method: "POST",
    path: "/qr-code",
    requiredFields: ["companyId", "name", "type"],
  },
  "qr-code.get": { method: "GET", path: "/qr-code/:qrcodeId" },
  "qr-code.patch": {
    method: "PATCH",
    path: "/qr-code/:qrcodeId",
    requiredFields: ["companyId"],
  },
  "qr-code.delete": {
    method: "DELETE",
    path: "/qr-code/:qrcodeId",
    requiredFields: ["companyId"],
  },
  "qr-code.delete-bulk": {
    method: "DELETE",
    path: "/qr-code/bulk",
    requiredFields: ["companyId"],
  },
  "qr-code.bulk-assign": {
    method: "PATCH",
    path: "/qr-code/bulk-assign",
    requiredFields: [
      "qrCodeIds",
      "groupingId",
      "groupingType",
      "companyId",
      "projectId",
    ],
  },
  "qr-code.bulk-assign-project": {
    method: "PATCH",
    path: "/qr-code/bulk-assign-project",
    requiredFields: ["qrCodeIds", "projectId", "companyId"],
  },
  "qr-code.bulk-password": {
    method: "PATCH",
    path: "/qr-code/bulk-password",
    requiredFields: ["qrCodeIds", "companyId", "passwordActivated"],
  },
  "qr-code.download": {
    method: "POST",
    path: "/qr-code/download",
    requiredFields: ["qrCodeIds"],
  },
  "qr-code.bulk-async": {
    method: "POST",
    path: "/qr-code/bulk-async",
    requiredFields: ["equipmentId", "projectId", "numberOfCodes", "companyId"],
  },
  "qr-code.job-status": { method: "GET", path: "/qr-code/jobs/:jobId" },
  "qr-code.job-cancel": {
    method: "DELETE",
    path: "/qr-code/jobs/:jobId",
    requiredFields: ["companyId"],
  },
  "qr-code.image": { method: "GET", path: "/qr-code/image/:qrcodeId" },
  "qr-code.scanned": { method: "GET", path: "/qr-code/scanned/:qrcodeId" },
  "qr-code.verify-password": {
    method: "POST",
    path: "/qr-code/scanned/:qrcodeId/verify-password",
    requiredFields: ["password"],
  },

  // Groups
  "groups.list": { method: "GET", path: "/groups" },
  "groups.get": { method: "GET", path: "/groups/:id" },
  "groups.create": {
    method: "POST",
    path: "/groups",
    requiredFields: ["companyId", "projectId", "groupName"],
  },
  "groups.patch": {
    method: "PATCH",
    path: "/groups/:id",
    requiredFields: ["companyId"],
  },
  "groups.delete": {
    method: "DELETE",
    path: "/groups/:id",
    requiredFields: ["companyId"],
  },
  "groups.delete-bulk": {
    method: "DELETE",
    path: "/groups/bulk",
    requiredFields: ["companyId"],
  },
  "groups.procore-fetch-global": {
    method: "GET",
    path: "/groups/:id/procore-fetch-global",
  },

  // Projects
  "project.list": {
    method: "GET",
    path: "/project",
    requiredFields: ["companyId"],
  },
  "project.create": {
    method: "POST",
    path: "/project",
    requiredFields: [
      "companyId",
      "projectName",
      "projectCity",
      "projectState",
      "projectZIP",
    ],
  },
  "project.get": { method: "GET", path: "/project/:projectId" },
  "project.get-by-id": { method: "GET", path: "/project/by-id/:projectId" },
  "project.patch": {
    method: "PATCH",
    path: "/project/:projectId",
    requiredFields: ["companyId"],
  },
  "project.delete": {
    method: "DELETE",
    path: "/project/:projectId",
    requiredFields: ["companyId"],
  },
  "project.delete-bulk": {
    method: "DELETE",
    path: "/project/bulk",
    requiredFields: ["companyId"],
  },

  // Auth
  "auth.login": {
    method: "POST",
    path: "/auth/login",
    requiredFields: ["email", "password"],
  },
  "auth.signup": {
    method: "POST",
    path: "/auth/signup",
    requiredFields: ["email", "firstName", "lastName"],
  },
  "auth.verify-otp": {
    method: "POST",
    path: "/auth/verify-otp",
    requiredFields: ["email", "otp"], // userId is declared in DTO but never used by backend service
  },
  "auth.resend-otp": {
    method: "POST",
    path: "/auth/resend-otp",
    requiredFields: ["email"],
  },
  "auth.complete-signup": {
    method: "POST",
    path: "/auth/complete-signup",
    requiredFields: ["email", "password"],
  },
  "auth.logout": { method: "POST", path: "/auth/logout" },
  "auth.forgot-password-request": {
    method: "POST",
    path: "/auth/forgot-password/request",
    requiredFields: ["email"],
  },
  "auth.forgot-password-verify": {
    method: "POST",
    path: "/auth/forgot-password/verify",
    requiredFields: ["email", "otp"],
  },
  "auth.forgot-password-complete": {
    method: "POST",
    path: "/auth/forgot-password/complete",
    requiredFields: ["email", "otp", "password"],
  },
  "auth.verify-email-token": {
    method: "POST",
    path: "/auth/verify-email-token",
    requiredFields: ["token"],
  },
  "auth.complete-invited-signup": {
    method: "POST",
    path: "/auth/complete-invited-signup",
    requiredFields: ["token", "password"],
  },

  // Company
  "company.get": { method: "GET", path: "/company/:companyId" },
  "company.patch": { method: "PATCH", path: "/company/:companyId" },
  "company.addon": {
    method: "POST",
    path: "/company/:companyId/addons",
    requiredFields: ["sessionId"],
  },
  "company.procore-status": {
    method: "GET",
    path: "/company/:companyId/procore-status",
  },
  "company.dashboard-stats": {
    method: "GET",
    path: "/company/:companyId/dashboard-stats",
  },
  "company.storage-stats": {
    method: "GET",
    path: "/company/:companyId/storage-stats",
  },
  "company.procore-integration-status": {
    method: "GET",
    path: "/procore/status",
  },
  "company.procore-settings": {
    method: "PATCH",
    path: "/company/:companyId/procore-settings",
    requiredFields: ["editProcoreItemsAllowed"],
  },
  "company.procore-integration-details": {
    method: "GET",
    path: "/company/:companyId/procore-integration-details",
  },
  "company.procore-integration-owner": {
    method: "PUT",
    path: "/company/:companyId/procore-integration-owner",
    requiredFields: ["newOwnerUserId", "requestingUserId"],
  },
  "oauth.procore-logout": {
    method: "POST",
    path: "/oauth/procore/logout",
    requiredFields: ["companyId"],
  },

  // Categories
  "categories.list": { method: "GET", path: "/categories" },
  "categories.classes": { method: "GET", path: "/categories/classes" },
  "categories.get": { method: "GET", path: "/categories/:id" },
  "categories.create": {
    method: "POST",
    path: "/categories",
    requiredFields: ["categoryName", "categoryClass", "companyId"],
  },
  "categories.update": { method: "PATCH", path: "/categories/:id" },
  "categories.delete": {
    method: "DELETE",
    path: "/categories/:id",
    requiredFields: ["companyId"],
  },
  "categories.delete-bulk": {
    method: "DELETE",
    path: "/categories/bulk",
    requiredFields: ["companyId"],
  },

  // Activity Log
  "activity-log.list": {
    method: "GET",
    path: "/company/:companyId/activity-log",
  },

  // Documents
  "document.upload": {
    method: "POST",
    path: "/document/upload",
    requiredFields: ["companyId", "documentName", "documentPurpose"],
  },
  "document.patch": {
    method: "PATCH",
    path: "/document/:fileId",
    requiredFields: ["companyId", "projectId"],
  },
  "document.delete": {
    method: "DELETE",
    path: "/document/:fileId",
    requiredFields: ["companyId"],
  },
  "document.delete-bulk": {
    method: "DELETE",
    path: "/document/bulk",
    requiredFields: ["companyId"],
  },
  "document.restore-bulk": {
    method: "PATCH",
    path: "/document/restore/bulk",
    requiredFields: ["companyId", "documentIds"],
  },
  "document.multipart-init": {
    method: "POST",
    path: "/document/multipart/init",
    requiredFields: [
      "companyId",
      "qrcodeId",
      "documentName",
      "documentPurpose",
    ],
  },
  "document.multipart-part-url": {
    method: "POST",
    path: "/document/multipart/part-url",
    requiredFields: [
      "s3Key",
      "uploadId",
      "partNumber",
      "bucket",
      "contentType",
    ],
  },
  "document.multipart-complete": {
    method: "POST",
    path: "/document/multipart/complete",
    requiredFields: [
      "s3Key",
      "uploadId",
      "parts",
      "companyId",
      "qrcodeId",
      "documentName",
      "documentPurpose",
    ],
  },
  "document.multipart-abort": {
    method: "POST",
    path: "/document/multipart/abort",
    requiredFields: ["s3Key", "uploadId"],
  },
  "document.upload-multiple": {
    method: "POST",
    path: "/document/upload/multiple",
    requiredFields: ["companyId", "documentPurpose"],
  },
  "document.restore-single": {
    method: "PATCH",
    path: "/document/restore/:documentId",
    requiredFields: ["companyId"],
  },

  // Folders
  "folder.create": {
    method: "POST",
    path: "/folder",
    requiredFields: ["companyId", "qrcodeId", "folderName"],
  },
  "folder.patch": {
    method: "PATCH",
    path: "/folder/:folderId",
    requiredFields: ["companyId", "projectId"],
  },
  "folder.delete": {
    method: "DELETE",
    path: "/folder/:folderId",
    requiredFields: ["companyId"],
  },
  "folder.delete-bulk": {
    method: "DELETE",
    path: "/folder/bulk",
    requiredFields: ["companyId"],
  },

  // Stripe
  "stripe.list-products": { method: "GET", path: "/stripe/products" },
  "stripe.get-product": { method: "GET", path: "/stripe/products/:productId" },
  "stripe.create-checkout-session": {
    method: "POST",
    path: "/stripe/checkout/sessions",
    requiredFields: ["priceId", "successUrl", "cancelUrl"],
  },
  "stripe.create-billing-portal": {
    method: "POST",
    path: "/stripe/billing-portal/sessions",
  },
  "stripe.storage-extension": {
    method: "POST",
    path: "/stripe/checkout/storage-extension",
  },
  "stripe.verify-checkout": {
    method: "POST",
    path: "/stripe/checkout/verify",
    requiredFields: ["sessionId"],
  },

  // Procore Items
  "procore-item.create": {
    method: "POST",
    path: "/procore-item",
    requiredFields: [
      "companyId",
      "projectId",
      "qrcodeId",
      "procoreToolName",
      "procoreItemID",
    ],
  },
  "procore-item.create-bulk": {
    method: "POST",
    path: "/procore-item/bulk",
    requiredFields: ["companyId", "projectId", "items"],
  },
  "procore-item.patch": {
    method: "PATCH",
    path: "/procore-item/:procoreItemInternalId",
    requiredFields: ["companyId", "projectId"],
  },
  "procore-item.delete-single": {
    method: "DELETE",
    path: "/procore-item/delete/single",
    requiredFields: ["companyId", "projectId", "procoreItemID", "qrcodeId"],
  },
  "procore-item.delete-bulk": {
    method: "DELETE",
    path: "/procore-item/bulk",
    requiredFields: ["companyId"],
  },
  "procore-item.delete": {
    method: "DELETE",
    path: "/procore-item/:procoreItemIdDB",
    requiredFields: ["companyId"],
  },
  "procore-item.toggle-visibility-single": {
    method: "PATCH",
    path: "/procore-item/toggle-visibility/single",
    requiredFields: [
      "companyId",
      "projectId",
      "procoreItemID",
      "qrcodeId",
      "hidden",
    ],
  },
  "procore-item.toggle-visibility-bulk": {
    method: "PATCH",
    path: "/procore-item/toggle-visibility/bulk",
    requiredFields: [
      "companyId",
      "projectId",
      "procoreItemIDs",
      "qrcodeId",
      "hidden",
    ],
  },

  // Procore
  "procore.locations": {
    method: "GET",
    path: "/procore/locations",
    requiredFields: ["companyId", "projectId"],
  },
  "procore.permissions": {
    method: "GET",
    path: "/procore/permissions",
    requiredFields: ["companyId", "projectId"],
  },
  "procore.tools": {
    method: "GET",
    path: "/procore/tools",
    requiredFields: ["companyId", "projectId"],
  },
  "procore.inspection-templates": {
    method: "GET",
    path: "/procore/inspection-templates",
    requiredFields: ["companyId", "projectId"],
  },
  "procore.drawings": {
    method: "GET",
    path: "/procore/drawings",
    requiredFields: ["qrCodeId", "companyId", "projectId"],
  },
  "procore.projects-search": {
    method: "GET",
    path: "/procore/projects/search",
    requiredFields: ["companyId"],
  },
  "procore.sync": {
    method: "POST",
    path: "/procore/sync",
    requiredFields: ["groupingId"],
  },
  "procore.inspections-bulk": {
    method: "POST",
    path: "/procore/inspections/bulk",
    requiredFields: ["groupingId", "inspectionTemplateId"],
  },

  // Users
  "user.list": { method: "GET", path: "/user", requiredFields: ["companyId"] },
  "user.get": { method: "GET", path: "/user/:userId" },
  "user.patch": {
    method: "PATCH",
    path: "/user/:userId",
    requiredFields: ["companyId"],
  },
  "user.add": {
    method: "POST",
    path: "/user/add-user",
    requiredFields: ["companyId", "email"],
  },
  "user.delete": {
    method: "DELETE",
    path: "/user/:userId",
    requiredFields: ["companyId"],
  },
  "user.delete-bulk": {
    method: "DELETE",
    path: "/user/bulk",
    requiredFields: ["companyId"],
  },
  "user.email-change-otp": {
    method: "POST",
    path: "/user/:userId/email-change-otp",
    requiredFields: ["companyId", "newEmail", "currentPassword"],
  },
  "user.email-change-verify": {
    method: "POST",
    path: "/user/:userId/email-change-verify",
    requiredFields: ["companyId", "newEmail", "otp"],
  },

  // QR Style
  "qr-style.presets": { method: "GET", path: "/qr-code/admin/presets" },
  "qr-style.company-config": {
    method: "GET",
    path: "/company/:companyId/qr-style",
  },
  "qr-style.update-company-config": {
    method: "PATCH",
    path: "/company/:companyId/qr-style",
    requiredFields: ["companyId", "useStyledQRCodes"],
  },
  "qr-style.preview": {
    method: "POST",
    path: "/qr-code/admin/preview",
    requiredFields: ["text"],
  },
  "qr-style.batch-regenerate": {
    method: "POST",
    path: "/qr-code/admin/batch-regenerate",
    requiredFields: ["companyId"],
  },

  // Print
  "print.letter": { method: "POST", path: "/print/group/:groupId/letter" },
  "print.avery": { method: "POST", path: "/print/group/:groupId/labels/avery" },
  "print.zebra": { method: "POST", path: "/print/group/:groupId/labels/zebra" },
};
