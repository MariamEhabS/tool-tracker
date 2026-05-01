import { createStaticSession } from "@/api/mockdata/staticData";
import { STATIC_APP_MODE } from "@/lib/staticAppMode";
import { safeLocalStorage } from "@/utils/safeStorage";
import { applyDevAuthBypass } from "./devBypassAuth";

const STATIC_SESSION_VERSION = "1";
const STATIC_MARKER = "__talihoStaticPrototypeSeeded";

export function bootstrapAppSession(): void {
  if (STATIC_APP_MODE) {
    const shouldSeed =
      safeLocalStorage.getItem(STATIC_MARKER) !== STATIC_SESSION_VERSION ||
      !safeLocalStorage.getItem("user") ||
      !safeLocalStorage.getItem("company") ||
      !safeLocalStorage.getItem("accessToken");

    if (!shouldSeed) return;

    const session = createStaticSession();
    safeLocalStorage.setJSON("user", session.user);
    safeLocalStorage.setJSON("company", session.company);
    safeLocalStorage.setItem("accessToken", session.accessToken);
    safeLocalStorage.removeItem("token");
    safeLocalStorage.setItem(STATIC_MARKER, STATIC_SESSION_VERSION);
    return;
  }

  applyDevAuthBypass();
}
