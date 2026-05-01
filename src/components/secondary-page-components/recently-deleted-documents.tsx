import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { axiosInstance } from "@/api";
import {
  restoreDocument,
  restoreDocumentsBulk,
} from "@/api/endpoints/document";
import { invalidateQrCaches } from "@/lib/invalidateQrCaches";

/** Extended document type including soft-delete fields from the backend. */
interface DeletedDocument {
  _id: string;
  documentName: string;
  documentFile: string;
  documentSize: number;
  folder: string;
  qrcode: string;
  project: string;
  createdAt: string;
  deletedAt: string;
  deletedBy?: string;
}

interface RecentlyDeletedDocumentsProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  projectId?: string;
  qrcodeId?: string;
}

export default function RecentlyDeletedDocuments({
  open,
  onClose,
  companyId,
  projectId,
  qrcodeId,
}: RecentlyDeletedDocumentsProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  const {
    data: deletedDocs,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["deleted-documents", companyId, qrcodeId],
    queryFn: async () => {
      const params: Record<string, string | boolean> = { companyId };
      if (qrcodeId) params.qrcodeId = qrcodeId;
      if (projectId) params.projectId = projectId;
      params.onlyDeleted = true;

      const { data } = await axiosInstance.get("/document", { params });
      const docs = data?.data ?? data?.documents ?? data ?? [];
      return (Array.isArray(docs) ? docs : []) as DeletedDocument[];
    },
    enabled: open && !!companyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getDaysUntilPurge = (deletedAt: string): number => {
    const deletedDate = new Date(deletedAt);
    const now = new Date();
    const daysSinceDelete = Math.floor(
      (now.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, 30 - daysSinceDelete);
  };

  const formatDeletedDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRestoreSingle = async (docId: string) => {
    setRestoringIds((prev) => new Set(prev).add(docId));
    try {
      const result = await restoreDocument(docId, companyId, projectId);
      if (result.success) {
        toast.success("Document restored successfully");
        queryClient.invalidateQueries({
          queryKey: ["deleted-documents", companyId, qrcodeId],
        });
        if (qrcodeId) {
          void invalidateQrCaches(queryClient, qrcodeId);
        }
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      } else {
        toast.error(result.message || "Failed to restore document");
      }
    } catch {
      toast.error("An error occurred while restoring the document");
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleRestoreSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setRestoringIds(new Set(ids));
    try {
      const result = await restoreDocumentsBulk(ids, companyId);
      if (result.success) {
        toast.success(result.message || `Restored ${ids.length} document(s)`);
        queryClient.invalidateQueries({
          queryKey: ["deleted-documents", companyId, qrcodeId],
        });
        if (qrcodeId) {
          void invalidateQrCaches(queryClient, qrcodeId);
        }
        setSelectedIds(new Set());
      } else {
        toast.error(result.message || "Failed to restore documents");
      }
    } catch {
      toast.error("An error occurred while restoring documents");
    } finally {
      setRestoringIds(new Set());
    }
  };

  const toggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!deletedDocs) return;
    if (selectedIds.size === deletedDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedDocs.map((d) => d._id)));
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  const docs = deletedDocs ?? [];
  const allSelected = docs.length > 0 && selectedIds.size === docs.length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Recently Deleted"
      subtitle="Documents deleted in the last 30 days. After 30 days, documents are permanently removed."
      size="2xl"
      scrollable
      withoutPadding
      footer={
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="primary"
              leftIconClass={
                restoringIds.size > 0
                  ? "bx bx-loader-alt bx-spin"
                  : "bx bx-revision"
              }
              disabled={restoringIds.size > 0}
              onClick={handleRestoreSelected}
            >
              Restore Selected ({selectedIds.size})
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12 px-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      ) : isError ? (
        <div className="px-6 py-5">
          <EmptyState
            icon={<i className="bx bx-error-circle text-2xl text-red-500" />}
            iconBgClass="bg-red-100"
            title="Failed to load deleted documents"
            description="An error occurred while fetching recently deleted documents. Please try again."
            compact
          />
        </div>
      ) : docs.length === 0 ? (
        <div className="px-6 py-5">
          <EmptyState
            icon={<i className="bx bx-trash text-2xl text-gray-400" />}
            iconBgClass="bg-gray-100"
            title="No recently deleted documents"
            description="Deleted documents appear here for 30 days before being permanently removed."
            compact
          />
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deleted Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Until Purge
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {docs.map((doc) => {
              const daysLeft = getDaysUntilPurge(doc.deletedAt);
              const isRestoring = restoringIds.has(doc._id);
              return (
                <tr
                  key={doc._id}
                  className={`hover:bg-gray-50 ${isRestoring ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                      checked={selectedIds.has(doc._id)}
                      onChange={() => toggleSelect(doc._id)}
                      disabled={isRestoring}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <i className="bx bx-file text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {doc.documentName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDeletedDate(doc.deletedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        daysLeft <= 3
                          ? "bg-red-100 text-red-800"
                          : daysLeft <= 7
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {daysLeft <= 0
                        ? "Expires today"
                        : `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass={
                        isRestoring
                          ? "bx bx-loader-alt bx-spin"
                          : "bx bx-revision"
                      }
                      disabled={isRestoring}
                      onClick={() => handleRestoreSingle(doc._id)}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
