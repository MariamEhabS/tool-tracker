import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { parse } from "dotenv";

export type E2EEnvMode = "test" | "development" | "prod-test";

type E2EEnv = {
  mode: E2EEnvMode;
  values: Readonly<Record<string, string>>;
};

type E2EStripeProductIds = {
  EARLY_ADOPTER: string;
  STANDARD: string;
  PROFESSIONAL: string;
  BUSINESS: string;
};

const FALLBACK_STRIPE_PRODUCT_IDS: Readonly<E2EStripeProductIds> = {
  EARLY_ADOPTER: "prod_N8k8D4cqD4mhAt",
  STANDARD: "prod_OMka4xzspBwa4a",
  PROFESSIONAL: "prod_OMkaQhTez9rNLY",
  BUSINESS: "prod_OMkaez51iHlPLI",
};

const VALID_MODES = new Set<E2EEnvMode>(["test", "development", "prod-test"]);
const BASE_ENV_FILES = [".env", ".env.local"] as const;

let cachedEnv: E2EEnv | null = null;
let cachedStripeIds: Readonly<E2EStripeProductIds> | null = null;
let hasWarnedMissingStripeIds = false;

const FRONTEND_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const trim = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const resolveMode = (): E2EEnvMode => {
  const configured = trim(process.env.PLAYWRIGHT_ENV_MODE);
  if (!configured) return "test";
  return VALID_MODES.has(configured as E2EEnvMode)
    ? (configured as E2EEnvMode)
    : "test";
};

const resolveEnvFiles = (mode: E2EEnvMode): readonly string[] => {
  const files: string[] = [...BASE_ENV_FILES];

  if (mode === "test") {
    files.push(".env.test", ".env.test.local");
    return files;
  }

  if (mode === "prod-test") {
    files.push(
      ".env.prod",
      ".env.prod.local",
      ".env.production",
      ".env.production.local",
    );
    return files;
  }

  files.push(
    ".env.dev",
    ".env.dev.local",
    ".env.development",
    ".env.development.local",
  );
  return files;
};

const readEnvFiles = (files: readonly string[]): Record<string, string> => {
  const merged: Record<string, string> = {};

  for (const file of files) {
    const fullPath = join(FRONTEND_ROOT, file);
    if (!existsSync(fullPath)) continue;
    Object.assign(merged, parse(readFileSync(fullPath, "utf8")));
  }

  return merged;
};

export const getE2EEnv = (): E2EEnv => {
  if (cachedEnv) return cachedEnv;

  const mode = resolveMode();
  const values = readEnvFiles(resolveEnvFiles(mode));

  cachedEnv = { mode, values };
  return cachedEnv;
};

export const getE2EStripeProductIds = (): Readonly<E2EStripeProductIds> => {
  if (cachedStripeIds) return cachedStripeIds;

  const { values, mode } = getE2EEnv();

  const mapped: E2EStripeProductIds = {
    EARLY_ADOPTER:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER) ||
      FALLBACK_STRIPE_PRODUCT_IDS.EARLY_ADOPTER,
    STANDARD:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_STANDARD) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_STANDARD) ||
      FALLBACK_STRIPE_PRODUCT_IDS.STANDARD,
    PROFESSIONAL:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_PROFESSIONAL) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_PROFESSIONAL) ||
      FALLBACK_STRIPE_PRODUCT_IDS.PROFESSIONAL,
    BUSINESS:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_BUSINESS) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_BUSINESS) ||
      FALLBACK_STRIPE_PRODUCT_IDS.BUSINESS,
  };

  const missingKeys = Object.entries({
    VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER),
    VITE_STRIPE_PRODUCT_ID_STANDARD:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_STANDARD) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_STANDARD),
    VITE_STRIPE_PRODUCT_ID_PROFESSIONAL:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_PROFESSIONAL) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_PROFESSIONAL),
    VITE_STRIPE_PRODUCT_ID_BUSINESS:
      trim(process.env.VITE_STRIPE_PRODUCT_ID_BUSINESS) ||
      trim(values.VITE_STRIPE_PRODUCT_ID_BUSINESS),
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0 && !hasWarnedMissingStripeIds) {
    hasWarnedMissingStripeIds = true;
    console.warn(
      `[e2e-env] Missing Stripe product IDs (${missingKeys.join(", ")}) in mode "${mode}". Using fallback IDs for missing values.`,
    );
  }

  cachedStripeIds = mapped;
  return cachedStripeIds;
};
