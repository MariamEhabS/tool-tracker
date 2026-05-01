import { useState, useMemo, useRef, useEffect } from "react";
import { useCategories, type Category } from "@/api/endpoints/categories";

interface CategorySelectorProps {
  companyId: string;
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CategorySelector({
  companyId,
  selectedCategories,
  onChange,
  disabled = false,
  placeholder = "Select categories (optional)",
  className = "",
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [], isLoading } = useCategories(companyId);

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
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCategories]);

  // Get selected category objects for display
  const selectedCategoryObjects = useMemo(() => {
    return categories.filter((c) =>
      selectedCategories.includes(c.categoryName),
    );
  }, [categories, selectedCategories]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategory = (categoryName: string) => {
    if (selectedCategories.includes(categoryName)) {
      onChange(selectedCategories.filter((c) => c !== categoryName));
    } else {
      onChange([...selectedCategories, categoryName]);
    }
  };

  const removeCategory = (categoryName: string) => {
    onChange(selectedCategories.filter((c) => c !== categoryName));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Categories Tags */}
      {selectedCategoryObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCategoryObjects.map((category) => (
            <span
              key={category._id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-md"
            >
              {category.categoryName}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCategory(category.categoryName)}
                  className="text-green-500 hover:text-green-700"
                  aria-label={`Remove ${category.categoryName}`}
                >
                  <i className="bx bx-x text-sm" />
                </button>
              )}
            </span>
          ))}
          {!disabled && selectedCategoryObjects.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Input / Trigger */}
      <div
        className={`relative flex items-center border rounded-md transition-colors ${
          isOpen
            ? "border-yellow-500 ring-1 ring-yellow-500"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-pointer"}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <i className="bx bx-category text-gray-400 ml-3" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 py-2 px-2 text-sm bg-transparent disabled:cursor-not-allowed"
          style={{ border: "none", outline: "none", boxShadow: "none" }}
          onFocus={() => setIsOpen(true)}
        />
        {isLoading ? (
          <i className="bx bx-loader-alt bx-spin text-gray-400 mr-3" />
        ) : (
          <i
            className={`bx ${isOpen ? "bx-chevron-up" : "bx-chevron-down"} text-gray-400 mr-3`}
          />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {categories.length === 0 && !isLoading ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              <i className="bx bx-folder-open text-2xl text-gray-300 mb-2 block" />
              No categories available.
              <br />
              <span className="text-xs">
                Create categories in Settings to organize your QR codes.
              </span>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="px-3 py-3 text-center text-sm text-gray-500">
              No categories match "{searchQuery}"
            </div>
          ) : (
            <div className="py-1">
              {categoriesByClass.map(([className, classCategories]) => (
                <div key={className}>
                  {/* Class Header */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 sticky top-0">
                    {className}
                  </div>
                  {/* Category Options */}
                  {classCategories.map((category) => {
                    const isSelected = selectedCategories.includes(
                      category.categoryName,
                    );
                    return (
                      <button
                        key={category._id}
                        type="button"
                        onClick={() => toggleCategory(category.categoryName)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                          isSelected ? "bg-green-50" : ""
                        }`}
                      >
                        <span
                          className={
                            isSelected
                              ? "text-green-700 font-medium"
                              : "text-gray-700"
                          }
                        >
                          {category.categoryName}
                        </span>
                        {isSelected && (
                          <i className="bx bx-check text-green-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategorySelector;
