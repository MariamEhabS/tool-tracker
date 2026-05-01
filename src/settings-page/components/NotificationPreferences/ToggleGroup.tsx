import type { ReactNode } from "react";

export interface ToggleItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  iconBgColor: string;
  checked: boolean;
}

interface ToggleGroupProps {
  items: ToggleItem[];
  disabled?: boolean;
  onToggle: (id: string, checked: boolean) => void;
}

export function ToggleGroup({
  items,
  disabled = false,
  onToggle,
}: ToggleGroupProps) {
  return (
    <div className="divide-y divide-gray-200">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between py-3"
          data-testid={`toggle-item-${item.id}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${item.iconBgColor}`}
            >
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={item.checked}
            aria-label={item.label}
            disabled={disabled}
            onClick={() => onToggle(item.id, !item.checked)}
            className={`
              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
              ${item.checked ? "bg-brand-500" : "bg-gray-200"}
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
            data-testid={`toggle-switch-${item.id}`}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                transition duration-200 ease-in-out
                ${item.checked ? "translate-x-5" : "translate-x-0"}
              `}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToggleGroup;
