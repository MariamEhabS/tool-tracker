/**
 * @fileoverview Global toast notification provider wrapping react-hot-toast
 * with Taliho's default styling for success, error, and loading states.
 */

import { Toaster } from "react-hot-toast";

/**
 * Pre-configured Toaster component with Taliho's color scheme and positioning.
 * Mount once at the application root.
 */
export const Toast = () => {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{
        zIndex: 99999,
      }}
      toastOptions={{
        // Define default options
        className: "",
        duration: 5000,
        removeDelay: 1000,
        style: {
          background: "#363636",
          color: "#fff",
        },

        // Default options for specific types
        success: {
          duration: 3000,
          style: {
            background: "#4caf50",
            color: "#fff",
          },
          iconTheme: {
            primary: "white",
            secondary: "#4caf50",
          },
        },
        error: {
          style: {
            background: "#f44336",
            color: "#fff",
          },
          iconTheme: {
            primary: "white",
            secondary: "#f44336",
          },
        },
        loading: {
          style: {
            background: "#2196f3",
            color: "#fff",
          },
          iconTheme: {
            primary: "white",
            secondary: "#2196f3",
          },
        },
        custom: {},
      }}
    />
  );
};
