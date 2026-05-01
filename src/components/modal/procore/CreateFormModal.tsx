import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useRouter } from "@tanstack/react-router";
import {
  getFormTemplates,
  postForm,
  getSignedProcoreUrl,
} from "@/api/endpoints/tools";
import { getCreatorInfoFromStorage } from "@/utils/creatorInfo";
import { createProcoreItem } from "@/api/endpoints/procore-item";
import { logProcoreError } from "@/utils/rollbar";

type FormTemplateListItem = {
  id: string;
  name: string;
  fillable_pdf_url?: string;
  fillable_pdf?: { url?: string };
};

interface CreateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  projectId: string;
  qrCodeId: string;
  onCreated?: (id: string) => void;
}

export function CreateFormModal({
  isOpen,
  onClose,
  companyId,
  projectId,
  qrCodeId,
  onCreated,
}: CreateFormModalProps) {
  const router = useRouter();
  const [formTemplates, setFormTemplates] = useState<
    Array<{ id: string; name: string; fillable_pdf_url?: string }>
  >([]);
  const [formTemplatesLoading, setFormTemplatesLoading] = useState(false);
  const [selectedFormTemplateId, setSelectedFormTemplateId] =
    useState<string>("");
  const [selectedFormTemplateFillableUrl, setSelectedFormTemplateFillableUrl] =
    useState<string>("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAttachmentPreviews, setFormAttachmentPreviews] = useState<
    string[]
  >([]);
  const [formAttachmentFiles, setFormAttachmentFiles] = useState<File[]>([]);
  const formAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFormTemplateMenu, setShowFormTemplateMenu] = useState(false);
  const formTemplateMenuRef = useRef<HTMLDivElement | null>(null);
  // Manual fillable PDF upload (fallback when auto-fetch fails)
  const [manualFillablePdf, setManualFillablePdf] = useState<File | null>(null);
  const fillablePdfInputRef = useRef<HTMLInputElement | null>(null);

  // Check if template has a fillable PDF URL or user uploaded one manually
  const hasFillablePdf = Boolean(
    selectedFormTemplateFillableUrl || manualFillablePdf,
  );

  const canSubmit = useMemo(
    () =>
      Boolean(
        selectedFormTemplateId &&
          formName.trim() &&
          hasFillablePdf &&
          !submitting,
      ),
    [selectedFormTemplateId, formName, hasFillablePdf, submitting],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFormTemplateId("");
    setSelectedFormTemplateFillableUrl("");
    setFormName("");
    setFormDescription("");
    setFormAttachmentPreviews([]);
    setFormAttachmentFiles([]);
    setShowFormTemplateMenu(false);
    setManualFillablePdf(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        formTemplateMenuRef.current &&
        target &&
        !formTemplateMenuRef.current.contains(target)
      ) {
        setShowFormTemplateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const loadFormTemplates = async () => {
    if (formTemplatesLoading || formTemplates.length > 0) return;
    try {
      setFormTemplatesLoading(true);
      const data = await getFormTemplates(companyId, projectId);
      const items: FormTemplateListItem[] = Array.isArray(
        (data as { data?: unknown[] })?.data,
      )
        ? (data as { data?: FormTemplateListItem[] }).data || []
        : Array.isArray(data)
          ? (data as FormTemplateListItem[])
          : [];
      const list = items
        .map((t) => ({
          id: String(t?.id ?? ""),
          name: String(t?.name ?? "").trim(),
          fillable_pdf_url: (t?.fillable_pdf?.url ||
            (t as { fillable_pdf_url?: string }).fillable_pdf_url) as
            | string
            | undefined,
        }))
        .filter((t) => t.id && t.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFormTemplates(list);
    } catch {
      setFormTemplates([]);
    } finally {
      setFormTemplatesLoading(false);
    }
  };

  const handleAddFormAttachmentClick = () => {
    formAttachmentInputRef.current?.click();
  };

  const handleFormAttachmentChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const newUrls = fileArray.map((f) => URL.createObjectURL(f));
    setFormAttachmentPreviews((prev) => [...prev, ...newUrls]);
    setFormAttachmentFiles((prev) => [...prev, ...fileArray]);
    e.currentTarget.value = "";
  };

  const handleRemoveFormAttachment = (index: number) => {
    setFormAttachmentPreviews((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
    setFormAttachmentFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleFillablePdfClick = () => {
    fillablePdfInputRef.current?.click();
  };

  const handleFillablePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManualFillablePdf(file);
    }
    e.currentTarget.value = "";
  };

  const handleRemoveFillablePdf = () => {
    setManualFillablePdf(null);
  };

  const handleSubmit = async () => {
    if (!selectedFormTemplateId) {
      toast.error("Please select a form template.");
      return;
    }
    if (!formName.trim()) {
      toast.error("Please enter a form name.");
      return;
    }
    try {
      setSubmitting(true);
      let fillablePdfFile: File | undefined;

      // First, try to use manually uploaded PDF if available
      if (manualFillablePdf) {
        fillablePdfFile = manualFillablePdf;
      } else if (selectedFormTemplateFillableUrl) {
        // Try to fetch from template URL
        try {
          const buffer = await getSignedProcoreUrl({
            qrCodeId: String(qrCodeId),
            fileUrl: selectedFormTemplateFillableUrl,
            urlOnly: false,
            sendBuffer: true,
          });
          if (buffer) {
            fillablePdfFile = new File(
              [buffer],
              `${(formName || "fillable").replace(/[^a-z0-9._-]+/gi, "_")}.pdf`,
              { type: "application/pdf" },
            );
          }
        } catch (error) {
          logProcoreError(error, "get-signed-procore-url", {
            projectId,
            qrCodeId,
            templateId: selectedFormTemplateId,
          });
        }
      }

      if (!fillablePdfFile) {
        toast.error(
          "A fillable PDF is required. Please upload one manually using the button below.",
        );
        return;
      }
      // Build description similar to Punch List create flow
      const creator = getCreatorInfoFromStorage();
      const created = await postForm(
        companyId,
        projectId,
        {
          name: formName.trim(),
          formTemplateId: selectedFormTemplateId,
          description:
            `Form Created in Taliho by ${creator?.name ?? ""} (${creator?.company ?? ""})` +
            (formDescription.trim() ? `\n\n${formDescription.trim()}` : ""),
        },
        fillablePdfFile,
        formAttachmentFiles,
      );
      const formId =
        (created as { id?: string | number; data?: { id?: string | number } })
          ?.id ??
        (created as { id?: string | number; data?: { id?: string | number } })
          ?.data?.id;
      if (formId) {
        // Try to link to QR code, but don't fail if linking fails
        try {
          await createProcoreItem({
            companyId: String(companyId),
            projectId: String(projectId),
            qrcodeId: String(qrCodeId),
            procoreToolName: "form",
            procoreItemID: String(formId),
          });
        } catch (linkError) {
          logProcoreError(linkError, "link-form-to-qrcode", {
            projectId,
            qrCodeId,
            formId: String(formId),
          });
          toast.error(
            "Form created but failed to link to QR code. You can link it manually later.",
          );
        }
        if (onCreated) onCreated(String(formId));
        // Navigate to form detail page and open edit modal by default; toast will be shown after data loads
        router.navigate({
          to: "/tools/$tool/$itemId",
          params: { tool: "form", itemId: String(formId) },
          search: {
            qrCodeId: String(qrCodeId),
            openEdit: "true",
            created: "form",
          },
        });
      }
      // toast is shown after data loads on destination route
      onClose();
    } catch (error) {
      logProcoreError(error, "create-form", {
        projectId,
        qrCodeId,
        templateId: selectedFormTemplateId,
        formName,
      });
      toast.error("Failed to create form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-white"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-yellow-400">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Form</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-900 bg-white/60 hover:bg-white px-3 py-1 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="space-y-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Form Template
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={async () => {
                      if (formTemplates.length === 0) await loadFormTemplates();
                      setShowFormTemplateMenu((prev) => !prev);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-left bg-white"
                  >
                    {formTemplatesLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        Loading templates…
                      </span>
                    ) : selectedFormTemplateId ? (
                      formTemplates.find((t) => t.id === selectedFormTemplateId)
                        ?.name || "Selected template"
                    ) : (
                      "Select form template"
                    )}
                  </button>
                  {showFormTemplateMenu && (
                    <div
                      ref={formTemplateMenuRef}
                      className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      {formTemplatesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          Loading…
                        </div>
                      ) : formTemplates.length === 0 &&
                        !formTemplatesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No templates found
                        </div>
                      ) : (
                        <ul className="py-1">
                          {formTemplates.map((t) => (
                            <li
                              key={t.id}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                setSelectedFormTemplateId(t.id);
                                setSelectedFormTemplateFillableUrl(
                                  String(
                                    (t as unknown as FormTemplateListItem)
                                      ?.fillable_pdf?.url ||
                                      (t as unknown as FormTemplateListItem)
                                        ?.fillable_pdf_url ||
                                      "",
                                  ),
                                );
                                setShowFormTemplateMenu(false);
                              }}
                            >
                              {t.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Fillable PDF Upload - shown when template is selected */}
                {selectedFormTemplateId && (
                  <>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Fillable PDF
                      {!selectedFormTemplateFillableUrl && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    {selectedFormTemplateFillableUrl && !manualFillablePdf ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-green-500"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>PDF from template (auto-loaded)</span>
                        <button
                          type="button"
                          onClick={handleFillablePdfClick}
                          className="ml-auto text-yellow-600 hover:text-yellow-700 font-medium"
                        >
                          Upload different
                        </button>
                      </div>
                    ) : manualFillablePdf ? (
                      <div className="flex items-center gap-2 text-sm text-gray-700 bg-yellow-50 px-3 py-2 rounded-md border border-yellow-200">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-yellow-500"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
                            clipRule="evenodd"
                          />
                          <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                        </svg>
                        <span className="truncate flex-1">
                          {manualFillablePdf.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveFillablePdf}
                          className="text-red-500 hover:text-red-600 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-amber-600">
                          This template doesn't have a fillable PDF. Please
                          upload one manually.
                        </p>
                        <button
                          type="button"
                          onClick={handleFillablePdfClick}
                          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-md px-3 py-4 text-gray-600 hover:border-yellow-400 hover:text-yellow-600 transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5z"
                              clipRule="evenodd"
                            />
                            <path d="M3.75 18.75v-4.5h1.5v4.5a.75.75 0 00.75.75h12a.75.75 0 00.75-.75v-4.5h1.5v4.5a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25z" />
                          </svg>
                          <span className="text-sm font-medium">
                            Upload Fillable PDF
                          </span>
                        </button>
                      </div>
                    )}
                    <input
                      ref={fillablePdfInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFillablePdfChange}
                      className="hidden"
                    />
                  </>
                )}

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Form Name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Form Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  rows={6}
                  placeholder="Description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Attachments
                </label>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={handleAddFormAttachmentClick}
                    className="flex items-center justify-center w-16 h-16 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 active:bg-gray-300 select-none"
                    aria-label="Add attachment"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-7 h-7"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <div className="flex gap-2 overflow-x-auto flex-1 flex-wrap">
                    {formAttachmentPreviews.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"
                      >
                        <img
                          src={src}
                          alt={`attachment-${idx}`}
                          className="object-cover w-full h-full"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFormAttachment(idx)}
                          className="absolute top-0 right-0 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs shadow"
                          aria-label="Remove attachment"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    ref={formAttachmentInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFormAttachmentChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
