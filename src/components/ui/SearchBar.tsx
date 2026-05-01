import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

/** Props for the SearchBar component -- a text input with a search icon for filtering lists. */
export type SearchBarProps = {
  /** Current search text (controlled) */
  value: string;
  /** Callback fired with the new text value on each keystroke */
  onChange: (value: string) => void;
  /** Placeholder text. Defaults to "Search...". */
  placeholder?: string;
  className?: string;
  /** Custom icon element rendered in the left position; replaces the default magnifying glass */
  leftIcon?: ReactNode;
  /** Additional native input attributes forwarded to the underlying `<input>` element */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "placeholder"
  >;
};

export default function SearchBar(props: SearchBarProps) {
  const {
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    leftIcon,
    inputProps,
  } = props;
  return (
    <div className={`relative rounded-md shadow-sm ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {leftIcon ?? <i className="bx bx-search text-gray-400"></i>}
      </div>
      <input
        type="text"
        autoComplete="off"
        className="block w-full pl-10 pr-4 py-2 sm:text-sm ring-[0.5px] ring-gray-300 border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
        placeholder={placeholder}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        {...inputProps}
      />
    </div>
  );
}
