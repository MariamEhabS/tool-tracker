import type { Category } from "@/api/endpoints/categories";
import { PROCORE_TOOL_OPTIONS } from "@/api/endpoints/categories";

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  disabled?: boolean;
}

export function CategoryCard({
  category,
  onEdit,
  onDelete,
  disabled = false,
}: CategoryCardProps) {
  // Get the Procore tool label if mapped
  const procoreToolLabel = category.procoreTool
    ? PROCORE_TOOL_OPTIONS.find((t) => t.value === category.procoreTool)?.label
    : null;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {category.categoryName}
          </h4>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {category.categoryClass}
          </p>
          {procoreToolLabel && (
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                <i className="bx bx-link text-xs" />
                {procoreToolLabel}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(category)}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={`Edit ${category.categoryName}`}
          >
            <i className="bx bx-pencil text-lg" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            aria-label={`Delete ${category.categoryName}`}
          >
            <i className="bx bx-trash text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryCard;
