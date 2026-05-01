import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import {
  requestEmailChangeOtp,
  verifyEmailChangeOtp,
} from "@/api/endpoints/user";
import {
  emailChangeSchema,
  otpVerifySchema,
  type EmailChangeFormData,
  type OTPVerifyFormData,
} from "../../utils/settingsValidation";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

// Helper functions for localStorage user management
function getUserFromLocalStorage(): Record<string, unknown> | null {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function updateUserInLocalStorage(updates: Record<string, unknown>): void {
  try {
    const existing = getUserFromLocalStorage() || {};
    localStorage.setItem("user", JSON.stringify({ ...existing, ...updates }));
  } catch {
    // no-op
  }
}

// Error message mapping for better UX
function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { message?: string; code?: string }; status?: number };
    message?: string;
  };

  const statusCode = err?.response?.status;
  const errorCode = err?.response?.data?.code;
  const message = err?.response?.data?.message || err?.message;

  // Handle specific error codes/statuses
  if (statusCode === 401 || errorCode === "INVALID_PASSWORD") {
    return "Invalid password. Please check your current password and try again.";
  }
  if (statusCode === 409 || errorCode === "EMAIL_IN_USE") {
    return "This email address is already associated with another account.";
  }
  if (statusCode === 400 && errorCode === "INVALID_OTP") {
    return "Invalid verification code. Please check and try again.";
  }
  if (errorCode === "OTP_EXPIRED") {
    return "Verification code has expired. Please request a new one.";
  }
  if (statusCode === 429 || errorCode === "RATE_LIMITED") {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  if (errorCode === "OTP_MAX_ATTEMPTS") {
    return "Maximum verification attempts exceeded. Please request a new code.";
  }

  return message || "An unexpected error occurred. Please try again.";
}

enum EmailChangeStep {
  ENTER_EMAIL = "ENTER_EMAIL",
  VERIFY_OTP = "VERIFY_OTP",
  SUCCESS = "SUCCESS",
}

interface EmailChangeWithOTPProps {
  userId: string;
  companyId: string;
  currentEmail: string;
  onSuccess?: (newEmail: string) => void;
  onCancel?: () => void;
}

export function EmailChangeWithOTP({
  userId,
  companyId,
  currentEmail,
  onSuccess,
  onCancel,
}: EmailChangeWithOTPProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<EmailChangeStep>(
    EmailChangeStep.ENTER_EMAIL,
  );
  const [newEmail, setNewEmail] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email change form
  const emailForm = useForm<EmailChangeFormData>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: {
      newEmail: "",
      currentPassword: "",
    },
  });

  // OTP verification form
  const otpForm = useForm<OTPVerifyFormData>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: {
      otp: "",
    },
  });

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(
        () => setResendCountdown(resendCountdown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Clear sensitive data on unmount
  useEffect(() => {
    return () => {
      emailForm.reset();
      otpForm.reset();
      setOtpValues(["", "", "", "", "", ""]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only runs on unmount, form instances are stable
  }, []);

  const handleEmailSubmit = async (data: EmailChangeFormData) => {
    try {
      setIsSubmitting(true);
      await requestEmailChangeOtp(userId, {
        companyId,
        newEmail: data.newEmail,
        currentPassword: data.currentPassword,
      });
      setNewEmail(data.newEmail);
      setStep(EmailChangeStep.VERIFY_OTP);
      setResendCountdown(60);
      toast.success("OTP sent to your new email");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = useCallback(
    async (otp: string) => {
      try {
        setIsSubmitting(true);
        const result = await verifyEmailChangeOtp(userId, {
          companyId,
          newEmail,
          otp,
        });

        if (result.success) {
          // Update access token with new token from response
          if (result.accessToken) {
            localStorage.setItem("accessToken", result.accessToken);
          }

          // Update user data in localStorage with new email
          updateUserInLocalStorage({
            ...result.user,
            email: result.user?.email || newEmail,
          });

          // Invalidate relevant queries to refresh user data
          queryClient.invalidateQueries({ queryKey: ["user"] });
          queryClient.invalidateQueries({ queryKey: ["company"] });

          setStep(EmailChangeStep.SUCCESS);
          toast.success("Email changed successfully");
          onSuccess?.(newEmail);
        } else {
          // Handle OTP validation failure (backend returns success: false with message)
          toast.error(
            result.message || "Invalid verification code. Please try again.",
          );

          // If max attempts exceeded or OTP expired, restart the flow
          if (result.restartFlow) {
            setStep(EmailChangeStep.ENTER_EMAIL);
            setNewEmail("");
            emailForm.reset();
          }

          // Clear OTP inputs on error
          setOtpValues(["", "", "", "", "", ""]);
          otpInputRefs.current[0]?.focus();
        }
      } catch (e: unknown) {
        toast.error(getErrorMessage(e));
        // Clear OTP inputs on error
        setOtpValues(["", "", "", "", "", ""]);
        otpInputRefs.current[0]?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, companyId, newEmail, onSuccess, queryClient, emailForm],
  );

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;

    try {
      setIsSubmitting(true);
      await requestEmailChangeOtp(userId, {
        companyId,
        newEmail,
        currentPassword: emailForm.getValues("currentPassword"),
      });
      setResendCountdown(60);
      toast.success("OTP resent successfully");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // Only allow numeric input
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Check if all 6 digits are entered
    const completeOtp = newOtpValues.join("");
    if (completeOtp.length === 6 && /^\d{6}$/.test(completeOtp)) {
      otpForm.setValue("otp", completeOtp);
      handleOtpSubmit(completeOtp);
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // Handle backspace
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    // Check if pasted data is exactly 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtpValues = pastedData.split("");
      setOtpValues(newOtpValues);
      otpForm.setValue("otp", pastedData);
      handleOtpSubmit(pastedData);
    }
  };

  const handleDone = () => {
    onCancel?.();
  };

  const handleBack = () => {
    setStep(EmailChangeStep.ENTER_EMAIL);
    setOtpValues(["", "", "", "", "", ""]);
    otpForm.reset();
  };

  const inputClassName =
    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm transition-all duration-200 focus:shadow-md";
  const errorClassName = "mt-1 text-sm text-red-600";

  // Step 1: Enter New Email
  if (step === EmailChangeStep.ENTER_EMAIL) {
    return (
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION }}
        onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
        className="space-y-4"
        data-testid="email-change-form"
      >
        {/* Header with Cancel button in same position as Change Email button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Current email: <span className="font-medium">{currentEmail}</span>
            </p>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isSubmitting}
              className="transition-all duration-200 hover:shadow-md"
            >
              Cancel
            </Button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.1 }}
          className="space-y-4"
        >
          {/* New Email */}
          <div>
            <label
              htmlFor="newEmail"
              className="block text-sm font-medium text-gray-700"
            >
              New Email Address
            </label>
            <input
              id="newEmail"
              type="email"
              {...emailForm.register("newEmail")}
              className={inputClassName}
              disabled={isSubmitting}
              data-testid="new-email-input"
              placeholder="Enter your new email"
            />
            <AnimatePresence>
              {emailForm.formState.errors.newEmail && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={errorClassName}
                  data-testid="email-error"
                >
                  {emailForm.formState.errors.newEmail.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Current Password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Current Password
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Required to verify your identity
            </p>
            <input
              id="currentPassword"
              type="password"
              {...emailForm.register("currentPassword")}
              className={inputClassName}
              disabled={isSubmitting}
              data-testid="current-password-input"
              placeholder="Enter your current password"
            />
            <AnimatePresence>
              {emailForm.formState.errors.currentPassword && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={errorClassName}
                  data-testid="password-error"
                >
                  {emailForm.formState.errors.currentPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Action Buttons - Send OTP only */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.15 }}
          className="flex justify-end gap-3 pt-2"
        >
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            data-testid="send-otp-button"
            className="transition-all duration-200 hover:shadow-md"
          >
            {isSubmitting ? (
              <>
                <i className="bx bx-loader-alt bx-spin" />
                Sending...
              </>
            ) : (
              "Send Verification Code"
            )}
          </Button>
        </motion.div>
      </motion.form>
    );
  }

  // Step 2: Verify OTP
  if (step === EmailChangeStep.VERIFY_OTP) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION }}
        className="space-y-4"
        data-testid="otp-verify-form"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.1 }}
          className="text-center"
        >
          <i className="bx bx-envelope text-4xl text-brand-500 mb-2" />
          <p className="text-sm text-gray-600">We sent a 6-digit code to:</p>
          <p
            className="font-medium text-gray-900"
            data-testid="otp-email-display"
          >
            {newEmail}
          </p>
        </motion.div>

        {/* OTP Input Boxes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.15 }}
          className="flex justify-center gap-2"
          onPaste={handleOtpPaste}
        >
          {otpValues.map((value, index) => (
            <motion.input
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, delay: 0.2 + index * 0.05 }}
              ref={(el) => {
                otpInputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              className="w-12 h-12 text-center text-xl font-semibold rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200 focus:shadow-md focus:scale-105"
              disabled={isSubmitting}
              data-testid={`otp-input-${index}`}
              aria-label={`OTP digit ${index + 1}`}
            />
          ))}
        </motion.div>

        <AnimatePresence>
          {otpForm.formState.errors.otp && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-center text-sm text-red-600"
              data-testid="otp-error"
            >
              {otpForm.formState.errors.otp.message}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Resend Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.25 }}
          className="text-center"
        >
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={resendCountdown > 0 || isSubmitting}
            className="text-sm text-brand-600 hover:text-brand-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            data-testid="resend-otp-button"
          >
            {resendCountdown > 0 ? (
              <span data-testid="resend-countdown">
                Resend in {resendCountdown}s
              </span>
            ) : (
              "Resend Code"
            )}
          </button>
        </motion.div>

        {/* Info text */}
        <p className="text-xs text-gray-500 text-center">
          Code expires in 5 minutes
        </p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.3 }}
          className="flex justify-center gap-3 pt-2"
        >
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={isSubmitting}
            data-testid="back-button"
            className="transition-all duration-200 hover:shadow-md"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              const completeOtp = otpValues.join("");
              if (completeOtp.length === 6) {
                handleOtpSubmit(completeOtp);
              }
            }}
            disabled={isSubmitting || otpValues.join("").length !== 6}
            data-testid="verify-button"
            className="transition-all duration-200 hover:shadow-md"
          >
            {isSubmitting ? (
              <>
                <i className="bx bx-loader-alt bx-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Change"
            )}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Step 3: Success
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: ANIMATION_DURATION }}
      className="text-center space-y-4"
      data-testid="success-view"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.3,
          delay: 0.1,
          type: "spring",
          stiffness: 200,
        }}
      >
        <i className="bx bx-check-circle text-5xl text-green-500" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ANIMATION_DURATION, delay: 0.2 }}
        className="text-lg font-medium text-gray-900"
      >
        Email Changed Successfully
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ANIMATION_DURATION, delay: 0.25 }}
        className="text-sm text-gray-600"
      >
        Your email has been updated to:
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ANIMATION_DURATION, delay: 0.3 }}
        className="font-medium text-gray-900"
        data-testid="new-email-display"
      >
        {newEmail}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ANIMATION_DURATION, delay: 0.35 }}
        className="pt-4"
      >
        <Button
          type="button"
          variant="primary"
          onClick={handleDone}
          data-testid="done-button"
          className="transition-all duration-200 hover:shadow-md"
        >
          Done
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default EmailChangeWithOTP;
