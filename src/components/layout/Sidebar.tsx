import { Link, useRouterState } from "@tanstack/react-router";
import { STATIC_APP_LABEL } from "@/lib/staticAppMode";
import Button from "../ui/Button";
import { canCreateProjects } from "@/utils/permissions";

export default function Sidebar() {
  const iconBase = "mr-3 inline-block align-middle text-lg";

  // Get user for permission checks
  const rawUser = localStorage.getItem("user");
  let user: Record<string, unknown> = {};
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = {};
    }
  }
  const canCreate = canCreateProjects(user);

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: "bx bx-home-alt" },
    { to: "/create-qr", label: "Create QR", icon: "bx bx-qr" },
    { to: "/projects", label: "Projects", icon: "bx bx-folder" },
    { to: "/my-qrcodes", label: "QR Codes", icon: "bx bx-qr-scan" },
    {
      to: "/groups",
      label: "Groups",
      icon: "bx bx-collection mr-3 inline-block align-middle text-lg",
    },
  ] as const;

  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <div className="flex flex-col w-64 bg-gray-900 border-r border-gray-800 flex-shrink-0 text-white">
      <div className="flex justify-center items-center h-16 px-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <img
            src={"/images/white-taliho-logo.png"}
            alt="Taliho Logo"
            className="w-auto h-9"
          />
          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
            {STATIC_APP_LABEL}
          </span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 mb-6">
          <Button
            href="/dashboard"
            variant={
              currentPath === "/dashboard"
                ? "sidebarPrimary"
                : "sidebarSecondary"
            }
            className="w-full"
            leftIconClass={`bx bx-home-alt ${iconBase}`}
          >
            Dashboard
          </Button>
          {canCreate && (
            <Button
              href="/create-qr"
              variant={
                currentPath === "/create-qr"
                  ? "sidebarPrimary"
                  : "sidebarSecondary"
              }
              className="w-full"
              leftIconClass={`bx bx-qr ${iconBase}`}
            >
              Create QR
            </Button>
          )}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
          Quick Access
        </div>
        <div className="flex flex-col gap-2">
          {navItems
            .filter((n) => n.to !== "/dashboard" && n.to !== "/create-qr")
            .map((item) => (
              <Link key={item.to} to={item.to} activeProps={{ className: "" }}>
                <Button
                  variant={"sidebarGeneral"}
                  className={`w-full justify-start ${currentPath === item.to ? "bg-gray-800 text-yellow-400" : ""}`}
                  leftIconClass={`${item.icon} ${iconBase}`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
        </div>
      </nav>
      <div className="p-4 border-t border-gray-800 mt-auto flex flex-col gap-2">
        <Link to="/" activeProps={{ className: "" }}>
          <Button
            variant={"sidebarGeneral"}
            className={`w-full justify-start ${currentPath === "/" ? "bg-gray-800 text-yellow-400" : ""}`}
            leftIconClass={`bx bx-layout ${iconBase}`}
          >
            Review Home
          </Button>
        </Link>
        <Link to="/settings" activeProps={{ className: "" }}>
          <Button
            variant={"sidebarGeneral"}
            className={`w-full justify-start ${currentPath === "/settings" ? "bg-gray-800 text-yellow-400" : ""}`}
            leftIconClass={`bx bx-cog ${iconBase}`}
          >
            Settings
          </Button>
        </Link>
        <a
          href="mailto:support@taliho.com?subject=Help%20Request"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant={"sidebarGeneral"}
            className="w-full justify-start"
            leftIconClass={`bx bx-help-circle ${iconBase}`}
          >
            Help Center
          </Button>
        </a>
      </div>
    </div>
  );
}
