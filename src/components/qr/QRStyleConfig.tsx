import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCompanyQRStyleConfig,
  useUpdateQRStyleConfig,
  previewQRStyle,
  uploadQRStyleLogo,
  deleteQRStyleLogo,
} from "@/api/endpoints/qr-style";
import toast from "react-hot-toast";
import { asString, asNumber, asBoolean, asRecord } from "@/lib/coerce";

export interface QRStyleConfigRef {
  handleSave: () => Promise<void>;
  handleCancel: () => void;
  hasChanges: boolean;
  isSaving: boolean;
}

interface QRStyleConfigProps {
  companyId: string;
  onClose?: () => void;
  onStateChange?: (state: QRStyleConfigRef) => void;
}

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

export default function QRStyleConfig({
  companyId,
  onClose,
  onStateChange,
}: QRStyleConfigProps) {
  const [enabled, setEnabled] = useState(false);
  const [previewDataUri, setPreviewDataUri] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);

  // Custom style configuration state
  const [customStyle, setCustomStyle] = useState<CustomStyleConfig>({
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
  });

  // Fetch current config
  const { data: currentConfig, isLoading: isLoadingConfig } =
    useCompanyQRStyleConfig(companyId);
  const updateMutation = useUpdateQRStyleConfig();

  // Initialize state from current config
  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.useStyledQRCodes);

      // Parse existing custom config if available
      type QRStyleConfigType = Record<string, unknown> & {
        presetName?: string;
      };
      const styleConfig = currentConfig.qrStyleConfig as
        | QRStyleConfigType
        | undefined;
      if (styleConfig && !styleConfig.presetName) {
        const config = styleConfig;
        const eyeStyleRec = asRecord(config.eyeStyle);
        const logoRec = asRecord(config.logo);
        setCustomStyle({
          moduleShape: asString(
            config.moduleShape,
            "rounded-square",
          ) as ModuleShape,
          moduleCornerRadius: asNumber(config.moduleCornerRadius, 0.5),
          foregroundColor:
            typeof config.foreground === "string"
              ? config.foreground
              : "#000000",
          backgroundColor: asString(config.background, "#FFFFFF"),
          eyeStyle: asString(eyeStyleRec?.style, "rounded") as EyeStyle,
          eyeOuterColor: asString(eyeStyleRec?.outerColor, "#000000"),
          eyeInnerColor: asString(eyeStyleRec?.innerColor, "#000000"),
          quietZoneModules: asNumber(config.quietZoneModules, 2),
          errorCorrectionLevel: asString(
            config.errorCorrectionLevel,
            "H",
          ) as ErrorCorrectionLevel,
          outerBorderRadius: asNumber(config.outerBorderRadius, 8),
          logoEnabled: asBoolean(logoRec?.enabled, false),
          logoSource: logoRec?.source as string | undefined,
          logoAwsId: logoRec?.awsId as string | undefined,
          logoAwsKey: logoRec?.awsKey as string | undefined,
        });
      }
    }
  }, [currentConfig]);

  // Load preview when style changes
  useEffect(() => {
    if (enabled) {
      loadPreview();
    } else {
      setPreviewDataUri("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customStyle, enabled]);

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
      // Return default style if no config
      return {
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
    },
    [],
  );

  // Check for changes
  useEffect(() => {
    const configChanged =
      enabled !== currentConfig?.useStyledQRCodes ||
      JSON.stringify(customStyle) !==
        JSON.stringify(getInitialStyle(currentConfig));
    setHasChanges(configChanged);
  }, [enabled, customStyle, currentConfig, getInitialStyle]);

  const loadPreview = async () => {
    try {
      setIsLoadingPreview(true);

      // Convert custom style to backend format
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
      if (import.meta.env.DEV) {
        console.error("Failed to load preview:", error);
      }
      toast.error("Failed to load preview");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSave = useCallback(async () => {
    try {
      // Validate contrast
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

      // Convert to backend format
      const styleConfig = {
        moduleShape: customStyle.moduleShape,
        moduleCornerRadius: customStyle.moduleCornerRadius,
        foreground: customStyle.foregroundColor,
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

      await updateMutation.mutateAsync({
        companyId,
        useStyledQRCodes: enabled,
        customStyle: enabled
          ? (styleConfig as Record<string, unknown>)
          : undefined,
      });

      toast.success("QR code style updated successfully!");
      setHasChanges(false);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to save config:", error);
      }
      toast.error("Failed to save configuration");
    }
  }, [customStyle, enabled, companyId, updateMutation, onClose]);

  const handleCancel = useCallback(() => {
    setEnabled(currentConfig?.useStyledQRCodes || false);
    setCustomStyle(getInitialStyle(currentConfig));
    if (onClose) {
      onClose();
    }
  }, [currentConfig, onClose, getInitialStyle]);

  // Notify parent of state changes - use refs to avoid infinite loop
  const handleSaveRef = useRef(handleSave);
  const handleCancelRef = useRef(handleCancel);

  useEffect(() => {
    handleSaveRef.current = handleSave;
    handleCancelRef.current = handleCancel;
  }, [handleSave, handleCancel]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        handleSave: () => handleSaveRef.current(),
        handleCancel: () => handleCancelRef.current(),
        hasChanges,
        isSaving: updateMutation.isPending,
      });
    }
  }, [hasChanges, updateMutation.isPending, onStateChange]);

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

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    try {
      setIsUploadingLogo(true);
      const result = await uploadQRStyleLogo(companyId, file);
      setCustomStyle((prev) => ({
        ...prev,
        logoSource: result.logoUrl,
        logoAwsId: result.awsId,
        logoAwsKey: result.awsKey,
        logoEnabled: true,
      }));
      toast.success("Logo uploaded successfully!");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

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
    } catch {
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

  const validateContrast = (fg: string, bg: string): boolean => {
    // Simple contrast check - convert hex to RGB and calculate luminance
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

    // Require at least 4.5:1 contrast ratio
    return contrast >= 4.5;
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const contrastValid = validateContrast(
    customStyle.foregroundColor,
    customStyle.backgroundColor,
  );

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mt-1">
            Customize the appearance of your company's QR codes. Changes apply
            to all future QR codes.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-300"
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
            {/* Live Preview */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 shadow-inner">
              <div className="flex items-center justify-center gap-4">
                <div className="flex-shrink-0">
                  {isLoadingPreview ? (
                    <div className="w-32 h-32 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : previewDataUri ? (
                    <motion.img
                      key={previewDataUri}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      src={previewDataUri}
                      alt="QR Code Preview"
                      className="w-32 h-32 rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center text-gray-400">
                        <i className="bx bx-qr text-3xl"></i>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    Live Preview
                  </h4>
                  <p className="text-xs text-gray-600">
                    Preview updates automatically as you customize
                  </p>
                  {!contrastValid && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ Low contrast - adjust colors for better scannability
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Customization Controls - Scrollable */}
            <div className="max-h-96 overflow-y-auto pr-2 space-y-6">
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
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      customStyle.logoEnabled ? "bg-blue-600" : "bg-gray-300"
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
                        // Logo preview and actions
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
                                />
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploadingLogo}
                                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                                >
                                  <i className="bx bx-refresh mr-1"></i>
                                  Change Logo
                                </button>
                                <button
                                  onClick={handleRemoveLogo}
                                  disabled={isDeletingLogo}
                                  className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                                >
                                  <i className="bx bx-trash mr-1"></i>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Logo upload dropzone
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                            isDragging
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <div className="space-y-2">
                            <div className="flex justify-center">
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  isDragging ? "bg-blue-100" : "bg-gray-200"
                                }`}
                              >
                                <i
                                  className={`bx bx-cloud-upload text-2xl ${
                                    isDragging
                                      ? "text-blue-600"
                                      : "text-gray-500"
                                  }`}
                                ></i>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {isDragging
                                  ? "Drop logo here"
                                  : "Upload Company Logo"}
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

                      {/* Logo Guidelines */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-800 font-medium mb-1">
                          <i className="bx bx-info-circle mr-1"></i>
                          Logo Guidelines
                        </p>
                        <ul className="text-xs text-amber-700 space-y-0.5 ml-5 list-disc">
                          <li>
                            Use a square or circular logo for best results
                          </li>
                          <li>High contrast logos scan better</li>
                          <li>Logo will be sized at 15% of QR code area</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dot Shape */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Dot Shape</h4>
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
                      className={`p-3 rounded-lg border-2 transition-all ${
                        customStyle.moduleShape === shape.value
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
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

              {/* Eye Style */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Eye Style</h4>
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
                      className={`p-3 rounded-lg border-2 transition-all ${
                        customStyle.eyeStyle === eye.value
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-sm font-medium">{eye.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Color Palette
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">
                      Foreground Color
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
                </div>
                {!contrastValid && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-700">
                      <i className="bx bx-error-circle mr-1"></i>
                      Insufficient contrast ratio. Increase contrast for better
                      scannability.
                    </p>
                  </div>
                )}
              </div>

              {/* Advanced Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Advanced Settings
                </h4>

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
                    className="w-full"
                  />
                </div>
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
  );
}
