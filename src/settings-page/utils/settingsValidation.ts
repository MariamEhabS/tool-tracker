import { z } from "zod";

/**
 * User profile validation schema
 * Validates basic user profile information (name fields and optional phone)
 */
export const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[\d\s\-()+ ]+$/.test(val),
      "Phone number can only contain digits, spaces, dashes, parentheses, and plus sign",
    )
    .refine(
      (val) => !val || val.replace(/\D/g, "").length >= 10,
      "Phone number must have at least 10 digits",
    ),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * Password change validation schema
 * Validates password changes with requirements for length, uppercase, lowercase, and numbers
 * Also validates that new password and confirmation match
 */
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordFormData = z.infer<typeof passwordSchema>;

/**
 * Company information validation schema
 * Validates company profile fields with optional address information
 * Website URL is validated when provided, but empty strings are allowed
 * Phone number validates format when provided (digits, spaces, dashes, parentheses, plus sign)
 */
export const companySchema = z.object({
  companyName: z.string().min(1, "Company name required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[\d\s\-()+ ]+$/.test(val),
      "Phone number can only contain digits, spaces, dashes, parentheses, and plus sign",
    )
    .refine(
      (val) => !val || val.replace(/\D/g, "").length >= 10,
      "Phone number must have at least 10 digits",
    ),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export type CompanyFormData = z.infer<typeof companySchema>;

/**
 * Notification preferences validation schema
 * Validates user notification settings including toggle preferences and delivery frequency
 */
export const notificationPrefsSchema = z.object({
  storageWarnings: z.boolean(),
  userInvites: z.boolean(),
  integrationAlerts: z.boolean(),
  weeklyReports: z.boolean(),
  frequency: z.enum(["instant", "daily", "weekly"]),
});

export type NotificationPrefsFormData = z.infer<typeof notificationPrefsSchema>;

/**
 * Email change (step 1) validation schema
 * Validates new email format and requires current password for verification
 */
export const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email format"),
  currentPassword: z.string().min(1, "Password required for verification"),
});

export type EmailChangeFormData = z.infer<typeof emailChangeSchema>;

/**
 * OTP verification validation schema
 * Validates 6-digit numeric OTP codes for email verification
 */
export const otpVerifySchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numeric"),
});

export type OTPVerifyFormData = z.infer<typeof otpVerifySchema>;

/**
 * Password change with OTP validation schema
 * Validates new password without requiring current password (OTP verifies identity)
 */
export const passwordChangeOtpSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordChangeOTPFormData = z.infer<typeof passwordChangeOtpSchema>;

/**
 * User invite validation schema
 * Validates email format and role selection for inviting new users
 */
export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["admin", "pm", "user"]),
});

export type InviteUserFormData = z.infer<typeof inviteUserSchema>;
