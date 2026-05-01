import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { useCompany, companyKeys } from "@/api/endpoints/company";
import {
  LogoUpload,
  LogoCropper,
  uploadLogo,
  deleteLogo,
  type AspectRatio,
} from "./CompanyLogo";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

interface PrintBrandingLogoProps {
  readOnly?: boolean;
}

function getCompanyIdFromLocalStorage(): string | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.companyId || user?.company || null;
  } catch {
    return null;
  }
}

export function PrintBrandingLogo({
  readOnly = false,
}: PrintBrandingLogoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const companyId = getCompanyIdFromLocalStorage();
  const { data: companyDetails, isLoading } = useCompany(companyId || "");

  // Print Branding Logo state management
  const [printLogoUrl, setPrintLogoUrl] = useState<string | null>(null);
  const [printLogoAspectRatio, setPrintLogoAspectRatio] =
    useState<AspectRatio>("1:1");
  const [printSelectedFile, setPrintSelectedFile] = useState<File | null>(null);
  const [printCropImageUrl, setPrintCropImageUrl] = useState<string | null>(
    null,
  );
  const [isUploadingPrintLogo, setIsUploadingPrintLogo] = useState(false);
  const [isDeletingPrintLogo, setIsDeletingPrintLogo] = useState(false);

  // Initialize logo URLs from company data
  useEffect(() => {
    console.log("[PrintBrandingLogo] Company details changed:", {
      printBrandingLogo: companyDetails?.printBrandingLogo,
      printBrandingLogoAspectRatio:
        companyDetails?.printBrandingLogoAspectRatio,
    });
    if (companyDetails?.printBrandingLogo) {
      setPrintLogoUrl(companyDetails.printBrandingLogo);
      if (companyDetails.printBrandingLogoAspectRatio) {
        setPrintLogoAspectRatio(
          companyDetails.printBrandingLogoAspectRatio as AspectRatio,
        );
      }
    }
  }, [companyDetails]);

  // Debug: Log current state
  useEffect(() => {
    console.log("[PrintBrandingLogo] Current state:", {
      printLogoUrl,
      printLogoAspectRatio,
      isEditing,
    });
  }, [printLogoUrl, printLogoAspectRatio, isEditing]);

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error("[PrintBrandingLogo] Image failed to load:", {
      src: e.currentTarget.src,
      error: e,
    });
  };

  // Handle image load success
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log("[PrintBrandingLogo] Image loaded successfully:", {
      src: e.currentTarget.src,
      naturalWidth: e.currentTarget.naturalWidth,
      naturalHeight: e.currentTarget.naturalHeight,
    });
  };

  // Print Branding Logo handlers
  const handlePrintFileSelect = (file: File) => {
    setPrintSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPrintCropImageUrl(objectUrl);
  };

  const handlePrintCropComplete = async (
    croppedBlob: Blob,
    aspectRatio?: string,
  ) => {
    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }
    setIsUploadingPrintLogo(true);
    try {
      const croppedFile = new File(
        [croppedBlob],
        printSelectedFile?.name || "print-logo.png",
        { type: "image/png" },
      );
      const ratio = (aspectRatio as AspectRatio) || printLogoAspectRatio;
      console.log("[PrintBrandingLogo] Calling uploadLogo with:", {
        companyId,
        fileName: croppedFile.name,
        fileSize: croppedFile.size,
        logoType: "print-branding",
        ratio,
      });
      const result = await uploadLogo(
        companyId,
        croppedFile,
        "print-branding",
        ratio,
      );
      console.log("[PrintBrandingLogo] Upload result:", result);
      console.log("[PrintBrandingLogo] Setting printLogoUrl to:", result.url);
      setPrintLogoUrl(result.url);
      setPrintLogoAspectRatio(ratio);
      setPrintCropImageUrl(null);
      setPrintSelectedFile(null);
      toast.success("Print branding logo uploaded successfully!");
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      // Exit edit mode after successful upload
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to upload logo");
      console.error("Logo upload error:", error);
    } finally {
      setIsUploadingPrintLogo(false);
    }
  };

  const handlePrintCropCancel = () => {
    if (printCropImageUrl) {
      URL.revokeObjectURL(printCropImageUrl);
    }
    setPrintCropImageUrl(null);
    setPrintSelectedFile(null);
  };

  const handleDeletePrintLogo = async () => {
    if (!companyId) return;
    setIsDeletingPrintLogo(true);
    try {
      await deleteLogo(companyId, "print-branding");
      setPrintLogoUrl(null);
      toast.success("Print branding logo deleted successfully!");
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
    } catch (error) {
      toast.error("Failed to delete logo");
      console.error("Logo delete error:", error);
    } finally {
      setIsDeletingPrintLogo(false);
    }
  };

  const handleCancel = () => {
    // Clear any active cropper state
    if (printCropImageUrl) {
      URL.revokeObjectURL(printCropImageUrl);
      setPrintCropImageUrl(null);
      setPrintSelectedFile(null);
    }
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const labelClassName = "block text-sm font-medium text-gray-700";

  if (isLoading) {
    return (
      <div data-testid="print-branding-logo">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-24 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="print-branding-logo">
      <AnimatePresence mode="wait" initial={false}>
        {!isEditing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
          >
            {/* Display Mode */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  Add logos to be displayed on printed QR code pages.
                </p>
                {printLogoUrl ? (
                  <div className="flex flex-col items-start">
                    <img
                      src={printLogoUrl}
                      alt="Print Branding Logo"
                      className={`max-h-24 object-contain border border-gray-200 rounded-lg p-2 ${
                        printLogoAspectRatio === "2:1" ? "max-w-48" : "max-w-24"
                      }`}
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No logo uploaded</p>
                )}
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleEdit}
                  data-testid="edit-print-logo-button"
                  className="transition-all duration-200 hover:shadow-md"
                >
                  {printLogoUrl ? "Change" : "Add Logo"}
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
          >
            {/* Edit Mode */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    {printLogoUrl ? "Change Logo" : "Upload Logo"}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Select an image to use as your print branding logo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  data-testid="cancel-print-logo-button"
                  className="transition-all duration-200 hover:shadow-md"
                >
                  Cancel
                </Button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: ANIMATION_DURATION, delay: 0.05 }}
                data-testid="print-logo-section-edit"
              >
                <span className={labelClassName}>Print Branding Logo</span>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  Branding for outside of the QR code within the printed page.
                </p>
                <div className="mt-3">
                  {printCropImageUrl ? (
                    <LogoCropper
                      imageUrl={printCropImageUrl}
                      onCropComplete={handlePrintCropComplete}
                      onCancel={handlePrintCropCancel}
                      isUploading={isUploadingPrintLogo}
                      aspectRatio={1}
                      aspectRatioOptions={[
                        { value: 1, label: "Square (1:1)" },
                        { value: 2, label: "Landscape (2:1)" },
                      ]}
                    />
                  ) : printLogoUrl ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center">
                        <img
                          src={printLogoUrl}
                          alt="Print Branding Logo"
                          className={`max-h-24 object-contain border border-gray-200 rounded-lg p-2 ${
                            printLogoAspectRatio === "2:1"
                              ? "max-w-48"
                              : "max-w-24"
                          }`}
                          onError={handleImageError}
                          onLoad={handleImageLoad}
                        />
                      </div>
                      <LogoUpload
                        onFileSelect={handlePrintFileSelect}
                        disabled={isUploadingPrintLogo}
                      />
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={handleDeletePrintLogo}
                          disabled={isDeletingPrintLogo}
                          data-testid="delete-print-logo-button"
                          className="transition-all duration-200 hover:shadow-md"
                        >
                          {isDeletingPrintLogo ? "Deleting..." : "Delete Logo"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <LogoUpload
                      onFileSelect={handlePrintFileSelect}
                      disabled={isUploadingPrintLogo}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PrintBrandingLogo;
