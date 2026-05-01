const DEFAULT_FRONTEND_PORT = "5173";
const DEFAULT_BACKEND_URL = "http://localhost:3000";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const trim = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const stripTrailingSlash = (value: string): string => value.replace(/\/$/, "");

export function getFrontendPort(): string {
  return (
    trim(process.env.FRONTEND_PORT) ||
    trim(process.env.PORT) ||
    DEFAULT_FRONTEND_PORT
  );
}

export function getFrontendBaseUrl(): string {
  const explicitBaseUrl =
    trim(process.env.BASE_URL) || trim(process.env.FRONTEND_BASE_URL);

  if (explicitBaseUrl) {
    return stripTrailingSlash(explicitBaseUrl);
  }

  return `http://localhost:${getFrontendPort()}`;
}

export function getBackendUrl(): string {
  return (
    trim(process.env.VITE_BACKEND_URL) ||
    trim(process.env.PLAYWRIGHT_BACKEND_URL) ||
    trim(process.env.BACKEND_URL) ||
    DEFAULT_BACKEND_URL
  );
}

export function getBackendOrigin(): string {
  const backendUrl = getBackendUrl();

  try {
    return new URL(backendUrl).origin;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function isBackendApiRequest(url: string): boolean {
  try {
    return new URL(url).origin === getBackendOrigin();
  } catch {
    return false;
  }
}

export function isBackendRequestUrl(url: string): boolean {
  try {
    const requestUrl = new URL(url);
    const backendUrl = new URL(getBackendOrigin());

    const sameProtocol = requestUrl.protocol === backendUrl.protocol;
    const samePort = requestUrl.port === backendUrl.port;
    const sameHostname =
      requestUrl.hostname === backendUrl.hostname ||
      (LOOPBACK_HOSTS.has(requestUrl.hostname) &&
        LOOPBACK_HOSTS.has(backendUrl.hostname));

    return sameProtocol && samePort && sameHostname;
  } catch {
    return false;
  }
}

export function toFrontendUrl(pathname: string): string {
  const baseUrl = `${getFrontendBaseUrl()}/`;
  return new URL(pathname, baseUrl).toString();
}

export function toBackendRoutePattern(pathname: string): string {
  return `**${new URL(pathname, `${getBackendOrigin()}/`).toString()}**`;
}
