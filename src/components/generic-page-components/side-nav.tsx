import { Link } from "@tanstack/react-router";
import { CreateQRCodeIcon } from "../../assets/icons/CreateQRCodeIcon";
import { HelpIcon } from "../../assets/icons/HelpIcon";
import { HomeIcon } from "../../assets/icons/HomeIcon";
import { QRCodeIcon } from "../../assets/icons/QRCodeIcon";
import { SettingsIcon } from "../../assets/icons/SettingsIcon";
import { StackIcon } from "../../assets/icons/StackIcon";
// import { WrenchIcon } from "../../assets/icons/WrenchIcon";
import { useRouterState } from "@tanstack/react-router";
import { FolderOutlineIcon } from "../../assets/icons/FolderOutlineIcon";
import { NavItemProps } from "../../types";

const navItems = [
  { icon: <HomeIcon />, label: "Dashboard", path: "/dashboard" },
  { icon: <CreateQRCodeIcon />, label: "Create QR", path: "/create-qr" },
  { icon: <FolderOutlineIcon />, label: "Projects", path: "/projects" },
  { icon: <QRCodeIcon />, label: "My QR Codes", path: "/my-qrcodes" },
  { icon: <StackIcon />, label: "Groups", path: "/groups" },
];

const bottomNavItems = [
  { icon: <SettingsIcon />, label: "Settings", path: "/settings" },
  { icon: <HelpIcon />, label: "Help Center", path: "/help-center" },
];

export const NavItem = ({
  icon,
  label,
  path,
  isActive,
  className,
}: NavItemProps) => (
  <Link
    to={path}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${className} ${
      isActive
        ? "bg-gray-600/50 text-yellow-400"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`}
  >
    <span className={`!text-white text-lg`}>{icon}</span>
    <span className="font-medium">{label}</span>
  </Link>
);

export const SideNav = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isActive={currentPath === item.path}
          />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-900 space-y-2">
        {bottomNavItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isActive={currentPath === item.path}
          />
        ))}
      </div>
    </>
  );
};
