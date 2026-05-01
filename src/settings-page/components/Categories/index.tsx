import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import { CategoryCard } from "./CategoryCard";
import { CategoryModal } from "./CategoryModal";
import { CategoryCSVUploadModal } from "./CategoryCSVUploadModal";
import {
  useCategories,
  useCategoryClasses,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/api/endpoints/categories";

interface CategoriesProps {
  companyId: string;
  readOnly?: boolean;
}

export function Categories({ companyId, readOnly = false }: CategoriesProps) {
  // State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } =
    useCategories(companyId);
  const { data: categoryClasses = [] } = useCategoryClasses(companyId);

  // Mutations
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory(companyId);
  const deleteMutation = useDeleteCategory(companyId);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.categoryName.toLowerCase().includes(query) ||
        c.categoryClass.toLowerCase().includes(query),
    );
  }, [categories, searchQuery]);

  // Group categories by class
  const categoriesByClass = useMemo(() => {
    const grouped: Record<string, Category[]> = {};
    filteredCategories.forEach((category) => {
      const className = category.categoryClass || "Uncategorized";
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(category);
    });
    // Sort classes alphabetically
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCategories]);

  // Handlers
  const handleCreate = async (data: {
    categoryName: string;
    categoryClass: string;
  }) => {
    try {
      await createMutation.mutateAsync({
        categoryName: data.categoryName.trim(),
        categoryClass: data.categoryClass.trim(),
        companyId,
      });
      toast.success("Category created successfully");
      setShowCreateModal(false);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create category",
      );
    }
  };

  const handleUpdate = async (data: {
    categoryName: string;
    categoryClass: string;
  }) => {
    if (!editingCategory) return;
    try {
      await updateMutation.mutateAsync({
        categoryId: editingCategory._id,
        input: {
          categoryName: data.categoryName.trim(),
          categoryClass: data.categoryClass.trim(),
        },
      });
      toast.success("Category updated successfully");
      setEditingCategory(null);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update category",
      );
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    try {
      await deleteMutation.mutateAsync(deletingCategory._id);
      toast.success("Category deleted successfully");
      setDeletingCategory(null);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete category",
      );
    }
  };

  const isAnyMutationLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header with Create Button and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:border-yellow-500 focus:ring-yellow-500"
            />
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              leftIconClass="bx bx-plus"
            >
              Add Category
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCSVUploadModal(true)}
              leftIconClass="bx bx-upload"
            >
              Import CSV
            </Button>
          </div>
        )}
      </div>

      {/* Categories List */}
      {categoriesLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <i className="bx bx-folder-open text-4xl text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            No categories yet. Categories help organize your QR code template
            names.
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              leftIconClass="bx bx-plus"
            >
              Create Your First Category
            </Button>
          )}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-8">
          <i className="bx bx-search text-3xl text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            No categories match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoriesByClass.map(([className, classCategories]) => (
            <div key={className}>
              {/* Class Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {className}
                </span>
                <span className="text-xs text-gray-400">
                  ({classCategories.length})
                </span>
              </div>
              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {classCategories.map((category) => (
                  <CategoryCard
                    key={category._id}
                    category={category}
                    onEdit={setEditingCategory}
                    onDelete={setDeletingCategory}
                    disabled={readOnly || isAnyMutationLoading}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total Count */}
      {categories.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          {filteredCategories.length === categories.length
            ? `${categories.length} categories`
            : `Showing ${filteredCategories.length} of ${categories.length} categories`}
        </div>
      )}

      {/* Create Modal */}
      <CategoryModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        categoryClasses={categoryClasses}
        isLoading={createMutation.isPending}
      />

      {/* Edit Modal */}
      <CategoryModal
        open={Boolean(editingCategory)}
        onClose={() => setEditingCategory(null)}
        onSubmit={handleUpdate}
        category={editingCategory}
        categoryClasses={categoryClasses}
        isLoading={updateMutation.isPending}
      />

      {/* CSV Upload Modal */}
      <CategoryCSVUploadModal
        open={showCSVUploadModal}
        onClose={() => setShowCSVUploadModal(false)}
        companyId={companyId}
        existingCategories={categories}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        title="Delete Category"
        subtitle="This action cannot be undone"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeletingCategory(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              leftIconClass={
                deleteMutation.isPending
                  ? "bx bx-loader-alt bx-spin"
                  : "bx bx-trash"
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Category"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-gray-700">
              Are you sure you want to delete the category{" "}
              <strong>"{deletingCategory?.categoryName}"</strong>?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This will remove the category from your company. QR codes using
              this category will not be affected.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Categories;
