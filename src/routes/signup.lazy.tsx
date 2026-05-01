import { createLazyFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  completeSignUp,
  procoreOauthSuccess,
  resendOtp,
  signUp,
} from "../api/endpoints/authentication";
import { verifyOtp } from "../api/endpoints/authentication";
import toast from "react-hot-toast";
import { logAuthError, logProcoreError } from "@/utils/rollbar";
import AuthLayout, {
  AnimatedFormContent,
  AnimatedFormItem,
} from "@/components/layout/AuthLayout";
import { motion, AnimatePresence } from "framer-motion";
import { setFirstName as setFirstNameAction } from "../store/slices/userSlice";
import { setCompanyName } from "../store/slices/userSlice";
import { setAuthenticated } from "../store/slices/appSlice";
import {
  parseSubscriptionIntent,
  toSubscriptionSearch,
} from "@/lib/subscriptionIntent";
import { initialize } from "@procore/procore-iframe-helpers";

// Safely initialize Procore iframe helpers - may fail outside Procore iframe context
let procoreContext: ReturnType<typeof initialize> | null = null;
try {
  procoreContext = initialize();
} catch (_e) {
  if (import.meta.env.DEV) {
    console.warn(
      "[Procore] Iframe helpers not available, will use popup fallback",
    );
  }
}

function isInProcoreIframeContext(): boolean {
  try {
    const isInIframe = window.top !== window;

    if (!isInIframe) {
      return false;
    }

    return procoreContext?.authentication?.authenticate !== undefined;
  } catch {
    return true;
  }
}

export const Route = createLazyFileRoute("/signup")({
  component: RouteComponent,
});

function RouteComponent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState("registration");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcoreLoading, setIsProcoreLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirmpPssword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [nfcId, setNfcId] = useState<string | undefined>(undefined);
  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const subscriptionIntent = useMemo(
    () => parseSubscriptionIntent(window.location.search),
    [],
  );
  const subscriptionSearch = subscriptionIntent
    ? toSubscriptionSearch(subscriptionIntent)
    : undefined;

  const handleProcoreOAuthSuccess = useCallback(
    async (userId: string) => {
      try {
        const userData = await procoreOauthSuccess(userId);
        if (userData?.accessToken) {
          localStorage.setItem("accessToken", userData.accessToken);
          localStorage.removeItem("token");
          localStorage.removeItem("settings-expanded-sections");
          localStorage.removeItem("settings-last-visit");

          dispatch(setFirstNameAction(userData.firstName));
          dispatch(setCompanyName(userData.company));
          dispatch(setAuthenticated(true));

          const normalizedUserData = {
            ...userData,
            _id: userData.userId || userData._id,
            companyId: userData.companyId || userData.company,
          };
          localStorage.setItem("user", JSON.stringify(normalizedUserData));

          if (subscriptionSearch) {
            router.navigate({ to: "/logged", search: subscriptionSearch });
          } else {
            router.navigate({ to: "/dashboard" });
          }
        } else {
          toast.error("Signup failed. Please try again.");
          setIsProcoreLoading(false);
        }
      } catch (error) {
        logProcoreError(error, "procore-oauth-signup-success-failed");
        toast.error("Failed to complete Procore signup. Please try again.");
        setIsProcoreLoading(false);
      }
    },
    [dispatch, router, subscriptionSearch],
  );

  const handleProcoreOAuthFailure = useCallback(
    (error?: unknown) => {
      if (import.meta.env.DEV) {
        console.error("[Procore OAuth] Signup failed:", error);
      }
      logProcoreError(error || new Error("unknown"), "procore-oauth-failed");
      toast.error(
        "Unable to sign up with Procore. Please try again or use email signup.",
      );
      dispatch(setAuthenticated(false));
      setIsProcoreLoading(false);
    },
    [dispatch],
  );

  const openOAuthPopup = useCallback(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const origin = encodeURIComponent(window.location.origin);
    const oauthUrl = `${backendUrl}/oauth/procore/login?origin=${origin}`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }

    const popup = window.open(
      oauthUrl,
      "procoreOAuth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    if (!popup || popup.closed) {
      toast.error(
        "Please allow popups to sign up with Procore, then try again.",
      );
      setIsProcoreLoading(false);
      return;
    }

    popupRef.current = popup;

    pollIntervalRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsProcoreLoading(false);
      }
    }, 500);
  }, []);

  const procoreSignupCallback = useCallback(() => {
    if (isProcoreLoading) return;
    setIsProcoreLoading(true);

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const origin = encodeURIComponent(window.location.origin);
    const oauthUrl = `${backendUrl}/oauth/procore/login?origin=${origin}`;
    const shouldUseProcoreHelpers = isInProcoreIframeContext();

    if (
      shouldUseProcoreHelpers &&
      procoreContext?.authentication?.authenticate
    ) {
      try {
        if (import.meta.env.DEV) {
          console.log(
            "[Procore OAuth] Using iframe helpers (in Procore context)",
          );
        }
        procoreContext.authentication.authenticate({
          url: oauthUrl,
          onSuccess: async ({ userId }: { userId: string }) => {
            await handleProcoreOAuthSuccess(userId);
          },
          onFailure: (error?: unknown) => {
            handleProcoreOAuthFailure(error);
          },
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(
            "[Procore OAuth] Iframe helpers failed, using popup fallback:",
            error,
          );
        }
        openOAuthPopup();
      }
    } else {
      if (import.meta.env.DEV) {
        console.log("[Procore OAuth] Using popup flow (standalone browser)");
      }
      openOAuthPopup();
    }
  }, [
    handleProcoreOAuthFailure,
    handleProcoreOAuthSuccess,
    isProcoreLoading,
    openOAuthPopup,
  ]);

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");
    const firstName = urlParams.get("firstName");
    const lastName = urlParams.get("lastName");
    const company = urlParams.get("company");
    const error = urlParams.get("error");
    const step = urlParams.get("step");
    const nfcIdParam = urlParams.get("nfcId");

    if (email && firstName && lastName && company) {
      setUserEmail(email);
      setFirstName(firstName);
      setLastName(lastName);
      setCompany(company);
    }

    if (nfcIdParam) {
      setNfcId(nfcIdParam);
    }

    if (step) {
      setCurrentStep(step);
    }

    if (error) {
      toast.error(error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "PROCORE_OAUTH_SUCCESS" && event.data?.userId) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        await handleProcoreOAuthSuccess(event.data.userId);
      } else if (event.data?.type === "PROCORE_OAUTH_FAILURE") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        handleProcoreOAuthFailure(event.data?.error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleProcoreOAuthFailure, handleProcoreOAuthSuccess]);

  const handleRegistrationSubmit = async () => {
    setIsLoading(true);
    const userData = {
      email: userEmail,
      firstName: firstName,
      lastName: lastName,
      company: company,
    };

    try {
      const response = await signUp(
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.company,
        nfcId,
      );
      if (response?.data.success) {
        toast.success(response?.data.message);
        setCurrentStep("otp");
      } else {
        toast.error(response?.data.message);
        setCurrentStep("registration");
      }
    } catch (error) {
      logAuthError(error, "signup-registration-failed");
      if (import.meta.env.DEV) {
        console.error("Registration error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await verifyOtp(userEmail, otpCode);
      if (response?.data.success && response?.data.user?.accessToken) {
        localStorage.setItem("accessToken", response.data.user.accessToken);
        localStorage.removeItem("token"); // Clear stale V2 key

        // Store user with proper company name (use response company name or the one from signup form)
        const companyName =
          response?.data.company?.name ||
          response?.data.company?.companyName ||
          company;
        // Normalize user data: map id to _id for frontend consistency
        const userData = {
          ...response.data.user,
          _id: response.data.user.id || response.data.user._id,
          companyId: response.data.user.company, // ObjectId for API calls
          company: companyName, // Actual company name
        };
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("company", JSON.stringify(response?.data.company));

        toast.success("OTP verified successfully");
        setCurrentStep("password");
        return response;
      } else {
        toast.error(response?.data.message);
        if (response?.data.restartRegistration) {
          setCurrentStep("registration");
        }
      }
      setOtpCode("");
    } catch (error) {
      logAuthError(error, "signup-otp-verification-failed");
      if (import.meta.env.DEV) {
        console.error("OTP verification error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const response = await resendOtp(userEmail);
      if (response?.data.success) {
        toast.success(response?.data.message);
      } else {
        toast.error(response?.data.message);
        setCurrentStep("registration");
      }
      return response;
    } catch (error) {
      logAuthError(error, "signup-resend-otp-failed");
      if (import.meta.env.DEV) {
        console.error("Failed to resend OTP:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async () => {
    setIsLoading(true);
    try {
      const { hasMinLength, hasUppercase, hasLowercase, hasNumber } =
        validatePassword(password);

      if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
        toast.error(
          "Password must be at least 8 characters and include uppercase, lowercase, and numbers",
        );
        setIsLoading(false);
        return;
      }

      if (password !== confirmpPssword) {
        toast.error("Passwords do not match");
        setIsLoading(false);
        return;
      }
      const response = await completeSignUp(password, userEmail);
      if (response?.data.success && response?.data.user?.accessToken) {
        // Store access token and clear stale V2 key
        localStorage.setItem("accessToken", response.data.user.accessToken);
        localStorage.removeItem("token");

        // Build user object for localStorage (matching login flow structure)
        // Use the company name from the signup form, not the ObjectId from the backend
        // Normalize user data: map id to _id for frontend consistency
        const userData = {
          ...response.data.user,
          _id: response.data.user.id || response.data.user._id,
          companyId: response.data.user.company, // ObjectId for API calls
          company: company, // Use the actual company name entered during signup
        };
        localStorage.setItem("user", JSON.stringify(userData));

        // Set Redux state
        dispatch(setFirstNameAction(response.data.user.firstName || firstName));
        dispatch(setCompanyName(company));
        dispatch(setAuthenticated(true));

        toast.success(response?.data.message);

        if (subscriptionSearch) {
          router.navigate({ to: "/logged", search: subscriptionSearch });
        } else {
          router.navigate({ to: "/dashboard" });
        }
      } else {
        toast.error(response?.data.message);
        setCurrentStep("registration");
      }
    } catch (error) {
      logAuthError(error, "signup-set-password-failed");
      if (import.meta.env.DEV) {
        console.error("Failed to set password:", error);
      }
      toast.error("Failed to create account");
      setCurrentStep("registration");
    } finally {
      setIsLoading(false);
    }
  };

  // Step indicator data
  const steps = [
    { id: "registration", label: "Account", number: 1 },
    { id: "otp", label: "Verify", number: 2 },
    { id: "password", label: "Password", number: 3 },
  ];

  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
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
          Get Started with <span className="text-brand-400">Taliho</span>
        </>
      }
      subheadline="Join thousands of construction professionals who trust Taliho for their QR code management needs."
      features={
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">Free 14-day trial</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">No credit card required</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
              <i className="bx bx-check text-brand-400 text-lg"></i>
            </div>
            <span className="text-gray-300">Cancel anytime</span>
          </div>
        </div>
      }
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center">
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
                  animate={{
                    scale: status === "current" ? 1 : 1,
                  }}
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
                    step.number
                  )}
                </motion.div>
                <span
                  className={`text-xs mt-1 ${
                    status === "current"
                      ? "text-gray-900 font-medium"
                      : "text-gray-500"
                  }`}
                >
                  {step.label}
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
        {/* Registration Step */}
        {currentStep === "registration" && (
          <motion.div
            key="registration"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AnimatedFormContent>
              <AnimatedFormItem className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Create your account
                </h2>
                <p className="text-gray-500 mt-2">
                  Enter your details to get started
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
                    type="email"
                    name="email"
                    id="email"
                    autoComplete="email"
                    value={userEmail}
                    placeholder="you@example.com"
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    required
                  />
                </AnimatedFormItem>

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
                      name="firstName"
                      id="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      placeholder="John"
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
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
                      name="lastName"
                      id="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      placeholder="Doe"
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                      required
                    />
                  </div>
                </AnimatedFormItem>

                <AnimatedFormItem className="space-y-1.5">
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    id="company"
                    autoComplete="organization"
                    value={company}
                    placeholder="Your Company"
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    required
                  />
                </AnimatedFormItem>
              </div>

              <AnimatedFormItem>
                <motion.button
                  onClick={handleRegistrationSubmit}
                  disabled={isLoading || isProcoreLoading}
                  className="w-full mt-6 px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="bx bx-loader-alt bx-spin"></i>
                      Creating account...
                    </span>
                  ) : (
                    "Continue"
                  )}
                </motion.button>
              </AnimatedFormItem>

              <AnimatedFormItem className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">
                    or continue with
                  </span>
                </div>
              </AnimatedFormItem>

              <AnimatedFormItem>
                <motion.button
                  type="button"
                  onClick={procoreSignupCallback}
                  disabled={isLoading || isProcoreLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={
                    isLoading || isProcoreLoading ? {} : { scale: 1.01 }
                  }
                  whileTap={
                    isLoading || isProcoreLoading ? {} : { scale: 0.99 }
                  }
                >
                  {isProcoreLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="bx bx-loader-alt bx-spin"></i>
                      Connecting to Procore...
                    </span>
                  ) : (
                    <>
                      <img
                        src="/images/procore-icon.png"
                        alt="Procore Logo"
                        className="w-5 h-5"
                      />
                      <span>Sign Up with Procore</span>
                    </>
                  )}
                </motion.button>
              </AnimatedFormItem>

              <AnimatedFormItem className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link
                  to="/"
                  search={subscriptionSearch}
                  className="text-brand-600 hover:text-brand-700 font-semibold"
                >
                  Sign in
                </Link>
              </AnimatedFormItem>
            </AnimatedFormContent>
          </motion.div>
        )}

        {/* OTP Step */}
        {currentStep === "otp" && (
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
                  Verify your email
                </h2>
                <p className="text-gray-500 mt-2">
                  We've sent a verification code to
                </p>
                <p className="text-gray-900 font-medium">{userEmail}</p>
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
                    type="text"
                    name="otp"
                    id="otp"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow text-center text-xl tracking-widest font-mono"
                    required
                  />
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    onClick={handleOtpSubmit}
                    disabled={isLoading || otpCode.length !== 6}
                    className="w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Verifying...
                      </span>
                    ) : (
                      "Verify Code"
                    )}
                  </motion.button>
                </AnimatedFormItem>
              </div>

              <div className="mt-6 space-y-3">
                <AnimatedFormItem className="text-center text-sm text-gray-500">
                  Didn't receive the code?
                </AnimatedFormItem>
                <AnimatedFormItem>
                  <motion.button
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isLoading ? "Sending..." : "Resend Code"}
                  </motion.button>
                </AnimatedFormItem>
                <AnimatedFormItem>
                  <button
                    onClick={() => setCurrentStep("registration")}
                    className="w-full px-4 py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                  >
                    ← Back to Registration
                  </button>
                </AnimatedFormItem>
              </div>
            </AnimatedFormContent>
          </motion.div>
        )}

        {/* Password Step */}
        {currentStep === "password" && (
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
                  Set your password
                </h2>
                <p className="text-gray-500 mt-2">
                  Create a secure password for your account
                </p>
              </AnimatedFormItem>

              <div className="space-y-4">
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
                      name="password"
                      id="password"
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
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
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      id="confirmPassword"
                      placeholder="••••••••"
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
                      required
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
                  {passwordError && confirmpPssword && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <i className="bx bx-error-circle" />
                      {passwordError}
                    </p>
                  )}
                </AnimatedFormItem>

                <AnimatedFormItem>
                  <motion.button
                    onClick={handleSetPassword}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-brand-500 text-gray-900 font-semibold rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="bx bx-loader-alt bx-spin"></i>
                        Creating account...
                      </span>
                    ) : (
                      "Complete Setup"
                    )}
                  </motion.button>
                </AnimatedFormItem>
              </div>
            </AnimatedFormContent>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
