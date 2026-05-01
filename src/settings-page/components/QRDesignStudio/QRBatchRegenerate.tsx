import { useState } from "react";
import {
  useBatchRegenerateQRCodes,
  type BatchRegenerateResult,
} from "@/api/endpoints/qr-style";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

export interface QRBatchRegenerateProps {
  companyId: string;
  onClose?: () => void;
}

export function QRBatchRegenerate({
  companyId,
  onClose: _onClose,
}: QRBatchRegenerateProps) {
  const [enableLogo, setEnableLogo] = useState(false);
  const [result, setResult] = useState<BatchRegenerateResult | null>(null);
  const batchRegenerateMutation = useBatchRegenerateQRCodes();

  const handleRegenerate = async () => {
    try {
      const data = await batchRegenerateMutation.mutateAsync({
        companyId,
        applyToAll: true,
        enableLogo,
      });

      setResult(data);

      if (data.failed === 0) {
        toast.success(`Successfully regenerated ${data.success} QR codes!`);
      } else {
        toast.error(
          `Regenerated ${data.success}/${data.total} QR codes. ${data.failed} failed.`,
        );
      }
    } catch (error) {
      console.error("Failed to regenerate QR codes:", error);
      toast.error("Failed to regenerate QR codes");
    }
  };

  const handleReset = () => {
    setResult(null);
    setEnableLogo(false);
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <>
          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="bx bx-info-circle text-blue-600 text-xl flex-shrink-0 mt-0.5"></i>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Apply Design Template to Existing QR Codes
                </h4>
                <p className="text-sm text-blue-700">
                  This will regenerate all QR codes in your company with the
                  current design template settings. This process may take a few
                  moments depending on the number of QR codes.
                </p>
              </div>
            </div>
          </div>

          {/* Logo toggle */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label
                  htmlFor="enable-logo-batch"
                  className="block text-sm font-medium text-gray-900 mb-1"
                >
                  Enable Company Logo Overlay
                </label>
                <p className="text-sm text-gray-600">
                  Add your company logo to all regenerated QR codes. The logo
                  will be centered and sized appropriately based on error
                  correction levels.
                </p>
              </div>
              <button
                id="enable-logo-batch"
                type="button"
                role="switch"
                aria-checked={enableLogo}
                onClick={() => setEnableLogo(!enableLogo)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                  enableLogo ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enableLogo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Warning box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="bx bx-error text-amber-600 text-xl flex-shrink-0 mt-0.5"></i>
              <div>
                <h4 className="text-sm font-medium text-amber-900 mb-1">
                  Important Notice
                </h4>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>
                    Existing QR code images will be replaced with new styled
                    versions
                  </li>
                  <li>QR code URLs and functionality will remain unchanged</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleRegenerate}
              disabled={batchRegenerateMutation.isPending}
              leftIconClass={
                batchRegenerateMutation.isPending
                  ? "bx-loader-alt bx-spin"
                  : "bx-refresh"
              }
            >
              {batchRegenerateMutation.isPending
                ? "Regenerating..."
                : "Regenerate All QR Codes"}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Results box */}
          <div
            className={`border rounded-lg p-4 ${
              result.failed === 0
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <i
                className={`text-xl flex-shrink-0 mt-0.5 ${
                  result.failed === 0
                    ? "bx bx-check-circle text-green-600"
                    : "bx bx-error-circle text-yellow-600"
                }`}
              ></i>
              <div className="flex-1">
                <h4
                  className={`text-sm font-medium mb-2 ${
                    result.failed === 0 ? "text-green-900" : "text-yellow-900"
                  }`}
                >
                  Regeneration Complete
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Total QR Codes:</span>
                    <span className="font-medium">{result.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">
                      Successfully Regenerated:
                    </span>
                    <span className="font-medium text-green-700">
                      {result.success}
                    </span>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-700">Failed:</span>
                      <span className="font-medium text-red-700">
                        {result.failed}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Errors list */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">
                Errors ({result.errors.length})
              </h4>
              <div className="max-h-40 overflow-y-auto">
                <ul className="text-xs text-red-700 space-y-1">
                  {result.errors.map((error, index) => (
                    <li key={index} className="font-mono">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Reset button */}
          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={handleReset}>
              Regenerate Again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default QRBatchRegenerate;
