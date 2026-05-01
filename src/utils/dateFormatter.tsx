/**
 * @fileoverview Date and time formatting helpers used across the application.
 * All functions accept an ISO date string and return a locale-formatted string.
 */

/**
 * Formats an ISO date string into MM/DD/YYYY format.
 * @param dateString - ISO 8601 date string
 */
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};

/**
 * Formats a Procore timestamp into a long-form date string (e.g., "January 15, 2025").
 * @param time - ISO 8601 date string from Procore API
 * @returns Formatted date or "-" if the date is invalid.
 */
export const formatProcoreTime = (time: string) => {
  const updatedAt = new Date(time);

  if (!updatedAt) return "-";

  const formattedDate = updatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `${formattedDate} `;
};

/**
 * Extracts and formats the time portion of an ISO date string (e.g., "02:30 PM").
 * @param dateTimeString - ISO 8601 date-time string
 */
export const formatTime = (dateTimeString: string) => {
  const date = new Date(dateTimeString);

  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formattedTime}`;
};
