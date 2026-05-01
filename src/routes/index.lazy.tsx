import { createLazyFileRoute } from "@tanstack/react-router";
import { STATIC_APP_LABEL } from "@/lib/staticAppMode";

export const Route = createLazyFileRoute("/")({
  component: StaticPrototypeHome,
});

const primaryRoutes = [
  {
    to: "/dashboard",
    title: "Dashboard",
    description: "Review the high-level shell, summary cards, and recent activity layout.",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    to: "/projects",
    title: "Projects",
    description: "Compare list density, filters, and project management patterns.",
    accent: "bg-sky-100 text-sky-700",
  },
  {
    to: "/my-qrcodes",
    title: "QR Codes",
    description: "Inspect list presentation, status badges, and detail navigation entry points.",
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    to: "/groups",
    title: "Groups",
    description: "Walk through grouped resource layouts and supporting table patterns.",
    accent: "bg-rose-100 text-rose-700",
  },
  {
    to: "/create-qr",
    title: "Create QR",
    description: "Stage wizard and form redesigns with static data instead of live generation.",
    accent: "bg-violet-100 text-violet-700",
  },
  {
    to: "/settings",
    title: "Settings",
    description: "Discuss account, billing, storage, and design studio sections in one place.",
    accent: "bg-slate-200 text-slate-700",
  },
] as const;

const mobileRoutes = [
  {
    to: "/scannedQR?qrcodeId=qr-static-001",
    title: "Scanned QR",
    description: "Mobile-first scan experience with mock folders, docs, and Procore links.",
  },
  {
    to: "/tools/drawing/draw-001?qrCodeId=qr-static-001",
    title: "Tool Detail",
    description: "Single-item mobile detail flow for reviewing Procore-inspired layouts.",
  },
] as const;

const adminRoutes = [
  {
    to: "/admin/customers",
    title: "Customer Admin",
    description: "Static customer management views for internal operations redesign work.",
  },
  {
    to: "/admin/stats",
    title: "Platform Stats",
    description: "Aggregate admin dashboard with safe local data for workshop sessions.",
  },
] as const;

function StaticPrototypeHome() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="border-b border-slate-200/80 px-6 py-8 sm:px-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                {STATIC_APP_LABEL}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Static prototype data only
              </span>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Taliho is now set up as a self-contained redesign staging app.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Every screen below runs against local mock responses, seeded user data,
                  and safe prototype content, so the team can review flows without a
                  backend, auth setup, or production side effects.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-inner">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Review Notes
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>Changes are local to this browser session and are safe to explore.</li>
                  <li>Billing, auth, uploads, and sync flows are mocked with dummy responses.</li>
                  <li>Main routes keep their production structure so redesign discussions stay grounded.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-10 px-6 py-8 sm:px-10">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Core Surfaces
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Start here for the main app shell and high-traffic product areas.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {primaryRoutes.map((route) => (
                  <a
                    key={route.to}
                    href={route.to}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                  >
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${route.accent}`}
                    >
                      Team review
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900 group-hover:text-slate-950">
                      {route.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {route.description}
                    </p>
                    <div className="mt-6 text-sm font-medium text-slate-900">
                      Open surface
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-xl font-semibold text-slate-950">
                  Mobile and Scan Flows
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  These routes use mock QR and Procore content so we can compare mobile
                  behavior, hierarchy, and readability without live scan data.
                </p>
                <div className="mt-5 space-y-3">
                  {mobileRoutes.map((route) => (
                    <a
                      key={route.to}
                      href={route.to}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {route.title}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600">
                        {route.description}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-xl font-semibold text-slate-950">
                  Internal Admin Views
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Useful when the team wants to critique dense dashboards, table-heavy
                  workflows, or operations surfaces separately from the customer app.
                </p>
                <div className="mt-5 space-y-3">
                  {adminRoutes.map((route) => (
                    <a
                      key={route.to}
                      href={route.to}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {route.title}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600">
                        {route.description}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
