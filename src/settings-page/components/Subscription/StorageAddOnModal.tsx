import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import { manageCompanyStorage } from "@/api/endpoints/stripe";
import { logApiError } from "@/utils/rollbar";
import { useStorageLimits } from "@/lib/tiers";
import {
  STORAGE_ADDON_DOCUMENT_BYTES,
  STORAGE_ADDON_QR_BYTES,
} from "@/lib/tiers/constants";

export interface StorageAddOnModalProps {
  open: boolean;
  onClose: () => void;
  stripeCustomerId?: string;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 GB";

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`;
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Storage Progress Bar Component
 */
function StorageBar({
  label,
  used,
  capacity,
  colorClass,
}: {
  label: string;
  used: number;
  capacity: number;
  colorClass: string;
}) {
  const percentage = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {formatBytes(used)} / {formatBytes(capacity)}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${colorClass} h-3 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function StorageAddOnModal({
  open,
  onClose,
  stripeCustomerId,
}: StorageAddOnModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const storageLimits = useStorageLimits();

  const { documentUsed, documentCapacity, qrUsed, qrCapacity, addonsCount } =
    storageLimits;

  // Calculate what the new capacity would be with add-ons
  const additionalDocumentStorage = quantity * STORAGE_ADDON_DOCUMENT_BYTES;
  const additionalQrStorage = quantity * STORAGE_ADDON_QR_BYTES;
  const newDocumentCapacity = documentCapacity + additionalDocumentStorage;
  const newQrCapacity = qrCapacity + additionalQrStorage;

  // Pricing loaded from environment variable (VITE_STRIPE_STORAGE_ADDON_PRICE)
  const pricePerAddon = Number(
    import.meta.env.VITE_STRIPE_STORAGE_ADDON_PRICE || "19",
  );
  const totalPrice = quantity * pricePerAddon;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= 10) {
      setQuantity(newQuantity);
    }
  };

  const handleAddStorage = async () => {
    if (!stripeCustomerId) {
      toast.error("Unable to process. Please contact support.");
      return;
    }

    try {
      setIsLoading(true);

      const base = window.location.origin;

      const response = await manageCompanyStorage({
        customer: stripeCustomerId,
        quantity,
        success_url: `${base}/storage/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/settings`,
      });

      if (response?.url) {
        window.location.href = response.url;
      } else {
        toast.error("Unable to start checkout. Please try again.");
      }
    } catch (error) {
      logApiError(error, "storage-checkout", { quantity });
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start storage checkout. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add More Storage"
      subtitle="Expand your storage capacity"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-left">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-semibold text-gray-900">
              ${totalPrice}/month
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleAddStorage}
              disabled={isLoading}
              leftIconClass={
                isLoading ? "bx bx-loader-alt bx-spin" : "bx bx-plus"
              }
            >
              {isLoading ? "Processing..." : "Add Storage"}
            </Button>
          </div>
        </div>
      }
    >
      {/* Current Usage Section */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-4">
          Current Storage Usage
        </h4>
        <div className="space-y-4">
          <StorageBar
            label="Documents"
            used={documentUsed}
            capacity={documentCapacity}
            colorClass="bg-blue-500"
          />
          <StorageBar
            label="QR Codes"
            used={qrUsed}
            capacity={qrCapacity}
            colorClass="bg-purple-500"
          />
        </div>
        {addonsCount > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            <i className="bx bx-check-circle text-green-500 mr-1" />
            You currently have {addonsCount} storage add-on
            {addonsCount > 1 ? "s" : ""} active
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-6" />

      {/* Add-On Details */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Storage Add-On
        </h4>
        <p className="text-sm text-gray-600 mb-4">Each add-on includes:</p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <i className="bx bx-folder text-blue-500" />
            <span className="text-sm text-gray-700">
              +50 GB document storage
            </span>
          </div>
          <div className="flex items-center gap-2">
            <i className="bx bx-qr text-purple-500" />
            <span className="text-sm text-gray-700">
              +10 GB QR code storage
            </span>
          </div>
          <div className="flex items-center gap-2">
            <i className="bx bx-credit-card text-green-500" />
            <span className="text-sm text-gray-700">
              ${pricePerAddon}/month per add-on
            </span>
          </div>
        </div>
      </div>

      {/* Quantity Selector */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Quantity</h4>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="bx bx-minus" />
            </button>
            <span className="px-4 py-2 text-lg font-semibold text-gray-900 min-w-[3rem] text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= 10}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="bx bx-plus" />
            </button>
          </div>
          <span className="text-sm text-gray-600">
            add-on{quantity > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Preview of New Capacity */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-800 mb-2">
          <i className="bx bx-check-circle mr-1" />
          New Storage Capacity
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-green-700">Documents:</span>
            <span className="font-medium text-green-800 ml-2">
              {formatBytes(newDocumentCapacity)}
            </span>
          </div>
          <div>
            <span className="text-green-700">QR Codes:</span>
            <span className="font-medium text-green-800 ml-2">
              {formatBytes(newQrCapacity)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default StorageAddOnModal;
