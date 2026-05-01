/**
 * Returns Tailwind CSS background and text color classes for a Procore status label.
 * @param status - Status label (e.g., "open", "closed", "in progress", "overdue")
 * @returns A string of Tailwind utility classes
 */
export const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "open":
      return "bg-green-200 text-green-800";
    case "resolved":
      return "bg-green-200 text-green-800";
    case "in progress":
      return "bg-blue-100 text-blue-800";
    case "closed":
      return "bg-gray-300 text-gray-800";
    case "overdue":
      return "bg-red-200 text-red-800";
    case "work_not_accepted":
      return "bg-red-200 text-red-800";
    default:
      return "bg-yellow-200 text-gray-800";
  }
};
