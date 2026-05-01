import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  requestPasswordReset,
  verifyPasswordReset,
  completePasswordReset,
} from "@/api/endpoints/authentication";
import { logAuthError } from "@/utils/rollbar";
import AuthLayout, {
  AnimatedFormContent,
  AnimatedFormItem,
} from "@/components/layout/AuthLayout";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createLazyFileRoute("/forgot-password")({
  component: RouteComponent,
});

type Step = "email" | "otp" | "password";

function RouteComponent() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation helper
  const validatePassword = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    return { hasMinLength, hasUppercase, hasLowercase, hasNumber };
  };

  const getPasswordStrength = (pwd: string) => {
    const { hasMinLength, hasUppercase, hasLowercase, hasNumber } =
      validatePassword(pwd);
    const checks = [hasMinLength, hasUppercase, hasLowercase, hasNumber];
    const passed = checks.filter(Boolean).length;

    if (passed === 0) return { strength: "none", color: "gray" };
    if (passed <= 2) return { strength: "weak", color: "red" };
    if (passed === 3) return { strength: "medium", color: "yellow" };
    return { strength: "strong", color: "green" };
  };

  async function handleRequest() {
    // Stricter email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await requestPasswordReset(email);
      if (res?.success) {
        toast.success("Verification code sent to your email.");
        setStep("otp");
      } else {
        toast.error(res?.message || "Failed to send code.");
      }
    } catch (error) {
      logAuthError(error, "forgot-password-request-failed");
      toast.error("Failed to send code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!otp || otp.trim().length < 4) {
      toast.error("Enter the code sent to your email.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await verifyPasswordReset(email, otp.trim());
      if (res?.success) {
        toast.success("Code verified.");
        setStep("password");
      } else {
        toast.error(res?.message || "Invalid code.");
        // If max attempts exceeded or OTP expired, restart the flow
        if (res?.restartFlow) {
          setOtp("");
          setStep("email");
        }
      }
    } catch (error) {
      logAuthError(error, "forgot-password-verify-failed");
      toast.error("Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    const { hasMinLength, hasUppercase, hasLowercase, hasNumber } =
      validatePassword(password);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      toast.error(
        "Password must be at least 8 characters and include uppercase, lowercase, and numbers",
      );
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await completePasswordReset(email, otp.trim(), password);
      if (res?.success) {
        toast.success("Password updated. Please log in.");
        navigate({ to: "/" });
      } else {
        toast.error(res?.message || "Failed to update password.");
        // If max attempts exceeded or OTP expired, restart the flow
        if (res?.restartFlow) {
          setOtp("");
          setPassword("");
          setConfirm("");
          setStep("email");
        }
      }
    } catch (error) {
      logAuthError(error, "forgot-password-complete-failed");
      toast.error("Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  // Step indicator data
  const steps = [
    { id: "email", label: "Email", number: 1 },
    { id: "otp", label: "Verify", number: 2 },
    { id: "password", label: "Reset", number: 3 },
  ];

  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex((s) => s.id === step);
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  // Step content animation variants
  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: { duration: 0.2, ease: "easeIn" },
    },
  };

  return (
    <AuthLayout
      headline={
        <>
          Reset Your <span className="text-brand-400">Password</span>
        </>
      }
      subheadline="Don't worry, it happens to the best of us. We'll help you get back into your account in no time."
      features={
        <div className="flex items-center gap-4 pt-4">
          <div className="w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center">
            <i className="bx bx-shield-quarter text-brand-400 text-2xl"></i>
          </div>
          <div>
            <p className="text-gray-300 font-medium">Secure Process</p>
            <p className="text-gray-500 text-sm">
              Your account security is our priority
            </p>
          </div>
        </div>
      }
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, index) => {
          const status = getStepStatus(s.id);
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    status === "completed"
                      ? "bg-brand-500 text-gray-900"
                      : status === "current"
                        ? "bg-brand-500 text-gray-900 ring-4 ring-brand-100"
                        : "bg-gray-200 text-gray-500"
                  }`}
                  initial={false}
                  whileHover={{ scale: 1.05 }}
                >
                  {status === "completed" ? (
                    <motion.i
                      className="bx bx-check text-lg"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    />
                  ) : (
                    s.number
                  )}
                </motion.div>
                <span
                  className={`text-xs mt-1 ${
                    status === "current"
                      ? "text-gray-900 font-medium"
                      : "text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <motion.div
                  className="w-12 h-0.5 mx-2 mb-5 bg-gray-200"
                  initial={false}
                  animate={{
                    backgroundColor:
                      getStepStatus(steps[index + 1].id) !== "upcoming"
                        ? "rgb(234 179 8)"
                        : "rgb(229 231 235)",
                  }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Email Step */}
        {step === "email" && (
          <motion.div
            key="email"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AnimatedFormContent>
              <AnimatedFormItem className="text-center mb-6">
                <motion.div
                  className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <i className="bx bx-lock-open-alt text-brand-600 text-3xl"></i>
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Forgot password?
                </h2>
                <p className="text-gray-500 mt-2">
                  Enter your email and we'll send you a verification code
                </p>
              </AnimatedFormItem>

              <div className="space-y-4">
                <AnimatedFormItem className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                  />
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    type="button"
                    onClick={handleRequest}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Sending...
                      </span>
                    ) : (
                      "Send Code"
                    )}
                  </motion.button>
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <Link
                    to="/"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    <i className="bx bx-arrow-back"></i>
                    Back to Sign In
                  </Link>
                </AnimatedFormItem>
              </div>
            </AnimatedFormContent>
          </motion.div>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <motion.div
            key="otp"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AnimatedFormContent>
              <AnimatedFormItem className="text-center mb-6">
                <motion.div
                  className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <i className="bx bx-envelope text-brand-600 text-3xl"></i>
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Verify code
                </h2>
                <p className="text-gray-500 mt-2">
                  Enter the code sent to{" "}
                  <span className="font-medium text-gray-900">{email}</span>
                </p>
              </AnimatedFormItem>

              <div className="space-y-4">
                <AnimatedFormItem className="space-y-1.5">
                  <label
                    htmlFor="otp"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter code"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow text-center text-xl tracking-widest font-mono"
                  />
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    type="button"
                    onClick={handleVerify}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Verifying...
                      </span>
                    ) : (
                      "Verify"
                    )}
                  </motion.button>
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    type="button"
                    onClick={handleRequest}
                    disabled={submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    Resend Code
                  </motion.button>
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="w-full px-4 py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                  >
                    ← Change email
                  </button>
                </AnimatedFormItem>
              </div>
            </AnimatedFormContent>
          </motion.div>
        )}

        {/* Password Step */}
        {step === "password" && (
          <motion.div
            key="password"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AnimatedFormContent>
              <AnimatedFormItem className="text-center mb-6">
                <motion.div
                  className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <i className="bx bx-lock-alt text-brand-600 text-3xl"></i>
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Set new password
                </h2>
                <p className="text-gray-500 mt-2">
                  Create a strong password for your account
                </p>
              </AnimatedFormItem>

              <div className="space-y-4">
                <AnimatedFormItem className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <i
                        className={`bx ${showPassword ? "bx-hide" : "bx-show"} text-xl`}
                      ></i>
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-2">
                      {/* Password strength indicator */}
                      <div>
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map((i) => {
                            const { strength } = getPasswordStrength(password);
                            const levels = {
                              none: 0,
                              weak: 1,
                              medium: 2,
                              strong: 4,
                            };
                            const currentLevel =
                              levels[strength as keyof typeof levels];
                            const isActive = i <= currentLevel;
                            return (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${
                                  isActive
                                    ? strength === "weak"
                                      ? "bg-red-500"
                                      : strength === "medium"
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                    : "bg-gray-200"
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      {/* Password requirements */}
                      <div className="text-xs space-y-1">
                        {(() => {
                          const checks = validatePassword(password);
                          return (
                            <>
                              <div
                                className={`flex items-center gap-1 ${checks.hasMinLength ? "text-green-600" : "text-gray-500"}`}
                              >
                                <i
                                  className={`bx ${checks.hasMinLength ? "bx-check-circle" : "bx-circle"} text-sm`}
                                />
                                At least 8 characters
                              </div>
                              <div
                                className={`flex items-center gap-1 ${checks.hasUppercase ? "text-green-600" : "text-gray-500"}`}
                              >
                                <i
                                  className={`bx ${checks.hasUppercase ? "bx-check-circle" : "bx-circle"} text-sm`}
                                />
                                One uppercase letter
                              </div>
                              <div
                                className={`flex items-center gap-1 ${checks.hasLowercase ? "text-green-600" : "text-gray-500"}`}
                              >
                                <i
                                  className={`bx ${checks.hasLowercase ? "bx-check-circle" : "bx-circle"} text-sm`}
                                />
                                One lowercase letter
                              </div>
                              <div
                                className={`flex items-center gap-1 ${checks.hasNumber ? "text-green-600" : "text-gray-500"}`}
                              >
                                <i
                                  className={`bx ${checks.hasNumber ? "bx-check-circle" : "bx-circle"} text-sm`}
                                />
                                One number
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </AnimatedFormItem>

                <AnimatedFormItem className="space-y-1.5">
                  <label
                    htmlFor="confirm"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <i
                        className={`bx ${showConfirmPassword ? "bx-hide" : "bx-show"} text-xl`}
                      ></i>
                    </button>
                  </div>
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    type="button"
                    onClick={handleComplete}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Saving...
                      </span>
                    ) : (
                      "Save Password"
                    )}
                  </motion.button>
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <button
                    type="button"
                    onClick={() => setStep("otp")}
                    className="w-full px-4 py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                  >
                    ← Back
                  </button>
                </AnimatedFormItem>
              </div>
            </AnimatedFormContent>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
