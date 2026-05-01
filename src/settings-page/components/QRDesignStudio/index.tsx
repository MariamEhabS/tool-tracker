import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { logQRError } from "@/utils/rollbar";
import Modal from "@/components/modal/Modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCompanyQRStyleConfig,
  useUpdateQRStyleConfig,
  useBatchRegenerateQRCodes,
  useBatchRegenerateQRCodesAsync,
  useGetRegenerateCount,
  previewQRStyle,
  uploadQRStyleLogo,
  deleteQRStyleLogo,
} from "@/api/endpoints/qr-style";
import { addJob } from "@/utils/localStorage-jobs";
import toast from "react-hot-toast";
import { asString, asNumber, asBoolean, asRecord } from "@/lib/coerce";

// QR Style configuration types
type ModuleShape = "square" | "rounded-square" | "dots";
type EyeStyle = "square" | "rounded" | "circular";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

interface CustomStyleConfig {
  moduleShape: ModuleShape;
  moduleCornerRadius: number;
  foregroundColor: string;
  backgroundColor: string;
  eyeStyle: EyeStyle;
  eyeOuterColor: string;
  eyeInnerColor: string;
  quietZoneModules: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  outerBorderRadius: number;
  logoEnabled: boolean;
  logoSource?: string;
  logoAwsId?: string;
  logoAwsKey?: string;
}

// Preset configuration type
interface QRPreset {
  id: string;
  name: string;
  preview: string;
  config: Partial<CustomStyleConfig>;
}

// Design Decision: These are frontend-only UI template helpers that provide
// quick-start configurations for custom QR styles. They are intentionally
// hardcoded as starter templates, not backend data. The actual custom styles
// are saved to the backend via the useUpdateQRStyleConfig customStyle parameter.
// Note: Backend presets (/qr-code/admin/presets) serve a different purpose -
// they are server-generated preset names for the backend's preset-based rendering.
const styleTemplates: QRPreset[] = [
  {
    id: "modern",
    name: "Modern",
    preview: "",
    config: {
      moduleShape: "rounded-square",
      moduleCornerRadius: 0.5,
      foregroundColor: "#1a1a2e",
      backgroundColor: "#ffffff",
      eyeStyle: "rounded",
      eyeOuterColor: "#1a1a2e",
      eyeInnerColor: "#4a4e69",
      quietZoneModules: 2,
      outerBorderRadius: 12,
    },
  },
  {
    id: "classic",
    name: "Classic",
    preview: "",
    config: {
      moduleShape: "square",
      moduleCornerRadius: 0,
      foregroundColor: "#000000",
      backgroundColor: "#ffffff",
      eyeStyle: "square",
      eyeOuterColor: "#000000",
      eyeInnerColor: "#000000",
      quietZoneModules: 4,
      outerBorderRadius: 0,
    },
  },
  {
    id: "vibrant",
    name: "Vibrant",
    preview: "",
    config: {
      moduleShape: "dots",
      moduleCornerRadius: 1,
      foregroundColor: "#111827",
      backgroundColor: "#fefce8",
      eyeStyle: "circular",
      eyeOuterColor: "#facc16",
      eyeInnerColor: "#facc16",
      quietZoneModules: 3,
      outerBorderRadius: 16,
    },
  },
];

const DEFAULT_STYLE: CustomStyleConfig = {
  moduleShape: "rounded-square",
  moduleCornerRadius: 0.5,
  foregroundColor: "#000000",
  backgroundColor: "#FFFFFF",
  eyeStyle: "rounded",
  eyeOuterColor: "#000000",
  eyeInnerColor: "#000000",
  quietZoneModules: 2,
  errorCorrectionLevel: "H",
  outerBorderRadius: 8,
  logoEnabled: false,
  logoSource: undefined,
  logoAwsId: undefined,
  logoAwsKey: undefined,
};

interface QRDesignStudioProps {
  companyId: string;
  companyName?: string;
  companyUrl?: string;
}

export default function QRDesignStudio({
  companyId,
  companyName,
  companyUrl,
}: QRDesignStudioProps) {
  const [enabled, setEnabled] = useState(false);
  const [previewDataUri, setPreviewDataUri] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] =
    useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Custom style configuration state
  const [customStyle, setCustomStyle] =
    useState<CustomStyleConfig>(DEFAULT_STYLE);

  // State for async regeneration confirmation dialog
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Fetch current config
  const { data: currentConfig, isLoading: isLoadingConfig } =
    useCompanyQRStyleConfig(companyId);
  const updateMutation = useUpdateQRStyleConfig();
  const batchRegenerateMutation = useBatchRegenerateQRCodes();
  const regenerateAsyncMutation = useBatchRegenerateQRCodesAsync();
  const { data: regenerateCount } = useGetRegenerateCount(
    companyId,
    applyToExisting,
  );

  // Parse style config from API response
  const getInitialStyle = useCallback(
    (
      config: { qrStyleConfig?: Record<string, unknown> } | null | undefined,
    ): CustomStyleConfig => {
      type QRStyleConfigType = Record<string, unknown> & {
        presetName?: string;
      };
      const qrStyleConfig = config?.qrStyleConfig as
        | QRStyleConfigType
        | undefined;
      if (qrStyleConfig && !qrStyleConfig.presetName) {
        const cfg = qrStyleConfig;
        const eyeStyleRec = asRecord(cfg.eyeStyle);
        const logoRec = asRecord(cfg.logo);
        return {
          moduleShape: asString(
            cfg.moduleShape,
            "rounded-square",
          ) as ModuleShape,
          moduleCornerRadius: asNumber(cfg.moduleCornerRadius, 0.5),
          foregroundColor:
            typeof cfg.foreground === "string" ? cfg.foreground : "#000000",
          backgroundColor: asString(cfg.background, "#FFFFFF"),
          eyeStyle: asString(eyeStyleRec?.style, "rounded") as EyeStyle,
          eyeOuterColor: asString(eyeStyleRec?.outerColor, "#000000"),
          eyeInnerColor: asString(eyeStyleRec?.innerColor, "#000000"),
          quietZoneModules: asNumber(cfg.quietZoneModules, 2),
          errorCorrectionLevel: asString(
            cfg.errorCorrectionLevel,
            "H",
          ) as ErrorCorrectionLevel,
          outerBorderRadius: asNumber(cfg.outerBorderRadius, 8),
          logoEnabled: asBoolean(logoRec?.enabled, false),
          logoSource: logoRec?.source as string | undefined,
          logoAwsId: logoRec?.awsId as string | undefined,
          logoAwsKey: logoRec?.awsKey as string | undefined,
        };
      }
      return DEFAULT_STYLE;
    },
    [],
  );

  // Initial style for change detection
  const initialStyle = useMemo(
    () => getInitialStyle(currentConfig),
    [currentConfig, getInitialStyle],
  );

  // Initialize state from current config
  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.useStyledQRCodes);
      setCustomStyle(getInitialStyle(currentConfig));
    }
  }, [currentConfig, getInitialStyle]);

  // Load preview with debounce
  const loadPreview = useCallback(async () => {
    if (!enabled) {
      setPreviewDataUri("");
      return;
    }

    try {
      setIsLoadingPreview(true);

      const styleForPreview = {
        moduleShape: customStyle.moduleShape,
        moduleCornerRadius: customStyle.moduleCornerRadius,
        foregroundColor: customStyle.foregroundColor,
        background: customStyle.backgroundColor,
        eyeStyle: {
          style: customStyle.eyeStyle,
          outerColor: customStyle.eyeOuterColor,
          innerColor: customStyle.eyeInnerColor,
          cornerRadius:
            customStyle.eyeStyle === "rounded"
              ? 0.5
              : customStyle.eyeStyle === "circular"
                ? 0.8
                : 0,
        },
        quietZoneModules: customStyle.quietZoneModules,
        errorCorrectionLevel: customStyle.errorCorrectionLevel,
        outerBorderRadius: customStyle.outerBorderRadius,
        size: 512,
        transparentBackground: false,
        logo: customStyle.logoEnabled
          ? {
              enabled: true,
              source: customStyle.logoSource,
              awsId: customStyle.logoAwsId,
              awsKey: customStyle.logoAwsKey,
              sizePercent: 15,
              opacity: 1,
              useBackground: true,
              backgroundPadding: 10,
            }
          : undefined,
      };

      const preview = await previewQRStyle(
        "https://app.taliho.com/sample",
        styleForPreview as Record<string, unknown>,
      );
      setPreviewDataUri(preview.dataUri);
    } catch (error) {
      logQRError(error, "design-studio-preview", undefined, { companyId });
      toast.error("Failed to load preview");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [customStyle, enabled, companyId]);

  // Debounced preview effect
  useEffect(() => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    previewDebounceRef.current = setTimeout(() => {
      loadPreview();
    }, 300);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [loadPreview]);

  // Check for changes
  useEffect(() => {
    const configChanged =
      enabled !== currentConfig?.useStyledQRCodes ||
      JSON.stringify(customStyle) !== JSON.stringify(initialStyle);
    // Also consider applyToExisting as a "change" when enabled
    setHasChanges(configChanged || applyToExisting);
  }, [enabled, customStyle, currentConfig, initialStyle, applyToExisting]);

  // Contrast validation
  const validateContrast = (fg: string, bg: string): boolean => {
    const getLuminance = (hex: string) => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = ((rgb >> 16) & 0xff) / 255;
      const g = ((rgb >> 8) & 0xff) / 255;
      const b = ((rgb >> 0) & 0xff) / 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return contrast >= 4.5;
  };

  const contrastValid = validateContrast(
    customStyle.foregroundColor,
    customStyle.backgroundColor,
  );

  // Handle preset selection
  const handlePresetSelect = (preset: QRPreset) => {
    setSelectedPresetId(preset.id);
    setCustomStyle((prev) => ({
      ...prev,
      ...preset.config,
    }));
  };

  // Handle save
  const handleSave = async () => {
    try {
      if (
        !validateContrast(
          customStyle.foregroundColor,
          customStyle.backgroundColor,
        )
      ) {
        toast.error(
          "Insufficient contrast between foreground and background colors. Please adjust for better scannability.",
        );
        return;
      }

      const styleConfig = {
        moduleShape: customStyle.moduleShape,
        moduleCornerRadius: customStyle.moduleCornerRadius,
        foregroundColor: customStyle.foregroundColor,
        background: customStyle.backgroundColor,
        eyeStyle: {
          style: customStyle.eyeStyle,
          outerColor: customStyle.eyeOuterColor,
          innerColor: customStyle.eyeInnerColor,
          cornerRadius:
            customStyle.eyeStyle === "rounded"
              ? 0.5
              : customStyle.eyeStyle === "circular"
                ? 0.8
                : 0,
        },
        quietZoneModules: customStyle.quietZoneModules,
        errorCorrectionLevel: customStyle.errorCorrectionLevel,
        outerBorderRadius: customStyle.outerBorderRadius,
        size: 1024,
        transparentBackground: false,
        logo: customStyle.logoEnabled
          ? {
              enabled: true,
              source: customStyle.logoSource,
              awsId: customStyle.logoAwsId,
              awsKey: customStyle.logoAwsKey,
              sizePercent: 15,
              opacity: 1,
              useBackground: true,
              backgroundPadding: 10,
            }
          : { enabled: false },
      };

      // Save the style configuration
      await updateMutation.mutateAsync({
        companyId,
        useStyledQRCodes: enabled,
        customStyle: enabled
          ? (styleConfig as Record<string, unknown>)
          : undefined,
      });

      // If applyToExisting is enabled, show confirmation dialog for async regeneration
      if (applyToExisting && enabled) {
        setShowRegenerateConfirm(true);
        return; // Don't reset state yet, wait for confirmation
      }

      toast.success("QR code style updated successfully!");
      setHasChanges(false);
      setApplyToExisting(false);
    } catch (error) {
      logQRError(error, "design-studio-save", undefined, {
        companyId,
        applyToExisting,
      });
      toast.error("Failed to save configuration");
    }
  };

  // Handle confirmed async regeneration
  const handleConfirmRegenerate = async () => {
    setShowRegenerateConfirm(false);

    try {
      const result = await regenerateAsyncMutation.mutateAsync({
        companyId,
        applyToAll: true,
        enableLogo: customStyle.logoEnabled,
      });

      if (!result.jobId || result.total === 0) {
        toast(result.message || "No QR codes found to regenerate.");
        setApplyToExisting(false);
        setHasChanges(false);
        return;
      }

      // Add job to localStorage for progress tracking
      addJob({
        jobId: result.jobId,
        status: "pending",
        progress: 0,
        total: result.total,
        type: "bulk-qr-regenerate",
        groupName: "QR Codes Redesign",
      });

      toast.success(`Regenerating ${result.total} QR codes in background`);

      // Reset form state
      setApplyToExisting(false);
      setHasChanges(false);
    } catch (error) {
      logQRError(error, "design-studio-async-regenerate", undefined, {
        companyId,
      });
      toast.error("Failed to start regeneration. Please try again.");
    }
  };

  // Handle cancel regeneration (style was already saved)
  const handleCancelRegenerate = () => {
    setShowRegenerateConfirm(false);
    // Still reset since style was already saved
    setApplyToExisting(false);
    setHasChanges(false);
    toast.success("Style saved. QR codes were not regenerated.");
  };

  // Handle cancel
  const handleCancel = () => {
    setEnabled(currentConfig?.useStyledQRCodes || false);
    setCustomStyle(initialStyle);
    setSelectedPresetId(null);
    setApplyToExisting(false);
  };

  // Logo handling - uploads to S3 via dedicated QR style logo endpoint
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processLogoFile(file);
  };

  const processLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    try {
      setIsUploadingLogo(true);
      // Upload to S3 via dedicated QR style logo endpoint
      // This stores in qrStyleConfig.logo, NOT in company.companyLogo
      const result = await uploadQRStyleLogo(companyId, file);

      setCustomStyle((prev) => ({
        ...prev,
        logoSource: result.logoUrl, // S3 presigned URL instead of base64
        logoAwsId: result.awsId,
        logoAwsKey: result.awsKey,
        logoEnabled: true,
      }));

      toast.success("Logo uploaded successfully!");
    } catch (error) {
      console.error("Logo upload error:", error);
      logQRError(error, "design-studio-logo-upload", undefined, { companyId });
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Remove logo - deletes from S3 and clears qrStyleConfig.logo
  const handleRemoveLogo = async () => {
    try {
      setIsDeletingLogo(true);
      await deleteQRStyleLogo(companyId);

      setCustomStyle((prev) => ({
        ...prev,
        logoSource: undefined,
        logoAwsId: undefined,
        logoAwsKey: undefined,
        logoEnabled: false,
      }));

      toast.success("Logo removed successfully!");
    } catch (error) {
      console.error("Logo delete error:", error);
      logQRError(error, "design-studio-logo-delete", undefined, { companyId });
      toast.error("Failed to remove logo");
    } finally {
      setIsDeletingLogo(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processLogoFile(file);
    }
  };

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  if (isLoadingConfig) {
    return (
      <div
        className="flex items-center justify-center p-12"
        data-testid="loading"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="qr-design-studio">
      {/* Main Layout: 60% Controls / 40% Preview */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Controls Section (60%) */}
        <div className="lg:w-3/5 space-y-6" data-testid="controls-section">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                Enable Styled QR Codes
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                Apply custom styling to all company QR codes
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              data-testid="enable-toggle"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-brand-500" : "bg-gray-300"
              }`}
              aria-label="Toggle QR code styling"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Quick Start Presets - Only visible when styled QR codes enabled */}
                <div className="space-y-3" data-testid="preset-library">
                  <h4 className="text-sm font-medium text-gray-900">
                    Quick Start Presets
                  </h4>
                  <p className="text-xs text-gray-600">
                    Select a preset to quickly apply a style, then customize as
                    needed
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {styleTemplates.map((preset) => {
                      // Determine border radius based on eye style to match QR eye patterns
                      const getPresetIconBorderRadius = () => {
                        if (preset.config.eyeStyle === "circular") {
                          return "50%"; // Fully circular for Vibrant preset
                        } else if (preset.config.eyeStyle === "rounded") {
                          return "8px"; // Rounded corners for Modern preset
                        }
                        return "0"; // Square corners for Classic preset
                      };

                      return (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetSelect(preset)}
                          data-testid={`preset-${preset.id}`}
                          className={`p-4 border-2 transition-all text-center hover:cursor-pointer rounded-lg ${
                            selectedPresetId === preset.id
                              ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div
                            className="w-12 h-12 mx-auto mb-2 flex items-center justify-center"
                            style={{
                              backgroundColor: preset.config.backgroundColor,
                              border: `2px solid ${preset.config.foregroundColor}`,
                              borderRadius: getPresetIconBorderRadius(),
                            }}
                          >
                            <div
                              className="w-6 h-6"
                              style={{
                                backgroundColor: preset.config.foregroundColor,
                                borderRadius:
                                  preset.config.moduleShape === "dots"
                                    ? "50%"
                                    : preset.config.moduleShape ===
                                        "rounded-square"
                                      ? "4px"
                                      : "0",
                              }}
                            />
                          </div>
                          <div className="text-sm font-medium">
                            {preset.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Logo Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <i className="bx bx-image-add text-lg"></i>
                        QR Code Logo
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Embed your logo in the center of QR codes
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setCustomStyle((prev) => ({
                          ...prev,
                          logoEnabled: !prev.logoEnabled,
                        }))
                      }
                      data-testid="logo-toggle"
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        customStyle.logoEnabled ? "bg-brand-500" : "bg-gray-300"
                      }`}
                      aria-label="Toggle logo"
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          customStyle.logoEnabled
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {customStyle.logoEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {customStyle.logoSource ? (
                          <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0">
                                <img
                                  src={customStyle.logoSource}
                                  alt="Logo preview"
                                  className="w-20 h-20 rounded-lg border-2 border-gray-300 object-contain bg-gray-50 p-2"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  Logo Uploaded
                                </p>
                                <p className="text-xs text-gray-600 mb-3">
                                  This logo will appear centered on all QR codes
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                    data-testid="logo-file-input"
                                  />
                                  <button
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                    disabled={isUploadingLogo}
                                    className="px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isUploadingLogo ? (
                                      <>
                                        <i className="bx bx-loader-alt bx-spin mr-1"></i>
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <i className="bx bx-refresh mr-1"></i>
                                        Change Logo
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={handleRemoveLogo}
                                    disabled={isDeletingLogo}
                                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isDeletingLogo ? (
                                      <>
                                        <i className="bx bx-loader-alt bx-spin mr-1"></i>
                                        Removing...
                                      </>
                                    ) : (
                                      <>
                                        <i className="bx bx-trash mr-1"></i>
                                        Remove
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : isUploadingLogo ? (
                          <div
                            data-testid="logo-uploading"
                            className="relative border-2 border-dashed rounded-lg p-6 text-center border-brand-300 bg-brand-50"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-center">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-100">
                                  <i className="bx bx-loader-alt bx-spin text-2xl text-brand-600"></i>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  Uploading logo...
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Please wait while your logo is being uploaded
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            data-testid="logo-dropzone"
                            className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                              isDragging
                                ? "border-brand-500 bg-brand-50"
                                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                            }`}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                              onChange={handleLogoUpload}
                              className="hidden"
                              data-testid="logo-file-input"
                            />
                            <div className="space-y-2">
                              <div className="flex justify-center">
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    isDragging ? "bg-brand-100" : "bg-gray-200"
                                  }`}
                                >
                                  <i
                                    className={`bx bx-cloud-upload text-2xl ${
                                      isDragging
                                        ? "text-brand-600"
                                        : "text-gray-500"
                                    }`}
                                  ></i>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {isDragging
                                    ? "Drop logo here"
                                    : "Upload QR Code Logo"}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Click to browse or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  PNG, JPG or SVG (max 2MB)
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    Color Palette
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Dot Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customStyle.foregroundColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              foregroundColor: e.target.value,
                              eyeOuterColor: e.target.value,
                              eyeInnerColor: e.target.value,
                            }))
                          }
                          data-testid="foreground-color"
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.foregroundColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              foregroundColor: e.target.value,
                              eyeOuterColor: e.target.value,
                              eyeInnerColor: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customStyle.backgroundColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              backgroundColor: e.target.value,
                            }))
                          }
                          data-testid="background-color"
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.backgroundColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              backgroundColor: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Eye Outer Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customStyle.eyeOuterColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              eyeOuterColor: e.target.value,
                            }))
                          }
                          data-testid="eye-outer-color"
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.eyeOuterColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              eyeOuterColor: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Eye Inner Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customStyle.eyeInnerColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              eyeInnerColor: e.target.value,
                            }))
                          }
                          data-testid="eye-inner-color"
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.eyeInnerColor}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              eyeInnerColor: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                  {!contrastValid && (
                    <div
                      className="bg-red-50 border border-red-200 rounded-lg p-3"
                      data-testid="contrast-warning"
                    >
                      <p className="text-xs text-red-700">
                        <i className="bx bx-error-circle mr-1"></i>
                        Insufficient contrast ratio. Increase contrast for
                        better scannability.
                      </p>
                    </div>
                  )}
                </div>

                {/* Eye Style */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    Eye Style
                  </h4>
                  <p className="text-xs text-gray-600">
                    Customize corner finder patterns
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "square" as EyeStyle, label: "Square" },
                      { value: "rounded" as EyeStyle, label: "Rounded" },
                      { value: "circular" as EyeStyle, label: "Circular" },
                    ].map((eye) => (
                      <button
                        key={eye.value}
                        onClick={() =>
                          setCustomStyle((prev) => ({
                            ...prev,
                            eyeStyle: eye.value,
                          }))
                        }
                        data-testid={`eye-style-${eye.value}`}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          customStyle.eyeStyle === eye.value
                            ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="text-sm font-medium">{eye.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dot Style */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    Dot Style
                  </h4>
                  <p className="text-xs text-gray-600">
                    Choose the shape of data modules
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        value: "square" as ModuleShape,
                        label: "Square",
                        icon: "bx-square",
                      },
                      {
                        value: "rounded-square" as ModuleShape,
                        label: "Rounded",
                        icon: "bx-square-rounded",
                      },
                      {
                        value: "dots" as ModuleShape,
                        label: "Dots",
                        icon: "bx-circle",
                      },
                    ].map((shape) => (
                      <button
                        key={shape.value}
                        onClick={() =>
                          setCustomStyle((prev) => ({
                            ...prev,
                            moduleShape: shape.value,
                          }))
                        }
                        data-testid={`dot-style-${shape.value}`}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          customStyle.moduleShape === shape.value
                            ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <i className={`bx ${shape.icon} text-2xl`}></i>
                        <div className="text-xs font-medium mt-1">
                          {shape.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!enabled && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <i className="bx bx-qr text-4xl text-gray-400"></i>
              <p className="text-sm text-gray-600 mt-2">
                Enable styled QR codes to customize their appearance
              </p>
            </div>
          )}
        </div>

        {/* Preview Section (40%) */}
        <div className="lg:w-2/5 space-y-4" data-testid="preview-section">
          <div className="sticky top-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 shadow-inner">
            <h4 className="text-sm font-medium text-gray-900 mb-4 text-center">
              Live Preview
            </h4>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {isLoadingPreview ? (
                  <div
                    className="w-[300px] h-[300px] flex items-center justify-center bg-white rounded-lg"
                    data-testid="preview-loading"
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                  </div>
                ) : previewDataUri ? (
                  <motion.img
                    key={previewDataUri}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    src={previewDataUri}
                    alt="QR Code Preview"
                    className="w-[300px] h-[300px] rounded-lg shadow-lg"
                    data-testid="preview-image"
                  />
                ) : (
                  <div
                    className="w-[300px] h-[300px] flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300"
                    data-testid="preview-placeholder"
                  >
                    <div className="text-center text-gray-400">
                      <i className="bx bx-qr text-6xl"></i>
                      <p className="text-sm mt-2">
                        {enabled
                          ? "Generating preview..."
                          : "Enable styling to preview"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {(companyName || companyUrl) && (
                <div className="text-center">
                  {companyName && (
                    <p className="text-sm font-medium text-gray-900">
                      {companyName}
                    </p>
                  )}
                  {companyUrl && (
                    <p className="text-xs text-gray-500">{companyUrl}</p>
                  )}
                </div>
              )}
              {!contrastValid && enabled && (
                <p className="text-xs text-red-600 font-medium text-center">
                  Low contrast - adjust colors for better scannability
                </p>
              )}
            </div>
          </div>

          {/* Advanced Settings - Collapsible section below Live Preview */}
          <AnimatePresence>
            {enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border border-gray-200 rounded-lg overflow-hidden"
                data-testid="advanced-settings-section"
              >
                <button
                  onClick={() =>
                    setAdvancedSettingsExpanded(!advancedSettingsExpanded)
                  }
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  data-testid="advanced-settings-toggle"
                >
                  <div className="flex items-center gap-2">
                    <i className="bx bx-cog text-lg text-gray-600"></i>
                    <h4 className="text-sm font-medium text-gray-900">
                      Advanced Settings
                    </h4>
                  </div>
                  <i
                    className={`bx bx-chevron-down text-xl text-gray-500 transition-transform duration-200 ${
                      advancedSettingsExpanded ? "rotate-180" : ""
                    }`}
                  ></i>
                </button>

                <AnimatePresence>
                  {advancedSettingsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-4 space-y-4 bg-white border-t border-gray-200"
                    >
                      {/* Quiet Zone */}
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">
                          Quiet Zone (modules): {customStyle.quietZoneModules}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="6"
                          value={customStyle.quietZoneModules}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              quietZoneModules: parseInt(e.target.value),
                            }))
                          }
                          data-testid="quiet-zone-slider"
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Margin space around the QR code
                        </p>
                      </div>

                      {/* Border Radius */}
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">
                          Border Radius: {customStyle.outerBorderRadius}px
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={customStyle.outerBorderRadius}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              outerBorderRadius: parseInt(e.target.value),
                            }))
                          }
                          data-testid="border-radius-slider"
                          className="w-full"
                        />
                      </div>

                      {/* Error Correction Level */}
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">
                          Error Correction Level
                        </label>
                        <select
                          value={customStyle.errorCorrectionLevel}
                          onChange={(e) =>
                            setCustomStyle((prev) => ({
                              ...prev,
                              errorCorrectionLevel: e.target
                                .value as ErrorCorrectionLevel,
                            }))
                          }
                          data-testid="error-correction-select"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                        >
                          <option value="L">Low (7%)</option>
                          <option value="M">Medium (15%)</option>
                          <option value="Q">Quartile (25%)</option>
                          <option value="H">
                            High (30%) - Recommended for logos
                          </option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Higher levels allow more damage but increase QR code
                          size
                        </p>
                      </div>

                      {/* Apply Template to Existing QR Codes */}
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <label className="block text-xs text-gray-700 mb-0.5">
                              Apply to Existing QR Codes
                            </label>
                            <p className="text-xs text-gray-500">
                              Regenerate all existing QR codes with this
                              template on save
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <div className="relative group">
                              <i className="bx bx-info-circle text-gray-400 hover:text-gray-600 cursor-help"></i>
                              <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <p className="mb-1">
                                  When enabled, saving will:
                                </p>
                                <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                                  <li>Replace existing QR code images</li>
                                  <li>Keep URLs and functionality intact</li>
                                  <li>This cannot be undone</li>
                                </ul>
                                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                              </div>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={applyToExisting}
                              onClick={() =>
                                setApplyToExisting(!applyToExisting)
                              }
                              data-testid="apply-to-existing-toggle"
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                applyToExisting ? "bg-amber-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  applyToExisting
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        {applyToExisting && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                            <i className="bx bx-error-circle"></i>
                            <span>
                              All existing QR codes will be regenerated on save
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="flex justify-end gap-3 pt-4 border-t border-gray-200"
            data-testid="action-buttons"
          >
            <button
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              data-testid="cancel-button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                updateMutation.isPending || batchRegenerateMutation.isPending
              }
              data-testid="save-button"
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 ${
                applyToExisting
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-brand-500 hover:bg-brand-600"
              }`}
            >
              {updateMutation.isPending || batchRegenerateMutation.isPending ? (
                <>
                  <i className="bx bx-loader-alt bx-spin"></i>
                  {batchRegenerateMutation.isPending
                    ? "Applying to QR codes..."
                    : "Saving..."}
                </>
              ) : (
                <>{applyToExisting ? "Save & Apply to All" : "Save"}</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regeneration Confirmation Dialog */}
      <Modal
        open={showRegenerateConfirm}
        onClose={handleCancelRegenerate}
        title="Regenerate QR Codes?"
        size="md"
        closeButton={false}
        footer={
          <>
            <button
              type="button"
              onClick={handleCancelRegenerate}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              data-testid="regenerate-skip-button"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleConfirmRegenerate}
              disabled={regenerateAsyncMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              data-testid="regenerate-confirm-button"
            >
              {regenerateAsyncMutation.isPending ? "Starting..." : "Regenerate"}
            </button>
          </>
        }
      >
        <div data-testid="regenerate-confirm-dialog">
          <p className="text-gray-600 mb-4">
            This will regenerate {regenerateCount ?? "..."} QR codes with the
            new style. This may take a few minutes for large numbers of codes.
          </p>
          <p className="text-sm text-amber-600">
            <i className="bx bx-info-circle mr-1" />
            You can continue using the app while this runs in the background.
          </p>
        </div>
      </Modal>
    </div>
  );
}
