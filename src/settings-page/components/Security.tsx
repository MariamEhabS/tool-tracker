import { useState } from "react";
import { logAuthError } from "@/utils/rollbar";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import { EmailChangeWithOTP } from "./Security/EmailChangeWithOTP";
import { PasswordChangeWithOTP } from "./Security/PasswordChangeWithOTP";

// Animation duration for form transitions (respects prefers-reduced-motion via CSS)
const ANIMATION_DURATION = 0.25;

interface SecurityProps {
  userId: string;
  companyId: string;
  currentEmail: string;
  onEmailUpdate?: (newEmail: string) => void;
}

export function Security({
  userId,
  companyId,
  currentEmail,
  onEmailUpdate,
}: SecurityProps) {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  const handlePasswordChangeSuccess = () => {
    setIsEditingPassword(false);
  };

  const handleEmailChangeSuccess = (newEmail: string) => {
    // Update the user data in localStorage or trigger a refetch
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        user.email = newEmail;
        localStorage.setItem("user", JSON.stringify(user));
      } catch (e) {
        logAuthError(e, "security-settings-email-update", { userId });
      }
    }
    // Notify parent to update state for immediate UI refresh
    onEmailUpdate?.(newEmail);
    setIsEditingEmail(false);
  };

  return (
    <div className="space-y-6">
      {/* Password Change Section */}
      <div>
        <AnimatePresence mode="wait" initial={false}>
          {!isEditingPassword ? (
            <motion.div
              key="password-display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION_DURATION }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-gray-600">
                  Keep your account secure with a strong password.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditingPassword(true)}
                leftIconClass="bx bx-lock-alt"
                className="transition-all duration-200 hover:shadow-md"
              >
                Change Password
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="password-edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION_DURATION }}
            >
              <PasswordChangeWithOTP
                userEmail={currentEmail}
                onSuccess={handlePasswordChangeSuccess}
                onCancel={() => setIsEditingPassword(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Email Change Section */}
      <div>
        <AnimatePresence mode="wait" initial={false}>
          {!isEditingEmail ? (
            <motion.div
              key="email-display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION_DURATION }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-gray-600">
                  Update the email address associated with your account.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditingEmail(true)}
                leftIconClass="bx bx-envelope"
                className="transition-all duration-200 hover:shadow-md"
              >
                Change Email
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="email-edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION_DURATION }}
            >
              <EmailChangeWithOTP
                userId={userId}
                companyId={companyId}
                currentEmail={currentEmail}
                onSuccess={handleEmailChangeSuccess}
                onCancel={() => setIsEditingEmail(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Security;
