import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeIcon } from "../assets/icons/HomeIcon";
import Button from "../components/ui/Button";
import { RecentListComponent } from "../components/generic-page-components/recent-list-component";
import { useListQRCodes } from "../api/endpoints/qr-codes";
import { useDashboardStats } from "../api/endpoints/company";
import { useListGroups, type GroupApi } from "../api/endpoints/groups";
import { QRCode } from "../types";
import { formatDate } from "@/lib/format";
import { useListProjects } from "../api/endpoints/projects";
import { iconColorMap, resolveQRCodeType } from "../utils/icon-color-map";
import { computeTypeBadge } from "../lib/badges";
import StatCard from "../components/dashboard/StatCard";
import ProjectCard from "../components/dashboard/ProjectCard";
import DashboardSkeleton from "../components/loader/DashboardSkeleton";
import EmptyState from "../components/ui/EmptyState";
import { canCreateProjects } from "../utils/permissions";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createFileRoute("/dashboard/")({
  component: RouteComponent,
});

function RouteComponent() {
  const user = getStoredUser();
  const canCreateQRCodes = canCreateProjects(user);

  // Fetch dashboard statistics from server-side aggregation (accurate counts)
  const { data: dashboardStats } = useDashboardStats(user.companyId);

  // Fetch recent items for display lists (limited to 5 items each)
  const { data: QrCodesData } = useListQRCodes({
    companyId: user.companyId,
    per_page: 5,
  });
  const { data: projectsResponse } = useListProjects({
    companyId: user.companyId,
    page: 1,
    perPage: 5,
    sortKey: "updatedAt",
    sortDir: "desc",
  });
  const ProjectsData = projectsResponse?.data ?? [];
  const { data: GroupsData } = useListGroups({
    companyId: user.companyId,
    per_page: 10,
  });

  if (localStorage.getItem("user") === null) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div data-page-id="index" className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="mb-4 md:mb-0">
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <HomeIcon className="text-blue-600 font-bold" />
              <span>Dashboard</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Here's an overview of your QR codes and activity
            </p>
          </div>
          {canCreateQRCodes && (
            <div className="flex flex-wrap items-center gap-2">
              <Link to={"/create-qr"}>
                <Button variant="primary">
                  {/* <i className="bx bx-qr" /> */}
                  Create QR Code
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Loading skeleton if any data is still undefined */}
        {!dashboardStats || !QrCodesData || !projectsResponse || !GroupsData ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatCard
                icon={<i className="bx bx-qr text-blue-600 text-3xl"></i>}
                title="Total QR Codes"
                value={(dashboardStats?.qrCodesCount ?? 0).toLocaleString()}
                // TODO: Add subtext after V3 launch
                // subtext="+12% from last month"
                iconBgClass="bg-blue-100"
              />
              <StatCard
                icon={<i className="bx bx-scan text-purple-600 text-3xl"></i>}
                title="Total Scans"
                value={(dashboardStats?.qrScansCount ?? 0).toLocaleString()}
                // TODO: Add subtext after V3 launch
                // subtext="+12% from last month"
                iconBgClass="bg-purple-100"
              />
              <StatCard
                icon={<i className="bx bx-file text-green-600 text-3xl"></i>}
                title="Files Shared"
                value={(dashboardStats?.documentsCount ?? 0).toLocaleString()}
                // TODO: Add subtext after V3 launch
                // subtext="+12% from last month"
                iconBgClass="bg-green-100"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold leading-6 text-gray-900">
                  Recent Projects
                </h3>
                <Link
                  to="/projects"
                  className="text-sm font-medium text-yellow-500 hover:text-yellow-600"
                >
                  View All
                </Link>
              </div>
              {(ProjectsData ?? []).filter(
                (p: { archived?: boolean; projectStatus?: string }) =>
                  p.archived !== true &&
                  p.projectStatus?.toLowerCase() !== "archived",
              ).length === 0 ? (
                <EmptyState
                  icon={
                    <i className="bx bx-building-house text-green-500 text-2xl" />
                  }
                  title="No Projects yet"
                  description="Create your first project to organize your QR codes"
                  iconBgClass="bg-green-50"
                  compact
                  className="!pt-0"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(ProjectsData ?? [])
                    .filter(
                      (p: { archived?: boolean; projectStatus?: string }) =>
                        p.archived !== true &&
                        p.projectStatus?.toLowerCase() !== "archived",
                    )
                    .slice(0, 4)
                    .map(
                      (
                        project: {
                          _id: string;
                          name?: string;
                          projectName?: string;
                          qrCodes: number;
                          archived?: boolean;
                          // status?: string;
                          projectStatus?: string;
                        },
                        idx: number,
                      ) => {
                        const title =
                          project?.projectName ||
                          project?.name ||
                          "Unnamed Project";
                        const raw = (
                          project?.projectStatus ?? ""
                        ).toLowerCase();
                        const isArchived = Boolean(project?.archived);
                        const status = isArchived
                          ? "archived"
                          : raw === "completed"
                            ? "completed"
                            : raw === "on hold" || raw === "on-hold"
                              ? "on-hold"
                              : "active";
                        const iconClass =
                          status === "archived"
                            ? "bx bx-archive text-gray-600"
                            : status === "completed"
                              ? "bx bx-badge-check text-blue-600"
                              : status === "on-hold"
                                ? "bx bx-pause-circle text-yellow-600"
                                : "bx bx-building-house text-green-600";
                        const iconBg =
                          status === "archived"
                            ? "bg-gray-100"
                            : status === "completed"
                              ? "bg-blue-100"
                              : status === "on-hold"
                                ? "bg-yellow-100"
                                : "bg-green-100";
                        return (
                          <ProjectCard
                            key={idx}
                            to={`/project/${project?._id}`}
                            icon={<i className={`${iconClass} text-2xl`}></i>}
                            iconWrapClass={iconBg}
                            title={title}
                            subtitle="Last updated recently"
                            pill={`${project?.qrCodes ?? 0} QR Codes`}
                          />
                        );
                      },
                    )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RecentListComponent
                category={"qrcode"}
                label={"QR Codes"}
                linkTo={"/my-qrcodes"}
                items={QrCodesData?.data?.map((qrcode: QRCode) => {
                  // Resolve type with backwards compatibility for legacy V2 QR codes
                  // Legacy QR codes don't have type property, defaulting to "folder"
                  const qrcodeWithResolved = qrcode as QRCode & {
                    resolvedType?: string;
                  };
                  const resolvedType = resolveQRCodeType(qrcodeWithResolved);
                  const typeMapping = iconColorMap(resolvedType);
                  const typeBadge = computeTypeBadge(resolvedType);
                  return {
                    id: qrcode?._id,
                    name: qrcode?.qrcodeName,
                    detail: typeBadge?.label || resolvedType || "--",
                    date: `Created ${formatDate(qrcode?.createdAt)}`,
                    bg: typeMapping.bg,
                    icon: typeMapping.icon,
                  };
                })}
              />
              <RecentListComponent
                category={"group"}
                label={"Groups"}
                linkTo={"/groups"}
                items={(GroupsData?.data ?? [])
                  .map((group: GroupApi) => {
                    const isEquipment = group.type === "equipment";
                    const name =
                      group.groupName ||
                      group.arrangementName ||
                      group.equipmentName ||
                      "Unnamed Group";
                    return {
                      id: group._id,
                      name,
                      detail: `${group.numberOfCodes ?? 0} QR Codes`,
                      date: `Updated ${formatDate(group.createdAt)}`,
                      bg: isEquipment ? "bg-red-100" : "bg-indigo-100",
                      color: isEquipment ? "text-red-600" : "text-indigo-600",
                      icon: isEquipment ? (
                        <i className="bx bx-wrench text-red-600 text-xl"></i>
                      ) : (
                        <i className="bx bx-layer text-indigo-600 text-xl"></i>
                      ),
                      createdAt: group.createdAt,
                    };
                  })
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt ?? 0).getTime() -
                      new Date(a.createdAt ?? 0).getTime(),
                  )
                  .slice(0, 5)}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
