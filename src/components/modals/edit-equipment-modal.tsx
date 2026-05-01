import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { PatchEquipmentDto } from "../../types";

/** Props for the EditEquipmentModal component -- a form dialog for editing equipment details (name, ID, specification, description). */
interface EditEquipmentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The equipment record being edited, with current field values */
  equipment: {
    _id: string;
    equipmentName: string;
    equipmentID?: string;
    equipmentSpecification?: string;
    description?: string;
    project: string;
  };
  /** Async callback to persist changes; receives the form data and should throw on failure */
  onSave: (data: PatchEquipmentDto) => Promise<void>;
}

export function EditEquipmentModal({
  isOpen,
  onClose,
  equipment,
  onSave,
}: EditEquipmentModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatchEquipmentDto>({
    defaultValues: {
      equipmentName: equipment.equipmentName,
      equipmentID: equipment.equipmentID,
      equipmentSpecification: equipment.equipmentSpecification,
      description: equipment.description,
      projectId: equipment.project,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        equipmentName: equipment.equipmentName,
        equipmentID: equipment.equipmentID,
        equipmentSpecification: equipment.equipmentSpecification,
        description: equipment.description,
        projectId: equipment.project,
      });
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen, equipment, reset]);

  const onSubmit = async (data: PatchEquipmentDto) => {
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to update equipment:", error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`
      fixed inset-0 z-50 flex items-center justify-center
      transition-opacity duration-200 ease-in-out
      ${isVisible ? "bg-gray-400/30 bg-opacity-50 opacity-100" : "bg-opacity-0 opacity-0"}
    `}
    >
      <div
        className={`
        relative mx-auto p-5 border border-gray-300 w-xl shadow-lg rounded-md bg-white
        transform transition-all duration-200 ease-in-out
        ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}
      `}
      >
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Edit Equipment
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="equipmentName"
                className="block text-sm font-medium text-gray-700 text-left"
              >
                Equipment Name*
              </label>
              <input
                id="equipmentName"
                type="text"
                {...register("equipmentName", {
                  required: "Equipment name is required",
                })}
                className="mt-1 block w-full rounded-md px-2 py-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
              {errors.equipmentName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.equipmentName.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="equipmentID"
                className="block text-sm font-medium text-gray-700 text-left"
              >
                Equipment ID
              </label>
              <input
                id="equipmentID"
                type="text"
                {...register("equipmentID")}
                className="mt-1 block w-full rounded-md px-2 py-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="equipmentSpecification"
                className="block text-sm font-medium text-gray-700 text-left"
              >
                Specification
              </label>
              <input
                id="equipmentSpecification"
                type="text"
                {...register("equipmentSpecification")}
                className="mt-1 block w-full rounded-md px-2 py-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 text-left"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                {...register("description")}
                className="mt-1 block w-full rounded-md px-2 py-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              />
            </div>

            <input type="hidden" {...register("projectId")} />

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex justify-center rounded-md border border-transparent bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
