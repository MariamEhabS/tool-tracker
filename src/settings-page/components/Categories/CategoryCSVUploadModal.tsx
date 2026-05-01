import { useState, useCallback, useRef } from "react";
import type { DragEvent, ChangeEvent } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import { useCreateCategory, type Category } from "@/api/endpoints/categories";
import categoriesCsvTemplate from "@/assets/templates/Categories-CSV-Template.csv?url";

interface ParsedRow {
  rowNumber: number;
  categoryName: string;
  categoryClass: string;
  errors: string[];
  isDuplicate: boolean;
  isDuplicateInFile: boolean;
}

interface CategoryCSVUploadModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  existingCategories: Category[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 1) {
    throw new Error("CSV file is empty");
  }

  // Parse header row
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));

  const nameIdx = headers.indexOf("categoryname");
  const classIdx = headers.indexOf("categoryclass");

  if (nameIdx === -1 || classIdx === -1) {
    throw new Error(
      'CSV must include "categoryName" and "categoryClass" columns in the header row',
    );
  }

  if (lines.length < 2) {
    throw new Error("CSV must include at least one data row after the header");
  }

  // Parse data rows
  return lines.slice(1).map((line, index) => {
    // Handle CSV values that may contain commas within quotes
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ""));

    return {
      rowNumber: index + 2, // 1-indexed, accounting for header
      categoryName: values[nameIdx] || "",
      categoryClass: values[classIdx] || "",
      errors: [],
      isDuplicate: false,
      isDuplicateInFile: false,
    };
  });
}

function validateRows(
  rows: ParsedRow[],
  existingCategories: Category[],
): ParsedRow[] {
  // Create a set of existing category keys for duplicate detection
  const existingKeys = new Set(
    existingCategories.map(
      (c) => `${c.categoryName.toLowerCase()}|${c.categoryClass.toLowerCase()}`,
    ),
  );

  // Track keys seen in this file for in-file duplicate detection
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const key = `${row.categoryName.toLowerCase()}|${row.categoryClass.toLowerCase()}`;

    // Validate categoryName
    if (!row.categoryName.trim()) {
      errors.push("Category name is required");
    } else if (row.categoryName.length > 100) {
      errors.push("Category name must be 100 characters or less");
    }

    // Validate categoryClass
    if (!row.categoryClass.trim()) {
      errors.push("Category class is required");
    } else if (row.categoryClass.length > 100) {
      errors.push("Category class must be 100 characters or less");
    }

    // Check for duplicates against existing categories
    const isDuplicate = existingKeys.has(key);

    // Check for duplicates within the file
    const isDuplicateInFile = seenInFile.has(key);
    if (row.categoryName.trim() && row.categoryClass.trim()) {
      seenInFile.add(key);
    }

    return {
      ...row,
      errors,
      isDuplicate,
      isDuplicateInFile,
    };
  });
}

export function CategoryCSVUploadModal({
  open,
  onClose,
  companyId,
  existingCategories,
}: CategoryCSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateCategory();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setSkipDuplicates(true);
    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const processFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      setFile(selectedFile);
      setParseError(null);

      try {
        const text = await selectedFile.text();
        const rows = parseCSV(text);
        const validatedRows = validateRows(rows, existingCategories);
        setParsedRows(validatedRows);
      } catch (error) {
        setParseError(
          error instanceof Error ? error.message : "Failed to parse CSV file",
        );
        setParsedRows([]);
      }
    },
    [existingCategories],
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback(async () => {
    // Filter rows to import based on validation and duplicate settings
    const rowsToImport = parsedRows.filter((row) => {
      // Skip rows with validation errors
      if (row.errors.length > 0) return false;
      // Skip duplicates if option is enabled
      if (skipDuplicates && (row.isDuplicate || row.isDuplicateInFile))
        return false;
      return true;
    });

    if (rowsToImport.length === 0) {
      toast.error("No valid categories to import");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: rowsToImport.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i];
      try {
        await createMutation.mutateAsync({
          categoryName: row.categoryName.trim(),
          categoryClass: row.categoryClass.trim(),
          companyId,
        });
        succeeded++;
      } catch {
        failed++;
      }
      setUploadProgress({ current: i + 1, total: rowsToImport.length });
    }

    setIsUploading(false);

    if (failed === 0) {
      toast.success(`Successfully imported ${succeeded} categories`);
      handleClose();
    } else if (succeeded > 0) {
      toast.success(
        `Imported ${succeeded} of ${succeeded + failed} categories. ${failed} failed.`,
      );
      handleClose();
    } else {
      toast.error("Failed to import categories. Please try again.");
    }
  }, [parsedRows, skipDuplicates, companyId, createMutation, handleClose]);

  // Calculate stats for display
  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);
  const duplicateRows = parsedRows.filter(
    (r) => r.errors.length === 0 && (r.isDuplicate || r.isDuplicateInFile),
  );
  const rowsToImportCount = skipDuplicates
    ? validRows.length - duplicateRows.length
    : validRows.length;

  const hasErrors = errorRows.length > 0;
  const canImport =
    parsedRows.length > 0 && rowsToImportCount > 0 && !isUploading;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Categories from CSV"
      subtitle="Bulk create categories by uploading a CSV file"
      size="xl"
      scrollable
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleImport}
            disabled={!canImport}
            leftIconClass={
              isUploading ? "bx bx-loader-alt bx-spin" : "bx bx-upload"
            }
          >
            {isUploading
              ? `Importing ${uploadProgress.current}/${uploadProgress.total}...`
              : `Import ${rowsToImportCount} Categories`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Template Download */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Download the template to see the required format.
          </p>
          <a
            href={categoriesCsvTemplate}
            download="Categories-CSV-Template.csv"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <i className="bx bx-download" />
            Download Template
          </a>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Dropzone or Preview */}
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center
              w-full min-h-[180px] p-6
              border-2 border-dashed rounded-lg
              transition-all duration-200 ease-in-out
              ${
                isDragging
                  ? "border-yellow-500 bg-yellow-50 scale-[1.01]"
                  : "border-gray-300 bg-white hover:border-yellow-400 hover:bg-gray-50 cursor-pointer"
              }
            `}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={`
                  w-12 h-12 mb-4 rounded-full flex items-center justify-center
                  ${isDragging ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-400"}
                `}
              >
                <i className="bx bx-upload text-2xl" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging
                  ? "Drop your CSV file here"
                  : "Drag & drop your CSV file here"}
              </p>
              <p className="mt-1 text-xs text-gray-500">or click to browse</p>
              <p className="mt-3 text-xs text-gray-400">CSV files only</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="bx bx-file text-green-600 text-xl" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {parsedRows.length} rows found
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="text-gray-400 hover:text-gray-600"
                disabled={isUploading}
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            {/* Parse Error */}
            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">
                  <i className="bx bx-error-circle mr-1" />
                  {parseError}
                </p>
              </div>
            )}

            {/* Stats Summary */}
            {parsedRows.length > 0 && !parseError && (
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-600">
                  <span className="font-medium text-gray-900">
                    {parsedRows.length}
                  </span>{" "}
                  total rows
                </span>
                {validRows.length > 0 && (
                  <span className="text-green-600">
                    <i className="bx bx-check-circle mr-1" />
                    {validRows.length} valid
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="text-red-600">
                    <i className="bx bx-error-circle mr-1" />
                    {errorRows.length} with errors
                  </span>
                )}
                {duplicateRows.length > 0 && (
                  <span className="text-amber-600">
                    <i className="bx bx-copy mr-1" />
                    {duplicateRows.length} duplicates
                  </span>
                )}
              </div>
            )}

            {/* Duplicate Handling */}
            {duplicateRows.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  {duplicateRows.length} duplicate
                  {duplicateRows.length > 1 ? "s" : ""} found
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      checked={skipDuplicates}
                      onChange={() => setSkipDuplicates(true)}
                      className="text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm text-gray-700">
                      Skip duplicates (recommended)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      checked={!skipDuplicates}
                      onChange={() => setSkipDuplicates(false)}
                      className="text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm text-gray-700">
                      Create anyway (will result in duplicates)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Preview Table */}
            {parsedRows.length > 0 && !parseError && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category Class
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedRows.map((row) => {
                        const hasRowError = row.errors.length > 0;
                        const isRowDuplicate =
                          row.isDuplicate || row.isDuplicateInFile;

                        return (
                          <tr
                            key={row.rowNumber}
                            className={
                              hasRowError
                                ? "bg-red-50"
                                : isRowDuplicate
                                  ? "bg-amber-50"
                                  : ""
                            }
                          >
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {row.rowNumber}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {row.categoryName || (
                                <span className="text-gray-400 italic">
                                  empty
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {row.categoryClass || (
                                <span className="text-gray-400 italic">
                                  empty
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {hasRowError ? (
                                <span
                                  className="text-red-600"
                                  title={row.errors.join(", ")}
                                >
                                  <i className="bx bx-error-circle mr-1" />
                                  Error
                                </span>
                              ) : isRowDuplicate ? (
                                <span className="text-amber-600">
                                  <i className="bx bx-copy mr-1" />
                                  Duplicate
                                </span>
                              ) : (
                                <span className="text-green-600">
                                  <i className="bx bx-check-circle mr-1" />
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error Details */}
            {hasErrors && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Errors found ({errorRows.length} rows):
                </p>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {errorRows.slice(0, 10).map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}: {row.errors.join(", ")}
                    </li>
                  ))}
                  {errorRows.length > 10 && (
                    <li className="text-red-600 font-medium">
                      ...and {errorRows.length - 10} more errors
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default CategoryCSVUploadModal;
