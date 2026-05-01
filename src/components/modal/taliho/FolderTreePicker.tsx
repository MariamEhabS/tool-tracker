import { useState } from "react";
import type { FolderOption } from "@components/modal/taliho/MoveModal";

type FolderTreePickerProps = {
  /** Depth-first ordered folder options (use buildFolderTree output) */
  folders: FolderOption[];
  /** Currently selected folder value */
  selectedFolderId: string;
  /** Folder to display as "(current)" and disable selection */
  currentFolderId?: string;
  /** Callback when user selects a folder */
  onSelect: (folderId: string) => void;
  /** Disable the entire picker */
  disabled?: boolean;
};

export default function FolderTreePicker({
  folders,
  selectedFolderId,
  currentFolderId,
  onSelect,
  disabled = false,
}: FolderTreePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.trim().toLowerCase();

  // When searching, show flat filtered list; otherwise show hierarchy
  const visibleFolders = isSearching
    ? folders.filter((f) => f.label.toLowerCase().includes(query))
    : folders.filter((f) => {
        // Hide children of collapsed folders
        if (f.depth === 0 || !f.parentId) return true;
        // Walk up ancestors -- if any ancestor is collapsed, hide this node
        let parentId: string | null | undefined = f.parentId;
        while (parentId) {
          if (collapsedIds.has(parentId)) return false;
          const parent = folders.find((p) => p.value === parentId);
          parentId = parent?.parentId;
        }
        return true;
      });

  function toggleCollapse(folderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  const isCurrent = (f: FolderOption) =>
    Boolean(currentFolderId && f.value === currentFolderId);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Search input */}
      <div className="p-2 border-b border-gray-200">
        <div className="relative rounded-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="bx bx-search text-gray-400 text-base" />
          </div>
          <input
            type="text"
            autoComplete="off"
            className="block w-full pl-9 pr-8 py-1.5 text-sm ring-[0.5px] ring-gray-300 border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setSearchQuery("")}
            >
              <i className="bx bx-x text-base" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable folder list */}
      <div className="max-h-64 overflow-y-auto">
        {visibleFolders.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 text-center">
            {isSearching
              ? "No folders match your search"
              : "No folders available"}
          </p>
        ) : (
          <div role="listbox" aria-label="Folder tree">
            {visibleFolders.map((folder) => {
              const isSelected = folder.value === selectedFolderId;
              const isCurrentFolder = isCurrent(folder);
              const isDisabled = disabled || isCurrentFolder;
              const depth = isSearching ? 0 : (folder.depth ?? 0);
              const isCollapsed = collapsedIds.has(folder.value);

              return (
                <button
                  key={folder.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) onSelect(folder.value);
                  }}
                  className={[
                    "w-full flex items-center py-2 pr-3 text-sm transition-colors",
                    isSelected
                      ? "bg-yellow-50 border-l-2 border-yellow-500"
                      : "border-l-2 border-transparent",
                    isCurrentFolder
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-50 cursor-pointer",
                  ].join(" ")}
                  style={{ paddingLeft: `${depth * 20 + 12}px` }}
                >
                  {/* Expand/collapse chevron */}
                  {folder.hasChildren && !isSearching ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => toggleCollapse(folder.value, e)}
                      className="flex items-center justify-center w-5 h-5 mr-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors"
                    >
                      <i
                        className={`bx text-base ${isCollapsed ? "bx-chevron-right" : "bx-chevron-down"}`}
                      />
                    </span>
                  ) : (
                    <span className="w-5 mr-1" />
                  )}

                  {/* Folder icon */}
                  <i className="bx bxs-folder text-yellow-500 text-base mr-2 flex-shrink-0" />

                  {/* Folder name */}
                  <span className="flex-1 text-left truncate text-gray-800">
                    {folder.label}
                  </span>

                  {/* Current folder badge */}
                  {isCurrentFolder && (
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      (current)
                    </span>
                  )}

                  {/* Selected checkmark */}
                  {isSelected && !isCurrentFolder && (
                    <i className="bx bx-check text-yellow-600 text-lg ml-2 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
