/**
 * @fileoverview Hook that constructs table configurations for all Procore tool
 * views (Documents, Drawings, RFIs, Submittals, Punch List, etc.) and bundles
 * them into a single lookup object.
 */

import { useMemo } from "react";
import { getProcoreCoordinationIssuesTable } from "@components/table/procore/ProcoreCoordinationIssuesTable";
import { getProcoreDirectoryTable } from "@components/table/procore/ProcoreDirectoryTable";
import { getProcoreDocumentsTable } from "@components/table/procore/ProcoreDocumentsTable";
import { getProcoreDrawingsTable } from "@components/table/procore/ProcoreDrawingsTable";
import { getProcoreFormsTable } from "@components/table/procore/ProcoreFormsTable";
import { getProcoreIncidentsTable } from "@components/table/procore/ProcoreIncidentsTable";
import { getProcoreInspectionsTable } from "@components/table/procore/ProcoreInspectionsTable";
import { getProcoreInstructionsTable } from "@components/table/procore/ProcoreInstructionsTable";
import { getProcoreObservationsTable } from "@components/table/procore/ProcoreObservationsTable";
import { getProcorePhotosTable } from "@components/table/procore/ProcorePhotosTable";
import { getProcorePunchListTable } from "@components/table/procore/ProcorePunchListTable";
import { getProcoreRFIsTable } from "@components/table/procore/ProcoreRFIsTable";
import { getProcoreSpecificationsTable } from "@components/table/procore/ProcoreSpecificationsTable";
import { getProcoreSubmittalsTable } from "@components/table/procore/ProcoreSubmittalsTable";
import { getProcoreTasksTable } from "@components/table/procore/ProcoreTasksTable";

/**
 * Builds memoized table configurations for every Procore tool type
 * (Coordination Issues, Directory, Documents, Drawings, Forms, Incidents,
 * Inspections, Instructions, Observations, Photos, Punch List, RFIs,
 * Specifications, Submittals, Tasks) and returns them as a keyed bundle map.
 *
 * Each bundle includes rows, columns, and a `getRowId` function that the
 * parent table component can consume. Action callbacks for hide/remove/show
 * and preview are wired into each table configuration.
 *
 * @param params - Configuration object
 * @param params.id - The QR code ID used for Procore data lookups
 * @param params.activeProcoreFolderId - Currently-selected Procore Documents folder ID
 * @param params.hiddenIds - Set of row IDs currently hidden from the table
 * @param params.shownIds - Set of row IDs explicitly shown in the table
 * @param params.onAction - Callback for hide/remove/show actions on a row
 * @param params.onRemove - Callback when a row is removed
 * @param params.onShow - Callback when a hidden row is re-shown
 * @param params.onPreview - Callback to open the preview panel for a row
 * @returns An object containing:
 *   - `procoreDocumentsTable` - Table configuration for Procore Documents specifically
 *   - `procoreBundles` - Record mapping each Procore tool name to its table configuration
 */
export function useProcoreViewState(params: {
  id: string;
  activeProcoreFolderId: number | null;
  hiddenIds: Set<string>;
  shownIds: Set<string>;
  onAction: (itemId: string, action: "hide" | "remove" | "show") => void;
  onRemove: (itemId: string) => void;
  onShow: (itemId: string) => void;
  onPreview: (
    row: unknown,
    kind:
      | "Directory"
      | "Drawings"
      | "Forms"
      | "Incidents"
      | "Inspections"
      | "Instructions"
      | "Observations"
      | "Photos"
      | "Punch List"
      | "RFIs"
      | "Submittals"
      | "Tasks",
  ) => void;
}) {
  const {
    id,
    activeProcoreFolderId,
    hiddenIds,
    shownIds,
    onAction,
    onRemove,
    onShow,
    onPreview,
  } = params;

  const procoreDocumentsTable = useMemo(
    () =>
      getProcoreDocumentsTable({
        qrId: id,
        activeFolderId: activeProcoreFolderId ?? undefined,
        onAction,
        onRemove,
        onShow,
        hiddenIds,
      }),
    [id, activeProcoreFolderId, hiddenIds, onAction, onRemove, onShow],
  );

  const procoreBundles = useMemo(
    () =>
      ({
        "Coordination Issues": getProcoreCoordinationIssuesTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          hiddenIds,
          shownIds,
        }),
        Directory: getProcoreDirectoryTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                name: row.name,
                title: row.title,
                company: row.company,
                trade: row.trade,
                phone: row.phone,
                email: row.email,
              },
              "Directory",
            ),
          hiddenIds,
          shownIds,
        }),
        Documents: procoreDocumentsTable,
        Drawings: getProcoreDrawingsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                number: row.number,
                title: row.title,
                revision: row.revision,
                area: row.area,
                discipline: row.discipline,
                date: row.date,
              },
              "Drawings",
            ),
          hiddenIds,
          shownIds,
        }),
        Forms: getProcoreFormsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id,
                title: row.title,
                template: row.template,
                status: row.status?.label ?? "Unknown",
                assignedTo: row.assignedTo,
                modified: row.modified,
              },
              "Forms",
            ),
          hiddenIds,
          shownIds,
        }),
        Incidents: getProcoreIncidentsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id.split("-")[0],
                title: row.title,
                status: row.status?.label ?? "Unknown",
                recordable: row.recordable,
                location: row.location,
                occurred: row.occurred,
              },
              "Incidents",
            ),
          hiddenIds,
          shownIds,
        }),
        Inspections: getProcoreInspectionsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                type: row.type?.label ?? "Unknown",
                location: row.location,
                inspector: row.inspector,
                date: row.date,
              },
              "Inspections",
            ),
          hiddenIds,
          shownIds,
        }),
        Instructions: getProcoreInstructionsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.procoreId,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                assignee: row.assignee,
                due: row.due,
              },
              "Instructions",
            ),
          hiddenIds,
          shownIds,
        }),
        Observations: getProcoreObservationsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                priority: row.priority?.label ?? "Unknown",
                type: row.type?.label ?? "Unknown",
                due: row.due,
              },
              "Observations",
            ),
          hiddenIds,
          shownIds,
        }),
        Photos: getProcorePhotosTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                priority: row.priority?.label ?? "Unknown",
                type: row.type?.label ?? "Unknown",
                date: row.due,
              },
              "Photos",
            ),
          hiddenIds,
          shownIds,
        }),
        "Punch List": getProcorePunchListTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.procoreId || row.position,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                location: row.location,
                assignee: row.assignee,
                due: row.due,
              },
              "Punch List",
            ),
          hiddenIds,
          shownIds,
        }),
        RFIs: getProcoreRFIsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.procoreId ?? row.rfi,
                subject: row.subject,
                rfi: row.rfi,
                status: row.status?.label ?? "Unknown",
                assignee: row.assignee,
                received: row.received,
                due: row.due,
              },
              "RFIs",
            ),
          hiddenIds,
          shownIds,
        }),
        Specifications: getProcoreSpecificationsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: () => undefined,
          hiddenIds,
          shownIds,
        }),
        Submittals: getProcoreSubmittalsTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                number: row.number,
                title: row.title,
                sub: row.sub,
                status: row.status?.label ?? "Unknown",
                ball: row.ball,
                type: row.type,
                received: row.received,
                due: row.due?.label ?? "—",
              },
              "Submittals",
            ),
          hiddenIds,
          shownIds,
        }),
        Tasks: getProcoreTasksTable({
          qrId: id,
          onAction,
          onRemove,
          onShow,
          onPreview: (row) =>
            onPreview(
              {
                id: row.id,
                title: row.title,
                status: row.status?.label ?? "Unknown",
                assignee: row.assignee,
                location: row.location,
                due: row.due,
              },
              "Tasks",
            ),
          hiddenIds,
          shownIds,
        }),
      }) as const,
    [
      id,
      procoreDocumentsTable,
      hiddenIds,
      shownIds,
      onAction,
      onRemove,
      onShow,
      onPreview,
    ],
  );

  return { procoreDocumentsTable, procoreBundles };
}
