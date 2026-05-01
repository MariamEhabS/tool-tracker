import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  verifyEmailToken,
  completeInvitedSignup,
} from "../api/endpoints/authentication";
import toast from "react-hot-toast";
import { asString } from "@/lib/coerce";
import { logAuthError } from "@/utils/rollbar";

export const Route = createLazyFileRoute("/verify-email/$token")({
  component: RouteComponent,
});

function RouteComponent() {
  // Extract token from URL params
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorType, setErrorType] = useState<
    "expired" | "invalid" | "already-verified" | "general" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");
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
        setErrorMessage(response.message || "Failed to verify invitation link");

        // Distinguish between different error types
        if (response.alreadyVerified) {
          setErrorType("already-verified");
          toast.error("This invitation has already been used.");
          setTimeout(() => {
            window.location.href = "/";
          }, 3000);
        } else if (
          response.message?.toLowerCase().includes("expired") ||
          response.expired
        ) {
          setErrorType("expired");
          toast.error("This invitation link has expired.");
        } else if (
          response.message?.toLowerCase().includes("invalid") ||
          response.invalid
        ) {
          setErrorType("invalid");
          toast.error("This invitation link is invalid.");
        } else {
          setErrorType("general");
          toast.error(response.message || "Failed to verify invitation link");
        }
      }
    } catch (error) {
      logAuthError(error, "token-verification-failed");
      if (import.meta.env.DEV) {
        console.error("Token verification error:", error);
      }
      setIsValid(false);
      setErrorType("general");
      setErrorMessage("Failed to verify invitation link");
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

    // Validation
    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
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

        // Redirect to dashboard
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

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    // Customize error message and actions based on error type
    const getErrorContent = () => {
      switch (errorType) {
        case "already-verified":
          return {
            icon: "bx-check-circle",
            iconColor: "text-blue-600",
            bgColor: "bg-blue-100",
            title: "Already Verified",
            message:
              "This invitation has already been used. You'll be redirected to login shortly.",
            action: null, // Will auto-redirect
          };
        case "expired":
          return {
            icon: "bx-time",
            iconColor: "text-orange-600",
            bgColor: "bg-orange-100",
            title: "Invitation Expired",
            message:
              "This invitation link has expired. Please contact your administrator for a new invitation.",
            action: {
              label: "Contact Administrator",
              href: "/",
            },
          };
        case "invalid":
          return {
            icon: "bx-error",
            iconColor: "text-red-600",
            bgColor: "bg-red-100",
            title: "Invalid Invitation",
            message:
              "This invitation link is not valid. Please check the link or contact your administrator.",
            action: {
              label: "Go to Login",
              href: "/",
            },
          };
        default:
          return {
            icon: "bx-error",
            iconColor: "text-red-600",
            bgColor: "bg-red-100",
            title: "Verification Failed",
            message:
              errorMessage ||
              "Unable to verify invitation. Please try again or contact support.",
            action: {
              label: "Go to Login",
              href: "/",
            },
          };
      }
    };

    const errorContent = getErrorContent();

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div
            className={`w-16 h-16 ${errorContent.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            <i
              className={`bx ${errorContent.icon} text-3xl ${errorContent.iconColor}`}
            ></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorContent.title}
          </h1>
          <p className="text-gray-600 mb-6">{errorContent.message}</p>
          {errorContent.action && (
            <a
              href={errorContent.action.href}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {errorContent.action.label}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="bx bx-check text-3xl text-green-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Your Account
          </h1>
          <p className="text-gray-600">
            You've been invited to join{" "}
            <span className="font-semibold">
              {asString(companyData?.companyName, "")}
            </span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={asString(userData?.email, "")}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            />
          </div>

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your first name"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your last name"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Create a password (min 8 characters)"
              required
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Confirm your password"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <i className="bx bx-loader-alt bx-spin mr-2"></i>
                Setting up account...
              </span>
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
