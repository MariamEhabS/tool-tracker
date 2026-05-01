import { useEffect, useRef, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { BadgeVariant } from "@/types/Badge.types";
import QrCode from "@/components/qr/QrCodeImage";
import { icons } from "@/lib/icons";
import procoreIcon from "@/assets/images/procore-icon.png";
import { formatDate } from "@/lib/format";

export type QrBadge = {
  label: string;
  className?: string;
  variant?: BadgeVariant;
};
export type Stat = { label: string; value: string };
export type LinkInfo = { url: string; buttonText?: string };

export type QRInfoCardProps = {
  qrImageSrc: string;
  qrAlt?: string;
  type?: string;
  title: string;
  description?: string;
  badges?: QrBadge[];
  link?: LinkInfo;
  actions?: ReactNode;
  className?: string;
  createdAt?: string;
  updatedAt?: string;
  totalScans?: number;
  lastScanned?: string;
  scanSummarySublabel?: string;
  typeBadge?: { label: string; variant?: BadgeVariant };
  groupingBadge?: { label: string; variant?: BadgeVariant; href?: string };
  projectBadge?: { label: string; variant?: BadgeVariant; href?: string };
  onEdit?: () => void;
  onSetPassword?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  /** Called when clicking an unassigned grouping badge to assign to a group */
  onAssignToGroup?: () => void;
  /** Called when clicking an unassigned project badge to assign to a project */
  onAssignToProject?: () => void;
};

export default function QRInfoCard(props: QRInfoCardProps) {
  const {
    qrImageSrc,
    qrAlt = "QR Code",
    title,
    type,
    description,
    // link,
    className = "",
    createdAt = "N/A",
    updatedAt = "N/A",
    totalScans = 0,
    lastScanned = "N/A",
    typeBadge,
    groupingBadge,
    projectBadge,
    onEdit,
    onSetPassword,
    onShare,
    onPrint,
    onDelete,
    onAssignToGroup,
    onAssignToProject,
  } = props;

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const t = timerRef.current;
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, []);

  // reserved: timerRef used if we later add transient UI feedback

  return (
    <div
      className={`relative overflow-y-auto bg-white rounded-lg shadow-sm p-6 flex gap-6 lg:gap-0 flex-row lg:flex-col ${className}`}
    >
      {/* QR preview and title */}
      <div className="flex flex-col items-center mb-3">
        <QrCode src={qrImageSrc} alt={qrAlt} variant="framed" />
        <h1 className="mt-2 w-full block text-xl md:text-2xl font-semibold text-gray-900 text-center line-clamp-2">
          {type?.includes("procore") ? (
            <img
              src={procoreIcon}
              alt="Procore"
              className="inline w-4 h-4 mb-1 mr-2"
            />
          ) : null}
          {title}
        </h1>
        <div className="mt-3 w-full max-h-20 flex items-start justify-center text-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none overflow-y-auto">
          <label className="sr-only" htmlFor="qr-description">
            Description
          </label>
          <div className="w-full">
            <p id="qr-description" className="text-sm text-gray-800">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0 flex flex-col">
        {/* Horizontal action buttons above summary */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="iconSquare"
            leftIconClass={icons.edit}
            onClick={onEdit}
            className="group relative"
          >
            <span className="sr-only">Edit</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
              Edit
            </span>
          </Button>
          <Button
            type="button"
            variant="iconSquare"
            leftIconClass={icons.lock}
            onClick={onSetPassword}
            className="group relative"
          >
            <span className="sr-only">Set Password</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
              Set Password
            </span>
          </Button>
          {/* <Button type="button" variant="iconSquare" leftIconClass={icons.download} onClick={onDownload} className="group relative">
						<span className="sr-only">Download</span>
						<span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">Download</span>
					</Button> */}
          <Button
            type="button"
            variant="iconSquare"
            leftIconClass="bx bx-share-alt"
            onClick={onShare}
            className="group relative"
          >
            <span className="sr-only">Share</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
              Share
            </span>
          </Button>
          <Button
            type="button"
            variant="iconSquare"
            leftIconClass="bx bx-printer"
            onClick={onPrint}
            className="group relative"
          >
            <span className="sr-only">Print</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
              Print
            </span>
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="iconSquare"
              leftIconClass="bx bx-trash"
              onClick={onDelete}
              className="group relative !ring-red-400 bg-red-50 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <span className="sr-only">Delete</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
                Delete
              </span>
            </Button>
          )}
          {/* <Button
            type="button"
            variant="iconSquare"
            leftIconClass={icons.cog}
            onClick={props.onSettings}
            className="group relative"
          >
            <span className="sr-only">Settings</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 group-hover:translate-y-1">
              Settings
            </span>
          </Button> */}
        </div>

        {/* Details list */}
        {typeBadge ||
        groupingBadge ||
        projectBadge ||
        createdAt ||
        typeof totalScans === "number" ||
        lastScanned ? (
          <div className="mt-4 divide-y divide-gray-200">
            {typeBadge ? (
              <div className="py-2 flex items-center justify-between text-gray-700 gap-6">
                <span className="text-[12px] uppercase tracking-wider font-medium">
                  Type
                </span>
                <Badge variant={typeBadge.variant} shape="md">
                  {typeBadge.label}
                </Badge>
              </div>
            ) : null}
            {groupingBadge && (
              <div className="py-2 flex items-center justify-between text-gray-700 gap-6">
                <span className="text-[12px] uppercase tracking-wider font-medium">
                  Group
                </span>
                {groupingBadge.href ? (
                  <a
                    href={groupingBadge.href}
                    className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
                  >
                    <Badge variant={groupingBadge.variant} shape="md">
                      {groupingBadge.label}
                    </Badge>
                  </a>
                ) : onAssignToGroup ? (
                  <button
                    type="button"
                    onClick={onAssignToGroup}
                    className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
                  >
                    <Badge variant={groupingBadge.variant} shape="md">
                      {groupingBadge.label}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant={groupingBadge.variant} shape="md">
                    {groupingBadge.label}
                  </Badge>
                )}
              </div>
            )}
            {projectBadge && (
              <div className="py-2 flex items-center justify-between text-gray-700 gap-6">
                <span className="text-[12px] uppercase tracking-wider font-medium">
                  Project
                </span>
                {projectBadge.href ? (
                  <a
                    href={projectBadge.href}
                    className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
                  >
                    <Badge variant={projectBadge.variant} shape="md">
                      {projectBadge.label}
                    </Badge>
                  </a>
                ) : onAssignToProject ? (
                  <button
                    type="button"
                    onClick={onAssignToProject}
                    className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
                  >
                    <Badge variant={projectBadge.variant} shape="md">
                      {projectBadge.label}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant={projectBadge.variant} shape="md">
                    {projectBadge.label}
                  </Badge>
                )}
              </div>
            )}
            {updatedAt ? (
              <div className="py-2 flex items-center justify-between text-gray-700">
                <span className="text-[12px] uppercase tracking-wider font-medium">
                  Last Updated
                </span>
                <span className="text-sm text-gray-900">
                  {formatDate(updatedAt === "N/A" ? createdAt : updatedAt)}
                </span>
              </div>
            ) : null}
            {/* {lastScanned ? (
							<div className="py-2 flex items-center justify-between text-gray-700">
								<span className="text-sm">Last Scanned</span>
								<span className="text-sm text-gray-900">{lastScanned}</span>
							</div>
						) : null} */}
          </div>
        ) : null}

        {/* Large summary tile */}
        {typeof totalScans === "number" ? (
          <div className="grow flex flex-col justify-end">
            <div className="mt-4 rounded-lg bg-green-50 border-green-300 border-2 p-2 flex flex-col justify-center">
              <div className="flex items-center justify-center divide-x-2 divide-green-300">
                <div className="pb-2 text-4xl font-semibold text-emerald-600 leading-none pr-2">
                  {totalScans}
                </div>
                <div className="text-left pl-2">
                  <p className="mt-0.5 text-[14px] font-medium text-gray-600 uppercase tracking-wide">
                    Total Scans
                  </p>
                  <p className="mt-0.5 mb-1 text-[11px] text-gray-500">
                    Since {formatDate(createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
