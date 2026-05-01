/**
 * @fileoverview Hook for detecting the user's device type (Desktop, Mobile, or Tablet)
 * based on the browser user-agent string.
 */

import { useState, useEffect } from "react";

/**
 * Detects the current device type by inspecting `navigator.userAgent` and
 * returns one of `"Desktop"`, `"Mobile"`, or `"Tablet"`.
 *
 * Re-evaluates on window resize events, though the user-agent string itself
 * does not change. The resize listener is cleaned up when the component unmounts.
 *
 * @returns The detected device type string: `"Desktop"`, `"Mobile"`, or `"Tablet"`.
 *   Returns an empty string briefly before the initial effect runs.
 */
const useDeviceDetection = () => {
  const [device, setDevice] = useState("");

  useEffect(() => {
    const handleDeviceDetection = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isTablet = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(
        userAgent,
      );
      const isMobile = /iphone|ipod|android|blackberry|windows phone/.test(
        userAgent,
      );

      if (isTablet) {
        setDevice("Tablet");
      } else if (isMobile) {
        setDevice("Mobile");
      } else {
        setDevice("Desktop");
      }
    };

    handleDeviceDetection();
    window.addEventListener("resize", handleDeviceDetection);

    return () => {
      window.removeEventListener("resize", handleDeviceDetection);
    };
  }, []);

  return device;
};

export default useDeviceDetection;
