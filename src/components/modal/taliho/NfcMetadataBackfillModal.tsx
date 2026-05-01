import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import {
  backfillNfcMetadata,
  type NfcMetadataBackfillResponse,
} from "@/api/endpoints/nfc";

type BackfillStep = "select" | "preview" | "confirm";

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: (result: NfcMetadataBackfillResponse) => void;
};

type MappingPreview = {
  fileName: string;
  inferredTagType: "card" | "zip_tie" | "unsupported";
  derivedBatchName: string;
};

function inferTagType(fileName: string): "card" | "zip_tie" | "unsupported" {
  const normalized = fileName.toLowerCase();
  if (/(cable[_-]?ties?|zip[_-]?ties?)/.test(normalized)) return "zip_tie";
  if (normalized.includes("card")) return "card";
  return "unsupported";
}

function deriveBatchName(fileName: string): string {
  const stem = fileName.replace(/\.[^/.]+$/, "").trim();
  return stem || "legacy_nfc_metadata_backfill";
}

export default function NfcMetadataBackfillModal({
  open,
  onClose,
  onApplied,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<BackfillStep>("select");
  const [previewResult, setPreviewResult] =
    useState<NfcMetadataBackfillResponse | null>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setStep("select");
      setPreviewResult(null);
    }
  }, [open]);

  const mappings = useMemo<MappingPreview[]>(
    () =>
      files.map((file) => ({
        fileName: file.name,
        inferredTagType: inferTagType(file.name),
        derivedBatchName: deriveBatchName(file.name),
      })),
    [files],
  );

  const previewMutation = useMutation({
    mutationFn: (selectedFiles: File[]) =>
      backfillNfcMetadata(selectedFiles, true),
    onSuccess: (result) => {
      setPreviewResult(result);
      setStep("preview");
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      toast.error(
        axiosError?.response?.data?.message ||
          "Failed to preview metadata backfill",
      );
    },
  });

  const applyMutation = useMutation({
    mutationFn: (selectedFiles: File[]) =>
      backfillNfcMetadata(selectedFiles, false),
    onSuccess: (result) => {
      toast.success(`Backfill updated ${result.totals.updated} NFC tags`);
      onApplied?.(result);
      onClose();
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      toast.error(
        axiosError?.response?.data?.message ||
          "Failed to apply metadata backfill",
      );
    },
  });

  const unmatchedIds = previewResult?.unmatchedObjectIds ?? [];
  const hasFiles = files.length > 0;
  const hasUnsupportedFile = mappings.some(
    (mapping) => mapping.inferredTagType === "unsupported",
  );
  const isBusy = previewMutation.isPending || applyMutation.isPending;

  const handlePreview = () => {
    if (!hasFiles) {
      toast.error("Upload at least one CSV file.");
      return;
    }
    previewMutation.mutate(files);
  };

  const handleCopyUnmatched = async () => {
    if (!unmatchedIds.length) return;
    try {
      await navigator.clipboard.writeText(unmatchedIds.join("\n"));
      toast.success("Copied unmatched IDs");
    } catch {
      toast.error("Failed to copy unmatched IDs");
    }
  };

  const handleDownloadUnmatched = () => {
    if (!unmatchedIds.length) return;
    const blob = new Blob([`OBJECT_ID\n${unmatchedIds.join("\n")}\n`], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nfc-unmatched-object-ids.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const footer = (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          if (step === "select") {
            onClose();
            return;
          }
          setStep(step === "confirm" ? "preview" : "select");
        }}
        disabled={isBusy}
      >
        {step === "select" ? "Cancel" : "Back"}
      </Button>

      {step === "select" && (
        <Button
          type="button"
          variant="primary"
          leftIconClass={
            previewMutation.isPending
              ? "bx bx-loader-alt bx-spin"
              : "bx bx-show"
          }
          disabled={isBusy || !hasFiles}
          onClick={handlePreview}
        >
          {previewMutation.isPending ? "Previewing..." : "Preview Updates"}
        </Button>
      )}

      {step === "preview" && (
        <Button
          type="button"
          variant="primary"
          leftIconClass="bx bx-right-arrow-alt"
          disabled={isBusy}
          onClick={() => setStep("confirm")}
        >
          Continue to Apply
        </Button>
      )}

      {step === "confirm" && (
        <Button
          type="button"
          variant="primary"
          leftIconClass={
            applyMutation.isPending ? "bx bx-loader-alt bx-spin" : "bx bx-check"
          }
          disabled={isBusy}
          onClick={() => applyMutation.mutate(files)}
        >
          {applyMutation.isPending ? "Applying..." : "Apply Backfill"}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Backfill NFC Metadata"
      subtitle="Upload legacy CSV files, preview impact, then apply safe metadata updates."
      size="xl"
      footer={footer}
    >
      <div className="space-y-5">
        {step === "select" && (
          <>
            <div className="space-y-2">
              <label
                htmlFor="nfc-metadata-backfill-files"
                className="block text-sm font-medium text-gray-700"
              >
                CSV files
              </label>
              <input
                id="nfc-metadata-backfill-files"
                type="file"
                accept=".csv,text/csv"
                multiple
                className="block w-full rounded-md border border-gray-300 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []));
                }}
              />
              <p className="text-xs text-gray-500">
                Expected CSV headers:{" "}
                <span className="font-mono">OBJECT ID</span>
                {", "}
                <span className="font-mono">FULL URL</span>.
              </p>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <h4 className="text-sm font-semibold text-gray-800">Defaults</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>
                  <span className="font-medium">purpose:</span> marketing
                </li>
                <li>
                  <span className="font-medium">assigned:</span> true (only when
                  empty/null)
                </li>
                <li>
                  <span className="font-medium">tagType:</span> inferred from
                  filename
                </li>
                <li>
                  <span className="font-medium">batchName:</span> derived from
                  filename
                </li>
                <li className="text-amber-700">
                  Existing non-empty fields are never overwritten.
                </li>
              </ul>
            </div>

            <div className="rounded-md border border-gray-200">
              <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800">
                Mapping Summary
              </div>
              <div className="max-h-52 overflow-auto">
                {mappings.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">
                    No files selected yet.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Tag Type</th>
                        <th className="px-3 py-2">Batch Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((mapping) => (
                        <tr
                          key={mapping.fileName}
                          className="border-t border-gray-100"
                        >
                          <td className="px-3 py-2 font-medium text-gray-700">
                            {mapping.fileName}
                          </td>
                          <td className="px-3 py-2">
                            {mapping.inferredTagType === "unsupported" ? (
                              <span className="text-red-600">Unsupported</span>
                            ) : (
                              mapping.inferredTagType
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {mapping.derivedBatchName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {hasUnsupportedFile && (
              <p className="text-sm text-amber-700">
                Some filenames have unsupported tag-type patterns. You can still
                preview; unsupported files will be reported as errors.
              </p>
            )}
          </>
        )}

        {(step === "preview" || step === "confirm") && previewResult && (
          <>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <h4 className="text-sm font-semibold text-gray-800">
                Preview Summary
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700 sm:grid-cols-3">
                <span>Parsed: {previewResult.totals.parsedRows}</span>
                <span>Valid: {previewResult.totals.validRows}</span>
                <span>Matched: {previewResult.totals.matched}</span>
                <span>Would Update: {previewResult.totals.wouldUpdate}</span>
                <span>
                  Skipped Existing: {previewResult.totals.skippedExisting}
                </span>
                <span>Not Found: {previewResult.totals.notFound}</span>
                <span>Invalid: {previewResult.totals.invalid}</span>
                <span>Duplicates: {previewResult.totals.duplicates}</span>
                <span>Run ID: {previewResult.runId}</span>
              </div>
            </div>

            <div className="rounded-md border border-gray-200">
              <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800">
                Per-File Results
              </div>
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Matched</th>
                      <th className="px-3 py-2">Would Update</th>
                      <th className="px-3 py-2">Not Found</th>
                      <th className="px-3 py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.files.map((file) => (
                      <tr
                        key={file.fileName}
                        className="border-t border-gray-100"
                      >
                        <td className="px-3 py-2 font-medium text-gray-700">
                          {file.fileName}
                        </td>
                        <td className="px-3 py-2">{file.totals.matched}</td>
                        <td className="px-3 py-2">{file.totals.wouldUpdate}</td>
                        <td className="px-3 py-2">{file.totals.notFound}</td>
                        <td className="px-3 py-2">{file.errors.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">
                  Unmatched OBJECT IDs ({unmatchedIds.length})
                </h4>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyUnmatched}
                    disabled={!unmatchedIds.length}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownloadUnmatched}
                    disabled={!unmatchedIds.length}
                  >
                    Download CSV
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs text-gray-700">
                {unmatchedIds.length ? (
                  unmatchedIds.map((id) => <div key={id}>{id}</div>)
                ) : (
                  <span className="text-gray-500">No unmatched IDs.</span>
                )}
              </div>
            </div>

            {step === "confirm" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Applying will update only empty/null metadata fields for matched
                records. Existing populated metadata remains unchanged.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
