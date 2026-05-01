import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { useCompany, patchCompany, companyKeys } from "@/api/endpoints/company";
import {
  companySchema,
  type CompanyFormData,
} from "../utils/settingsValidation";
import { useUnsavedChangesSection } from "../hooks/useUnsavedChanges";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

interface CompanyInfoProps {
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

export function CompanyInfo({ readOnly = false }: CompanyInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const companyId = getCompanyIdFromLocalStorage();
  const { data: companyDetails, isLoading } = useCompany(companyId || "");
  const { setDirty, markClean } = useUnsavedChangesSection(
    "company-info",
    "Company Information",
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      phone: "",
      website: "",
    },
  });

  // Update form when company data loads
  useEffect(() => {
    if (companyDetails) {
      reset({
        companyName: companyDetails.companyName || "",
        address: companyDetails.companyAddress || "",
        city: companyDetails.companyCity || "",
        state: companyDetails.companyState || "",
        zip: companyDetails.companyZIP || "",
        phone: companyDetails.companyPhone || "",
        website: companyDetails.companyWebsite || "",
      });
    }
  }, [companyDetails, reset]);

  // Sync form dirty state with global unsaved changes tracker
  useEffect(() => {
    setDirty(isEditing && isDirty);
  }, [isDirty, isEditing, setDirty]);

  const mutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      if (!companyId) {
        throw new Error("Missing company id");
      }
      return patchCompany(companyId, {
        companyName: data.companyName,
        companyAddress: data.address || "",
        companyCity: data.city || "",
        companyState: data.state || "",
        companyZIP: data.zip || "",
        companyPhone: data.phone || "",
        companyWebsite: data.website || "",
      });
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: companyKeys.all });

      // Snapshot previous value
      const previousCompany = queryClient.getQueryData(
        companyKeys.detail(companyId || ""),
      );

      // Optimistically update
      queryClient.setQueryData(
        companyKeys.detail(companyId || ""),
        (old: unknown) => ({
          ...(old as object),
          companyName: newData.companyName,
          companyAddress: newData.address || "",
          companyCity: newData.city || "",
          companyState: newData.state || "",
          companyZIP: newData.zip || "",
          companyPhone: newData.phone || "",
          companyWebsite: newData.website || "",
        }),
      );

      return { previousCompany };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });

      // Update localStorage["user"].company and notify header
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          user.company = variables.companyName;
          localStorage.setItem("user", JSON.stringify(user));
          // Dispatch event so header re-renders with new company name
          window.dispatchEvent(
            new CustomEvent("companyNameUpdated", {
              detail: { companyName: variables.companyName },
            }),
          );
        }
      } catch {
        // Silent fail - header will update on next login
      }

      toast.success("Company details updated successfully!");
      markClean();
      setIsEditing(false);
    },
    onError: (error: unknown, _variables, context) => {
      // Revert optimistic update
      if (context?.previousCompany) {
        queryClient.setQueryData(
          companyKeys.detail(companyId || ""),
          context.previousCompany,
        );
      }
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update company details",
      );
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    mutation.mutate(data);
  };

  const handleCancel = () => {
    reset({
      companyName: companyDetails?.companyName || "",
      address: companyDetails?.companyAddress || "",
      city: companyDetails?.companyCity || "",
      state: companyDetails?.companyState || "",
      zip: companyDetails?.companyZIP || "",
      phone: companyDetails?.companyPhone || "",
      website: companyDetails?.companyWebsite || "",
    });
    markClean();
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const inputClassName =
    "block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm";
  const errorClassName = "mt-1 text-sm text-red-600";
  const labelClassName = "block text-sm font-medium text-gray-700";

  if (isLoading) {
    return (
      <div data-testid="company-info">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="company-info">
      <AnimatePresence mode="wait" initial={false}>
        {!isEditing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Company Information
                </h4>
                <p className="text-sm text-gray-500">Your company's details</p>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleEdit}
                  data-testid="edit-button"
                  className="transition-all duration-200 hover:shadow-md"
                >
                  Edit
                </Button>
              )}
            </div>

            {/* QR Code Center Logo Section */}
            {/* <div
              className="border-b border-gray-200 pb-6"
              data-testid="qr-logo-section"
            >
              <span className={labelClassName}>QR Code Center Logo</span>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Embedded at the center of generated QR codes. Must be square
                (1:1 ratio).
              </p>
              <div className="mt-3">
                {qrCropImageUrl ? (
                  <LogoCropper
                    imageUrl={qrCropImageUrl}
                    onCropComplete={handleQrCropComplete}
                    onCancel={handleQrCropCancel}
                    isUploading={isUploadingQrLogo}
                    aspectRatio={1}
                  />
                ) : qrLogoUrl ? (
                  <div className="space-y-4">
                    <LogoPreview
                      logoUrl={qrLogoUrl}
                      onDelete={handleDeleteQrLogo}
                      isDeleting={isDeletingQrLogo}
                    />
                    {!readOnly && (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            document
                              .querySelector<HTMLInputElement>(
                                '[data-testid="qr-logo-file-input"]',
                              )
                              ?.click()
                          }
                          data-testid="change-qr-logo-button"
                          className="transition-all duration-200 hover:shadow-md"
                        >
                          Change Logo
                        </Button>
                      </div>
                    )}
                    {!readOnly && (
                      <div className="hidden">
                        <LogoUpload
                          onFileSelect={handleQrFileSelect}
                          disabled={isUploadingQrLogo}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  !readOnly && (
                    <LogoUpload
                      onFileSelect={handleQrFileSelect}
                      disabled={isUploadingQrLogo}
                    />
                  )
                )}
                {readOnly && !qrLogoUrl && (
                  <p className="text-sm text-gray-500">No logo uploaded</p>
                )}
              </div>
            </div> */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={labelClassName}>Company Name</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-company-name"
                >
                  {companyDetails?.companyName || "-"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className={labelClassName}>Address</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-address"
                >
                  {companyDetails?.companyAddress || "-"}
                </p>
              </div>
              <div>
                <span className={labelClassName}>City</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-city"
                >
                  {companyDetails?.companyCity || "-"}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <span className={labelClassName}>State</span>
                  <p
                    className="mt-1 text-sm text-gray-900"
                    data-testid="display-state"
                  >
                    {companyDetails?.companyState || "-"}
                  </p>
                </div>
                <div className="flex-1">
                  <span className={labelClassName}>ZIP</span>
                  <p
                    className="mt-1 text-sm text-gray-900"
                    data-testid="display-zip"
                  >
                    {companyDetails?.companyZIP || "-"}
                  </p>
                </div>
              </div>
              <div>
                <span className={labelClassName}>Phone</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-phone"
                >
                  {companyDetails?.companyPhone || "-"}
                </p>
              </div>
              <div>
                <span className={labelClassName}>Website</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-website"
                >
                  {companyDetails?.companyWebsite || "-"}
                </p>
              </div>
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Header with Cancel button in same position as Edit button */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Edit Company Information
                  </h4>
                  <p className="text-sm text-gray-500">
                    Update your company's details
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={mutation.isPending}
                  data-testid="cancel-button"
                  className="transition-all duration-200 hover:shadow-md"
                >
                  Cancel
                </Button>
              </div>

              {/* QR Code Center Logo Section in Edit Mode */}
              {/* <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: ANIMATION_DURATION, delay: 0.05 }}
                className="border-b border-gray-200 pb-6"
                data-testid="qr-logo-section-edit"
              >
                <span className={labelClassName}>QR Code Center Logo</span>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  Embedded at the center of generated QR codes. Must be square
                  (1:1 ratio).
                </p>
                <div className="mt-3">
                  {qrCropImageUrl ? (
                    <LogoCropper
                      imageUrl={qrCropImageUrl}
                      onCropComplete={handleQrCropComplete}
                      onCancel={handleQrCropCancel}
                      isUploading={isUploadingQrLogo}
                      aspectRatio={1}
                    />
                  ) : qrLogoUrl ? (
                    <div className="space-y-4">
                      <LogoPreview
                        logoUrl={qrLogoUrl}
                        onDelete={handleDeleteQrLogo}
                        isDeleting={isDeletingQrLogo}
                      />
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            document
                              .querySelector<HTMLInputElement>(
                                '[data-testid="qr-logo-file-input-edit"]',
                              )
                              ?.click()
                          }
                          data-testid="change-qr-logo-button-edit"
                          className="transition-all duration-200 hover:shadow-md"
                        >
                          Change Logo
                        </Button>
                      </div>
                      <div className="hidden">
                        <LogoUpload
                          onFileSelect={handleQrFileSelect}
                          disabled={isUploadingQrLogo}
                        />
                      </div>
                    </div>
                  ) : (
                    <LogoUpload
                      onFileSelect={handleQrFileSelect}
                      disabled={isUploadingQrLogo}
                    />
                  )}
                </div>
              </motion.div> */}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: ANIMATION_DURATION, delay: 0.1 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div className="sm:col-span-2">
                  <label htmlFor="companyName" className={labelClassName}>
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    {...register("companyName")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-company-name"
                  />
                  <AnimatePresence>
                    {errors.companyName && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-company-name"
                      >
                        {errors.companyName.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="address" className={labelClassName}>
                    Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    {...register("address")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-address"
                  />
                  <AnimatePresence>
                    {errors.address && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-address"
                      >
                        {errors.address.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="city" className={labelClassName}>
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    {...register("city")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-city"
                  />
                  <AnimatePresence>
                    {errors.city && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-city"
                      >
                        {errors.city.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label htmlFor="state" className={labelClassName}>
                      State
                    </label>
                    <input
                      id="state"
                      type="text"
                      {...register("state")}
                      className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                      data-testid="input-state"
                    />
                    <AnimatePresence>
                      {errors.state && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className={errorClassName}
                          data-testid="error-state"
                        >
                          {errors.state.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="zip" className={labelClassName}>
                      ZIP
                    </label>
                    <input
                      id="zip"
                      type="text"
                      {...register("zip")}
                      className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                      data-testid="input-zip"
                    />
                    <AnimatePresence>
                      {errors.zip && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className={errorClassName}
                          data-testid="error-zip"
                        >
                          {errors.zip.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className={labelClassName}>
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="text"
                    {...register("phone")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    placeholder="(555) 555-5555"
                    data-testid="input-phone"
                  />
                  <AnimatePresence>
                    {errors.phone && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-phone"
                      >
                        {errors.phone.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="website" className={labelClassName}>
                    Website
                  </label>
                  <input
                    id="website"
                    type="text"
                    {...register("website")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    placeholder="https://example.com"
                    data-testid="input-website"
                  />
                  <AnimatePresence>
                    {errors.website && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-website"
                      >
                        {errors.website.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: ANIMATION_DURATION, delay: 0.15 }}
                className="flex justify-end gap-3 pt-4 border-t border-gray-200"
              >
                <Button
                  type="submit"
                  variant="primary"
                  disabled={mutation.isPending || !isDirty}
                  data-testid="save-button"
                  className="transition-all duration-200 hover:shadow-md"
                >
                  {mutation.isPending ? "Saving..." : "Save"}
                </Button>
              </motion.div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CompanyInfo;
