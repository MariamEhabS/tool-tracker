import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useRouter } from "@tanstack/react-router";
import { getInspectionTemplates, postInspection } from "@/api/endpoints/tools";
import { getCreatorInfoFromStorage } from "@/utils/creatorInfo";
import { createProcoreItem } from "@/api/endpoints/procore-item";
import { logProcoreError } from "@/utils/rollbar";

type InspectionTemplate = {
  id: string | number;
  name: string;
  description?: string;
};

interface CreateInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  projectId: string;
  qrCodeId: string;
  onCreated?: (id: string) => void;
}

export function CreateInspectionModal({
  isOpen,
  onClose,
  companyId,
  projectId,
  qrCodeId,
  onCreated,
}: CreateInspectionModalProps) {
  const router = useRouter();
  const [inspectionTemplates, setInspectionTemplates] = useState<
    InspectionTemplate[]
  >([]);
  const [inspectionTemplatesLoading, setInspectionTemplatesLoading] =
    useState(false);
  const [selectedInspectionTemplateId, setSelectedInspectionTemplateId] =
    useState("");
  const [inspectionDescription, setInspectionDescription] = useState("");
  const [inspectionIdentifier, setInspectionIdentifier] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionDueDate, setInspectionDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInspectionTemplateMenu, setShowInspectionTemplateMenu] =
    useState(false);
  const inspectionTemplateMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setInspectionDate(`${yyyy}-${mm}-${dd}`);
    setInspectionDueDate("");
    setInspectionIdentifier("");
    setInspectionDescription("");
    setSelectedInspectionTemplateId("");
    setShowInspectionTemplateMenu(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        inspectionTemplateMenuRef.current &&
        target &&
        !inspectionTemplateMenuRef.current.contains(target)
      ) {
        setShowInspectionTemplateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const canSubmit = useMemo(
    () =>
      Boolean(selectedInspectionTemplateId && inspectionDate && !submitting),
    [selectedInspectionTemplateId, inspectionDate, submitting],
  );

  const handleOpenInspectionTemplates = async () => {
    if (inspectionTemplatesLoading || inspectionTemplates.length > 0) return;
    try {
      setInspectionTemplatesLoading(true);
      const data = await getInspectionTemplates(companyId, projectId);
      if (Array.isArray(data)) {
        setInspectionTemplates(data as InspectionTemplate[]);
      } else if (Array.isArray((data as { data?: unknown[] })?.data)) {
        setInspectionTemplates(
          (data as { data?: InspectionTemplate[] }).data || [],
        );
      } else {
        setInspectionTemplates([]);
      }
    } catch {
      toast.error("Failed to load inspection templates.");
    } finally {
      setInspectionTemplatesLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInspectionTemplateId) {
      toast.error("Please select an inspection template.");
      return;
    }
    try {
      setSubmitting(true);
      const creator = getCreatorInfoFromStorage();
      const response = await postInspection(
        companyId,
        projectId,
        selectedInspectionTemplateId,
        {
          inspection_template_id: selectedInspectionTemplateId,
          identifier: inspectionIdentifier,
          inspection_date: inspectionDate,
          due_date: inspectionDueDate,
          description:
            `Inspection Created in Taliho by ${creator?.name ?? ""} (${creator?.company ?? ""})` +
            (inspectionDescription ? `\n\n${inspectionDescription}` : ""),
        },
      );
      const inspectionId =
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.id ??
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.data?.id;
      if (inspectionId) {
        // Try to link to QR code, but don't fail if linking fails
        try {
          await createProcoreItem({
            companyId: String(companyId),
            projectId: String(projectId),
            qrcodeId: String(qrCodeId),
            procoreToolName: "inspection",
            procoreItemID: String(inspectionId),
          });
        } catch (linkError) {
          logProcoreError(linkError, "link-inspection-to-qrcode", {
            projectId,
            qrCodeId,
            inspectionId: String(inspectionId),
          });
          toast.error(
            "Inspection created but failed to link to QR code. You can link it manually later.",
          );
        }
        onCreated?.(String(inspectionId));
        router.navigate({
          to: "/tools/$tool/$itemId",
          params: { tool: "inspection", itemId: String(inspectionId) },
          search: {
            qrCodeId: String(qrCodeId),
            openEdit: "true",
            created: "inspection",
          },
        });
      }
      onClose();
    } catch (e) {
      logProcoreError(e, "create-inspection", {
        projectId,
        qrCodeId,
        templateId: selectedInspectionTemplateId,
      });
      toast.error("Failed to create inspection.");
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
                <h2 className="text-lg font-bold text-gray-900">
                  Create Inspection
                </h2>
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
                  Inspection Template
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={async () => {
                      if (inspectionTemplates.length === 0)
                        await handleOpenInspectionTemplates();
                      setShowInspectionTemplateMenu((prev) => !prev);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-left bg-white"
                  >
                    {inspectionTemplatesLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        Loading templates…
                      </span>
                    ) : selectedInspectionTemplateId ? (
                      inspectionTemplates.find(
                        (t) =>
                          String(t.id) === String(selectedInspectionTemplateId),
                      )?.name || "Selected template"
                    ) : (
                      "Select inspection template"
                    )}
                  </button>
                  {showInspectionTemplateMenu && (
                    <div
                      ref={inspectionTemplateMenuRef}
                      className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      {inspectionTemplatesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          Loading…
                        </div>
                      ) : inspectionTemplates.length === 0 &&
                        !inspectionTemplatesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No templates found
                        </div>
                      ) : (
                        <ul className="py-1">
                          {inspectionTemplates.map((template) => (
                            <li
                              key={String(template.id)}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                setSelectedInspectionTemplateId(
                                  String(template.id),
                                );
                                setShowInspectionTemplateMenu(false);
                              }}
                            >
                              {template.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Identifier
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Identifier"
                  value={inspectionIdentifier}
                  onChange={(e) => setInspectionIdentifier(e.target.value)}
                />
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Inspection Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Inspection Date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                />
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Due Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Due Date"
                  value={inspectionDueDate}
                  onChange={(e) => setInspectionDueDate(e.target.value)}
                />
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  rows={6}
                  placeholder="Description"
                  value={inspectionDescription}
                  onChange={(e) => setInspectionDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
