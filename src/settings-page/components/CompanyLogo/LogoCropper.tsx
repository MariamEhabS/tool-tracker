import { useState, useCallback, useRef, useEffect } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Button from "@/components/ui/Button";

type AspectRatioOption = {
  value: number;
  label: string;
};

type LogoCropperProps = {
  imageUrl: string;
  onCropComplete: (croppedBlob: Blob, aspectRatio?: string) => void;
  onCancel: () => void;
  isUploading?: boolean;
  /** Aspect ratio for cropping (default: 1 for square) */
  aspectRatio?: number;
  /** Allow user to switch between aspect ratios */
  aspectRatioOptions?: AspectRatioOption[];
  /** Label shown above the cropper */
  aspectRatioLabel?: string;
};

// Special value to indicate custom/free-form cropping
const CUSTOM_ASPECT_RATIO = 0;

// Tolerance for comparing aspect ratios (to account for floating point)
const ASPECT_RATIO_TOLERANCE = 0.05;

/**
 * Creates a cropped image blob from canvas.
 */
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Calculate the scale between displayed image and natural image
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to the cropped area size at natural resolution
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create blob from canvas"));
      }
    }, "image/png");
  });
}

/**
 * Creates a full-image crop (100% width and height)
 */
function createFullImageCrop(): Crop {
  return {
    unit: "%",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };
}

/**
 * Creates a centered crop with the given aspect ratio
 */
function createAspectRatioCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 100,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

/**
 * Check if a crop matches a given aspect ratio within tolerance
 */
function cropMatchesAspectRatio(
  crop: Crop | PixelCrop,
  targetAspect: number,
): boolean {
  if (!crop.width || !crop.height) return false;
  const cropAspect = crop.width / crop.height;
  return Math.abs(cropAspect - targetAspect) < ASPECT_RATIO_TOLERANCE;
}

export default function LogoCropper(props: LogoCropperProps) {
  const {
    imageUrl,
    onCropComplete,
    onCancel,
    isUploading = false,
    aspectRatioOptions: externalAspectRatioOptions,
    aspectRatioLabel,
  } = props;

  // Build aspect ratio options including Custom
  const aspectRatioOptions: AspectRatioOption[] = [
    ...(externalAspectRatioOptions || []),
    { value: CUSTOM_ASPECT_RATIO, label: "Custom" },
  ];

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  // Start with Custom (full image) by default
  const [currentAspectRatio, setCurrentAspectRatio] =
    useState<number>(CUSTOM_ASPECT_RATIO);
  const imgRef = useRef<HTMLImageElement>(null);
  const isUserResizing = useRef(false);

  const handleImageLoad = useCallback(
    (_e: React.SyntheticEvent<HTMLImageElement>) => {
      // Set initial crop to cover full image (Custom mode)
      const initialCrop = createFullImageCrop();
      setCrop(initialCrop);
      setCurrentAspectRatio(CUSTOM_ASPECT_RATIO);
    },
    [],
  );

  const handleAspectRatioChange = useCallback((ratio: number) => {
    setCurrentAspectRatio(ratio);

    if (imgRef.current) {
      if (ratio === CUSTOM_ASPECT_RATIO) {
        // Switch to full image crop for Custom
        setCrop(createFullImageCrop());
      } else {
        // Switch to centered crop with the selected aspect ratio
        const { width, height } = imgRef.current;
        const newCrop = createAspectRatioCrop(width, height, ratio);
        setCrop(newCrop);
      }
    }
  }, []);

  const handleCropChange = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: Crop) => {
      setCrop(percentCrop);

      // If user is actively resizing and we're on a preset ratio,
      // check if the crop still matches that ratio
      if (
        isUserResizing.current &&
        currentAspectRatio !== CUSTOM_ASPECT_RATIO &&
        percentCrop.width &&
        percentCrop.height
      ) {
        // Check if crop no longer matches the selected aspect ratio
        if (!cropMatchesAspectRatio(percentCrop, currentAspectRatio)) {
          // Auto-switch to Custom
          setCurrentAspectRatio(CUSTOM_ASPECT_RATIO);
        }
      }
    },
    [currentAspectRatio],
  );

  const handleCropAndUpload = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      // Calculate actual aspect ratio from the crop
      let aspectRatioStr: string;
      if (currentAspectRatio === 1) {
        aspectRatioStr = "1:1";
      } else if (currentAspectRatio === 2) {
        aspectRatioStr = "2:1";
      } else {
        // For custom, calculate the actual ratio
        const actualRatio = completedCrop.width / completedCrop.height;
        if (Math.abs(actualRatio - 1) < ASPECT_RATIO_TOLERANCE) {
          aspectRatioStr = "1:1";
        } else if (Math.abs(actualRatio - 2) < ASPECT_RATIO_TOLERANCE) {
          aspectRatioStr = "2:1";
        } else {
          // Use the closest standard or report as custom
          aspectRatioStr = actualRatio >= 1.5 ? "2:1" : "1:1";
        }
      }
      onCropComplete(croppedBlob, aspectRatioStr);
    } catch (error) {
      console.error("Failed to crop image:", error);
    }
  }, [completedCrop, onCropComplete, currentAspectRatio]);

  // Reset crop when image URL changes
  useEffect(() => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCurrentAspectRatio(CUSTOM_ASPECT_RATIO);
  }, [imageUrl]);

  // Determine the aspect prop for ReactCrop
  // undefined = free-form resizing, number = locked aspect ratio
  const aspectProp =
    currentAspectRatio === CUSTOM_ASPECT_RATIO ? undefined : currentAspectRatio;

  return (
    <div data-testid="logo-cropper" className="flex flex-col">
      {/* Header with Cancel button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {aspectRatioLabel && (
            <p className="text-sm text-gray-600">{aspectRatioLabel}</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isUploading}
          data-testid="cancel-crop-button"
        >
          Cancel
        </Button>
      </div>

      {/* Aspect Ratio Selector */}
      {aspectRatioOptions && aspectRatioOptions.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aspect Ratio
          </label>
          <div className="flex gap-2 flex-wrap">
            {aspectRatioOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleAspectRatioChange(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                  currentAspectRatio === option.value
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                data-testid={`aspect-ratio-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cropper Container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        data-testid="cropper-container"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          backgroundColor: "white",
        }}
      >
        <ReactCrop
          crop={crop}
          onChange={handleCropChange}
          onComplete={(c) => setCompletedCrop(c)}
          onDragStart={() => {
            isUserResizing.current = true;
          }}
          onDragEnd={() => {
            isUserResizing.current = false;
          }}
          aspect={aspectProp}
          className="max-h-[400px] mx-auto block"
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            onLoad={handleImageLoad}
            className="max-h-[400px] max-w-full mx-auto block"
            style={{ backgroundColor: "transparent" }}
          />
        </ReactCrop>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="primary"
          onClick={handleCropAndUpload}
          disabled={isUploading || !completedCrop}
          data-testid="crop-upload-button"
        >
          {isUploading ? "Uploading..." : "Crop & Upload"}
        </Button>
      </div>
    </div>
  );
}
