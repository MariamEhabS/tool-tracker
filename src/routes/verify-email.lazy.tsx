import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  verifyEmailToken,
  completeInvitedSignup,
} from "../api/endpoints/authentication";
import toast from "react-hot-toast";
import { asString } from "@/lib/coerce";
import { logAuthError } from "@/utils/rollbar";
import AuthLayout, {
  AnimatedFormContent,
  AnimatedFormItem,
} from "@/components/layout/AuthLayout";
import { motion } from "framer-motion";

export const Route = createLazyFileRoute("/verify-email")({
  component: RouteComponent,
});

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

function RouteComponent() {
  // Extract token from URL path
  const pathParts = window.location.pathname.split("/");
  const token = pathParts[pathParts.length - 1];
  const navigate = useNavigate();

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [userData, setUserData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [companyData, setCompanyData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const verifyToken = async () => {
    try {
      const response = await verifyEmailToken(token);

      if (response.success) {
        setIsValid(true);
        setUserData(response.user);
        setCompanyData(response.company);
        setFirstName(response.user.firstName || "");
        setLastName(response.user.lastName || "");
      } else {
        setIsValid(false);
        if (response.alreadyVerified) {
          toast.error(response.message);
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        } else {
          toast.error(response.message);
        }
      }
    } catch (error) {
      logAuthError(error, "token-verification-failed");
      if (import.meta.env.DEV) {
        console.error("Token verification error:", error);
      }
      setIsValid(false);
      toast.error("Failed to verify invitation link");
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    const { hasMinLength, hasUppercase, hasLowercase, hasNumber } =
      validatePassword(password);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      toast.error(
        "Password must be at least 8 characters and include uppercase, lowercase, and numbers",
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await completeInvitedSignup(
        token,
        password,
        firstName,
        lastName,
      );

      if (response.success) {
        toast.success(response.message);

        // Store access token (refresh token is handled via HttpOnly cookie)
        localStorage.setItem("accessToken", response.accessToken);

        // Normalize user data: include accessToken in user object for auth checks
        // This matches the pattern used in the login flow (index.lazy.tsx)
        const userData = {
          ...response.user,
          _id: response.user._id || response.user.id,
          accessToken: response.accessToken,
        };
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("company", JSON.stringify(response.company));

        setTimeout(() => {
          navigate({ to: "/" });
        }, 1000);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      logAuthError(error, "signup-completion-failed");
      if (import.meta.env.DEV) {
        console.error("Signup completion error:", error);
      }
      toast.error("Failed to complete account setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isVerifying) {
    return (
      <AuthLayout
        headline={
          <>
            Welcome to <span className="text-brand-400">Taliho</span>
          </>
        }
        subheadline="Verifying your invitation..."
      >
        <div className="text-center py-12">
          <motion.div
            className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <i className="bx bx-loader-alt text-brand-600 text-3xl"></i>
          </motion.div>
          <p className="text-gray-500">Verifying your invitation...</p>
        </div>
      </AuthLayout>
    );
  }

  // Invalid token state
  if (!isValid) {
    return (
      <AuthLayout
        headline={
          <>
            Oops! <span className="text-brand-400">Something went wrong</span>
          </>
        }
        subheadline="Your invitation link may have expired or is invalid."
      >
        <AnimatedFormContent>
          <AnimatedFormItem className="text-center">
            <motion.div
              className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <i className="bx bx-error text-red-600 text-3xl"></i>
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-500 mb-6">
              This invitation link is invalid or has expired. Please contact
              your administrator for a new invitation.
            </p>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link
                to="/"
                className="inline-block w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 transition-all text-center shadow-lg shadow-brand-500/25"
              >
                Go to Login
              </Link>
            </motion.div>
          </AnimatedFormItem>
        </AnimatedFormContent>
      </AuthLayout>
    );
  }

  // Valid token - show account completion form
  return (
    <AuthLayout
      headline={
        <>
          Complete Your <span className="text-brand-400">Account</span>
        </>
      }
      subheadline={`You've been invited to join ${asString(companyData?.companyName, "your team")} on Taliho.`}
      features={
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">Secure account setup</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">Instant team access</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">QR code management</span>
          </div>
        </div>
      }
    >
      <AnimatedFormContent>
        <AnimatedFormItem className="text-center mb-6">
          <motion.div
            className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <i className="bx bx-user-plus text-brand-600 text-3xl"></i>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900">
            Set up your account
          </h2>
          <p className="text-gray-500 mt-2">
            Complete your profile to get started
          </p>
        </AnimatedFormItem>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only) */}
          <AnimatedFormItem className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={asString(userData?.email, "")}
              readOnly
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </AnimatedFormItem>

          {/* First Name & Last Name (side by side) */}
          <AnimatedFormItem className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700"
              >
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700"
              >
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                placeholder="Doe"
                required
              />
            </div>
          </AnimatedFormItem>

          {/* Password with strength indicator */}
          <AnimatedFormItem className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                placeholder="••••••••"
                required
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
            {/* Password strength indicator */}
            {password && (
              <div className="mt-2 space-y-2">
                {/* Strength bars */}
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => {
                    const { strength } = getPasswordStrength(password);
                    const levels: Record<string, number> = {
                      none: 0,
                      weak: 1,
                      medium: 2,
                      strong: 4,
                    };
                    const currentLevel = levels[strength];
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
                {/* Password requirements */}
                <div className="grid grid-cols-2 gap-x-1 text-xs space-y-1">
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

          {/* Confirm Password */}
          <AnimatedFormItem className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (
                    e.target.value &&
                    password &&
                    e.target.value !== password
                  ) {
                    setPasswordError("Passwords do not match");
                  } else {
                    setPasswordError("");
                  }
                }}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i
                  className={`bx ${showConfirmPassword ? "bx-hide" : "bx-show"} text-xl`}
                ></i>
              </button>
            </div>
            {passwordError && confirmPassword && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <i className="bx bx-error-circle" />
                {passwordError}
              </p>
            )}
          </AnimatedFormItem>

          {/* Submit Button */}
          <AnimatedFormItem>
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="bx bx-loader-alt bx-spin"></i>
                  Setting up account...
                </span>
              ) : (
                "Complete Setup"
              )}
            </motion.button>
          </AnimatedFormItem>
        </form>

        <AnimatedFormItem className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/"
            className="text-brand-600 hover:text-brand-700 font-semibold"
          >
            Sign in
          </Link>
        </AnimatedFormItem>
      </AnimatedFormContent>
    </AuthLayout>
  );
}
