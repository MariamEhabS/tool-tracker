import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import {
  requestPasswordChangeOtp,
  verifyPasswordChangeOtp,
  completePasswordChangeOtp,
} from "@/api/endpoints/user";
import {
  passwordChangeOtpSchema,
  otpVerifySchema,
  type PasswordChangeOTPFormData,
  type OTPVerifyFormData,
} from "../../utils/settingsValidation";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

// Cooldown duration in seconds
const COOLDOWN_DURATION = 60;

// LocalStorage key for persisting cooldown
const COOLDOWN_STORAGE_KEY = "password_change_otp_cooldown";

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
  if (errorCode === "SAME_PASSWORD") {
    return "New password must be different from your current password.";
  }

  return message || "An unexpected error occurred. Please try again.";
}

// Helper to get remaining cooldown from localStorage
function getRemainingCooldown(): number {
  try {
    const stored = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!stored) return 0;
    const expiresAt = parseInt(stored, 10);
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

// Helper to set cooldown in localStorage
function setCooldownExpiry(): void {
  try {
    const expiresAt = Date.now() + COOLDOWN_DURATION * 1000;
    localStorage.setItem(COOLDOWN_STORAGE_KEY, expiresAt.toString());
  } catch {
    // no-op
  }
}

// Helper to clear cooldown from localStorage
function clearCooldown(): void {
  try {
    localStorage.removeItem(COOLDOWN_STORAGE_KEY);
  } catch {
    // no-op
  }
}

enum PasswordChangeStep {
  INITIAL = "INITIAL",
  VERIFY_OTP = "VERIFY_OTP",
  SET_NEW_PASSWORD = "SET_NEW_PASSWORD",
  SUCCESS = "SUCCESS",
}

interface PasswordChangeWithOTPProps {
  userEmail: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

type PasswordStrength = "weak" | "medium" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  const requirements = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const metCount = requirements.filter(Boolean).length;

  if (metCount <= 1) return "weak";
  if (metCount <= 3) return "medium";
  return "strong";
}

function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "strong":
      return "bg-green-500";
  }
}

function getStrengthWidth(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "w-1/3";
    case "medium":
      return "w-2/3";
    case "strong":
      return "w-full";
  }
}

// Mask email for display (e.g., j***@example.com)
function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

export function PasswordChangeWithOTP({
  userEmail,
  onSuccess,
  onCancel,
}: PasswordChangeWithOTPProps) {
  const [step, setStep] = useState<PasswordChangeStep>(
    PasswordChangeStep.INITIAL,
  );
  const [resendCountdown, setResendCountdown] = useState(() =>
    getRemainingCooldown(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password change form
  const passwordForm = useForm<PasswordChangeOTPFormData>({
    resolver: zodResolver(passwordChangeOtpSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // OTP verification form
  const otpForm = useForm<OTPVerifyFormData>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: {
      otp: "",
    },
  });

  const newPassword = passwordForm.watch("newPassword");
  const confirmPassword = passwordForm.watch("confirmPassword");

  const passwordRequirements: PasswordRequirement[] = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Contains number", met: /[0-9]/.test(newPassword) },
  ];

  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;

  const passwordStrength = getPasswordStrength(newPassword);

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
      passwordForm.reset();
      otpForm.reset();
      setOtpValues(["", "", "", "", "", ""]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only runs on unmount, form instances are stable
  }, []);

  const handleRequestOTP = async () => {
    if (resendCountdown > 0) return;

    try {
      setIsSubmitting(true);
      await requestPasswordChangeOtp(userEmail);
      setCooldownExpiry();
      setResendCountdown(COOLDOWN_DURATION);
      setStep(PasswordChangeStep.VERIFY_OTP);
      toast.success(`Verification email sent to ${maskEmail(userEmail)}`);
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

        // Verify OTP with backend before advancing
        const result = await verifyPasswordChangeOtp({
          email: userEmail,
          otp,
        });

        if (result.success) {
          // OTP verified successfully - store and advance to password step
          otpForm.setValue("otp", otp);
          setStep(PasswordChangeStep.SET_NEW_PASSWORD);
        } else {
          // OTP verification failed
          toast.error(
            result.message || "Invalid verification code. Please try again.",
          );

          // If max attempts exceeded or OTP expired, restart the entire flow
          if (result.restartFlow) {
            clearCooldown();
            setStep(PasswordChangeStep.INITIAL);
          }

          // Clear OTP inputs on error
          setOtpValues(["", "", "", "", "", ""]);
          otpInputRefs.current[0]?.focus();
          otpForm.reset();
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
    [otpForm, userEmail],
  );

  const handlePasswordSubmit = async (data: PasswordChangeOTPFormData) => {
    try {
      setIsSubmitting(true);
      const otp = otpForm.getValues("otp");
      const result = await completePasswordChangeOtp({
        email: userEmail,
        otp,
        password: data.newPassword,
      });

      if (result.success) {
        clearCooldown();
        setStep(PasswordChangeStep.SUCCESS);
        toast.success("Password changed successfully");
        // Note: onSuccess is called when user clicks "Done" to allow them to see the success screen
      } else {
        // Handle OTP validation failure (backend returns success: false with message)
        toast.error(
          result.message || "Invalid verification code. Please try again.",
        );

        // If max attempts exceeded or OTP expired, restart the entire flow
        if (result.restartFlow) {
          clearCooldown();
          setStep(PasswordChangeStep.INITIAL);
          passwordForm.reset();
        } else {
          // Go back to OTP step so user can re-enter or request new code
          setStep(PasswordChangeStep.VERIFY_OTP);
        }

        setOtpValues(["", "", "", "", "", ""]);
        otpForm.reset();
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
      // If OTP is invalid/expired, go back to OTP step
      const err = e as { response?: { data?: { code?: string } } };
      if (
        err?.response?.data?.code === "INVALID_OTP" ||
        err?.response?.data?.code === "OTP_EXPIRED" ||
        err?.response?.data?.code === "OTP_MAX_ATTEMPTS"
      ) {
        setStep(PasswordChangeStep.VERIFY_OTP);
        setOtpValues(["", "", "", "", "", ""]);
        otpForm.reset();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;

    try {
      setIsSubmitting(true);
      await requestPasswordChangeOtp(userEmail);
      setCooldownExpiry();
      setResendCountdown(COOLDOWN_DURATION);
      toast.success("Verification code resent");
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
    onSuccess?.();
  };

  const handleBack = () => {
    if (step === PasswordChangeStep.SET_NEW_PASSWORD) {
      setStep(PasswordChangeStep.VERIFY_OTP);
      passwordForm.reset();
    } else if (step === PasswordChangeStep.VERIFY_OTP) {
      setStep(PasswordChangeStep.INITIAL);
      setOtpValues(["", "", "", "", "", ""]);
      otpForm.reset();
    }
  };

  const inputClassName =
    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm transition-all duration-200 focus:shadow-md";
  const errorClassName = "mt-1 text-sm text-red-600";

  // Step 1: Initial - Request OTP
  if (step === PasswordChangeStep.INITIAL) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION }}
        className="space-y-4"
        data-testid="password-change-initial"
      >
        {/* Header with Cancel button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              We'll send a verification code to your email to confirm your
              identity.
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
          className="bg-gray-50 rounded-lg p-4"
        >
          <p className="text-sm text-gray-600">
            Verification code will be sent to:
          </p>
          <p className="font-medium text-gray-900">{maskEmail(userEmail)}</p>
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.15 }}
          className="flex justify-end gap-3 pt-2"
        >
          <Button
            type="button"
            variant="primary"
            onClick={handleRequestOTP}
            disabled={isSubmitting || resendCountdown > 0}
            data-testid="send-otp-button"
            className={`transition-all duration-200 hover:shadow-md ${
              resendCountdown > 0 ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {isSubmitting ? (
              <>
                <i className="bx bx-loader-alt bx-spin mr-1" />
                Sending...
              </>
            ) : resendCountdown > 0 ? (
              <span data-testid="cooldown-timer">
                Resend in {resendCountdown}s
              </span>
            ) : (
              "Send Verification Code"
            )}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Step 2: Verify OTP
  if (step === PasswordChangeStep.VERIFY_OTP) {
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
            {maskEmail(userEmail)}
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
            className={`text-sm transition-colors duration-200 ${
              resendCountdown > 0 || isSubmitting
                ? "text-gray-400 cursor-not-allowed"
                : "text-brand-600 hover:text-brand-700"
            }`}
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
                <i className="bx bx-loader-alt bx-spin mr-1" />
                Verifying...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Step 3: Set New Password
  if (step === PasswordChangeStep.SET_NEW_PASSWORD) {
    return (
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: ANIMATION_DURATION }}
        onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
        className="space-y-4"
        data-testid="set-password-form"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.1 }}
          className="flex items-center gap-3 bg-green-50 rounded-lg px-4 py-3 border border-green-100"
        >
          <i className="bx bx-check-circle text-2xl text-green-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900 text-sm">
              Identity verified
            </p>
            <p className="text-xs text-gray-500">Set your new password below</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.15 }}
          className="space-y-4"
        >
          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                {...passwordForm.register("newPassword")}
                className={inputClassName}
                disabled={isSubmitting}
                data-testid="new-password-input"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                <i
                  className={`bx ${showNewPassword ? "bx-hide" : "bx-show"} text-lg`}
                />
              </button>
            </div>
            <AnimatePresence>
              {passwordForm.formState.errors.newPassword && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={errorClassName}
                >
                  {passwordForm.formState.errors.newPassword.message}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Password Strength Indicator */}
            <AnimatePresence>
              {newPassword.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      Password strength
                    </span>
                    <span
                      className={`text-xs font-medium transition-colors duration-200 ${
                        passwordStrength === "weak"
                          ? "text-red-600"
                          : passwordStrength === "medium"
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {passwordStrength.charAt(0).toUpperCase() +
                        passwordStrength.slice(1)}
                    </span>
                  </div>
                  <div
                    className="h-2 bg-gray-200 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={
                      passwordStrength === "weak"
                        ? 33
                        : passwordStrength === "medium"
                          ? 66
                          : 100
                    }
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Password strength"
                  >
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor(passwordStrength)} ${getStrengthWidth(passwordStrength)}`}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Requirements Checklist - 2 column grid */}
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {passwordRequirements.map((req, index) => (
                <motion.li
                  key={req.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.03 }}
                  className="flex items-center text-xs"
                >
                  <i
                    className={`bx ${req.met ? "bx-check text-green-500" : "bx-x text-gray-400"} mr-1 text-sm transition-colors duration-200`}
                    aria-hidden="true"
                  />
                  <span
                    className={`transition-colors duration-200 ${req.met ? "text-green-700" : "text-gray-500"}`}
                  >
                    {req.label}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...passwordForm.register("confirmPassword")}
                className={inputClassName}
                disabled={isSubmitting}
                data-testid="confirm-password-input"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                <i
                  className={`bx ${showConfirmPassword ? "bx-hide" : "bx-show"} text-lg`}
                />
              </button>
            </div>
            <AnimatePresence>
              {passwordForm.formState.errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={errorClassName}
                >
                  {passwordForm.formState.errors.confirmPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
            {/* Passwords match indicator */}
            <AnimatePresence>
              {confirmPassword.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1 flex items-center text-xs"
                >
                  <i
                    className={`bx ${passwordsMatch ? "bx-check text-green-500" : "bx-x text-red-400"} mr-1 text-sm transition-colors duration-200`}
                    aria-hidden="true"
                  />
                  <span
                    className={`transition-colors duration-200 ${passwordsMatch ? "text-green-700" : "text-red-500"}`}
                  >
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION_DURATION, delay: 0.2 }}
          className="flex justify-end gap-3 pt-2"
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
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            data-testid="save-password-button"
            className="transition-all duration-200 hover:shadow-md"
          >
            {isSubmitting ? (
              <>
                <i className="bx bx-loader-alt bx-spin mr-1" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </motion.div>
      </motion.form>
    );
  }

  // Step 4: Success
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
        Password Changed Successfully
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: ANIMATION_DURATION, delay: 0.25 }}
        className="text-sm text-gray-600"
      >
        Your password has been updated. Use your new password next time you sign
        in.
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

export default PasswordChangeWithOTP;
