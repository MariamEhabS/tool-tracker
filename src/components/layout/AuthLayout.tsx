import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

/**
 * Props for the AuthLayout component -- a split-screen layout with an animated branding panel on the left
 * and a form card on the right, used for login, registration, and password reset pages.
 */
interface AuthLayoutProps {
  /** Form content rendered inside the animated card on the right panel */
  children: ReactNode;
  /** Headline with highlighted word rendered in the left branding panel */
  headline: ReactNode;
  /** Subheadline text shown below the headline in the left panel */
  subheadline: string;
  /** Features or highlights to show in the left panel (e.g., a bullet list of product benefits) */
  features?: ReactNode;
}

// Animation variants for the form card
const cardVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Animation variants for the branding content
const brandingVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      staggerChildren: 0.1,
    },
  },
};

const brandingItemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// Animation for the mobile logo
const mobileLogoVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export default function AuthLayout({
  children,
  headline,
  subheadline,
  features,
}: AuthLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        {/* Animated decorative elements */}
        <motion.div
          className="absolute inset-0 opacity-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1 }}
        >
          <motion.div
            className="absolute top-20 left-20 w-72 h-72 bg-brand-500 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              x: [0, 10, 0],
              y: [0, -10, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-20 right-20 w-96 h-96 bg-brand-400 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.05, 1],
              x: [0, -10, 0],
              y: [0, 10, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col justify-between p-12 w-full"
          variants={brandingVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={brandingItemVariants}>
            <Link to="/">
              <motion.img
                src="/images/white-taliho-logo.png"
                alt="Taliho"
                className="h-10 w-auto"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              />
            </Link>
          </motion.div>

          <motion.div className="space-y-6" variants={brandingItemVariants}>
            <AnimatePresence mode="wait">
              <motion.h1
                key={location.pathname + "-headline"}
                className="text-4xl xl:text-5xl font-bold text-white leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {headline}
              </motion.h1>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p
                key={location.pathname + "-subheadline"}
                className="text-lg text-gray-400 max-w-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              >
                {subheadline}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname + "-features"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
              >
                {features}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="text-sm text-gray-500"
            variants={brandingItemVariants}
          >
            © {new Date().getFullYear()} Taliho. All rights reserved.
          </motion.div>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:px-12 sm:py-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <motion.div
            className="lg:hidden mb-8 text-center"
            variants={mobileLogoVariants}
            initial="initial"
            animate="animate"
          >
            <Link to="/">
              <img
                src="/images/taliho-logo.png"
                alt="Taliho"
                className="h-10 w-auto mx-auto"
              />
            </Link>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 sm:p-10 border border-gray-100"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Reusable animated form container for staggered children animations
export function AnimatedFormContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

// Animated form item wrapper
export function AnimatedFormItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
