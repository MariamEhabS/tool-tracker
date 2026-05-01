import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useRouter } from "@tanstack/react-router";
import { postPunchList } from "@/api/endpoints/tools";
import { getCreatorInfoFromStorage } from "@/utils/creatorInfo";
import { createProcoreItem } from "@/api/endpoints/procore-item";
import { logProcoreError } from "@/utils/rollbar";

interface CreatePunchListModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  projectId: string;
  qrCodeId: string;
  onCreated?: (id: string) => void;
  assignees: Array<{
    id: string | number;
    name?: string;
    login_information?: { name?: string };
  }>;
}

export function CreatePunchListModal({
  isOpen,
  onClose,
  companyId,
  projectId,
  qrCodeId,
  onCreated,
  assignees,
}: CreatePunchListModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDueDate("");
    setDescription("");
    setSelectedAssignees([]);
    setSubmitting(false);
    setAttachments([]);
    setPreviews([]);
    setShowAssigneeMenu(false);
  }, [isOpen]);

  useEffect(() => {
    if (!showAssigneeMenu) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        assigneeMenuRef.current &&
        target &&
        !assigneeMenuRef.current.contains(target)
      ) {
        setShowAssigneeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showAssigneeMenu]);

  const canSubmit = useMemo(
    () => Boolean(title.trim() && !submitting),
    [title, submitting],
  );

  const handleAddAttachmentClick = () => fileInputRef.current?.click();
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setAttachments((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    e.currentTarget.value = "";
  };
  const handleRemoveAttachment = (i: number) => {
    setPreviews((prev) => {
      const next = [...prev];
      const removed = next.splice(i, 1)[0];
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
    setAttachments((prev) => {
      const next = [...prev];
      next.splice(i, 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    try {
      setSubmitting(true);
      const creator = getCreatorInfoFromStorage();
      const response = await postPunchList(
        companyId,
        projectId,
        {
          name: title.trim(),
          due_date: dueDate || undefined,
          description:
            `Punch List Created in Taliho by ${creator?.name ?? ""} (${creator?.company ?? ""})` +
            (description ? `\n\n${description}` : ""),
          assignees: selectedAssignees,
        },
        attachments,
      );
      const punchId =
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.id ??
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.data?.id;
      if (punchId) {
        // Try to link to QR code, but don't fail if linking fails
        try {
          await createProcoreItem({
            companyId: String(companyId),
            projectId: String(projectId),
            qrcodeId: String(qrCodeId),
            procoreToolName: "punch-list",
            procoreItemID: String(punchId),
          });
        } catch (linkError) {
          logProcoreError(linkError, "link-punch-list-to-qrcode", {
            projectId,
            qrCodeId,
            punchListId: String(punchId),
          });
          toast.error(
            "Punch list created but failed to link to QR code. You can link it manually later.",
          );
        }
        onCreated?.(String(punchId));
        router.navigate({
          to: "/tools/$tool/$itemId",
          params: { tool: "punch-list", itemId: String(punchId) },
          search: {
            qrCodeId: String(qrCodeId),
            openEdit: "true",
            created: "punch-list",
          },
        });
      }
      onClose();
    } catch (e) {
      logProcoreError(e, "create-punch-list", {
        projectId,
        qrCodeId,
        title,
      });
      toast.error("Failed to create punch list.");
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
                  Create Punch List
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
                  Title
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Assignees
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAssigneeMenu((v) => !v)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-left bg-white"
                  >
                    {selectedAssignees.length > 0
                      ? `${selectedAssignees.length} selected`
                      : "Select assignees"}
                  </button>
                  {showAssigneeMenu && (
                    <div
                      ref={assigneeMenuRef}
                      className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      {assignees.length > 0 ? (
                        <ul className="py-1">
                          {assignees.map((a) => {
                            const id = String(a.id);
                            const label =
                              a?.login_information?.name ||
                              a?.name ||
                              `Assignee ${a.id}`;
                            const checked = selectedAssignees.includes(id);
                            return (
                              <li
                                key={id}
                                className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <input
                                  id={id}
                                  type="checkbox"
                                  className="h-6 w-6 text-yellow-400 focus:ring-2 focus:ring-yellow-300"
                                  checked={checked}
                                  onChange={(e) =>
                                    setSelectedAssignees((prev) =>
                                      e.target.checked
                                        ? [...prev, id]
                                        : prev.filter((x) => x !== id),
                                    )
                                  }
                                />
                                <label htmlFor={id} className="text-gray-700">
                                  {label}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No assignees found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Due Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Due Date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  rows={6}
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Attachments
                </label>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={handleAddAttachmentClick}
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
                    {previews.map((src, idx) => (
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
                          onClick={() => handleRemoveAttachment(idx)}
                          className="absolute top-0 right-0 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs shadow"
                          aria-label="Remove attachment"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleAttachmentChange}
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
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
