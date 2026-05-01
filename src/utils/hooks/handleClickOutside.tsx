/**
 * @fileoverview Utility for detecting clicks outside dropdown elements.
 */

/**
 * Handles click-outside detection for dropdown menus. Iterates through all
 * elements with a `data-dropdown-id` attribute and checks whether the click
 * target falls outside every dropdown.
 *
 * Typically attached as a global `mousedown` or `click` event listener to
 * dismiss open dropdowns when the user clicks elsewhere on the page.
 *
 * @param event - The native mouse event from the click/mousedown listener
 */
export const handleClickOutside = (event: MouseEvent) => {
  const dropdowns = document.querySelectorAll("[data-dropdown-id]");
  for (const dropdown of dropdowns) {
    if (dropdown.contains(event.target as Node)) return;
  }
};
