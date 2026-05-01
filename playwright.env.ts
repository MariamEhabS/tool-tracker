import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "dotenv";

export type PlaywrightEnvMode = "test" | "development" | "prod-test";

const VALID_ENV_MODES: ReadonlySet<string> = new Set([
  "test",
  "development",
  "prod-test",
]);

const BASE_ENV_FILES = [".env", ".env.local"] as const;

const resolveEnvFiles = (mode: PlaywrightEnvMode): string[] => {
  const envFiles: string[] = [...BASE_ENV_FILES];

  if (mode === "test") {
    envFiles.push(".env.test", ".env.test.local");
  } else if (mode === "prod-test") {
    envFiles.push(
      ".env.prod",
      ".env.prod.local",
      ".env.production",
      ".env.production.local",
    );
  } else {
    envFiles.push(
      ".env.dev",
      ".env.dev.local",
      ".env.development",
      ".env.development.local",
    );
  }

  return envFiles;
};

const readEnvFiles = (
  frontendRoot: string,
  files: readonly string[],
): Record<string, string> => {
  const env: Record<string, string> = {};

  for (const fileName of files) {
    const filePath = join(frontendRoot, fileName);
    if (!existsSync(filePath)) continue;

    const parsed = parse(readFileSync(filePath, "utf8"));
    Object.assign(env, parsed);
  }

  return env;
};

const readModeEnv = (
  frontendRoot: string,
  mode: PlaywrightEnvMode,
): Record<string, string> => {
  return readEnvFiles(frontendRoot, resolveEnvFiles(mode));
};

export const resolvePlaywrightServerEnv = (
  frontendRoot: string,
  mode: PlaywrightEnvMode,
) => {
  const baseEnv = readEnvFiles(frontendRoot, BASE_ENV_FILES);
  const modeEnv = readModeEnv(frontendRoot, mode);
  const configuredPort = baseEnv.PORT?.trim() || modeEnv.PORT?.trim();
  const configuredBackendUrl =
    baseEnv.VITE_BACKEND_URL?.trim() || modeEnv.VITE_BACKEND_URL?.trim();

  // Prefer frontend env files so backend shell PORT values do not hijack frontend E2E.
  const port =
    process.env.FRONTEND_PORT?.trim() ||
    process.env.PLAYWRIGHT_PORT?.trim() ||
    configuredPort ||
    process.env.PORT?.trim() ||
    "5173";

  const baseURL =
    process.env.BASE_URL?.trim() ||
    baseEnv.BASE_URL?.trim() ||
    modeEnv.BASE_URL?.trim() ||
    `http://localhost:${port}`;

  const backendURL =
    process.env.VITE_BACKEND_URL?.trim() ||
    process.env.PLAYWRIGHT_BACKEND_URL?.trim() ||
    configuredBackendUrl ||
    "http://localhost:3000";

  return {
    baseURL,
    backendURL,
    port,
  };
};

export const resolvePlaywrightEnvMode = (
  fallbackMode: PlaywrightEnvMode,
): PlaywrightEnvMode => {
  const configuredMode = process.env.PLAYWRIGHT_ENV_MODE?.trim();
  if (!configuredMode) return fallbackMode;

  if (!VALID_ENV_MODES.has(configuredMode)) {
    return fallbackMode;
  }

  return configuredMode as PlaywrightEnvMode;
};
