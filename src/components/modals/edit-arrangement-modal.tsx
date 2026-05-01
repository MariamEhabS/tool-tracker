import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { patchGroup } from "../../api/endpoints/groups";

/** Props for the EditArrangementModal component -- a form dialog for editing an arrangement's name and description. */
interface EditArrangementModalProps {
  /** The arrangement record being edited, with current field values */
  arrangement: {
    _id: string;
    arrangementName: string;
    description?: string;
    /** Project ID the arrangement belongs to */
    projectId: string;
    /** Company ID the arrangement belongs to */
    companyId: string;
  };
  /** Callback to close the modal */
  onClose: () => void;
}

export const EditArrangementModal = ({
  arrangement,
  onClose,
}: EditArrangementModalProps) => {
  const [name, setName] = useState(arrangement.arrangementName);
  const [description, setDescription] = useState(arrangement.description || "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      patchGroup(arrangement._id, {
        groupName: name,
        description,
        projectId: `${arrangement.projectId}`,
        companyId: arrangement.companyId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["arrangement", arrangement._id],
      });
      queryClient.invalidateQueries({
        queryKey: ["Groups"],
      });
      toast.success("Arrangement updated successfully");
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update arrangement");
    },
  });

  return (
    <div className="fixed inset-0 bg-gray-400/30 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Arrangement
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Close</span>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Arrangement Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border-gray-300 text-gray-700 shadow-sm py-2 px-2 focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (Optional)
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm py-2 px-2 focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex justify-center rounded-md border border-transparent bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
