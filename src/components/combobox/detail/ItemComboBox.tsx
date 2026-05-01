import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../../ui/Button";
import { useCombobox } from "../Combobox";

/** Primitive value type for ItemComboBox options. */
export type ItemValue = string | number;

/** A single action option for ItemComboBox with optional icon and custom select handler. */
export type ItemComboBoxOption = {
  /** Display text for the action */
  label: string;
  /** Value passed to onChange when selected */
  value: ItemValue;
  /** Optional Boxicons class for an icon rendered before the label */
  iconClass?: string;
  /** When true, the option is shown but cannot be selected */
  disabled?: boolean;
  /** Custom callback fired when this specific option is selected (in addition to onChange) */
  onSelect?: () => void;
};

/** Props for the ItemComboBox component -- an actions dropdown menu triggered by a three-dot or custom button. */
type ItemComboBoxProps = {
  /** Available action options to display in the dropdown */
  options: ItemComboBoxOption[];
  /** Callback fired with the selected option's value */
  onChange?: (value: ItemValue) => void;
  /** Aria label for the trigger button. Defaults to "Actions". */
  buttonAriaLabel?: string;
  id?: string;
  className?: string;
  /** Tailwind width class for the dropdown menu, e.g., "w-48". Defaults to "w-48". */
  menuWidthClassName?: string;
  /** Tailwind z-index utility class for the dropdown panel; defaults to z-50 */
  menuZIndexClassName?: string;
  /** Horizontal alignment of the dropdown relative to the trigger. Defaults to "right". */
  align?: "left" | "right";
  /** Additional CSS classes for the trigger button */
  buttonClassName?: string;
  /** Additional CSS classes for the default dots icon content */
  buttonContentClassName?: string;
  /** Custom ReactNode content for the trigger button; replaces the default three-dot icon */
  buttonContent?: React.ReactNode;
  /** Variant to use for the Button trigger (defaults to 'icon') */
  buttonVariant?:
    | "primary"
    | "secondary"
    | "clear"
    | "danger"
    | "icon"
    | "iconGhost"
    | "iconDangerGhost"
    | "filter";
  /** Optional label for the Button trigger; used when buttonContent is not provided */
  buttonLabel?: string;
  /** Optional left icon class for the Button trigger when using buttonLabel */
  buttonLeftIconClass?: string;
  /** Optional right icon class for the Button trigger when using buttonLabel */
  buttonRightIconClass?: string;
  /** Unique identifier for the combobox instance to coordinate single-open behavior. Defaults to "item-combobox". */
  sourceId?: string;
};

export default function ItemComboBox(props: ItemComboBoxProps) {
  const {
    options,
    onChange,
    buttonAriaLabel = "Actions",
    id,
    className = "",
    menuWidthClassName = "w-48",
    menuZIndexClassName = "z-50",
    align = "right",
    buttonClassName = "",
    buttonContentClassName = "",
    buttonContent,
    buttonVariant = "icon",
    buttonLabel,
    buttonLeftIconClass,
    buttonRightIconClass,
    sourceId = "item-combobox",
  } = props;

  const {
    open,
    setOpen,
    shouldRender,
    entered,
    activeIndex,
    setActiveIndex,
    setRootNode,
    setListNode,
    rootNode,
  } = useCombobox({ sourceId });
  const [dropUp, setDropUp] = useState<boolean>(false);

  function getScrollableAncestor(node: HTMLElement | null): HTMLElement | null {
    let current: HTMLElement | null = node?.parentElement ?? null;
    while (current) {
      const style = window.getComputedStyle(current);
      const oy = style.overflowY;
      if (oy === "auto" || oy === "scroll") return current;
      current = current.parentElement;
    }
    return null;
  }

  const enabledOptions = useMemo(() => options ?? [], [options]);

  const computeDropDirection = useCallback(() => {
    try {
      const trigger = rootNode;
      if (!trigger) return;
      const scrollParent = getScrollableAncestor(trigger);
      const triggerRect = trigger.getBoundingClientRect();
      const containerBottom = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      // Estimate panel height: ~36px per option + padding, capped at 288px
      const estimated = Math.min(enabledOptions.length * 36 + 8, 288);
      const spaceBelow = containerBottom - triggerRect.bottom;
      setDropUp(spaceBelow < estimated);
    } catch {
      setDropUp(false);
    }
  }, [rootNode, enabledOptions.length]);

  useEffect(() => {
    if (open) computeDropDirection();
  }, [open, computeDropDirection]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(enabledOptions.length ? 0 : -1);
  }, [open, enabledOptions.length, setActiveIndex]);

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(enabledOptions.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (
      e.key === "Enter" &&
      activeIndex >= 0 &&
      activeIndex < enabledOptions.length
    ) {
      e.preventDefault();
      selectOption(enabledOptions[activeIndex]);
    }
  }

  function selectOption(opt: ItemComboBoxOption) {
    if (opt.disabled) return;
    if (opt.onSelect) opt.onSelect();
    if (onChange) onChange(opt.value);
    setOpen(false);
  }

  return (
    <div
      ref={setRootNode}
      className={`relative inline-block text-left ${className}`}
      id={id}
    >
      <Button
        type="button"
        aria-label={buttonAriaLabel}
        variant={buttonVariant}
        className={`justify-center ${buttonClassName}`}
        onClick={() => setOpen((o) => !o)}
        {...(buttonContent
          ? { children: buttonContent }
          : buttonLabel
            ? {
                leftIconClass: buttonLeftIconClass,
                rightIconClass: buttonRightIconClass,
                children: buttonLabel,
              }
            : {
                leftIconClass: `bx bx-dots-vertical-rounded ${buttonContentClassName ?? ""}`,
              })}
      />
      {shouldRender ? (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} ${menuZIndexClassName} ${menuWidthClassName} rounded-md bg-white shadow-lg ring-1 ring-gray-300 ring-opacity-5 focus:outline-none transition-all duration-200 ease-out transform ${dropUp ? (entered ? "opacity-100 -translate-y-0" : "opacity-0 translate-y-1") : entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"} ${dropUp ? "origin-bottom-right mb-2" : "origin-top-right mt-2"}`}
          style={dropUp ? { bottom: "100%" } : undefined}
        >
          <ul
            ref={setListNode}
            role="menu"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="py-1"
          >
            {enabledOptions.length === 0 ? (
              <li className="px-3 py-1.5 text-sm text-gray-500">No actions</li>
            ) : (
              enabledOptions.map((opt, idx) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="menuitem"
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${idx === activeIndex ? "bg-gray-50" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectOption(opt)}
                  disabled={opt.disabled}
                >
                  {opt.iconClass ? (
                    <i className={`${opt.iconClass} text-gray-500`}></i>
                  ) : null}
                  <span className="font-medium text-gray-700">{opt.label}</span>
                </button>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
