import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import Modal from "@components/modal/Modal";
import Button from "@components/ui/Button";
import Badge from "@components/ui/Badge";
import DataTable from "@components/table/DataTable";
import type { Column } from "@components/table/DataTable";
import {
  csvImportPreview,
  csvImportPreviewStream,
  csvImportSave,
  type CsvImportProgressEvent,
  type CsvImportPreviewResponse,
  type CsvImportMatchedItem,
  type CsvImportUnmatchedItem,
  type CsvImportAlreadyLinkedItem,
} from "@api/endpoints/csv-import";

// --- Props ------------------------------------------------------------------

type CSVImportModalProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  projectId: string;
  context: "qr" | "group" | "project";
  contextId: string;
  onConfirmed: (result: { created: number }) => void;
};

// --- State machine ----------------------------------------------------------

type ModalPhase = "idle" | "uploading" | "preview" | "saving" | "done";

// --- Column definitions -----------------------------------------------------

const matchedColumns: Column<CsvImportMatchedItem>[] = [
  {
    key: "rowIndex",
    header: "Row",
    columnType: "number",
    className: "whitespace-nowrap",
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">{row.rowIndex}</span>
    ),
  },
  {
    key: "qrCodeName",
    header: "QR Code",
    columnType: "secondary",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap font-medium text-gray-900"
        title={row.qrCodeName}
      >
        {row.qrCodeName}
      </span>
    ),
  },
  {
    key: "tool",
    header: "Tool",
    columnType: "secondary",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap text-gray-700"
        title={row.procoreToolName}
      >
        {row.procoreToolName}
      </span>
    ),
  },
  {
    key: "csvIdentifier",
    header: "Identifier",
    columnType: "text",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap text-gray-700"
        title={row.csvIdentifier}
      >
        {row.csvIdentifier}
      </span>
    ),
  },
  {
    key: "procoreItemTitle",
    header: "Procore Title",
    columnType: "primary",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap text-gray-900"
        title={row.procoreItemTitle}
      >
        {row.procoreItemTitle}
      </span>
    ),
  },
];

const unmatchedColumns: Column<CsvImportUnmatchedItem>[] = [
  {
    key: "rowIndex",
    header: "Row",
    columnType: "number",
    className: "whitespace-nowrap",
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">{row.rowIndex}</span>
    ),
  },
  {
    key: "qrCodeName",
    header: "QR Code",
    columnType: "secondary",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap font-medium text-gray-900"
        title={row.qrCodeName}
      >
        {row.qrCodeName}
      </span>
    ),
  },
  {
    key: "tool",
    header: "Tool",
    columnType: "secondary",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap text-gray-700"
        title={row.tool}
      >
        {row.tool}
      </span>
    ),
  },
  {
    key: "csvIdentifier",
    header: "Identifier",
    columnType: "text",
    className: "whitespace-nowrap",
    render: (row) => (
      <span
        className="block max-w-full truncate whitespace-nowrap text-gray-700"
        title={row.csvIdentifier}
      >
        {row.csvIdentifier}
      </span>
    ),
  },
  {
    key: "reason",
    header: "Reason",
    columnType: "text",
    className: "whitespace-nowrap",
    render: (row) => {
      const labels: Record<CsvImportUnmatchedItem["reason"], string> = {
        no_match: "No match found",
        qr_not_found: "QR code not found",
        qr_not_in_scope: "QR code out of scope",
        private: "Private in Procore",
      };
      const badgeVariant = row.reason === "private" ? "orange" : "red";
      return (
        <Badge
          variant={badgeVariant}
          shape="full"
          className="whitespace-nowrap"
        >
          {labels[row.reason]}
        </Badge>
      );
    },
  },
];

// --- Component --------------------------------------------------------------

export default function CSVImportModal({
  open,
  onClose,
  companyId,
  projectId,
  context,
  contextId,
  onConfirmed,
}: CSVImportModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] =
    useState<CsvImportPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgressPct, setUploadProgressPct] = useState(0);
  const [uploadStageMessage, setUploadStageMessage] =
    useState("Preparing file...");
  const [uploadUsingFallback, setUploadUsingFallback] = useState(false);
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const [matchedExpanded, setMatchedExpanded] = useState(true);
  const [unmatchedExpanded, setUnmatchedExpanded] = useState(false);
  const [alreadyLinkedExpanded, setAlreadyLinkedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Reset state when modal closes ---------------------------------------

  function resetState() {
    setPhase("idle");
    setFile(null);
    setPreviewData(null);
    setErrorMessage(null);
    setUploadProgressPct(0);
    setUploadStageMessage("Preparing file...");
    setUploadUsingFallback(false);
    setIsCsvDragging(false);
    setMatchedExpanded(true);
    setUnmatchedExpanded(false);
    setAlreadyLinkedExpanded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    resetState();
    onClose();
  }

  // -- Upload & Preview ----------------------------------------------------

  async function handleUploadPreview() {
    if (!file) return;
    setPhase("uploading");
    setErrorMessage(null);
    setUploadUsingFallback(false);
    setUploadProgressPct(2);
    setUploadStageMessage("Uploading file...");

    const updateProgress = (event: CsvImportProgressEvent) => {
      const nextPercent = Math.max(
        0,
        Math.min(100, Math.round(event.progress * 100)),
      );
      setUploadProgressPct((prev) => (nextPercent < prev ? prev : nextPercent));
      setUploadStageMessage(event.message || "Processing CSV import...");
    };

    try {
      const result = await csvImportPreviewStream(
        {
          file,
          companyId,
          projectId,
          context,
          contextId,
        },
        {
          onProgress: updateProgress,
        },
      );
      setUploadProgressPct(100);
      setUploadStageMessage("Preview ready.");
      setPreviewData(result);
      setPhase("preview");
    } catch {
      setUploadUsingFallback(true);
      setUploadProgressPct((prev) => (prev < 15 ? 15 : prev));
      setUploadStageMessage("Streaming unavailable. Finishing import...");

      try {
        const result = await csvImportPreview({
          file,
          companyId,
          projectId,
          context,
          contextId,
        });
        setUploadProgressPct(100);
        setUploadStageMessage("Preview ready.");
        setPreviewData(result);
        setPhase("preview");
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to process the file. Please check the format and try again.";
        setErrorMessage(message);
        setPhase("idle");
      }
    }
  }

  // -- Save matched items --------------------------------------------------

  async function handleSave() {
    if (!previewData || previewData.matched.length === 0) return;
    setPhase("saving");

    try {
      const result = await csvImportSave({
        companyId,
        projectId,
        items: previewData.matched.map((m) => ({
          qrCodeId: m.qrCodeId,
          procoreToolName: m.procoreToolName,
          procoreItemID: m.procoreItemID,
        })),
      });
      setPhase("done");
      onConfirmed(result);
      handleClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save items. Please try again.";
      toast.error(message);
      setPhase("preview");
    }
  }

  // -- File input handler --------------------------------------------------

  function isAcceptedFileType(fileName: string) {
    const lowerName = fileName.toLowerCase();
    return (
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls")
    );
  }

  function setSelectedFile(nextFile: File | null) {
    setFile(nextFile);
    setErrorMessage(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    if (!isAcceptedFileType(selected.name)) {
      setErrorMessage("Please select a .csv, .xlsx, or .xls file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
      return;
    }
    setSelectedFile(selected);
  }

  function handleCsvDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);

    if (phase === "uploading") return;
    const droppedFile = e.dataTransfer?.files?.[0] ?? null;
    if (!droppedFile) return;
    if (!isAcceptedFileType(droppedFile.name)) {
      setErrorMessage("Please drop a .csv, .xlsx, or .xls file.");
      return;
    }

    try {
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        fileInputRef.current.files = dt.files;
      }
    } catch {
      // Ignore environments that disallow programmatic FileList assignment.
    }

    setSelectedFile(droppedFile);
  }

  function handleCsvDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (phase !== "uploading") setIsCsvDragging(true);
  }

  function handleCsvDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (phase !== "uploading") setIsCsvDragging(true);
  }

  function handleCsvDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);
  }

  // -- Template download -------------------------------------------------

  function downloadTemplate() {
    const toCsvCell = (value: string) => {
      return `"${value.replace(/"/g, '""')}"`;
    };
    const toCsvRow = (values: string[]) => values.map(toCsvCell).join(",");

    const headers = [
      "QR Code Name",
      "Coordination Issues - Number",
      "Directory - Email",
      "Directory - Name",
      "Documents - Folder",
      "Documents - Name",
      "Drawings - Area",
      "Drawings - Number",
      "Forms - Title",
      "Incidents - Number",
      "Inspections - Identifier",
      "Instructions - Number",
      "Observations - Number",
      "Photos - File Name",
      "Punch List - Number",
      "RFIs - Number",
      "Specifications - Number",
      "Submittals - Number",
      "Tasks - Number",
    ];
    const exampleRow = [
      "2001",
      "5",
      "m.smith@taliho.com",
      "Morty Smith",
      "Safety",
      "budget.xlsx",
      "South Building",
      "A102B, A111",
      "Daily Checklist",
      "1, 2, 3",
      "VAV-05-77",
      "7, 12, 15",
      "5, 6, 8",
      "site-progress.jpg",
      "10",
      "247, 136",
      "06 10 00, 08 11 00",
      "08 70 00-9",
      "5, 10",
    ];
    const csv = [toCsvRow(headers), toCsvRow(exampleRow)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "procore_fetch_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // -- QR code warning banners ---------------------------------------------

  function renderQrWarnings() {
    if (!previewData) return null;
    const { qrCodesNotFound, qrCodesOutOfScope } = previewData.summary;
    const hasNotFound = qrCodesNotFound.length > 0;
    const hasOutOfScope = qrCodesOutOfScope.length > 0;
    if (!hasNotFound && !hasOutOfScope) return null;

    return (
      <div className="space-y-2">
        {hasNotFound && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <div className="flex items-start gap-2">
              <i className="bx bx-error text-yellow-600 text-lg flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">QR codes not found:</p>
                <p className="mt-1 text-yellow-700">
                  {qrCodesNotFound.join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}
        {hasOutOfScope && (
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
            <div className="flex items-start gap-2">
              <i className="bx bx-error text-orange-600 text-lg flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">QR codes out of scope:</p>
                <p className="mt-1 text-orange-700">
                  {qrCodesOutOfScope.join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -- Render body content by phase ----------------------------------------

  function renderBody() {
    const accordionAnimationDuration = 0.25;

    if (phase === "uploading") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-amber-100">
                <i className="bx bx-loader-alt bx-spin text-xl text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  Processing CSV import
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {uploadStageMessage}
                </p>
                {uploadUsingFallback && (
                  <p className="mt-1 text-xs text-amber-700">
                    Live progress is unavailable. Continuing with standard
                    upload.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Import Progress
              </span>
              <span className="text-xs font-semibold text-gray-700">
                {uploadProgressPct}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300 ease-out"
                style={{ width: `${uploadProgressPct}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Please keep this window open while Procore data is fetched and rows
            are matched.
          </p>
        </div>
      );
    }

    // Idle phase
    if (phase === "idle") {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select a CSV or Excel file
            </label>
            <div
              onDragEnter={handleCsvDragEnter}
              onDragOver={handleCsvDragOver}
              onDragLeave={handleCsvDragLeave}
              onDrop={handleCsvDrop}
              onClick={() => {
                fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`w-full rounded-md border-2 border-dashed px-4 py-3 transition duration-150 ease-in-out cursor-pointer flex items-center gap-4 ${isCsvDragging ? "border-yellow-400 bg-yellow-50/40" : "border-gray-300 hover:border-gray-400"}`}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <i className="bx bx-cloud-upload text-xl text-gray-500"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-yellow-700">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </p>
                {file ? (
                  <p className="text-xs text-green-700 truncate">
                    Selected: {file.name}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Only .csv, .xlsx, and .xls files are accepted
                  </p>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              id="csv-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <div className="flex items-start gap-2">
                <i className="bx bx-error-circle text-red-600 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 justify-between pt-2 border-t border-gray-100 mt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={downloadTemplate}
            >
              Download CSV template
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleUploadPreview}
              disabled={!file}
              leftIconClass="bx bx-upload"
            >
              Upload & Preview
            </Button>
          </div>
        </div>
      );
    }

    // Preview / Saving phase
    if (phase === "preview" || phase === "saving") {
      if (!previewData) return null;
      const { matched, unmatched, alreadyLinked, summary } = previewData;

      return (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="green" shape="full">
              {summary.matchedItems} matched
            </Badge>
            <Badge variant="orange" shape="full">
              {summary.unmatchedItems} unmatched
            </Badge>
            <Badge variant="gray" shape="full">
              {summary.alreadyLinkedItems} already linked
            </Badge>
          </div>

          {/* QR code warning banners */}
          {renderQrWarnings()}

          {/* Matched items table */}
          {matched.length > 0 && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-600 mb-2"
                onClick={() => setMatchedExpanded((prev) => !prev)}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: matchedExpanded ? 0 : -90 }}
                  transition={{
                    duration: accordionAnimationDuration,
                    ease: "easeInOut",
                  }}
                  className="flex items-center justify-center"
                >
                  <i className="bx bx-chevron-down text-lg" />
                </motion.div>
                Matched Items ({matched.length})
              </button>
              <AnimatePresence initial={false}>
                {matchedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: {
                        duration: accordionAnimationDuration,
                        ease: "easeInOut",
                      },
                      opacity: {
                        duration: accordionAnimationDuration * 0.8,
                        ease: "easeInOut",
                      },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden h-64 min-h-0">
                      <DataTable<CsvImportMatchedItem>
                        columns={matchedColumns}
                        rows={matched}
                        serverSide
                        allowHorizontalScroll
                        showFooter={false}
                        getRowId={(row) =>
                          `${row.rowIndex}-${row.qrCodeId}-${row.procoreItemID}`
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Unmatched items (collapsible) */}
          {unmatched.length > 0 && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-600 mb-2"
                onClick={() => setUnmatchedExpanded((prev) => !prev)}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: unmatchedExpanded ? 0 : -90 }}
                  transition={{
                    duration: accordionAnimationDuration,
                    ease: "easeInOut",
                  }}
                  className="flex items-center justify-center"
                >
                  <i className="bx bx-chevron-down text-lg" />
                </motion.div>
                Unmatched Items ({unmatched.length})
              </button>
              <AnimatePresence initial={false}>
                {unmatchedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: {
                        duration: accordionAnimationDuration,
                        ease: "easeInOut",
                      },
                      opacity: {
                        duration: accordionAnimationDuration * 0.8,
                        ease: "easeInOut",
                      },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden h-64 min-h-0">
                      <DataTable<CsvImportUnmatchedItem>
                        columns={unmatchedColumns}
                        rows={unmatched}
                        serverSide
                        allowHorizontalScroll
                        showFooter={false}
                        getRowId={(row) =>
                          `${row.rowIndex}-${row.qrCodeName}-${row.csvIdentifier}`
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Already linked items (collapsible) */}
          {alreadyLinked.length > 0 && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-600 mb-2"
                onClick={() => setAlreadyLinkedExpanded((prev) => !prev)}
              >
                <i
                  className={`bx ${alreadyLinkedExpanded ? "bx-chevron-down" : "bx-chevron-right"} text-lg`}
                />
                Already Linked ({alreadyLinked.length})
              </button>
              {alreadyLinkedExpanded && (
                <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-auto">
                  {alreadyLinked.map((item: CsvImportAlreadyLinkedItem) => (
                    <li
                      key={`${item.rowIndex}-${item.qrCodeId}-${item.procoreItemID}`}
                      className="px-4 py-2 text-sm text-gray-600"
                    >
                      Row {item.rowIndex}: {item.qrCodeName} &mdash; {item.tool}{" "}
                      / {item.csvIdentifier}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  // -- Footer --------------------------------------------------------------

  function renderFooter() {
    if (phase === "preview" || phase === "saving") {
      const matchedCount = previewData?.matched.length ?? 0;
      return (
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={phase === "saving"}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={matchedCount === 0 || phase === "saving"}
            leftIconClass={
              phase === "saving" ? "bx bx-loader-alt bx-spin" : "bx bx-plus"
            }
          >
            {phase === "saving" ? "Saving..." : `Add ${matchedCount} Items`}
          </Button>
        </>
      );
    }
    return undefined;
  }

  // -- Render --------------------------------------------------------------

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import from CSV"
      subtitle="Upload a CSV or Excel file to bulk-link Procore items to QR codes."
      size="lg"
      scrollable
      footer={renderFooter()}
    >
      {renderBody()}
    </Modal>
  );
}
