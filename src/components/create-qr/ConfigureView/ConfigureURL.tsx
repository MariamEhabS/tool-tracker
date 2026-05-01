import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Button from "@/components/ui/Button";

/**
 * URL Configure form (scaffold). Validates the URL format + name locally;
 * submission is stubbed with a toast because the backend does not yet
 * accept `subtype: "url"`. Full wiring lands in a follow-up PRD.
 */
export default function ConfigureURL() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const urlValid = useMemo(() => {
    const trimmed = url.trim();
    if (trimmed.length < 8) return false;
    return (
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
    );
  }, [url]);

  const nameValid = useMemo(() => name.trim().length >= 1, [name]);
  const canSubmit = urlValid && nameValid;

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    toast.error("URL creation is coming soon — backend pending.");
  };

  const showUrlError = touched && !urlValid;
  const showNameError = touched && !nameValid;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          Configure URL
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Point this QR code to any URL. Scanning opens it in the phone's
          browser.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          data-testid="url-url-input"
          className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 ${
            showUrlError
              ? "border-red-400 focus:border-red-400 focus:ring-red-400"
              : "border-gray-300"
          }`}
        />
        <p
          className="mt-1 text-xs text-gray-500"
          data-testid="url-url-helper"
        >
          Include the https:// prefix.
        </p>
        {showUrlError && (
          <p className="mt-1 text-xs text-red-600" data-testid="url-url-error">
            Enter a valid URL starting with http:// or https://.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Vendor Portal"
          data-testid="url-name-input"
          className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 ${
            showNameError
              ? "border-red-400 focus:border-red-400 focus:ring-red-400"
              : "border-gray-300"
          }`}
        />
        {showNameError && (
          <p className="mt-1 text-xs text-red-600" data-testid="url-name-error">
            Name is required.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 justify-end pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleSubmit}
          data-testid="url-create-add-another"
        >
          Create &amp; Add Another
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          data-testid="url-create-populate"
        >
          Create &amp; Populate
        </Button>
      </div>
    </div>
  );
}
