import { useState, useEffect } from "react";

type QrCodeProps = {
  src: string;
  alt?: string;
  variant?: "framed" | "responsive";
  /** Only used in framed variant. Example: 'w-56 h-56' */
  sizeClass?: string;
  /** Additional classes for the outer wrapper (framed) */
  className?: string;
  /** Additional classes for the <img> element */
  imgClassName?: string;
  /** Show placeholder icon instead of image (for error/missing states) */
  showPlaceholder?: boolean;
};

export default function QrCode(props: QrCodeProps) {
  const {
    src,
    alt = "QR Code",
    variant = "framed",
    sizeClass = "w-48 h-48",
    className = "",
    imgClassName = "",
    showPlaceholder = false,
  } = props;

  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Show placeholder if explicitly requested, if image errored, or if no src
  if (showPlaceholder || hasError || !src) {
    const placeholderClasses =
      variant === "framed"
        ? `p-2 bg-white border border-gray-100 rounded-lg shadow-sm ${sizeClass} flex items-center justify-center ${className}`
        : `flex items-center justify-center h-full w-full ${className}`;

    return (
      <div className={placeholderClasses}>
        <i className="bx bx-qr text-4xl text-gray-300" />
      </div>
    );
  }

  if (variant === "framed") {
    return (
      <div
        className={`p-2 bg-white border border-gray-100 rounded-lg shadow-sm ${sizeClass} flex items-center justify-center ${className}`}
      >
        <img
          src={src}
          alt={alt}
          className={`w-full h-full ${imgClassName}`}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain h-full w-full ${imgClassName}`}
      onError={() => setHasError(true)}
    />
  );
}
