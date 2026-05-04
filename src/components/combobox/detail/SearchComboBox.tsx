import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useCombobox } from "@/components/combobox/Combobox";

/** Primitive value type for SearchComboBox options. */
export type SearchComboBoxValue = string | number;

/** A selectable option for SearchComboBox with display and behavior settings. */
export type SearchComboBoxOption = {
  /** Display text for the option */
  label: string;
  /** Value used for selection tracking and onChange callback */
  value: SearchComboBoxValue;
  /** When true, the option is shown but cannot be selected */
  disabled?: boolean;
  /** When true, hides the radio/checkbox indicator for this option */
  hideIndicator?: boolean;
  /** When true, renders a visual divider line below this option */
  dividerBelow?: boolean;
  /** When true, this option is hidden when the user has typed a non-empty query */
  hideWhenQueryNotEmpty?: boolean;
};

/**
 * Props for the SearchComboBox component -- a filterable dropdown with text input,
 * supporting single/multi select, grouped options, infinite scroll, free-text entry,
 * and portal rendering.
 */
type SearchComboBoxProps = {
  /** Flat list of selectable options (use either `options` or `groups`, not both) */
  options?: SearchComboBoxOption[];
  /** Grouped options with section headers (use either `options` or `groups`, not both) */
  groups?: { label: string; options: SearchComboBoxOption[] }[];
  /** Currently selected value(s); single value for single-select, array for multi-select */
  value: SearchComboBoxValue | SearchComboBoxValue[] | undefined;
  /** Callback fired when the selection changes */
  onChange: (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => void;
  /** Placeholder text for the input. Defaults to "Select...". */
  placeholder?: string;
  id?: string;
  className?: string;
  /** Additional CSS classes applied to the text input element */
  inputClassName?: string;
  /** Maximum height of the dropdown menu in pixels. Defaults to 280. */
  maxMenuHeightPx?: number;
  /** Enable multi-select mode with checkboxes. Defaults to false. */
  multiple?: boolean;
  /** Callback fired when the user scrolls near the bottom of the dropdown (for infinite scroll / pagination) */
  onEndReached?: () => void;
  /** Pixel threshold from the bottom to trigger onEndReached. Defaults to 24. */
  endReachedThresholdPx?: number;
  /** When true, shows a loading spinner at the bottom of the dropdown */
  loading?: boolean;
  /** When true, hides the clear selection "X" button */
  hideClearButton?: boolean;
  /** Optional callback to expose free-typed input text (for free-text entries) */
  onQueryChange?: (next: string) => void;
  /** Optional controlled query value (when provided, component becomes controlled) */
  query?: string;
  /** Optional callback when dropdown opens */
  onOpen?: () => void;
  /** Render dropdown in a portal to avoid overflow clipping issues */
  usePortal?: boolean;
  /** Hide dropdown when there are no matching results (instead of showing "No results") */
  hideNoResults?: boolean;
  /** Allow committing free-typed values with Enter/blur. Defaults to true. */
  allowCustomValue?: boolean;
};

export default function SearchComboBox(props: SearchComboBoxProps) {
  const {
    options,
    groups,
    value,
    onChange,
    placeholder = "Select...",
    id,
    className = "",
    inputClassName = "",
    maxMenuHeightPx = 280,
    multiple = false,
    onEndReached,
    endReachedThresholdPx = 24,
    loading = false,
    hideClearButton = false,
    onQueryChange,
    query: controlledQuery,
    onOpen,
    usePortal = false,
    hideNoResults = false,
    allowCustomValue = true,
  } = props;

  const [internalQuery, setInternalQuery] = useState("");
  const isControlled = controlledQuery !== undefined;
  const query = isControlled ? controlledQuery : internalQuery;
  const {
    open,
    setOpen,
    shouldRender,
    entered,
    activeIndex,
    setActiveIndex,
    setRootNode,
    setListNode,
    dropUp,
    recomputePlacement,
    rootNode,
  } = useCombobox({ sourceId: "search-combobox", maxMenuHeightPx });
  const instanceId = useId();
  const listId = useMemo(
    () => (id ? `${id}-listbox` : `scb-list-${instanceId}`),
    [id, instanceId],
  );

  // Portal positioning state
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});

  // Calculate portal position based on input element
  const updatePortalPosition = useCallback(() => {
    if (!usePortal || !rootNode) return;
    const rect = rootNode.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldDropUp =
      spaceBelow < maxMenuHeightPx && spaceAbove > spaceBelow;

    setPortalStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(shouldDropUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  }, [usePortal, rootNode, maxMenuHeightPx]);

  // Update portal position when open or on scroll/resize
  useEffect(() => {
    if (!usePortal || !open) return;
    updatePortalPosition();
    const handleUpdate = () => updatePortalPosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [usePortal, open, updatePortalPosition]);

  const computePlacement = useCallback(() => {
    recomputePlacement();
  }, [recomputePlacement]);

  useEffect(() => {
    if (!open) return;
    computePlacement();
    const handler = () => computePlacement();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, computePlacement]);

  useEffect(() => {
    if (open && onOpen) {
      onOpen();
    }
  }, [open, onOpen]);

  const flatAllOptions = useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((g) => g.options);
    }
    return options ?? [];
  }, [options, groups]);

  const valueArray: SearchComboBoxValue[] = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value : [];
    return typeof value === "string" || typeof value === "number"
      ? [value]
      : [];
  }, [value, multiple]);

  const selectedOptions = useMemo(() => {
    if (!valueArray.length) return [] as SearchComboBoxOption[];
    const set = new Set(valueArray);
    return flatAllOptions.filter((o) => set.has(o.value));
  }, [flatAllOptions, valueArray]);

  const optionIdFor = useCallback(
    (value: SearchComboBoxValue): string => {
      const sanitized = String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
      return `${listId}-opt-${sanitized}`;
    },
    [listId],
  );

  const { filteredFlat, filteredGroups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (groups && groups.length > 0) {
      const g = groups
        .map((grp) => ({
          label: grp.label,
          options: grp.options.filter((o) => {
            if (q && o.hideWhenQueryNotEmpty) return false;
            return !q || o.label.toLowerCase().includes(q);
          }),
        }))
        .filter((grp) => grp.options.length > 0);
      return {
        filteredFlat: g.flatMap((grp) => grp.options),
        filteredGroups: g,
      };
    }
    const base = options ?? [];
    const arr = q
      ? base.filter((o) => {
          if (o.hideWhenQueryNotEmpty) return false;
          return o.label.toLowerCase().includes(q);
        })
      : base;
    return { filteredFlat: arr, filteredGroups: undefined as undefined };
  }, [options, groups, query]);

  const hasResults = filteredGroups
    ? filteredGroups.length > 0
    : filteredFlat.length > 0;
  // Allow dropdown if: no custom query handler, has results, is loading, or has onOpen handler (lazy loading)
  // When hideNoResults is true, don't show dropdown if there are no matching results
  const allowDropdown = hideNoResults
    ? hasResults || loading
    : !onQueryChange || hasResults || loading || !!onOpen;

  useEffect(() => {
    if (!open) return;
    setActiveIndex(filteredFlat.length ? 0 : -1);
  }, [open, filteredFlat.length, setActiveIndex]);

  useEffect(() => {
    if (!open) return;
    const active =
      activeIndex >= 0 && activeIndex < filteredFlat.length
        ? filteredFlat[activeIndex]
        : undefined;
    if (!active) return;
    try {
      const el = document.getElementById(optionIdFor(active.value));
      if (el) el.scrollIntoView({ block: "nearest" });
    } catch {
      /* noop */
    }
  }, [open, activeIndex, filteredFlat, optionIdFor]);

  function commitSingle(next?: SearchComboBoxValue) {
    onChange(next);
    setOpen(false);
  }

  function toggleMulti(next: SearchComboBoxValue) {
    const curr = new Set(valueArray);
    if (curr.has(next)) curr.delete(next);
    else curr.add(next);
    onChange(Array.from(curr));
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (open) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filteredFlat.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // If an option is highlighted, select it
        if (activeIndex >= 0 && activeIndex < filteredFlat.length) {
          const opt = filteredFlat[activeIndex];
          if (!opt || opt.disabled) return;
          if (multiple) toggleMulti(opt.value);
          else commitSingle(opt.value);
        } else if (!multiple && allowCustomValue && query.trim()) {
          // If no option is highlighted but there's text, commit the text as free-text entry
          commitSingle(query.trim());
        }
      }
    }
  }

  function summaryLabel(): string {
    if (multiple) {
      if (open) return query;
      if (selectedOptions.length === 0) return "";
      if (selectedOptions.length <= 2)
        return selectedOptions.map((o) => o.label).join(", ");
      return `${selectedOptions.length} selected`;
    }
    return open ? query : (selectedOptions[0]?.label ?? query);
  }

  const baseInput =
    "block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-400 focus:ring-brand-400 sm:text-sm pr-16";
  const inputIsActive = selectedOptions.length > 0;

  return (
    <div
      ref={setRootNode}
      className={`relative ${className}`}
      id={id}
    >
      <div className="relative">
        <input
          type="text"
          className={`${baseInput} ${inputIsActive ? "bg-brand-50 text-brand-700 border-2 border-yellow-400 font-medium focus:border-yellow-400" : ""} ${inputClassName}`}
          placeholder={placeholder}
          value={hideClearButton ? query : summaryLabel()}
          onChange={(e) => {
            const newValue = e.target.value;
            if (isControlled) {
              if (onQueryChange) onQueryChange(newValue);
            } else {
              setInternalQuery(newValue);
              if (onQueryChange) onQueryChange(newValue);
            }
            if (!open && allowDropdown) setOpen(true);
          }}
          onFocus={() => {
            if (allowDropdown) setOpen(true);
          }}
          onBlur={() => {
            // On blur, if we have free-text query and no selection, commit it as the value
            // Use setTimeout to allow click events in dropdown to fire first
            setTimeout(() => {
              if (
                !multiple &&
                allowCustomValue &&
                query.trim() &&
                selectedOptions.length === 0
              ) {
                onChange(query.trim());
              }
            }, 200);
          }}
          onKeyDown={onInputKeyDown}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && activeIndex >= 0 && filteredFlat[activeIndex]
              ? optionIdFor(filteredFlat[activeIndex].value)
              : undefined
          }
        />
        {inputIsActive && !hideClearButton ? (
          <button
            type="button"
            aria-label="Clear selection"
            className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${onQueryChange ? "right-4" : "right-8"}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(multiple ? [] : undefined);
              if (isControlled) {
                if (onQueryChange) onQueryChange("");
              } else {
                setInternalQuery("");
              }
              setOpen(true);
            }}
          >
            <i className="bx bx-x"></i>
          </button>
        ) : null}
        {onQueryChange ? null : (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setOpen(!open)}
          >
            <i className="bx bx-chevron-down"></i>
          </button>
        )}
      </div>

      {(() => {
        if (!shouldRender || !allowDropdown) return null;

        const dropdownContent = (
          <div
            className={`${usePortal ? "" : "absolute left-0 right-0"} z-10 max-h-64 overflow-auto ${!usePortal && dropUp ? "bottom-full mb-2 origin-bottom-left" : !usePortal ? "top-full mt-2 origin-top-left" : ""} rounded-md bg-white shadow-lg ring-1 ring-gray-300 ring-opacity-5 focus:outline-none transition-all duration-200 ease-out transform ${entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
            style={usePortal ? portalStyle : undefined}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (
                el.scrollTop + el.clientHeight >=
                el.scrollHeight - endReachedThresholdPx
              ) {
                if (onEndReached) {
                  onEndReached();
                }
              }
            }}
          >
            <ul
              ref={setListNode}
              role="listbox"
              id={listId}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (!open) return;
                if (e.key === "Escape") {
                  setOpen(false);
                  return;
                }
              }}
              className="py-1"
              style={{ maxHeight: maxMenuHeightPx }}
            >
              {filteredFlat.length === 0 ? (
                <>
                  <li className="px-3 py-2 text-sm text-gray-500">
                    No results
                  </li>
                  <li aria-live="polite" className="sr-only">
                    No results
                  </li>
                </>
              ) : filteredGroups ? (
                filteredGroups.map((grp) => {
                  return (
                    <li key={`grp-${grp.label}`} className="py-1">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {grp.label}
                      </div>
                      <ul>
                        {grp.options.map((opt) => {
                          const idx = filteredFlat.findIndex(
                            (o) => o.value === opt.value,
                          );
                          const isSelected = valueArray.includes(opt.value);
                          return (
                            <li
                              key={String(opt.value)}
                              role="option"
                              aria-selected={isSelected}
                              aria-current={
                                idx === activeIndex ? "true" : undefined
                              }
                              id={optionIdFor(opt.value)}
                              className={`px-3 py-1.5 text-sm cursor-pointer flex items-center ${idx === activeIndex ? "bg-gray-50" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""} ${opt.dividerBelow ? "border-b border-gray-200 mb-1" : ""}`}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => {
                                if (!opt.disabled) {
                                  if (multiple) {
                                    toggleMulti(opt.value);
                                  } else {
                                    commitSingle(opt.value);
                                  }
                                }
                              }}
                            >
                              {!opt.hideIndicator ? (
                                multiple ? (
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 mr-2"
                                    readOnly
                                    checked={isSelected}
                                  />
                                ) : (
                                  <input
                                    type="radio"
                                    name={`scb-${id ?? "combobox"}`}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 mr-2"
                                    readOnly
                                    checked={isSelected}
                                  />
                                )
                              ) : null}
                              <span className="text-gray-700">{opt.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })
              ) : (
                filteredFlat.map((opt, idx) => {
                  const isSelected = valueArray.includes(opt.value);
                  return (
                    <li
                      key={String(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      aria-current={idx === activeIndex ? "true" : undefined}
                      id={optionIdFor(opt.value)}
                      className={`px-3 py-1.5 text-sm cursor-pointer flex items-center ${idx === activeIndex ? "bg-gray-50" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""} ${opt.dividerBelow ? "border-b border-gray-200 mb-1" : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        if (!opt.disabled) {
                          if (multiple) {
                            toggleMulti(opt.value);
                          } else {
                            commitSingle(opt.value);
                          }
                        }
                      }}
                    >
                      {!opt.hideIndicator ? (
                        multiple ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 mr-2"
                            readOnly
                            checked={isSelected}
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`scb-${id ?? "combobox"}`}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 mr-2"
                            readOnly
                            checked={isSelected}
                          />
                        )
                      ) : null}
                      <span className="text-gray-700">{opt.label}</span>
                    </li>
                  );
                })
              )}
              {loading ? (
                <li className="px-3 py-2 text-sm text-gray-500 flex items-center justify-center">
                  <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin"></span>
                </li>
              ) : null}
            </ul>
          </div>
        );

        return usePortal
          ? createPortal(dropdownContent, document.body)
          : dropdownContent;
      })()}
    </div>
  );
}
