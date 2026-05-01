import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { addUser } from "@/api/endpoints/user";

interface InviteUserFormData {
  email: string;
  role: "user" | "pm" | "admin";
}

interface InviteUserFormProps {
  companyId: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserForm({ companyId }: InviteUserFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteUserFormData>({
    defaultValues: {
      email: "",
      role: "user",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InviteUserFormData) => {
      if (!companyId) {
        throw new Error("Missing company id");
      }
      return addUser({
        companyId,
        email: data.email.trim(),
        permission: data.role,
      });
    },
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["companyUsers"] });
      toast.success("Invitation sent successfully");
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to invite user",
      );
    },
  });

  const onSubmit = (data: InviteUserFormData) => {
    mutation.mutate(data);
  };

  const inputClassName =
    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed";
  const errorClassName = "mt-1 text-sm text-red-600";
  const labelClassName = "block text-sm font-medium text-gray-700";

  return (
    <div
      className="border border-gray-200 rounded-md p-3"
      data-testid="invite-user-form"
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Invite New User
      </h3>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          <div className="flex-1">
            <label htmlFor="invite-email" className={labelClassName}>
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              disabled={mutation.isPending}
              className={`${inputClassName} ${errors.email ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}`}
              data-testid="invite-email-input"
              {...register("email", {
                required: "Email is required",
                validate: (value) =>
                  EMAIL_REGEX.test(value.trim()) ||
                  "Please enter a valid email address",
              })}
            />
            {errors.email && (
              <p className={errorClassName} data-testid="email-error">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="sm:w-32">
            <label htmlFor="invite-role" className={labelClassName}>
              Role
            </label>
            <select
              id="invite-role"
              disabled={mutation.isPending}
              className={inputClassName}
              data-testid="invite-role-select"
              {...register("role")}
            >
              <option value="user">User</option>
              <option value="pm">PM</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            leftIconClass={
              mutation.isPending ? "bx bx-loader-alt bx-spin" : "bx bx-send"
            }
            data-testid="invite-submit-button"
          >
            {mutation.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default InviteUserForm;
