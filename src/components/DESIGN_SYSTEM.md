# Taliho V3 Design System Reference

Quick reference for developers working on the Taliho V3 frontend.

---

## Color Palette

Colors are defined as Tailwind v4 `@theme` tokens in `src/index.css`. Each semantic color has a full shade scale (50-900) aliased from the default Tailwind palette.

| Token       | Alias Source    | Purpose                                           |
|-------------|-----------------|---------------------------------------------------|
| `brand`     | `yellow`        | Primary brand color (buttons, focus rings, active tabs) |
| `accent`    | `orange`        | Secondary accent, Procore-related highlights      |
| `info`      | `blue`          | Informational notices, file-type badges           |
| `success`   | `green`         | Success states, active project badges             |
| `warning`   | `yellow`        | Warning notices, on-hold status                   |
| `danger`    | `red`           | Destructive actions, error states                 |

**Usage:** Use Tailwind utility classes directly, e.g. `bg-brand-500`, `text-danger-600`, `ring-info-100`. The default shade (e.g. `bg-brand`) resolves to the 500 shade, except `success` and `danger` which default to 600. Standard Tailwind `gray`/`slate` shades are used for neutrals with no custom tokens.

---

## Typography

**Font family:** Tailwind's default sans-serif stack (system-ui, Segoe UI, Roboto, etc.). No custom font is loaded.

**Common text patterns:**

| Context             | Classes                                    |
|---------------------|--------------------------------------------|
| Page heading        | `text-2xl font-bold text-gray-800`         |
| Section heading     | `text-lg font-semibold text-gray-900`      |
| Card title          | `text-sm font-medium text-gray-900`        |
| Card subtitle       | `text-xs text-gray-500`                    |
| Body text           | `text-sm text-gray-700`                    |
| Muted / helper text | `text-sm text-gray-500`                    |
| Badge text          | `text-xs font-medium`                      |

---

## Spacing & Layout

The project uses Tailwind's default spacing scale (multiples of 0.25rem). No custom spacing tokens are defined.

**Useful custom utilities** (from `src/index.css`):

- `.grid-col-fluid` -- responsive grid: `repeat(auto-fit, minmax(20ch, 1fr))`
- `.no-scrollbar` -- hides scrollbars (webkit + Firefox)
- `.line-clamp-2` -- multi-line text truncation to 2 lines

**Shared style bundles** (from `src/lib/classnames.ts`):

```ts
import { styles } from "@/lib/classnames";

styles.tilePanel       // rounded-2xl border panel container
styles.iconTileBrand50 // icon tile with brand-50 background
styles.focusRingBrand  // keyboard focus ring using brand-500
styles.chipDefault     // lightweight badge/chip fallback
```

---

## Component Inventory

All shared UI components live in `src/components/ui/`.

| Component                | File                        | Description                                                   |
|--------------------------|-----------------------------|---------------------------------------------------------------|
| `Badge`                  | `Badge.tsx`                 | Colored label pill (12 color variants, `md` or `full` shape)  |
| `Breadcrumbs`            | `Breadcrumbs.tsx`           | Navigation breadcrumb trail (`parent` or `folder` variant)    |
| `Button`                 | `Button.tsx`                | Polymorphic button/anchor with 12+ variants                   |
| `CreationProgressBanner` | `CreationProgressBanner.tsx`| Animated progress bar banner for background job tracking      |
| `DevOverrideMenu`        | `DevOverrideMenu.tsx`       | Internal dev tools for tier/permission/customer-view overrides|
| `EmptyState`             | `EmptyState.tsx`            | Centered icon + title + optional CTA for empty lists          |
| `ErrorBoundary`          | `ErrorBoundary.tsx`         | Root-level React error boundary with Rollbar reporting        |
| `ErrorPage`              | `ErrorPage.tsx`             | Full-page error screen with retry + dashboard link            |
| `FeatureErrorBoundary`   | `FeatureErrorBoundary.tsx`  | Section-level error boundary to isolate feature crashes       |
| `Icon`                   | `Icon.tsx`                  | Row-type icon (file/folder/url/procore) or rounded icon       |
| `InfoTooltip`            | `InfoTooltip.tsx`           | CSS-only hover tooltip attached to an info icon               |
| `ItemCard`               | `ItemCard.tsx`              | Clickable list/tile card with icon, title, subtitle           |
| `NotFoundPage`           | `NotFoundPage.tsx`          | 404 page with link back to dashboard                          |
| `Notice`                 | `Notice.tsx`                | Alert banner in 4 variants: `info`, `success`, `warning`, `error` |
| `PortalTooltip`          | `PortalTooltip.tsx`         | Portal-rendered tooltip that avoids overflow clipping          |
| `SearchBar`              | `SearchBar.tsx`             | Text input with search icon and controlled value              |
| `SearchFiltersCard`      | `SearchFiltersCard.tsx`     | Combined search + filter bar container with clear button      |

### Modal (`src/components/modal/Modal.tsx`)

The `Modal` component is separate from `ui/` but is the standard overlay dialog. It is portal-rendered, supports stacking, focus trapping, and animated transitions.

**Sizes:** `sm`, `md`, `lg`, `xl`, `2xl`

---

## Usage Patterns

### Buttons

```tsx
import Button from "@/components/ui/Button";

<Button variant="primary" onClick={save}>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger" leftIconClass="bx bx-trash">Delete</Button>
<Button href="/settings" variant="clear">Settings</Button> // renders <a>
```

Key variants: `primary` (brand yellow), `secondary` (white/outlined), `danger` (red), `clear` (gray outlined), `icon` / `iconGhost` / `iconDangerGhost` (icon-only), `filter`, `tab` / `tabActive`, `sidebarPrimary` / `sidebarSecondary`.

### Modals

```tsx
import Modal from "@/components/modal/Modal";

const [open, setOpen] = useState(false);

<Modal open={open} onClose={() => setOpen(false)} title="Confirm" size="md"
  footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
           <Button variant="primary" onClick={confirm}>Confirm</Button></>}>
  <p>Are you sure?</p>
</Modal>
```

### Toasts

The project uses `react-hot-toast`. Import and call directly:

```tsx
import toast from "react-hot-toast";

toast.success("Saved successfully");
toast.error("Something went wrong");
```

### Forms

Forms use `react-hook-form` with `zod` validation via `@hookform/resolvers`:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
```

### Notices / Alerts

```tsx
import Notice from "@/components/ui/Notice";

<Notice variant="warning">Storage is almost full.</Notice>
<Notice variant="error" right={<Button variant="danger">Retry</Button>}>
  Upload failed.
</Notice>
```

### Error Boundaries

Wrap feature sections with `FeatureErrorBoundary` for isolated error recovery:

```tsx
<FeatureErrorBoundary featureName="dashboard">
  <DashboardContent />
</FeatureErrorBoundary>
```

---

## Icons

**Library:** [Boxicons 2.1.4](https://boxicons.com/) loaded via CDN in `index.html`.

**Usage:** Apply icon classes directly to `<i>` elements:

```tsx
<i className="bx bx-home-alt text-xl text-gray-600" />
```

**Named icon map** (`src/lib/icons.ts`) provides a typed lookup for common icons:

```ts
import { icons } from "@/lib/icons";

icons.home      // "bx bx-home-alt"
icons.edit      // "bx bx-pencil"
icons.trash     // "bx bx-trash"
icons.download  // "bx bx-download"
icons.qr        // "bx bx-qr"
```

Available names: `qr`, `qrScan`, `home`, `folder`, `file`, `image`, `pdf`, `doc`, `wrench`, `layer`, `collection`, `upload`, `edit`, `download`, `trash`, `leftArrow`, `chevronRight`, `chevronDown`, `dots`, `mapPin`, `plus`, `plusCircle`, `grid`, `cog`, `lock`, `linkExternal`, `info`, `help`, `task`. The `Icon` component (`Icon.tsx`) wraps Boxicons for row-type icons with colored backgrounds and sizing (`sm`, `md`, `lg`).

---

## Accessibility & Key Dependencies

- **Focus rings:** `focus-visible` outlines use `brand-500` (`#eab308`). Form elements use border-color change to avoid double rings. Dark backgrounds (`.bg-gray-900`) use `brand-400`.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables animations globally.
- **Modals:** ARIA `role="dialog"`, `aria-modal`, focus trapping, and focus restoration on close.

**Key packages:** `tailwindcss` v4, `@headlessui/react` (accessible primitives), `@heroicons/react` (SVG icons), `react-hot-toast`, `framer-motion`, `react-hook-form` + `zod`, `swiper`, `recharts`.
