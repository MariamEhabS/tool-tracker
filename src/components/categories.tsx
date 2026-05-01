// import { count } from "console";

export const Categories = ({
  category,
  onClick,
  className,
  count,
}: {
  category: string;
  onClick: (category: string) => void;
  className: string;
  count: number | null;
}) => (
  <button
    className={`category-button relative text-sm font-semibold border border-gray-200 bg-white py-1 px-2 rounded-md min-w-[30%] text-gray-700 ${className}`}
    onClick={() => onClick(category)}
  >
    <span>{category}</span>
    {count && (
      <span className="absolute -right-3 -top-3 bg-yellow-200 border border-yellow-400 shadow-md text-black px-2 py-[4px] text-xs rounded-full">
        {count}
      </span>
    )}
  </button>
);
