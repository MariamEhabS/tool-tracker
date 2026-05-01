import { Link } from "@tanstack/react-router";
import { RecentItemData } from "../../types";
import ItemCard from "../ui/ItemCard";
import EmptyState from "../ui/EmptyState";

const emptyStateConfig: Record<
  string,
  { icon: string; iconColor: string; iconBg: string; description: string }
> = {
  qrcode: {
    icon: "bx bx-qr",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    description: "Create your first QR code to get started",
  },
  arrangement: {
    icon: "bx bx-layer",
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
    description: "Group your QR codes into arrangements",
  },
  equipment: {
    icon: "bx bx-wrench",
    iconColor: "text-red-500",
    iconBg: "bg-red-50",
    description: "Add equipment to track and manage",
  },
  group: {
    icon: "bx bx-layer",
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
    description: "Group your QR codes together",
  },
};

export const RecentListComponent = ({
  items = [],
  category,
  linkTo,
  label,
}: RecentItemData) => {
  if (!items) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <div className="dashboard-loader m-0 max-auto"></div>
      </div>
    );
  }

  function getLinkConfig(id: string): {
    to: string;
    params?: Record<string, string>;
  } {
    if (category === "qrcode")
      return { to: "/qrcode/$qrcodeId", params: { qrcodeId: id } };
    if (category === "equipment")
      return { to: "/group/$groupId", params: { groupId: id } };
    if (category === "arrangement")
      return {
        to: "/group/$groupId",
        params: { groupId: id },
      };
    if (category === "group")
      return { to: "/group/$groupId", params: { groupId: id } };
    return { to: linkTo };
  }

  const config = emptyStateConfig[category] || {
    icon: "bx bx-folder",
    iconColor: "text-gray-500",
    iconBg: "bg-gray-50",
    description: "No items found",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold leading-6 text-gray-900">
          Recent {label}
        </h3>
        <Link
          to={linkTo}
          className="text-sm font-medium text-yellow-500 hover:text-yellow-600"
        >
          View All
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<i className={`${config.icon} ${config.iconColor} text-2xl`} />}
          title={`No ${label} yet`}
          description={config.description}
          iconBgClass={config.iconBg}
          compact
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items?.map((item) => {
            const cfg = getLinkConfig(String(item.id));
            return (
              <Link key={item.id} to={cfg.to} params={cfg.params}>
                <ItemCard
                  icon={item.icon}
                  iconContainerClassName={`${item.bg}`}
                  title={item?.name}
                  subtitle={`${item?.detail} • ${item?.date}`}
                  className="p-4"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
