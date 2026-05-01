import React, { useState, useEffect, useMemo } from "react";
import { FolderOutlineIcon } from "../../assets/icons/FolderOutlineIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { ChevDownIcon } from "../../assets/icons/ChevDownIcon";
import { TrashCanIcon } from "../../assets/icons/TrashCanIcon";
import { SearchIcon } from "../../assets/icons/SearchIcon";
import { SortIcon } from "../../assets/icons/SortIcon";
import { ThreeDotIcon } from "../../assets/icons/ThreeDotIcon";
import { DataItem, DataTableProps } from "../../types";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  clearFilters,
  getPaginationNumbers,
  toggleGroupActions,
} from "../../utils/helpers/tableHelpers";

export const DataTable = <T extends DataItem>({
  title = "Data",
  description = "Manage your data",
  titleIcon = <FolderOutlineIcon />,
  data = [],
  columns = [],
  actions = [],
  groupActions = [],
  filters = [],
  searchPlaceholder = "Search...",
  itemsPerPageOptions = [10, 20, 50],
  onRowClick,
  onCreateNew,
  createButtonText = "Create New",
  createButtonColor = "bg-yellow-500",
  totalItems,
  serverSidePagination = false,
  currentPage: controlledPage,
  onPageChange,
  onItemsPerPageChange,
  searchTerm,
  setSearchTerm,
  // isLoading
}: DataTableProps<T>) => {
  const [selectedItems, setSelectedItems] = useState<Set<string | number>>(
    new Set(),
  );
  const [currentPageState, setCurrentPageState] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(
    itemsPerPageOptions[0] || 10,
  );
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc";
  }>({
    key: null,
    direction: "asc",
  });
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [showGroupActions, setShowGroupActions] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );
  const navigate = useNavigate();

  const actualCurrentPage = serverSidePagination
    ? controlledPage || 1
    : currentPageState;

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isCurrentPage = (page: number) =>
    serverSidePagination ? controlledPage === page : currentPageState === page;

  const handlePageChange = (page: number) => {
    if (serverSidePagination) onPageChange?.(page);
    else setCurrentPageState(page);
  };

  const handleItemsPerPageChange = (value: number) => {
    if (serverSidePagination) {
      onItemsPerPageChange?.(value);
      onPageChange?.(1);
    } else {
      setItemsPerPage(value);
      setCurrentPageState(1);
    }
  };

  const handleItemSelect = (itemId: string | number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) newSelected.delete(itemId);
    else newSelected.add(itemId);
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (checked: boolean, dataSet: T[]) => {
    setSelectedItems(
      checked ? new Set(dataSet.map((item) => item.id)) : new Set(),
    );
  };

  const handleFilterChange = (
    filterKey: string,
    value: string,
    checked: boolean,
  ) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: prev[filterKey]
        ? checked
          ? [...prev[filterKey], value]
          : prev[filterKey].filter((v) => v !== value)
        : checked
          ? [value]
          : [],
    }));
    handlePageChange(1);
  };

  const handleSort = (key: string | null) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
  };

  const toggleDropdown = (dropdownId: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [dropdownId]: !prev[dropdownId] }));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdowns = document.querySelectorAll("[data-dropdown-id]");
      for (const dropdown of dropdowns) {
        if (dropdown.contains(event.target as Node)) return;
      }
      setOpenDropdowns({});
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredAndSortedData = useMemo(() => {
    const filtered = data.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(item).some((value) =>
          value
            ?.toString()
            .toLowerCase()
            .includes(`${searchTerm?.toLowerCase()}`),
        );
      const matchesFilters = Object.entries(activeFilters).every(
        ([key, values]) => {
          if (!values.length) return true;
          return values.includes(String(item[key]));
        },
      );
      return matchesSearch && matchesFilters;
    });
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        if ((aVal ?? "") < (bVal ?? ""))
          return sortConfig.direction === "asc" ? -1 : 1;
        if ((aVal ?? "") > (bVal ?? ""))
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, searchTerm, activeFilters, sortConfig]);

  const totalItemsToUse = serverSidePagination
    ? (totalItems ?? data.length)
    : filteredAndSortedData.length;

  const startIndex = (actualCurrentPage - 1) * itemsPerPage;
  const endIndex =
    Math.min(startIndex + itemsPerPage) > totalItemsToUse
      ? totalItemsToUse
      : Math.min(startIndex + itemsPerPage);
  const paginatedData = serverSidePagination
    ? data
    : filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(totalItemsToUse / itemsPerPage);

  return (
    <main className="flex-grow overflow-y-auto h-full ">
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          {currentPath == "/qrcode" ? null : (
            <div className="mb-4 md:mb-0">
              <h1 className=" text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <span>{titleIcon}</span>
                <span> {title}</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() =>
                toggleGroupActions({
                  showGroupActions,
                  setShowGroupActions,
                  setSelectedItems,
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition duration-150 ease-in-out active:scale-95 ${
                showGroupActions
                  ? "bg-yellow-50 text-yellow-700 ring-yellow-300"
                  : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
              }`}
            >
              <TilesIcon className=" !size-4" />
              Group Actions
            </button>
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className={`inline-flex items-center gap-2 rounded-md py-1.5 px-3 text-sm font-semibold text-white shadow-inner shadow-white/10 focus:outline-none transition duration-150 ease-in-out active:scale-95 ${createButtonColor} hover:opacity-90`}
              >
                {createButtonText}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative rounded-md shadow-sm border border-gray-300">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="!text-gray-600 !size-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm && setSearchTerm(e.target.value)
                  }
                  className="block w-full pl-10 pr-4 py-2 sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder={searchPlaceholder}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {filters.map((filter) => (
                <div
                  key={filter.key}
                  className="relative inline-block text-left"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown(`filter-${filter.key}`);
                    }}
                    className="inline-flex items-center justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    {filter.label}
                    <ChevDownIcon className="!size-3" />
                  </button>
                  {openDropdowns[`filter-${filter.key}`] && (
                    <div className="absolute left-0 z-50 mt-2 w-48 origin-top-left rounded-md bg-white shadow-lg focus:outline-none">
                      <div className="p-2 space-y-1 ">
                        {filter.options.map(
                          (option: { value: string; label: string }) => (
                            <label
                              key={option.value}
                              className="flex items-center px-2 py-1 text-sm rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  activeFilters[filter.key]?.includes(
                                    option.value,
                                  ) || false
                                }
                                onChange={(e) => {
                                  if (typeof option.value === "string") {
                                    handleFilterChange(
                                      filter.key,
                                      option.value,
                                      e.target.checked,
                                    );
                                  }
                                }}
                                className="h-4 w-4 rounded !border-gray-200  text-indigo-600 focus:ring-indigo-500 mr-2"
                              />
                              <span className="text-gray-500">
                                {option.label}
                              </span>
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  clearFilters(setActiveFilters, setCurrentPageState)
                }
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-gray-700 gap-1"
              >
                <TrashCanIcon className="!size-4" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        </div>

        {showGroupActions && (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              <span>{selectedItems.size}</span> items selected
            </span>
            <div className="space-x-2">
              {groupActions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => action.onClick(Array.from(selectedItems))}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition duration-150 ease-in-out active:scale-95 ${action.className || "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={`bg-white rounded-lg overflow-hidden flex-grow flex flex-col ${currentPath.includes("/project/") ? "h-[60vh]" : "h-[75vh]"}  `}
        >
          <div className="overflow-auto flex-grow h-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {showGroupActions && (
                    <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedItems.size === filteredAndSortedData.length &&
                          filteredAndSortedData.length > 0
                        }
                        onChange={(e) =>
                          handleSelectAll(
                            e.target.checked,
                            filteredAndSortedData,
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="sticky top-0 z-10 bg-gray-50 px-6 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <span>{column.label}</span>
                        {column.sortable === true && (
                          <button
                            onClick={() => handleSort(column.key)}
                            className="ml-1 p-0.5 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300"
                          >
                            <SortIcon className="text-gray-400 hover:text-gray-600 !size-4" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {actions.length > 0 && (
                    <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() =>
                      navigate({
                        to: `/${item.category}/${item.id}`,
                        search: {},
                      })
                    }
                  >
                    {showGroupActions && (
                      <td className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleItemSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 whitespace-nowrap text-sm"
                      >
                        {column.render
                          ? column.render(item[column.key], item)
                          : (item[column.key] as React.ReactNode)}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div
                          className="relative inline-block text-left"
                          data-dropdown-id={`actions-${item.id}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDropdown(`actions-${item.id}`);
                            }}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                          >
                            <ThreeDotIcon className="!text-gray-400 !size-5" />
                          </button>
                          {openDropdowns[`actions-${item.id}`] && (
                            <div className="absolute right-0 z-10 mt-2 w-40 bg-white rounded-md shadow-lg ring-1 ring-gray-200 ring-opacity-5 focus:outline-none">
                              <div className="py-1 rounded-md overflow-hidden">
                                {actions.map((action, actionIndex: number) => (
                                  <button
                                    key={actionIndex}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      action.onClick(item);
                                      setOpenDropdowns({});
                                    }}
                                    className={`group flex items-center font-light w-full px-4 gap-2  py-2 text-sm text-left hover:bg-gray-100 ${action.className || "text-gray-700 hover:text-gray-900"}`}
                                  >
                                    {action.icon}
                                    {/* <i className={`${action.icon} h-4 w-4 mr-2`}></i> */}
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 ">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() =>
                  handlePageChange(Math.max(1, currentPageState - 1))
                }
                disabled={currentPageState === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  handlePageChange(Math.max(1, actualCurrentPage + 1))
                }
                disabled={actualCurrentPage === 1}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {`Showing ${startIndex + 1} to ${endIndex} of ${totalItemsToUse} results`}
                </p>
              </div>
              <div className="flex-1 flex justify-center">
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() =>
                      handlePageChange(Math.max(1, actualCurrentPage - 1))
                    }
                    disabled={actualCurrentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevLeftIcon />
                  </button>
                  {getPaginationNumbers(currentPageState, totalPages).map(
                    (page, index) => (
                      <React.Fragment key={index}>
                        {page === "..." ? (
                          <span className=" relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            ...
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              typeof page === "number" && handlePageChange(page)
                            }
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              isCurrentPage(Number(page))
                                ? "z-10 bg-yellow-50 border-yellow-500 text-yellow-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        )}
                      </React.Fragment>
                    ),
                  )}
                  <button
                    onClick={() =>
                      handlePageChange(Math.max(1, actualCurrentPage + 1))
                    }
                    disabled={
                      totalPages === 0 || actualCurrentPage === totalPages
                    }
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevRightIcon />
                  </button>
                </nav>
              </div>
              <div className="flex items-center">
                <select
                  value={itemsPerPage}
                  onChange={(e) =>
                    handleItemsPerPageChange(Number(e.target.value))
                  }
                  className="block w-auto pl-2 pr-2  py-1.5 text-base border border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md"
                >
                  {itemsPerPageOptions.map((option) => (
                    <option className="" key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 ml-2">items</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
