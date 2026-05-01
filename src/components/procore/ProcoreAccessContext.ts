import { createContext, useContext } from "react";
import type { ProcoreAccessStatus } from "@/api/endpoints/company";

// Context for providing access status to children
export interface ProcoreAccessContextValue {
  accessStatus: ProcoreAccessStatus | null;
}

export const ProcoreAccessContext = createContext<ProcoreAccessContextValue>({
  accessStatus: null,
});

export const useProcoreAccess = () => useContext(ProcoreAccessContext);
