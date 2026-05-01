# Frontend Route Map

This document describes every route in the Taliho v3 frontend application. The app uses **TanStack Router** with file-based routing. Route files live in `src/routes/`.

---

## Routing Conventions

| Pattern | Meaning |
|---------|---------|
| `__root.tsx` | Root layout applied to every page; wraps all routes with sidebar, header, auth checks, upload queue, etc. |
| `_auth` prefix | (Not used in this project -- auth is enforced at the root level via `requireAuth` middleware.) |
| `$param` | Dynamic URL segment (e.g., `$projectId`, `$qrcodeId`). |
| `.lazy.tsx` | Lazy-loaded (code-split) route component; the route definition may live in a separate non-lazy file. |
| `admin.*.tsx` | Dot-separated segments map to `/admin/*` nested paths. |
| `procore/` and `oauth/` directories | Directory-based nested routes for Procore/OAuth flows. |

### Auth Model

Authentication is enforced globally in `__root.tsx` via the `requireAuth` `beforeLoad` guard (defined in `src/middleware/auth/authMiddleware.ts`). The guard maintains an explicit **public paths** allow-list:

```
/                        (login page)
/signup
/scannedQR
/forgot-password
/procore/oauth-success
/procore/oauth-error
/procore/select-company
```

Additionally, paths containing `/tools`, starting with `/nfc/`, or starting with `/verify-email/` bypass the auth check. All other paths require a valid user object and access token in localStorage; unauthenticated visitors are redirected to `/`.

---

## Route Tree

```
/                                    Login page (public)
├── /signup                          Sign-up wizard (public)
├── /forgot-password                 Password reset flow (public)
├── /verify-email                    Invited-user signup -- legacy path (public)
│   └── /verify-email/$token         Invited-user signup with token param (public)
├── /logged                          Post-login redirect handler (auth required)
├── /checkout                        Stripe checkout page (auth required)
├── /storage/success                 Storage add-on confirmation (auth required)
├── /sample                          Dev placeholder page (auth required)
│
├── /dashboard                       Main dashboard with stats (auth required)
├── /projects                        Project list (auth required)
│   └── /project/$projectId          Single project detail (auth required)
├── /groups                          Group (arrangement/equipment) list (auth required)
│   └── /group/$groupId              Single group detail (auth required)
├── /my-qrcodes                      QR code list (auth required)
│   └── /qrcode/$qrcodeId            Single QR code detail (auth required)
├── /create-qr                       QR code creation wizard (auth required)
├── /settings                        Account & company settings (auth required)
│
├── /scannedQR                       Mobile QR scan viewer (public)
├── /tools/$tool/$itemId             Mobile Procore tool detail page (public)
├── /nfc/v1/$nfcId                   NFC tag resolver/redirect (public)
│
├── /procore/
│   ├── oauth-success                Procore OAuth success callback (public)
│   ├── oauth-error                  Procore OAuth error callback (public)
│   ├── select-company               Procore company selection (public)
│   └── fetch                        Procore data fetch page (auth required)
│
├── /oauth/procore/
│   ├── login                        Redirect to backend OAuth login endpoint (public)
│   └── callback                     Redirect to backend OAuth callback endpoint (public)
│
└── /admin/
    ├── customers                    Customer list (admin only, auth required)
    │   └── customers/$companyId     Customer detail (admin only, auth required)
    ├── db-backfill                  Database backfill operations (admin only, auth required)
    ├── ghl                          GoHighLevel CRM migration tool (admin only, auth required)
    ├── nfc                          NFC tag management (admin only, auth required)
    ├── online                       Live user presence dashboard (admin only, auth required)
    └── stats                        Platform-wide statistics (admin only, auth required)
```

---

## Route Details by Section

### 1. Public Routes

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/` | `index.tsx` + `index.lazy.tsx` | Static redesign review home with links into key prototype surfaces. | public | -- | Yes |
| `/signup` | `signup.lazy.tsx` | Multi-step sign-up wizard (registration, OTP verification, password). | public | -- | Yes |
| `/forgot-password` | `forgot-password.lazy.tsx` | Three-step password reset flow (email, OTP verification, new password). | public | -- | Yes |
| `/verify-email` | `verify-email.lazy.tsx` | Invited-user account completion form (legacy URL pattern without token in path). | public | -- | Yes |
| `/verify-email/$token` | `verify-email.$token.lazy.tsx` | Invited-user account completion form with token in the URL path. | public | `$token` | Yes |

### 2. Auth Infrastructure

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/logged` | `logged.tsx` | Post-authentication redirect handler; routes to dashboard or initiates Stripe checkout for subscription intents. | auth required | -- | No |
| `/procore/oauth-success` | `procore/oauth-success.tsx` | Procore OAuth success callback; notifies parent window or completes login directly. | public | `userId`, `origin` (search) | No |
| `/procore/oauth-error` | `procore/oauth-error.tsx` | Procore OAuth error callback; notifies parent window and displays error. | public | `error`, `message`, `origin` (search) | No |
| `/procore/select-company` | `procore/select-company.tsx` | Procore company selection screen shown when a user has multiple Procore companies. | public | -- | No |
| `/oauth/procore/login` | `oauth/procore/login.tsx` | Frontend catch-all that redirects to the backend `/oauth/procore/login` endpoint. | public | -- | No |
| `/oauth/procore/callback` | `oauth/procore/callback.tsx` | Frontend catch-all that redirects to the backend `/oauth/procore/callback` endpoint, preserving query params. | public | -- | No |

### 3. Main App Routes

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/dashboard` | `dashboard.index.tsx` | Main dashboard showing stats (QR codes, scans, files), recent projects, QR codes, and groups. | auth required | -- | No |
| `/projects` | `projects.lazy.tsx` | Paginated project list with search, filters, bulk actions, and project creation. | auth required | -- | Yes |
| `/project/$projectId` | `project.$projectId.tsx` | Single project detail page with QR codes, Procore integration, and project management. | auth required | `$projectId` | No |
| `/groups` | `groups.lazy.tsx` | List of groups (arrangements and equipment) with search, filters, and bulk actions. | auth required | -- | Yes |
| `/group/$groupId` | `group.$groupId.tsx` | Single group detail page with QR codes, documents, and group management. | auth required | `$groupId` | No |
| `/my-qrcodes` | `my-qrcodes.lazy.tsx` | List of all QR codes with search, filters, bulk actions, and inline editing. | auth required | -- | Yes |
| `/qrcode/$qrcodeId` | `qrcode.$qrcodeId.tsx` | Single QR code detail page with documents, Procore tools, sharing, and settings. | auth required | `$qrcodeId` | No |
| `/create-qr` | `create-qr.lazy.tsx` | Multi-step QR code creation wizard supporting single and bulk creation. | auth required | -- | Yes |
| `/checkout` | `checkout.lazy.tsx` | Stripe checkout page for subscription plans; redirects to Stripe's hosted checkout. | auth required | `productId`, `priceId` (search) | Yes |
| `/storage/success` | `storage.success.lazy.tsx` | Post-checkout confirmation page for storage add-on purchases. | auth required | `session_id` (search) | Yes |
| `/procore/fetch` | `procore/fetch.tsx` | Procore data fetch page for importing Procore project data (drawings, submittals, etc.) into QR codes. | auth required | -- | No |

### 4. Mobile / QR Scan Routes

These routes are rendered with a mobile-focused layout (no sidebar, simplified header).

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/scannedQR` | `scannedQR.tsx` | Mobile page displayed when a QR code is scanned; shows categories, documents, and Procore tools for the scanned QR code. | public | `qrcodeId` (search) | No |
| `/tools/$tool/$itemId` | `tools.$tool.$itemId.tsx` | Mobile detail page for a specific Procore tool item (drawings, punch lists, inspections, etc.). | public | `$tool`, `$itemId`, `qrCodeId` (search) | No |
| `/nfc/v1/$nfcId` | `nfc.v1.$nfcId.tsx` | NFC tag resolver; looks up the NFC tag and redirects to the appropriate destination (QR scan page, marketing URL, or signup). | public | `$nfcId` | No |

### 5. Settings Routes

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/settings` | `settings.lazy.tsx` | Comprehensive settings page with sections for user profile, security, subscription, company info, print branding, user management, QR design studio, Procore integration, and categories. | auth required | -- | Yes |

### 6. Admin Routes

All admin routes check `isAdminUser()` against a whitelist of allowed email addresses. Unauthorized users are redirected to `/dashboard`.

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/admin/customers` | `admin.customers.tsx` (layout) + `admin.customers.index.lazy.tsx` | Admin customer list with company management, status updates, trial refreshes, and backfill actions. | admin only | -- | Yes (index) |
| `/admin/customers/$companyId` | `admin.customers.$companyId.lazy.tsx` | Admin customer detail page with user management, domain approvals, and company administration. | admin only | `$companyId` | Yes |
| `/admin/db-backfill` | `admin.db-backfill.lazy.tsx` | Database backfill operations dashboard for running data migration tasks. | admin only | -- | Yes |
| `/admin/ghl` | `admin.ghl.lazy.tsx` | GoHighLevel CRM migration tool for migrating company/contact data to GHL. | admin only | -- | Yes |
| `/admin/nfc` | `admin.nfc.lazy.tsx` | NFC tag inventory management with batch creation, assignment, and CSV export. | admin only | -- | Yes |
| `/admin/online` | `admin.online.lazy.tsx` | Live user presence dashboard showing currently active users via WebSocket. | admin only | -- | Yes |
| `/admin/stats` | `admin.stats.lazy.tsx` | Platform-wide statistics dashboard with plan distribution, storage usage, and company metrics. | admin only | -- | Yes |

### 7. Development Routes

| Path | File | Purpose | Auth | Params | Lazy |
|------|------|---------|------|--------|------|
| `/sample` | `sample.lazy.tsx` | Minimal placeholder route for development testing. | auth required | -- | Yes |

---

## Special Files

| File | Purpose |
|------|---------|
| `__root.tsx` | Root layout component applied to all routes. Renders the sidebar, header, mobile header, auth checks, upload tray, job tracker, toasts, subscription/storage banners, and devtools. |
| `admin.customers.tsx` | Layout wrapper for `/admin/customers` that renders an `<Outlet />` for nested customer routes. |
| `index.tsx` | Non-lazy route definition for `/` that validates search params (`error`, `task`, `plan`) for subscription intents. |

---

## File Naming to URL Mapping (TanStack Router Conventions)

| File Name Pattern | URL |
|-------------------|-----|
| `index.tsx` / `index.lazy.tsx` | `/` |
| `dashboard.index.tsx` | `/dashboard` or `/dashboard/` |
| `project.$projectId.tsx` | `/project/:projectId` |
| `admin.customers.index.lazy.tsx` | `/admin/customers` |
| `admin.customers.$companyId.lazy.tsx` | `/admin/customers/:companyId` |
| `procore/oauth-success.tsx` | `/procore/oauth-success` |
| `oauth/procore/login.tsx` | `/oauth/procore/login` |
| `nfc.v1.$nfcId.tsx` | `/nfc/v1/:nfcId` |
| `tools.$tool.$itemId.tsx` | `/tools/:tool/:itemId` |
| `verify-email.$token.lazy.tsx` | `/verify-email/:token` |
