# CLAUDE.md (Frontend)

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the CLAUDE.md file to help prevent future agents from having the same issue.

# currentDate
Today's date is 2026-03-09.

---

## Module / Directory Inventory

| Directory | Purpose | Key Files | Notes |
|-----------|---------|-----------|-------|
| `src/api/` | Axios HTTP client, TanStack Query client, API endpoint modules | `index.ts` (Axios instance + interceptors + QueryClient), `queryDefaults.ts`, `constants.ts` | Token refresh logic lives in response interceptor |
| `src/api/endpoints/` | One file per backend domain; exports query hooks, mutation helpers, and key factories | `qr-codes.ts`, `groups.ts`, `authentication.ts`, `document.ts`, `procore.ts`, `projects.ts`, `company.ts`, `stripe.ts`, `print.ts`, `user.ts`, `folder.ts`, `categories.ts`, `tools.ts`, `procore-tools.ts`, `procore-item.ts`, `qr-style.ts`, `qr-procore-tools.ts`, `scanned-qr.ts`, `aggregation.ts`, `activity-log.ts`, `admin-customers.ts`, `backfill.ts`, `ghl.ts`, `lambda.ts`, `nfc.ts`, `csv-import.ts` | Each file co-locates its TanStack Query key factory (e.g. `QrKeys`, `groupsKeys`) |
| `src/api/endpoints/.deprecated/` | Archived endpoint modules superseded by the Groups consolidation | `arrangements.ts`, `equipment.ts`, `README.md` | Do NOT import in new code; use `groups.ts` instead |
| `src/components/` | All React components, organized by feature or concern | See Component Organization below | ~25 top-level subdirectories |
| `src/routes/` | TanStack Router file-based route definitions | `__root.tsx`, `index.tsx`, `index.lazy.tsx`, `logged.tsx`, `dashboard.index.tsx`, `settings.lazy.tsx`, route files per page | `.lazy.tsx` suffix = lazy-loaded component; plain `.tsx` = route config / search validation |
| `src/store/` | Redux Toolkit store configuration and slices | `index.ts`, `slices/appSlice.ts`, `slices/userSlice.ts`, `slices/companySlice.ts`, `slices/projectSlice.ts`, `slices/procoreSlice.ts`, `slices/folderFileSlice.ts`, `slices/folderRecurseSlice.ts` | 7 slices total; see State Management section |
| `src/utils/` | Shared utility functions, custom hooks, and helper modules | `permissions.ts`, `safeStorage.ts`, `getStoredUser.ts`, `rollbar.ts`, `logger.ts`, `toolMap.ts`, `httpErrors.ts`, `sanitize.ts`, `dateFormatter.tsx`, `formatFileSize.tsx`, `modalErrorHandler.ts` | Also contains `hooks/`, `helpers/`, `toaster/`, `ui/` subdirectories |
| `src/utils/hooks/` | Reusable custom hooks for tables, selection, Procore, filtering, file previews | `useSearchAndFilters.ts`, `useSelectionState.ts`, `useFilteredRows.ts`, `useProcoreToolData.ts`, `useProcoreViewState.ts`, `useDocsView.ts`, `useFilePreview.ts`, `useQrTypes.ts`, `useTableLoadingState.ts`, `useQueryErrorInfo.ts`, `deviceDetect.tsx` | These are app-level shared hooks, not component-specific |
| `src/utils/helpers/` | Data transformation and table helper utilities | `tableHelpers.tsx`, `transformData.tsx` | |
| `src/utils/toaster/` | Toast notification component | `toast.tsx` | Wraps `react-hot-toast` |
| `src/utils/ui/` | Specialized UI utility components | `qr-code-settings.tsx`, `scan-activity.tsx`, `time-zone-dropdown.tsx` | |
| `src/lib/` | Shared library code: helpers, enums, feature flags, tier logic | `adminWhitelist.ts`, `badges.ts`, `classnames.ts`, `coerce.ts`, `columns.tsx`, `files.ts`, `filePreviews.ts`, `format.ts`, `icons.ts`, `invalidateQrCaches.ts`, `paths.ts`, `subscriptionIntent.ts`, `urlState.ts` | Also contains `devOverride/` and `tiers/` subdirectories |
| `src/lib/devOverride/` | Dev-only override system for Taliho employees (permission/tier/feature overrides) | `DevOverrideContext.tsx`, `DevOverrideTypes.ts`, `impersonationStorage.ts`, `useDevOverrides.ts`, `index.ts` | Wraps app in `DevOverrideProvider`; only active for admin/employee users |
| `src/lib/tiers/` | Subscription tier logic: tier determination, limits, hooks | `constants.ts`, `determineTier.ts`, `hooks.ts`, `types.ts`, `index.ts` | `useTier()` and `useStorageLimits()` hooks |
| `src/types/` | TypeScript type declaration files | `Badge.types.ts`, `assets.d.ts` | Minimal; most domain types live in `src/types.ts` |
| `src/types.ts` | Central domain type definitions | Single file with `Project`, `Company`, `QRCode`, `QRCodeAggregate`, `Arrangement`, `Equipment`, `Document`, `ProcoreToolItem`, `DataTableProps`, `Column`, `Action`, etc. | This is the primary types file; component-specific types are co-located with their components |
| `src/hooks/` | Top-level hooks directory | `useAdminPresenceSocket.ts` | Most hooks live in `src/utils/hooks/` instead |
| `src/middleware/` | Route middleware | `auth/authMiddleware.ts` | Exports `requireAuth` used in `__root.tsx` |
| `src/settings-page/` | Settings page feature module | `components/`, `context/`, `hooks/`, `utils/` subdirectories | Self-contained feature: company info, user management, security, subscription, Procore, categories |
| `src/assets/` | Static images, fonts, icons | | |

---

## Component Organization

### UI Primitives (`src/components/ui/`)

Base-level reusable components with no domain logic:

| Component | Purpose |
|-----------|---------|
| `Badge.tsx` | Status/label badges with color variants |
| `Breadcrumbs.tsx` | Navigation breadcrumb trail |
| `Button.tsx` | Standard button with size/variant props |
| `CreationProgressBanner.tsx` | Bulk creation progress indicator |
| `DevOverrideMenu.tsx` | Admin dev tools menu (override permissions, tiers, impersonation) |
| `EmptyState.tsx` | Empty state illustration + message |
| `ErrorBoundary.tsx` | React error boundary wrapper |
| `ErrorPage.tsx` | Full-page error display |
| `FeatureErrorBoundary.tsx` | Scoped error boundary for individual features |
| `Icon.tsx` | Icon wrapper component |
| `InfoTooltip.tsx` | Hover tooltip for info icons |
| `ItemCard.tsx` | Generic card for list items |
| `NotFoundPage.tsx` | 404 not found page |
| `Notice.tsx` | Informational notice banner |
| `PortalTooltip.tsx` | Portal-rendered tooltip (avoids overflow clipping) |
| `SearchBar.tsx` | Search input with debounce |
| `SearchFiltersCard.tsx` | Collapsible filter panel |

### Feature Components

| Directory | Purpose | Key Components |
|-----------|---------|----------------|
| `combobox/` | Searchable dropdown system | `Combobox.tsx` (headless hook), `detail/SearchComboBox.tsx`, `detail/FilterComboBox.tsx`, `detail/InfoComboBox.tsx`, `detail/ItemComboBox.tsx` |
| `create-qr/` | Multi-step QR code creation wizard | `BulkSelectionView.tsx`, `SingleSelectionView.tsx`, `ConfigureView/`, `CreateQRStepTracker.tsx`, `ProcoreStatusIndicator.tsx` |
| `dashboard/` | Dashboard page components | `ProjectCard.tsx`, `StatCard.tsx` |
| `dashboard-tool-components/` | Procore tool data display for dashboard | `dynamic-tool-table.tsx`, `tool-table-data.tsx`, `category-table-data.tsx` |
| `error/` | Inline error display components | `InlineError.tsx`, `MobileInlineError.tsx` |
| `group/` | Group detail page components | `hooks/`, `row-transforms.ts`, `types.ts` |
| `layout/` | App shell layout components | `AuthLayout.tsx` (login/signup layout), `Sidebar.tsx`, `ListPageLayout.tsx` |
| `loader/` | Loading skeleton components | `DashboardSkeleton.tsx`, `GridSkeleton.tsx`, `TableSkeleton.tsx`, `GridContentsSkeleton.tsx`, `TableContentsSkeleton.tsx` |
| `modal/` | Modal system and domain-specific modals | `Modal.tsx` (base), `taliho/` (Taliho modals), `procore/` (Procore modals), `admin/` (admin modals), `config/` |
| `modals/` | Legacy modals (pre-consolidation) | `attachments-view-modal.tsx`, `edit-arrangement-modal.tsx`, `edit-equipment-modal.tsx` |
| `my-qrcodes/` | My QR Codes page components | `hooks/`, `row-transforms.ts`, `types.ts` |
| `permissions/` | Permission-based rendering utilities | `PermissionGate.tsx`, `withPermission.tsx` (HOC), `permissionUtils.ts` |
| `primary-page-components/` | Primary Procore tool view components | `drawings-primary.tsx`, `photo-gallery.tsx`, `specifications-primary.tsx` |
| `procore/` | Procore integration components | `ProcoreAccessContext.ts`, `ProcoreFetchGate.tsx`, `ProcoreToolEmptyState.tsx` |
| `project/` | Project detail page components | |
| `qr/` | QR code detail and management components | `QRStyleConfig.tsx`, `QrCodeImage.tsx`, `QrInfoCard.tsx`, `QrGridCard.tsx`, `QrFilters.tsx`, `QrDocsTable.tsx`, `QrProcoreTable.tsx`, `QrSettingsPanel.tsx`, `QrHeaderActions.tsx`, `QrBatchRegenerate.tsx`, `useDocsTable.tsx` |
| `qrcode/` | QR code hooks and utilities | `hooks/`, `utils.ts` |
| `secondary-page-components/` | Procore tool-specific table/list views (one per tool) | `inspections.tsx`, `punch-lists.tsx`, `forms.tsx`, `drawings.tsx`, `rfis.tsx`, `submittals.tsx`, `observations.tsx`, `photos.tsx`, `documents.tsx`, `incidents.tsx`, `directory.tsx`, `coordination-issues.tsx`, `specifications.tsx`, `instructions.tsx`, `tasks.tsx`, `recently-deleted-documents.tsx` |
| `table/` | Data table system | `DataTable.tsx` (main), `DataGrid.tsx` (card grid), `Pagination.tsx`, `ItemsPerPage.tsx`, `BulkActionsBar.tsx`, `GroupActionsBar.tsx`, `TableFooter.tsx`, `ResultsSummary.tsx`; also `taliho/` and `procore/` subdirectories |
| `upload/` | File upload queue system | `UploadQueueProvider.tsx` (React Context), `GlobalUploadTray.tsx` |
| `upgrade/` | Subscription upgrade prompts | `TrialBanner.tsx`, `StorageWarningBanner.tsx`, `FeatureGateModal.tsx`, `StorageLimitModal.tsx`, `LockedFeatureCard.tsx`, `UpgradePrompt.tsx` |
| `categories/` | Category management UI | `CategorySelector.tsx`, `CategorySelectionPanel.tsx` |
| `generic-page-components/` | Reusable page-level patterns | `generic-paginated-table.tsx`, `generic-qr-header.tsx`, `generic-table-content.tsx`, `qrcode-edit-header.tsx`, `qrcode-paginated-table.tsx`, `recent-list-component.tsx`, `side-nav.tsx` |

### Standalone Components (in `src/components/`)

| File | Purpose |
|------|---------|
| `PdfViewer.tsx` | Full-featured inline PDF viewer (page navigation, zoom, pinch-to-zoom) |
| `pdf-opener.tsx` | PDF opening/download logic |
| `file-list.tsx` | File listing component |
| `folder-file-view.tsx` | Folder + file combined view |
| `folder-swipe-view.tsx` | Mobile swipe-based folder navigation |
| `display-category-data.tsx` | Category data display |
| `questions-and-answers.tsx` | Q&A display for Procore items |
| `vertical-attachment-section.tsx` | Attachment display section |
| `taliho-splash-screen.tsx` | Splash/loading screen |
| `global-job-tracker.tsx` | Tracks async bulk job progress (SSE-based) |
| `categories.tsx` | Categories page component |

---

## State Management Architecture

### TanStack Query (Server State)

Manages all data fetched from the backend API. Every API endpoint file in `src/api/endpoints/` exports:

1. **Query key factory** -- an object (e.g. `QrKeys`, `groupsKeys`, `ProjectKeys`) with methods like `.all`, `.list(filters)`, `.single(id)` that produce stable, serializable key tuples.
2. **Query hooks** -- `useQuery` wrappers (e.g. `useListQRCodes`, `useSingleGroup`, `useSingleQRCode`) that use the key factory internally and accept filter/pagination params.
3. **Mutation functions** -- plain async functions (e.g. `createQRCode`, `patchGroup`, `deleteSingleQRCode`) called inside `useMutation` at the component level.

**Default query configuration** (`src/api/index.ts`):
- `staleTime`: 5 minutes
- `retry`: once for 5xx errors, no retry for 4xx
- `refetchOnWindowFocus`: false

**Shared query presets** (`src/api/queryDefaults.ts`):
- `listQueryDefaults` -- 5 min stale, 30 min gc, `keepPreviousData` placeholder (for paginated tables)
- `detailQueryDefaults` -- 2 min stale, 10 min gc
- `procoreToolQueryDefaults` -- 5 min stale, 30 min gc, `keepPreviousData`

**Query key conventions**:
- Root key is a capitalized noun: `["Qrs"]`, `["Groups"]`, `["Projects"]`
- List keys append `"list"` + flattened filter values as a stable string tuple
- Detail/single keys append `"single"` or `"detail"` + the ID
- Nested resources append extra segments: `[...QrKeys.single(id), "image"]`

### Redux Toolkit (Client State)

Seven slices in `src/store/slices/`:

| Slice | State Shape | Purpose |
|-------|-------------|---------|
| `appSlice` | `{ selectedTool: string, authenticated: boolean }` | Global app state: currently selected Procore tool, authentication flag |
| `userSlice` | `{ firstName, company, permission, isVerified, email, userId }` | Current user profile data (hydrated from localStorage on login) |
| `companySlice` | Full `Company` type from `types.ts` | Current company data including Procore access, Stripe subscription, storage limits |
| `projectSlice` | Full `Project` type from `types.ts` | Currently selected/active project |
| `procoreSlice` | `Record<ToolKey, unknown[]>` (one array per Procore tool) | Cached Procore tool data arrays, keyed by tool name from `toolsMap` |
| `folderFileSlice` | `{ document: { folders, files }, "taliho-local": { folders, files } }` | Folder/file lists for both Procore documents and local Taliho uploads |
| `folderRecurseSlice` | `{ currentLocation, breadcrumbs, childrenOf }` | Folder navigation state for recursive folder browsing (breadcrumb trail, children cache) |

### React Context

| Provider | Location | Purpose |
|----------|----------|---------|
| `UploadQueueProvider` | `src/components/upload/UploadQueueProvider.tsx` | File upload queue management: queuing, progress tracking, multi-part upload, cancellation. Wraps the entire app at `__root.tsx`. |
| `DevOverrideProvider` | `src/lib/devOverride/DevOverrideContext.tsx` | Dev-only overrides for Taliho employees: permission level, tier, feature flags. Only active when user is admin or Taliho employee. |
| `ProcoreAccessContext` | `src/components/procore/ProcoreAccessContext.ts` | Provides Procore OAuth access status to child components. |

---

## Routing Architecture

### TanStack Router File-Based Routing

Routes are defined in `src/routes/` using TanStack Router's file-based convention. The route tree is auto-generated into `src/routeTree.gen.ts` (run `npx tsr generate` or `npm run dev` to regenerate).

### Route File Conventions

- **`routeName.tsx`** -- Route configuration: `createFileRoute()` with `validateSearch`, `beforeLoad`, `loader`. No component JSX (or minimal).
- **`routeName.lazy.tsx`** -- Lazy-loaded route component: contains the actual page component. Split from the config file so the component bundle is code-split.
- **`routeName.test.tsx`** -- Co-located unit tests for the route.

### Auth-Protected vs Public Routes

The root route (`__root.tsx`) applies `requireAuth` middleware via `beforeLoad`. This middleware (defined in `src/middleware/auth/authMiddleware.ts`) checks `localStorage` for a valid user object and access token.

**Public routes** (no auth required):
- `/` (login)
- `/signup`
- `/scannedQR` (public QR scan landing)
- `/forgot-password`
- `/procore/oauth-success`, `/procore/oauth-error`, `/procore/select-company`
- `/verify-email/*`
- `/tools/$tool/$itemId` (public Procore tool item view)
- `/nfc/v1/$nfcId` (NFC tag scan)

**Auth-required routes** (all others, redirected to `/` if no token):
- `/dashboard` -- Main dashboard
- `/projects`, `/project/$projectId` -- Projects list and detail
- `/groups`, `/group/$groupId` -- Groups list and detail
- `/my-qrcodes` -- User's QR codes
- `/qrcode/$qrcodeId` -- QR code detail
- `/create-qr` -- QR code creation wizard
- `/settings` -- Company/user settings
- `/admin/*` -- Admin-only pages (customers, NFC, stats, online, db-backfill, GHL)
- `/checkout`, `/storage/success` -- Stripe checkout flows

### Route Parameter Patterns

- `$projectId` -- MongoDB ObjectId for project
- `$groupId` -- MongoDB ObjectId for group
- `$qrcodeId` -- MongoDB ObjectId for QR code
- `$companyId` -- MongoDB ObjectId for company (admin routes)
- `$tool` -- Procore tool key string (e.g. `inspection`, `punch-list`)
- `$itemId` -- Procore item ID
- `$nfcId` -- NFC tag ID
- `$token` -- Email verification token

### Layout Structure

The root component (`__root.tsx`) renders three layout modes based on the current path:
1. **Mobile-focused** (`/scannedQR`, `/tools/*`, `/nfc/*`) -- Minimal header with Taliho logo, no sidebar
2. **Auth pages** (`/`, `/signup`, `/forgot-password`, `/procore/*`, `/verify-email/*`) -- No chrome, just `<Outlet />`
3. **Desktop app** (everything else) -- Full layout with `Sidebar` + header + `<Outlet />`

---

## API Client Architecture

### Axios Client (`src/api/index.ts`)

- **Base URL**: `import.meta.env.VITE_BACKEND_URL`
- **Credentials**: `withCredentials: true` (sends/receives HttpOnly refresh token cookie)
- **Request interceptor**: Attaches `x-api-key` header, `Authorization: Bearer <token>` from localStorage (checks `accessToken` first, falls back to legacy `token` key), and impersonation headers if customer-view session is active
- **Response interceptor**: Handles 401 errors with automatic token refresh:
  1. On 401, queues concurrent requests while refreshing
  2. Calls `POST /auth/refresh` (refresh token is in HttpOnly cookie)
  3. Stores new access token in localStorage
  4. Retries all queued requests with new token
  5. If refresh fails, clears all auth data and redirects to `/`
- **Error reporting**: Reports significant errors to Rollbar via `logApiErrorByDomain()`, which routes to domain-specific error classes (QR, Procore, Auth, etc.). Skips cancelled requests, expected 404/410s, and pre-retry 401s.

### QueryClient Configuration

- Queries: Retry once for 5xx, no retry for 4xx. 5 min staleTime. No refetchOnWindowFocus.
- Mutations: Global `onError` logs non-Axios errors to Rollbar (Axios errors are already reported by the interceptor).

### API Endpoint File Pattern

Each file in `src/api/endpoints/` follows this structure:

```typescript
// 1. Key factory
export const EntityKeys = {
  all: ["Entity"] as const,
  list: (filters: Params) => [...EntityKeys.all, "list", ...flatFilters] as const,
  single: (id: string) => [...EntityKeys.all, "single", id] as const,
};

// 2. Query hooks
export const useListEntities = (params: Params) => {
  return useQuery({
    queryKey: EntityKeys.list(params),
    queryFn: async () => { /* axiosInstance.get(...) */ },
    enabled: !!params.requiredField,
    ...listQueryDefaults,  // or inline staleTime/gcTime
  });
};

// 3. Mutation functions (plain async, used with useMutation at call sites)
export const createEntity = async (data: CreateDto): Promise<ResponseDto> => {
  const { data: response } = await axiosInstance.post("/entity", data);
  return response;
};
```

---

## Common Patterns

### SearchComboBox Usage

The `SearchComboBox` component (`src/components/combobox/detail/SearchComboBox.tsx`) is the primary searchable dropdown. Key patterns:

**Flat options:**
```tsx
<SearchComboBox
  options={[{ label: "Option A", value: "a" }, { label: "Option B", value: "b" }]}
  value={selectedValue}
  onChange={setSelectedValue}
  placeholder="Select..."
/>
```

**Grouped options:**
```tsx
<SearchComboBox
  groups={[
    { label: "Group 1", options: [...] },
    { label: "Group 2", options: [...] },
  ]}
  value={selectedValue}
  onChange={setSelectedValue}
/>
```

**usePortal prop** -- Required when the combobox is inside a container with `overflow: hidden` or `overflow: auto` (e.g. inside a modal with `scrollable` prop). Without it, the dropdown will be clipped:
```tsx
<SearchComboBox usePortal options={...} value={...} onChange={...} />
```

**Multiple selection:**
```tsx
<SearchComboBox multiple options={...} value={selectedArray} onChange={setSelectedArray} />
```

### Table / List Pattern

Tables use `DataTable` (`src/components/table/DataTable.tsx`) or `DataGrid` for card layouts. They support:
- Server-side pagination (`serverSidePagination`, `currentPage`, `totalItems`, `onPageChange`)
- Search, sort, bulk selection
- `BulkActionsBar` for batch operations on selected rows
- `GroupActionsBar` for group-level actions
- Loading skeletons via `src/components/loader/`

Typical page pattern: a route component calls a `useList*` hook, passes data + columns + handlers to `DataTable`.

### Modal Pattern

The base `Modal` component (`src/components/modal/Modal.tsx`) provides:
- Portal rendering to `document.body`
- Stacking z-index for nested modals
- Body scroll lock
- Focus trap
- Animation (enter/exit)
- Props: `open`, `onClose`, `title`, `subtitle`, `footer`, `headerRight`, `size` (`sm`/`md`/`lg`/`xl`/`2xl`), `scrollable`, `allowOverflow`

Domain modals are organized in:
- `src/components/modal/taliho/` -- Taliho-specific modals
- `src/components/modal/procore/` -- Procore-specific modals
- `src/components/modal/admin/` -- Admin modals

### Form Pattern

Forms use React Hook Form + Zod validation (primarily in the Settings page module):
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

React Hook Form is used in: `settings-page/components/` (CompanyInfo, UserProfile, Security, UserManagement, Categories), `admin.nfc.lazy.tsx`, and `modals/edit-equipment-modal.tsx`. Most other forms use controlled state directly.

### Permission Checking Pattern

Three approaches for permission-based rendering:

1. **`usePermissions` hook** (`src/utils/permissions.ts`):
   ```tsx
   const user = getStoredUser();
   const { isAdmin, canModify, canDelete } = usePermissions(user);
   ```

2. **`PermissionGate` component** (`src/components/permissions/PermissionGate.tsx`):
   ```tsx
   <PermissionGate user={user} check="canCreateProjects" fallback={<NoAccess />}>
     <CreateButton />
   </PermissionGate>
   ```

3. **`withPermission` HOC** (`src/components/permissions/withPermission.tsx`):
   ```tsx
   const AdminOnlyComponent = withPermission(MyComponent, "isAdmin");
   ```

Permission levels: `admin` > `pm` > `user`. Users with no `permission` field default to `admin` (backward compatibility with V2).

**Dev override support**: `usePermissionsWithOverride` wraps `usePermissions` and applies any active dev override from the `DevOverrideProvider`, allowing Taliho employees to test different permission levels.

### Procore Integration Pattern

**OAuth popup flow** (`src/routes/procore/oauth-success.tsx`):
1. Backend redirects to `/procore/oauth-success?userId=...&origin=...`
2. Page attempts to notify parent window via BOTH:
   - `window.opener.postMessage({ type: "PROCORE_OAUTH_SUCCESS", userId }, origin)` -- for the Login page listener
   - Procore iframe helpers `notifySuccess()` -- for the Settings page ProcoreCard `authenticate()` listener
3. Falls back to direct login completion if no parent window

**Procore data fetching**:
- `toolsMap` (`src/utils/toolMap.ts`) maps 15 Procore tool keys to their fetch functions, display titles, and API name variants
- `procoreSlice` stores fetched tool data in Redux, keyed by tool name
- `ProcoreFetchGate` component gates rendering on Procore access status
- `useProcoreToolData` hook (`src/utils/hooks/useProcoreToolData.ts`) manages fetching and caching tool data

---

## Conventions

### File Naming

- **Components**: PascalCase files for components (`Modal.tsx`, `SearchComboBox.tsx`, `DataTable.tsx`)
- **Hooks**: camelCase with `use` prefix (`useDocsTable.tsx`, `useProcoreToolData.ts`)
- **Utils/helpers**: kebab-case (`safeStorage.ts`, `qr-codes.ts`, `badge-helpers.ts`)
- **Route files**: dot-separated path segments (`admin.customers.$companyId.lazy.tsx`, `group.$groupId.tsx`)
- **Test files**: Co-located with source, `.test.ts` or `.test.tsx` suffix (`Modal.test.tsx`, `permissions.test.ts`)
- **Types**: Co-located `types.ts` within feature directories, or central `src/types.ts`

### Component Prop Pattern

Props are defined using TypeScript `type` aliases (not `interface`) for most components:
```tsx
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  // ...
};
```

Some components (particularly older or domain-specific ones) use `interface`. The codebase does not enforce one over the other.

### Import Aliases

Defined in `tsconfig.app.json`:
- `@/*` maps to `./src/*` (primary, used throughout)
- `@api/*` maps to `./src/api/*`
- `@components/*` maps to `./src/components/*`
- `@lib/*` maps to `./src/lib/*`
- `@assets/*` maps to `./src/assets/*`
- `@types/*` maps to `./src/types/*`
- `@data/*` maps to `./src/api/mockdata/*`

In practice, `@/` is the most commonly used alias. The others exist but are less frequently used.

### CSS Approach

- **Tailwind CSS v4** with utility classes (no CSS modules, no styled-components)
- Theme defined in `src/index.css` using `@theme` directive:
  - `brand-*` palette aliased to yellow (Taliho's brand color)
  - `accent-*` aliased to orange
  - Semantic aliases: `info-*` (blue), `success-*` (green), `warning-*` (yellow), `danger-*` (red)
- Uses `@tailwindcss/forms` plugin
- Icon library: BoxIcons (`bx bx-*` classes)

### Test Organization

- **Unit tests** (Vitest): Co-located `.test.ts`/`.test.tsx` files next to source, plus `src/__tests__/` for shared test utilities
- **E2E tests** (Playwright): In `e2e/` directory with Page Object Model pattern (`e2e/pages/`), fixtures, and utilities
- **TypeScript compilation excludes test files**: `tsconfig.app.json` excludes `**/*.test.ts`, `**/*.test.tsx`, and `src/__tests__/**`

### Error Handling

- **Rollbar** integration via `src/utils/rollbar.ts`: domain-specific error loggers (`logQRError`, `logProcoreError`, `logAuthError`, `logDocumentError`, `logJobError`, `logApiError`, `logApiErrorByDomain`)
- **Logger** utility (`src/utils/logger.ts`): wraps `console` methods
- **Error boundaries**: `ErrorBoundary` (global) and `FeatureErrorBoundary` (scoped) in `src/components/ui/`
- **HTTP error parsing**: `parseHttpError` in `src/utils/httpErrors.ts`

---

## Known Gotchas

### Arrangement/Equipment to Groups Consolidation

The legacy `arrangement` and `equipment` concepts have been consolidated into a unified `groups` system. However:
- Deprecated API endpoint files exist in `src/api/endpoints/.deprecated/` (arrangements.ts, equipment.ts) -- do NOT import these
- The `types.ts` file still exports `Arrangement` and `Equipment` types for backward compatibility
- The `GroupApi` type in `groups.ts` has fields for both: `arrangementName`, `equipmentID`, `equipmentName`, `groupName`
- The `groupingType` field on QR codes can be `"arrangement"`, `"equipment"`, `"group"`, or `"procore-drawing-codes"`
- Some legacy modals still exist in `src/components/modals/` (edit-arrangement-modal, edit-equipment-modal) -- prefer using the Groups modal system

### SearchComboBox `usePortal` Prop

When placing a `SearchComboBox` inside a modal with `scrollable={true}` or any container with `overflow: hidden`/`overflow: auto`, the dropdown will be clipped unless `usePortal={true}` is set. This is because the dropdown is positioned absolutely relative to the combobox root by default. With `usePortal`, it renders via `createPortal` to `document.body` with fixed positioning.

### `localStorage.getItem("user")` Pattern

The stored user object in localStorage requires careful handling:
- Always use `getStoredUser()` from `src/utils/getStoredUser.ts` (which internally uses `safeLocalStorage.getJSON`)
- Direct `JSON.parse(localStorage.getItem("user"))` can throw if the value is malformed, `"undefined"`, or `"null"`
- The auth middleware (`authMiddleware.ts`) explicitly checks for these edge cases
- The stored user object may have `_id` or `userId` as the user ID field (check both)
- The stored user may have `companyId` or `company` as the company reference (check both)
- Some code still uses `JSON.parse(localStorage.getItem("company") || "null")` directly (see `__root.tsx`) -- prefer `safeLocalStorage.getJSON("company")`

### `safeLocalStorage` Wrapper

Always prefer `safeLocalStorage` (`src/utils/safeStorage.ts`) over direct `localStorage` calls. It wraps all operations in try/catch and reports failures to Rollbar. This is important because `localStorage` can throw in:
- Private/incognito browsing mode
- When storage quota is exceeded
- When browser settings disable storage
- SecurityError in certain contexts

The API: `safeLocalStorage.getItem()`, `.setItem()`, `.removeItem()`, `.getJSON()`, `.setJSON()`.

### Procore OAuth Dual Notification

The Procore OAuth success page (`src/routes/procore/oauth-success.tsx`) sends TWO different notifications because different parent pages listen for different message types:
1. **Login page** (`/`) listens for `postMessage` with `{ type: "PROCORE_OAUTH_SUCCESS", userId }`
2. **Settings page** ProcoreCard uses `@procore/procore-iframe-helpers` `authenticate()`, which expects `authentication.notifySuccess()`

Both notifications fire on every OAuth completion. This is intentional, not a bug.

### Token Storage Migration (V2 to V3)

The app supports two localStorage keys for the access token:
- `accessToken` (V3, preferred)
- `token` (V2 legacy)

The request interceptor checks `accessToken` first, then falls back to `token`. After a successful token refresh, the interceptor stores the new token in `accessToken` and removes the legacy `token` key. New code should always use `accessToken`.

### Route Type Generation

TanStack Router auto-generates `src/routeTree.gen.ts` on dev server start. If you see TypeScript errors after pulling changes or adding/renaming route files, run:
```bash
npm run dev  # or: npx tsr generate
```

### TypeScript Compilation Excludes

The `tsconfig.app.json` excludes from type checking:
- `src/components/table/procore/**`
- `src/components/modal/procore/**`
- `**/*.test.ts`, `**/*.test.tsx`
- `src/__tests__/**`

If you add types or exports in these excluded directories, they will not be checked by `npx tsc --noEmit`.

### Impersonation / Customer View

Taliho employees can impersonate customers via the Customer View system:
- Session data stored in localStorage under `taliho-dev-customer-view-session` and `taliho-dev-customer-view-actor`
- When active, the request interceptor adds `x-impersonate-user-id` and `x-impersonation-mode` headers
- `isCustomerViewActive()` from `src/lib/devOverride/impersonationStorage.ts` checks if a session is active
- The `CustomerViewBanner` component shows a warning banner at the top of the page

### Procore Tool Keys vs Backend Enum Values

The `toolsMap` in `src/utils/toolMap.ts` maps internal tool keys (e.g. `"punch-list"`) to:
- `title` (display name)
- `fetch` (API fetcher function)
- `procoreApiName` (Procore's API identifier, e.g. `"punch_list"`)
- `backendEnumValue` (backend stored value, e.g. `"punch-list"`)

The `procoreApiNameToBackendEnum` map includes extra aliases because Procore's permissions API may return different name formats than what the toolsMap uses.

### Bulk Operations and Async Jobs

Bulk create/delete operations that exceed simple REST limits use the async job system:
- `createBulkQRJob()` / `createBulkQRDeleteJob()` / `createBulkGroupDeleteJob()` return a `jobId`
- Real-time progress is streamed via SSE (`connectJobStream()`)
- Job status can be polled via `getJobStatus()` as a fallback
- The `GlobalJobTracker` component (`src/components/global-job-tracker.tsx`) shows progress for active jobs
- Jobs support pause/resume/cancel operations
- `MAX_BULK_DELETE_COUNT` is 500 (defined in `src/api/constants.ts`)
