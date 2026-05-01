import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import type { Category } from "@/api/endpoints/categories";

interface CategoryFormData {
  categoryName: string;
  categoryClass: string;
}

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    categoryName: string;
    categoryClass: string;
  }) => Promise<void>;
  category?: Category | null;
  categoryClasses: string[];
  isLoading?: boolean;
}

export function CategoryModal({
  open,
  onClose,
  onSubmit,
  category,
  categoryClasses,
  isLoading = false,
}: CategoryModalProps) {
  const isEditMode = Boolean(category);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [filteredClasses, setFilteredClasses] = useState<string[]>([]);
  const classInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    defaultValues: {
      categoryName: "",
      categoryClass: "",
    },
  });

  const categoryClassValue = watch("categoryClass");

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (open) {
      reset({
        categoryName: category?.categoryName || "",
        categoryClass: category?.categoryClass || "",
      });
    }
  }, [open, category, reset]);

  // Filter classes based on input
  useEffect(() => {
    if (categoryClassValue) {
      const filtered = categoryClasses.filter((c) =>
        c.toLowerCase().includes(categoryClassValue.toLowerCase()),
      );
      setFilteredClasses(filtered);
    } else {
      setFilteredClasses(categoryClasses);
    }
  }, [categoryClassValue, categoryClasses]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        classInputRef.current &&
        !classInputRef.current.contains(event.target as Node)
      ) {
        setShowClassDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFormSubmit = async (data: CategoryFormData) => {
    await onSubmit({
      categoryName: data.categoryName,
      categoryClass: data.categoryClass,
    });
  };

  const handleSelectClass = (className: string) => {
    setValue("categoryClass", className);
    setShowClassDropdown(false);
  };

  const inputClassName =
    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed";
  const errorClassName = "mt-1 text-sm text-red-600";
  const labelClassName = "block text-sm font-medium text-gray-700";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Category" : "Create Category"}
      subtitle={
        isEditMode
          ? "Update the category name or class"
          : "Add a new category to organize your QR codes"
      }
      size="md"
      allowOverflow
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="category-form"
            disabled={isLoading}
            leftIconClass={
              isLoading
                ? "bx bx-loader-alt bx-spin"
                : isEditMode
                  ? "bx bx-check"
                  : "bx bx-plus"
            }
          >
            {isLoading
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Create Category"}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
      >
        <div className="space-y-4">
          {/* Category Name */}
          <div>
            <label htmlFor="categoryName" className={labelClassName}>
              Category Name
            </label>
            <input
              id="categoryName"
              type="text"
              placeholder="e.g., Submittals, Safety Documents"
              disabled={isLoading}
              className={`${inputClassName} ${errors.categoryName ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
              {...register("categoryName", {
                required: "Category name is required",
                minLength: {
                  value: 1,
                  message: "Category name must be at least 1 character",
                },
                maxLength: {
                  value: 100,
                  message: "Category name must be at most 100 characters",
                },
              })}
            />
            {errors.categoryName && (
              <p className={errorClassName}>{errors.categoryName.message}</p>
            )}
          </div>

          {/* Category Class with Autocomplete */}
          <div className="relative">
            <label htmlFor="categoryClass" className={labelClassName}>
              Category Class
            </label>
            <input
              id="categoryClass"
              type="text"
              placeholder="e.g., Construction, Safety, Architect & Engineer"
              disabled={isLoading}
              className={`${inputClassName} ${errors.categoryClass ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
              {...register("categoryClass", {
                required: "Category class is required",
                minLength: {
                  value: 1,
                  message: "Category class must be at least 1 character",
                },
                maxLength: {
                  value: 100,
                  message: "Category class must be at most 100 characters",
                },
              })}
              ref={(e) => {
                register("categoryClass").ref(e);
                classInputRef.current = e;
              }}
              onFocus={() => setShowClassDropdown(true)}
              autoComplete="off"
            />
            {errors.categoryClass && (
              <p className={errorClassName}>{errors.categoryClass.message}</p>
            )}

            {/* Class Autocomplete Dropdown */}
            {showClassDropdown && filteredClasses.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredClasses.map((className) => (
                  <button
                    key={className}
                    type="button"
                    onClick={() => handleSelectClass(className)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    {className}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Helper Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-700">
              <i className="bx bx-info-circle mr-1" />
              Categories help organize QR code template names. The class groups
              related categories together (e.g., all safety-related categories
              under "Safety").
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default CategoryModal;
