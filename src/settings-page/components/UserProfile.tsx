import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { patchUserDetails } from "@/api/endpoints/user";
import {
  profileSchema,
  type ProfileFormData,
} from "../utils/settingsValidation";
import { useUnsavedChangesSection } from "../hooks/useUnsavedChanges";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

interface UserData {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  companyId?: string;
}

function getUserFromLocalStorage(): UserData | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function updateUserInLocalStorage(updates: Partial<UserData>): void {
  try {
    const existing = getUserFromLocalStorage() || {};
    localStorage.setItem("user", JSON.stringify({ ...existing, ...updates }));
  } catch {
    // no-op
  }
}

export function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<UserData | null>(getUserFromLocalStorage);
  const queryClient = useQueryClient();
  const { setDirty, markClean } = useUnsavedChangesSection(
    "user-profile",
    "User Profile",
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phoneNumber: user?.phoneNumber || "",
    },
  });

  // Sync form dirty state with global unsaved changes tracker
  useEffect(() => {
    setDirty(isEditing && isDirty);
  }, [isDirty, isEditing, setDirty]);

  const mutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?._id || !user?.companyId) {
        throw new Error("Missing user or company id");
      }
      return patchUserDetails(user._id, {
        companyId: user.companyId,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || undefined,
      });
    },
    onMutate: async (newData) => {
      // Optimistic update
      updateUserInLocalStorage({
        firstName: newData.firstName,
        lastName: newData.lastName,
        phoneNumber: newData.phoneNumber,
      });
    },
    onSuccess: (updatedUser) => {
      // Update localStorage with server response
      updateUserInLocalStorage({
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        phoneNumber: updatedUser?.phoneNumber,
      });
      // Update local state to reflect changes in the UI
      setUser((prev) => ({
        ...prev,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        phoneNumber: updatedUser?.phoneNumber,
      }));
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Profile updated successfully!");
      markClean();
      setIsEditing(false);
    },
    onError: (error: unknown) => {
      // Revert optimistic update
      reset({
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        phoneNumber: user?.phoneNumber || "",
      });
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update profile",
      );
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    mutation.mutate(data);
  };

  const handleCancel = () => {
    reset({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phoneNumber: user?.phoneNumber || "",
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

  return (
    <div data-testid="user-profile">
      <AnimatePresence mode="wait" initial={false}>
        {!isEditing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Profile Information
                </h4>
                <p className="text-sm text-gray-500">
                  Your personal profile details
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleEdit}
                data-testid="edit-button"
                className="transition-all duration-200 hover:shadow-md"
              >
                Edit
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className={labelClassName}>First Name</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-first-name"
                >
                  {user?.firstName || "-"}
                </p>
              </div>
              <div>
                <span className={labelClassName}>Last Name</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-last-name"
                >
                  {user?.lastName || "-"}
                </p>
              </div>
              <div>
                <span className={labelClassName}>Email</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-email"
                >
                  {user?.email || "-"}
                </p>
              </div>
              <div>
                <span className={labelClassName}>Phone Number</span>
                <p
                  className="mt-1 text-sm text-gray-900"
                  data-testid="display-phone-number"
                >
                  {user?.phoneNumber || "-"}
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Header with Cancel button in same position as Edit button */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Edit Profile Information
                  </h4>
                  <p className="text-sm text-gray-500">
                    Update your personal details
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

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: ANIMATION_DURATION, delay: 0.1 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor="firstName" className={labelClassName}>
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    {...register("firstName")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-first-name"
                  />
                  <AnimatePresence>
                    {errors.firstName && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-first-name"
                      >
                        {errors.firstName.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="lastName" className={labelClassName}>
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    {...register("lastName")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-last-name"
                  />
                  <AnimatePresence>
                    {errors.lastName && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-last-name"
                      >
                        {errors.lastName.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="email" className={labelClassName}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className={`${inputClassName} bg-gray-50 text-gray-500 cursor-not-allowed`}
                    data-testid="input-email"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email can be changed in the Security section
                  </p>
                </div>

                <div>
                  <label htmlFor="phoneNumber" className={labelClassName}>
                    Phone Number
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    {...register("phoneNumber")}
                    className={`${inputClassName} transition-all duration-200 focus:shadow-md`}
                    data-testid="input-phone-number"
                  />
                  <AnimatePresence>
                    {errors.phoneNumber && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={errorClassName}
                        data-testid="error-phone-number"
                      >
                        {errors.phoneNumber.message}
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

export default UserProfile;
