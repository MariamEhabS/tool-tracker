import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";

type LogoPreviewProps = {
  logoUrl: string;
  onDelete: () => void;
  isDeleting?: boolean;
};

// Sample QR code SVG as a data URL for preview purposes
const SAMPLE_QR_CODE = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect fill="#ffffff" x="0" y="0" width="200" height="200"/>
  <g fill="#000000">
    <rect x="20" y="20" width="60" height="60"/>
    <rect x="120" y="20" width="60" height="60"/>
    <rect x="20" y="120" width="60" height="60"/>
    <rect x="30" y="30" width="40" height="40" fill="#ffffff"/>
    <rect x="130" y="30" width="40" height="40" fill="#ffffff"/>
    <rect x="30" y="130" width="40" height="40" fill="#ffffff"/>
    <rect x="40" y="40" width="20" height="20"/>
    <rect x="140" y="40" width="20" height="20"/>
    <rect x="40" y="140" width="20" height="20"/>
    <rect x="90" y="20" width="20" height="20"/>
    <rect x="90" y="50" width="10" height="10"/>
    <rect x="90" y="70" width="20" height="10"/>
    <rect x="20" y="90" width="30" height="20"/>
    <rect x="60" y="90" width="20" height="10"/>
    <rect x="90" y="90" width="30" height="30"/>
    <rect x="130" y="90" width="20" height="10"/>
    <rect x="160" y="90" width="20" height="20"/>
    <rect x="130" y="120" width="50" height="60"/>
    <rect x="140" y="130" width="30" height="40" fill="#ffffff"/>
    <rect x="150" y="140" width="10" height="20"/>
  </g>
</svg>
`)}`;

export default function LogoPreview(props: LogoPreviewProps) {
  const { logoUrl, onDelete, isDeleting = false } = props;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logoDimensions, setLogoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = logoUrl;
    img.onload = () => {
      setLogoDimensions({ width: img.width, height: img.height });
    };
  }, [logoUrl]);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div data-testid="logo-preview" className="space-y-6">
      {/* Logo on Mock QR Code */}
      <div className="flex flex-col items-center">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Preview on QR Code
        </p>
        <div
          className="relative w-48 h-48 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
          data-testid="qr-preview-container"
        >
          <img
            src={SAMPLE_QR_CODE}
            alt="Sample QR Code"
            className="w-full h-full"
          />
          {/* Logo overlay in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-white rounded-md p-1 shadow-sm">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="w-full h-full object-contain"
                data-testid="logo-preview-image"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logo Dimensions */}
      {logoDimensions && (
        <div className="text-center">
          <p className="text-sm text-gray-500" data-testid="logo-dimensions">
            Logo dimensions: {logoDimensions.width} x {logoDimensions.height}px
          </p>
        </div>
      )}

      {/* Delete Button */}
      <div className="flex justify-center pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="danger"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          leftIconClass="bx bx-trash"
          data-testid="delete-logo-button"
        >
          {isDeleting ? "Deleting..." : "Delete Logo"}
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={handleCancelDelete}
        title="Delete Logo"
        subtitle="Are you sure you want to delete this logo?"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancelDelete}
              data-testid="cancel-delete-button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDelete}
              leftIconClass="bx bx-trash"
              data-testid="confirm-delete-button"
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="flex items-start">
          <i className="bx bxs-error-circle text-red-500 text-xl mr-2 mt-0.5" />
          <p className="text-sm text-gray-700">
            This action cannot be undone. The logo will be permanently removed
            from your company profile.
          </p>
        </div>
      </Modal>
    </div>
  );
}
