/**
 * Returns Tailwind CSS background and text color classes for a Procore priority level.
 * @param priority - Priority label (e.g., "high", "medium", "low", "urgent")
 * @returns A string of Tailwind utility classes
 */
export const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "high":
      return "bg-red-100 text-red-800";
    case "urgent":
      return "bg-red-100 text-red-800";
    case "true":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-yellow-200 text-gray-800";
    case "low":
      return "bg-green-100 text-green-800";
    case "false":
      return "bg-green-200 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
