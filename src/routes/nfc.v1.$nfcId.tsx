import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolveNfc } from "../api/endpoints/nfc";
import { MobileInlineError } from "@/components/error";

export const Route = createFileRoute("/nfc/v1/$nfcId")({
  component: NfcResolveComponent,
});

function NfcResolveComponent() {
  const { nfcId } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const response = await resolveNfc(nfcId);

        if (cancelled) return;

        switch (response.type) {
          case "customer":
            navigate({
              to: "/scannedQR",
              search: { qrcodeId: response.qrcodeId },
            });
            break;
          case "marketing":
            if (response.redirectUrl) {
              window.location.href = response.redirectUrl;
            }
            break;
          case "unassigned":
            navigate({
              to: "/signup",
              search: { nfcId: response.nfcId },
            });
            break;
          default:
            setError("NFC tag not found");
        }
      } catch {
        if (!cancelled) {
          setError("NFC tag not found");
        }
      }
    };

    resolve();

    return () => {
      cancelled = true;
    };
  }, [nfcId, navigate]);

  if (error) {
    return (
      <MobileInlineError
        title="NFC Tag Not Found"
        message="This NFC tag could not be resolved. It may not exist or may have been removed."
      />
    );
  }

  // Loading state: branded loading screen
  return (
    <div className="absolute flex flex-col items-center justify-center z-50 top-0 left-0 bg-white w-[100vw] h-[100vh] gap-y-8">
      <img src="../../images/taliho-logo.png" width="75%" alt="Taliho" />
      <p className="text-lg text-gray-500 font-medium">Resolving...</p>
      <div className="relative">
        <div className="loader">
          <div className="loader-inner"></div>
        </div>
      </div>
    </div>
  );
}
