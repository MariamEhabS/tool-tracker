import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { postPhoto } from "@/api/endpoints/tools";
import { getCreatorInfoFromStorage } from "@/utils/creatorInfo";
import { createProcoreItem } from "@/api/endpoints/procore-item";
import { logProcoreError } from "@/utils/rollbar";

interface CreatePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  projectId: string;
  qrCodeId: string;
  onCreated?: (id: string) => void;
}

export function CreatePhotoModal({
  isOpen,
  onClose,
  companyId,
  projectId,
  qrCodeId,
  onCreated,
}: CreatePhotoModalProps) {
  const [photoName, setPhotoName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPhotoName("");
    setDescription("");
    setSubmitting(false);
    setImageFile(null);
    setImagePreview(null);
  }, [isOpen]);

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const canSubmit = useMemo(
    () => Boolean(imageFile && !submitting),
    [imageFile, submitting],
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    e.currentTarget.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!imageFile) {
      toast.error("Please select a photo.");
      return;
    }
    try {
      setSubmitting(true);
      const creator = getCreatorInfoFromStorage();
      const fullDescription =
        `Photo Created in Taliho by ${creator?.name ?? ""} (${creator?.company ?? ""})` +
        (description ? `\n\n${description}` : "");

      // If user provided a name, create a new File with that name (preserving extension)
      let fileToUpload = imageFile;
      if (photoName.trim()) {
        const ext = imageFile.name.includes(".")
          ? imageFile.name.substring(imageFile.name.lastIndexOf("."))
          : ".jpg";
        const newName = photoName.trim().endsWith(ext)
          ? photoName.trim()
          : `${photoName.trim()}${ext}`;
        fileToUpload = new File([imageFile], newName, {
          type: imageFile.type,
        });
      }

      const response = await postPhoto(
        companyId,
        projectId,
        { description: fullDescription },
        fileToUpload,
      );

      const photoId =
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.id ??
        (response as { id?: string | number; data?: { id?: string | number } })
          ?.data?.id;

      if (photoId) {
        try {
          await createProcoreItem({
            companyId: String(companyId),
            projectId: String(projectId),
            qrcodeId: String(qrCodeId),
            procoreToolName: "photo",
            procoreItemID: String(photoId),
          });
        } catch (linkError) {
          logProcoreError(linkError, "link-photo-to-qrcode", {
            projectId,
            qrCodeId,
            photoId: String(photoId),
          });
          toast.error(
            "Photo created but failed to link to QR code. You can link it manually later.",
          );
        }
        onCreated?.(String(photoId));
        toast.success("Photo uploaded successfully.");
      }
      onClose();
    } catch (e) {
      logProcoreError(e, "create-photo", {
        projectId,
        qrCodeId,
      });
      toast.error("Failed to create photo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-white"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-yellow-400">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Add Photo
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-900 bg-white/60 hover:bg-white px-3 py-1 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="space-y-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Photo
                </label>
                {imagePreview ? (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full rounded-lg border border-gray-200 object-cover max-h-64"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-sm shadow"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 active:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-10 h-10 mb-2 text-gray-400"
                    >
                      <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                      <path
                        fillRule="evenodd"
                        d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.2.32.544.524.921.56a49.52 49.52 0 010 0 .75.75 0 01.713.52c.3.96.463 1.978.463 3.037v.75a.75.75 0 01-1.5 0v-.75c0-.812-.12-1.595-.345-2.334a2.25 2.25 0 00-2.139-1.56 49.02 49.02 0 00-5.124 0 2.25 2.25 0 00-2.139 1.56A9.722 9.722 0 006.75 9.894v.75a.75.75 0 01-1.5 0v-.75c0-1.059.163-2.077.464-3.037a.75.75 0 01.712-.52 49.52 49.52 0 010 0c.377-.036.72-.24.921-.56l.821-1.317a2.639 2.639 0 012.332-1.39zM12 12.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Tap to take or select a photo
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Photo name (optional)"
                  value={photoName}
                  onChange={(e) => setPhotoName(e.target.value)}
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  rows={4}
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500 disabled:opacity-60"
              >
                {submitting ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
