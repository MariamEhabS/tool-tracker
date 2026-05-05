import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import { type Column } from "@/components/table/DataTable";
import {
  type ItemComboBoxOption,
} from "@/components/combobox/detail/ItemComboBox";
import RetireToolModal from "@/components/create-qr/ConfigureView/RetireToolModal";
import type {
  ToolRetirement,
  ToolRetirementReason,
} from "@/components/create-qr/toolTracker/types";
import {
  SAMPLE_GANGS,
  SAMPLE_PROJECTS,
  SAMPLE_STAFF,
  SAMPLE_TOOLS_ARRAY,
  SAMPLE_TOOL_CATEGORIES,
  type SampleGang,
  type SampleToolRecord,
  type SampleToolStatus,
} from "@/data/seed/toolTrackerSeed";
import AddToGangModal from "./AddToGangModal";
import GangToolsModal, { type GangCreatePayload } from "./GangToolsModal";
import GroupedToolsTable from "./GroupedToolsTable";
import MoveToProjectModal from "./MoveToProjectModal";
import ToolDetailModal from "./ToolDetailModal";
import ToolsBulkBar from "./ToolsBulkBar";
import { formatShortDate, toRow } from "./row-transforms";
import type { ToolRow } from "./types";

const STATUS_VARIANT: Record<SampleToolStatus, BadgeVariant> = {
  available: "green",
  out: "blue",
  overdue: "red",
  retired: "slate",
};

const STATUS_FILTER_OPTIONS: { value: SampleToolStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "out", label: "Checked out" },
  { value: "overdue", label: "Overdue" },
  { value: "retired", label: "Retired" },
];

export default function ToolsListPage() {
  const navigate = useNavigate();

  const [tools, setTools] = useState<SampleToolRecord[]>(SAMPLE_TOOLS_ARRAY);
  const [gangs, setGangs] = useState<SampleGang[]>(SAMPLE_GANGS);
  const [gangModalOpen, setGangModalOpen] = useState(false);
  const [collapsedGangIds, setCollapsedGangIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<SampleToolStatus[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [retireTargetId, setRetireTargetId] = useState<string | null>(null);
  const [moveTargetIds, setMoveTargetIds] = useState<string[] | null>(null);
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const [addToGangTargetId, setAddToGangTargetId] = useState<string | null>(
    null,
  );

  const projectsById = useMemo(
    () => Object.fromEntries(SAMPLE_PROJECTS.map((p) => [p.id, p.name])),
    [],
  );

  const rows = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return tools
      .filter((t) => {
        if (statusFilter.length > 0 && !statusFilter.includes(t.status))
          return false;
        if (
          assignedFilter.length > 0 &&
          !assignedFilter.includes(t.assignedTo)
        )
          return false;
        if (projectFilter.length > 0 && !projectFilter.includes(t.projectId))
          return false;
        if (categoryFilter.length > 0 && !categoryFilter.includes(t.category))
          return false;
        if (!term) return true;
        return (
          t.name.toLowerCase().includes(term) ||
          t.manufacturer.toLowerCase().includes(term) ||
          t.model.toLowerCase().includes(term) ||
          t.serial.toLowerCase().includes(term) ||
          t.assignedTo.toLowerCase().includes(term)
        );
      })
      .map((t) => toRow(t, projectsById));
  }, [
    tools,
    searchText,
    statusFilter,
    assignedFilter,
    projectFilter,
    categoryFilter,
    projectsById,
  ]);

  const visibleIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const selectedVisibleCount = useMemo(
    () => Array.from(selectedIds).filter((id) => visibleIds.has(id)).length,
    [selectedIds, visibleIds],
  );

  // Split filtered rows into per-gang groups + standalones for grouped display.
  const { gangGroups, standaloneRows } = useMemo(() => {
    const byGang: Record<string, ToolRow[]> = {};
    const standalone: ToolRow[] = [];
    for (const r of rows) {
      const gangId = r.record.gangId;
      if (gangId && gangs.some((g) => g.id === gangId)) {
        (byGang[gangId] ??= []).push(r);
      } else {
        standalone.push(r);
      }
    }
    const groups = gangs
      .map((g) => ({ gang: g, members: byGang[g.id] ?? [] }))
      // Hide gangs whose members all got filtered out — keeps the grouped
      // display from showing empty cards when a filter is active.
      .filter((grp) => grp.members.length > 0);
    return { gangGroups: groups, standaloneRows: standalone };
  }, [rows, gangs]);

  const selectedToolRecords = useMemo(
    () => tools.filter((t) => selectedIds.has(t.id)),
    [tools, selectedIds],
  );

  const canGangSelection =
    selectedToolRecords.length >= 2 &&
    selectedToolRecords.every((t) => !t.gangId);

  const toggleRow = (row: ToolRow) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handlePerRowMove = (row: ToolRow) => {
    setMoveTargetIds([row.id]);
  };

  const handleBulkMove = () => {
    const ids = Array.from(selectedIds).filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    setMoveTargetIds(ids);
  };

  const applyMove = (projectId: string) => {
    if (!moveTargetIds || moveTargetIds.length === 0) return;
    const targetSet = new Set(moveTargetIds);
    setTools((prev) =>
      prev.map((t) => (targetSet.has(t.id) ? { ...t, projectId } : t)),
    );
    const projectName = projectsById[projectId] ?? "the selected project";
    const count = moveTargetIds.length;
    toast.success(
      `Moved ${count} ${count === 1 ? "tool" : "tools"} to ${projectName}.`,
    );
    setMoveTargetIds(null);
    if (count > 1) clearSelection();
  };

  const handlePerRowRetire = (row: ToolRow) => {
    setRetireTargetId(row.id);
  };

  const applyRetire = (retirement: ToolRetirement) => {
    if (!retireTargetId) return;
    setTools((prev) =>
      prev.map((t) =>
        t.id === retireTargetId
          ? {
              ...t,
              status: "retired",
              retirement: {
                reason: retirement.reason,
                retiredAt: retirement.retiredAt,
                notes: retirement.notes,
              },
            }
          : t,
      ),
    );
    toast.success("Tool retired. History preserved.");
    setRetireTargetId(null);
  };

  const handleRestore = (row: ToolRow) => {
    setTools((prev) =>
      prev.map((t) =>
        t.id === row.id
          ? { ...t, status: "available", retirement: undefined }
          : t,
      ),
    );
    toast.success(`${row.name} restored to active.`);
  };

  // ─── Gang handlers ──────────────────────────────────────────────────────
  const openGangModal = () => {
    if (!canGangSelection) {
      if (selectedToolRecords.some((t) => t.gangId)) {
        toast.error(
          "Some selected tools are already in a gang. Disband first or deselect them.",
        );
      } else {
        toast.error("Select at least 2 tools to gang.");
      }
      return;
    }
    setGangModalOpen(true);
  };

  const handleGangCreate = (payload: GangCreatePayload) => {
    const newGangId = `gang-${Date.now()}`;
    const memberIds = new Set(
      selectedToolRecords.map((t) => t.id),
    );
    const newGang: SampleGang = {
      id: newGangId,
      name: payload.name,
      foreman: payload.foreman,
      createdAt: new Date().toISOString(),
    };
    setGangs((prev) => [...prev, newGang]);
    setTools((prev) =>
      prev.map((t) => {
        if (!memberIds.has(t.id)) return t;
        const next: SampleToolRecord = { ...t, gangId: newGangId };
        if (payload.ownerStrategy === "reassign" && payload.reassignTo) {
          next.assignedTo = payload.reassignTo;
        }
        return next;
      }),
    );
    setGangModalOpen(false);
    clearSelection();
    toast.success(
      `Created gang "${payload.name}" with ${memberIds.size} tools.`,
    );
  };

  const handleGangDisband = (gangId: string) => {
    const gang = gangs.find((g) => g.id === gangId);
    if (!gang) return;
    setTools((prev) =>
      prev.map((t) =>
        t.gangId === gangId ? { ...t, gangId: undefined } : t,
      ),
    );
    setGangs((prev) => prev.filter((g) => g.id !== gangId));
    toast.success(`Disbanded "${gang.name}". Tools are standalone again.`);
  };

  const handleAddToGang = (row: ToolRow) => {
    if (gangs.length === 0) {
      toast(
        "No gangs exist yet. Select 2+ tools and click Gang tools… to create one.",
        { icon: "💡" },
      );
      return;
    }
    setAddToGangTargetId(row.id);
  };

  const applyAddToGang = (payload: {
    gangId: string;
    reassignTo?: string;
  }) => {
    if (!addToGangTargetId) return;
    const targetId = addToGangTargetId;
    const tool = tools.find((t) => t.id === targetId);
    const gang = gangs.find((g) => g.id === payload.gangId);
    if (!tool || !gang) return;
    setTools((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
              ...t,
              gangId: payload.gangId,
              ...(payload.reassignTo
                ? { assignedTo: payload.reassignTo }
                : {}),
            }
          : t,
      ),
    );
    setAddToGangTargetId(null);
    if (payload.reassignTo && payload.reassignTo !== tool.assignedTo) {
      toast.success(
        `Added ${tool.name} to "${gang.name}" and reassigned to ${payload.reassignTo}.`,
      );
    } else {
      toast.success(`Added ${tool.name} to "${gang.name}".`);
    }
  };

  const handleRemoveFromGang = (row: ToolRow) => {
    const gangId = row.record.gangId;
    if (!gangId) return;
    const gang = gangs.find((g) => g.id === gangId);
    if (!gang) return;
    const remaining = tools.filter(
      (t) => t.gangId === gangId && t.id !== row.id,
    );
    setTools((prev) =>
      prev.map((t) =>
        t.id === row.id ? { ...t, gangId: undefined } : t,
      ),
    );
    // A gang of fewer than 2 tools serves no purpose — mirror the
    // "min 2 to create" rule on removal and auto-disband.
    if (remaining.length < 2) {
      setTools((prev) =>
        prev.map((t) =>
          t.gangId === gangId ? { ...t, gangId: undefined } : t,
        ),
      );
      setGangs((prev) => prev.filter((g) => g.id !== gangId));
      toast.success(
        `Removed ${row.name} from "${gang.name}" — gang disbanded (needs at least 2 tools).`,
      );
    } else {
      toast.success(`Removed ${row.name} from "${gang.name}".`);
    }
  };

  const handleGangMove = (gangId: string) => {
    const memberIds = tools
      .filter((t) => t.gangId === gangId)
      .map((t) => t.id);
    if (memberIds.length === 0) return;
    setMoveTargetIds(memberIds);
  };

  const toggleGangCollapsed = (gangId: string) => {
    setCollapsedGangIds((prev) => {
      const next = new Set(prev);
      if (next.has(gangId)) next.delete(gangId);
      else next.add(gangId);
      return next;
    });
  };

  const handleBulkRetire = () => {
    const ids = Array.from(selectedIds).filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const reason: ToolRetirementReason = "other";
    const idSet = new Set(ids);
    setTools((prev) =>
      prev.map((t) =>
        idSet.has(t.id) && t.status !== "retired"
          ? {
              ...t,
              status: "retired",
              retirement: {
                reason,
                retiredAt: today,
                notes: "Retired via bulk action.",
              },
            }
          : t,
      ),
    );
    toast.success(
      `Retired ${ids.length} ${ids.length === 1 ? "tool" : "tools"}. Use the per-row Retire action to capture a reason.`,
    );
    clearSelection();
  };

  const retireTargetName = useMemo(() => {
    if (!retireTargetId) return "";
    return tools.find((t) => t.id === retireTargetId)?.name ?? "";
  }, [retireTargetId, tools]);

  const moveCurrentProjectId = useMemo(() => {
    if (!moveTargetIds || moveTargetIds.length !== 1) return undefined;
    return tools.find((t) => t.id === moveTargetIds[0])?.projectId;
  }, [moveTargetIds, tools]);

  const columns: Column<ToolRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Tool",
        sortable: true,
        columnType: "primary",
        render: (r) => (
          <div className="min-w-0">
            <div
              className="truncate text-sm font-medium text-gray-900"
              title={r.name}
            >
              {r.name}
            </div>
            <div
              className="truncate text-xs text-gray-500"
              title={`${r.manufacturer} · ${r.model}`}
            >
              {r.manufacturer} · {r.model}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        columnType: "status",
        render: (r) => {
          // Tools that belong to a gang display as "Ganged" — the gang
          // itself is the unit of work. The underlying status (available/
          // out/overdue) still drives row tinting and the Due back column,
          // and is fully shown in the detail modal.
          if (r.record.gangId) {
            return (
              <Badge variant="orange" shape="full">
                Ganged
              </Badge>
            );
          }
          return (
            <Badge variant={STATUS_VARIANT[r.status]} shape="full">
              {r.statusLabel}
            </Badge>
          );
        },
      },
      {
        key: "assignedTo",
        header: "Assigned to",
        sortable: true,
        columnType: "secondary",
        render: (r) => (
          <span className="truncate text-sm text-gray-700" title={r.assignedTo}>
            {r.assignedTo}
          </span>
        ),
      },
      {
        key: "projectName",
        header: "Project",
        sortable: true,
        columnType: "project",
        render: (r) => (
          <span
            className="truncate text-sm text-gray-700"
            title={r.projectName}
          >
            {r.projectName}
          </span>
        ),
      },
      {
        key: "category",
        header: "Category",
        sortable: true,
        columnType: "secondary",
        render: (r) => (
          <span className="truncate text-sm text-gray-700" title={r.category}>
            {r.category}
          </span>
        ),
      },
      {
        key: "dueBackAt",
        header: "Due back",
        sortable: true,
        columnType: "date",
        render: (r) => <DueBackCell row={r} />,
        // Sort: overdue/out tools first by date; tools with no due date sink
        // to the bottom regardless of sort direction.
        getSortValue: (r) =>
          r.dueBackAt ? new Date(r.dueBackAt) : new Date(8640000000000000),
      },
    ],
    [],
  );

  return (
    <div className="grow flex flex-col p-8 overflow-y-auto min-h-0">
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <i className="bx bx-wrench text-green-600 mr-2"></i>
            Tools
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Every tool you've created, with its status, owner, and project.
            Sort, filter, and act on a row — or batch-move a whole kit between
            projects.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          leftIconClass="bx bx-plus"
          onClick={() =>
            navigate({
              to: "/create-qr",
              search: { step: 2, typeId: "tool-tracker" } as never,
            })
          }
          data-testid="tools-create-cta"
        >
          Create tool
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="flex-1 min-w-[220px]">
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              placeholder="Search by name, serial, manufacturer, or staff…"
            />
          </div>
          <FilterCombo
            label="Status"
            options={STATUS_FILTER_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={statusFilter}
            onChange={(next) => setStatusFilter(next as SampleToolStatus[])}
            testId="tools-filter-status"
          />
          <FilterCombo
            label="Assigned to"
            options={SAMPLE_STAFF.map((s) => ({ value: s, label: s }))}
            value={assignedFilter}
            onChange={(next) => setAssignedFilter(next as string[])}
            testId="tools-filter-assigned"
          />
          <FilterCombo
            label="Project"
            options={SAMPLE_PROJECTS.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            value={projectFilter}
            onChange={(next) => setProjectFilter(next as string[])}
            testId="tools-filter-project"
          />
          <FilterCombo
            label="Category"
            options={SAMPLE_TOOL_CATEGORIES.filter(
              (c) => c !== "Uncategorized",
            ).map((c) => ({ value: c, label: c }))}
            value={categoryFilter}
            onChange={(next) => setCategoryFilter(next as string[])}
            testId="tools-filter-category"
          />
          {(statusFilter.length > 0 ||
            assignedFilter.length > 0 ||
            projectFilter.length > 0 ||
            categoryFilter.length > 0 ||
            searchText.trim() !== "") && (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              onClick={() => {
                setStatusFilter([]);
                setAssignedFilter([]);
                setProjectFilter([]);
                setCategoryFilter([]);
                setSearchText("");
              }}
              data-testid="tools-filters-clear"
            >
              Clear filters
            </button>
          )}
        </div>

        <GroupedToolsTable
          columns={columns}
          gangs={gangGroups}
          standaloneRows={standaloneRows}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onRowClick={(r) => setDetailTargetId(r.id)}
          rowClassName={dueBackRowClass}
          collapsedGangIds={collapsedGangIds}
          onToggleGangCollapsed={toggleGangCollapsed}
          buildRowActions={(r) =>
            buildRowActions(r, {
              onView: () => setDetailTargetId(r.id),
              onEdit: () => toast("Edit flow coming soon.", { icon: "✏️" }),
              onPrint: () => toast("Print QR coming soon.", { icon: "🖨️" }),
              onMove: () => handlePerRowMove(r),
              onRetire: () => handlePerRowRetire(r),
              onRestore: () => handleRestore(r),
              onRemoveFromGang: () => handleRemoveFromGang(r),
              onAddToGang: () => handleAddToGang(r),
              hasGangs: gangs.length > 0,
            })
          }
          buildGangActions={(g) => [
            {
              label: "Move all to project…",
              value: "move-all",
              iconClass: "bx bx-folder-open",
              onSelect: () => handleGangMove(g.id),
            },
            {
              label: "Disband gang",
              value: "disband",
              iconClass: "bx bx-unlink",
              onSelect: () => handleGangDisband(g.id),
            },
          ]}
        />

        <div className="mt-4 text-xs text-gray-500" data-testid="tools-count">
          Showing {rows.length} of {tools.length} tools
          {gangGroups.length > 0
            ? ` · ${gangGroups.length} gang${gangGroups.length === 1 ? "" : "s"}`
            : ""}
          {selectedVisibleCount > 0
            ? ` · ${selectedVisibleCount} selected`
            : ""}
        </div>
      </div>

      <ToolsBulkBar
        selectedCount={selectedVisibleCount}
        onMoveToProject={handleBulkMove}
        onRetireSelected={handleBulkRetire}
        onGangSelected={openGangModal}
        canGang={canGangSelection}
        onClear={clearSelection}
      />

      <RetireToolModal
        open={!!retireTargetId}
        toolName={retireTargetName}
        onClose={() => setRetireTargetId(null)}
        onConfirm={applyRetire}
      />

      <MoveToProjectModal
        open={!!moveTargetIds}
        count={moveTargetIds?.length ?? 0}
        currentProjectId={moveCurrentProjectId}
        onClose={() => setMoveTargetIds(null)}
        onConfirm={applyMove}
      />

      <GangToolsModal
        open={gangModalOpen}
        tools={selectedToolRecords}
        onClose={() => setGangModalOpen(false)}
        onConfirm={handleGangCreate}
      />

      <AddToGangModal
        open={!!addToGangTargetId}
        tool={
          addToGangTargetId
            ? (tools.find((t) => t.id === addToGangTargetId) ?? null)
            : null
        }
        gangs={gangs}
        allTools={tools}
        onClose={() => setAddToGangTargetId(null)}
        onConfirm={applyAddToGang}
      />

      <ToolDetailModal
        open={!!detailTargetId}
        tool={
          detailTargetId
            ? (tools.find((t) => t.id === detailTargetId) ?? null)
            : null
        }
        projectName={
          detailTargetId
            ? (projectsById[
                tools.find((t) => t.id === detailTargetId)?.projectId ?? ""
              ] ?? "—")
            : "—"
        }
        onClose={() => setDetailTargetId(null)}
        onEdit={() => toast("Edit flow coming soon.", { icon: "✏️" })}
        onPrint={() => toast("Print QR coming soon.", { icon: "🖨️" })}
        onMove={() => {
          if (detailTargetId) {
            setMoveTargetIds([detailTargetId]);
            setDetailTargetId(null);
          }
        }}
        onRetire={() => {
          if (detailTargetId) {
            setRetireTargetId(detailTargetId);
            setDetailTargetId(null);
          }
        }}
        onRestore={() => {
          if (!detailTargetId) return;
          const row = rows.find((r) => r.id === detailTargetId);
          if (row) handleRestore(row);
          setDetailTargetId(null);
        }}
        onReceiptChange={(receipt) => {
          if (!detailTargetId) return;
          setTools((prev) =>
            prev.map((t) =>
              t.id === detailTargetId
                ? { ...t, receipt: receipt ?? undefined }
                : t,
            ),
          );
          toast.success(
            receipt ? "Receipt attached." : "Receipt removed.",
          );
        }}
      />
    </div>
  );
}

type DueBackState = "overdue" | "soon" | "future" | "none";

interface DueBackInfo {
  state: DueBackState;
  /** Negative when overdue, 0 = today, 1 = tomorrow, etc. */
  daysDiff: number | null;
}

function getDueBackInfo(row: ToolRow): DueBackInfo {
  if (!row.dueBackAt) return { state: "none", daysDiff: null };
  const due = new Date(row.dueBackAt);
  if (Number.isNaN(due.getTime())) return { state: "none", daysDiff: null };
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (due.getTime() - startOfToday.getTime()) / dayMs,
  );
  if (row.status === "overdue" || daysDiff < 0) {
    return { state: "overdue", daysDiff };
  }
  if (daysDiff <= 1) return { state: "soon", daysDiff };
  return { state: "future", daysDiff };
}

function dueBackRowClass(row: ToolRow): string {
  switch (getDueBackInfo(row).state) {
    case "overdue":
      return "bg-red-50/70 hover:bg-red-100/70";
    case "soon":
      return "bg-yellow-50/70 hover:bg-yellow-100/70";
    default:
      return "";
  }
}

function DueBackCell({ row }: { row: ToolRow }) {
  const { state, daysDiff } = getDueBackInfo(row);
  if (state === "none" || daysDiff === null) {
    return <span className="text-gray-400">—</span>;
  }

  let label: string;
  if (daysDiff < 0) {
    const days = Math.abs(daysDiff);
    label = `${days} day${days === 1 ? "" : "s"} overdue`;
  } else if (daysDiff === 0) {
    label = "Due today";
  } else if (daysDiff === 1) {
    label = "Due tomorrow";
  } else {
    label = `In ${daysDiff} days`;
  }

  const tone =
    state === "overdue"
      ? "text-red-700 font-semibold"
      : state === "soon"
        ? "text-yellow-800 font-semibold"
        : "text-gray-700";

  return (
    <span className={tone} title={formatShortDate(row.dueBackAt!)}>
      {label}
    </span>
  );
}

interface FilterComboProps {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  testId: string;
}

function FilterCombo({
  label,
  options,
  value,
  onChange,
  testId,
}: FilterComboProps) {
  return (
    <div className="min-w-[160px]" data-testid={testId}>
      <SearchComboBox
        options={options}
        multiple
        value={value}
        onChange={(next) => {
          if (Array.isArray(next)) {
            onChange(next.filter((v): v is string => typeof v === "string"));
          } else if (next === undefined) {
            onChange([]);
          }
        }}
        placeholder={label}
        allowCustomValue={false}
        usePortal
      />
    </div>
  );
}

interface RowActionHandlers {
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onMove: () => void;
  onRetire: () => void;
  onRestore: () => void;
  onRemoveFromGang: () => void;
  onAddToGang: () => void;
  /** Whether at least one existing gang is available to add to. Hides
   * the "Add to gang…" option when false (the user should bulk-create
   * a gang first). */
  hasGangs: boolean;
}

function buildRowActions(
  row: ToolRow,
  handlers: RowActionHandlers,
): ItemComboBoxOption[] {
  const isRetired = row.status === "retired";
  const options: ItemComboBoxOption[] = [
    {
      label: "View detail",
      value: "view",
      iconClass: "bx bx-show",
      onSelect: handlers.onView,
    },
    {
      label: "Edit…",
      value: "edit",
      iconClass: "bx bx-pencil",
      onSelect: handlers.onEdit,
    },
    {
      label: "Print QR",
      value: "print",
      iconClass: "bx bx-printer",
      onSelect: handlers.onPrint,
    },
    {
      label: "Move to project…",
      value: "move",
      iconClass: "bx bx-folder-open",
      onSelect: handlers.onMove,
    },
  ];
  if (row.record.gangId) {
    options.push({
      label: "Remove from gang",
      value: "remove-from-gang",
      iconClass: "bx bx-minus-circle",
      onSelect: handlers.onRemoveFromGang,
    });
  } else if (handlers.hasGangs && !isRetired) {
    options.push({
      label: "Add to gang…",
      value: "add-to-gang",
      iconClass: "bx bx-collection",
      onSelect: handlers.onAddToGang,
    });
  }
  if (isRetired) {
    options.push({
      label: "Restore to active",
      value: "restore",
      iconClass: "bx bx-undo",
      onSelect: handlers.onRestore,
    });
  } else {
    options.push({
      label: "Retire tool…",
      value: "retire",
      iconClass: "bx bx-archive-in",
      onSelect: handlers.onRetire,
    });
  }
  return options;
}
