import { useState } from "react";
import type { ToolInput, ToolTrackerRules } from "@/components/create-qr/toolTracker/types";

/**
 * Field-tech scan preview modal (PRD §7).
 *
 * Preview-only — no backend call, no state persistence beyond modal lifetime.
 * Tabs across the top let the PM toggle between the six screens a tech sees
 * across the scan flow: Sign-out (identity capture), Photo (optional photo
 * step), Signed-out / Signed-in confirmations, Already-out (handoffs off),
 * and Offline-queued.
 *
 * The preview is intentionally self-contained — it does NOT import the
 * production scan-flow components. Otherwise the PM-side bundle would
 * pull in the offline queue, the relative-time helper, the §7 mailto
 * helper, and the canvas compression module — none of which the modal
 * actually exercises. We render static slides that visually match the
 * shipped screens.
 *
 * HandoffRequest is intentionally omitted (PRD §2 named four screens to
 * add; the PM is configuring rules, not auditing every state — Stage 7
 * Override A).
 */

type PreviewTab =
  | "signout"
  | "photo"
  | "signedout"
  | "signedin"
  | "alreadyout"
  | "offline";

interface ToolTrackerScanPreviewProps {
  tool: ToolInput;
  rules: ToolTrackerRules;
  onClose: () => void;
}

const TABS: Array<{ key: PreviewTab; label: string }> = [
  { key: "signout", label: "Sign-out" },
  { key: "photo", label: "Photo" },
  { key: "signedout", label: "Signed-out" },
  { key: "signedin", label: "Signed-in" },
  { key: "alreadyout", label: "Already-out" },
  { key: "offline", label: "Offline" },
];

const CAPTIONS: Record<PreviewTab, string> = {
  signout: "First scan. The tech identifies themselves and taps Sign out.",
  photo:
    "Optional. The tech can also tap to add a photo, then continue. Skip advances without one.",
  signedout: "Confirmation after a successful sign-out submission.",
  signedin:
    "Confirmation after sign-in. An overdue pill renders here when the tool came back late.",
  alreadyout:
    "Renders when the tool is already signed out to another tech AND handoffs are off.",
  offline:
    "Renders when the network failed at submit time. The same screen renders for sign-in too with adapted copy.",
};

export default function ToolTrackerScanPreview({
  tool,
  rules,
  onClose,
}: ToolTrackerScanPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("signout");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-preview-title"
      data-testid="scan-preview-modal"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <div
            id="scan-preview-title"
            className="text-xs font-semibold uppercase tracking-wider text-gray-500"
          >
            Field tech view &mdash; on their phone
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close preview"
            data-testid="scan-preview-close"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Scan preview screens"
          className="grid grid-cols-3 border-b border-gray-100 shrink-0"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-2 py-2 text-[11px] font-medium transition border-b-2 ${
                tab === t.key
                  ? "text-brand-700 border-brand-500 bg-brand-50/40"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
              data-testid={`scan-preview-tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 bg-gray-100 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {tab === "signout" && <SignOutScreen tool={tool} rules={rules} />}
            {tab === "photo" && <PhotoScreen />}
            {tab === "signedout" && <SignedOutScreen tool={tool} />}
            {tab === "signedin" && <SignedInScreen tool={tool} />}
            {tab === "alreadyout" && <AlreadyOutScreen tool={tool} />}
            {tab === "offline" && <OfflineScreen tool={tool} />}
          </div>
          <p
            className="text-[11px] text-gray-500 mt-2 leading-snug"
            data-testid="scan-preview-caption"
          >
            {CAPTIONS[tab]}
          </p>
        </div>
      </div>
    </div>
  );
}

function SignOutScreen({
  tool,
  rules,
}: {
  tool: ToolInput;
  rules: ToolTrackerRules;
}) {
  const needsPhone = rules.identification === "name_phone";
  const needsLogin = rules.identification === "login";
  const pinHelper = !rules.pinEnabled
    ? null
    : rules.pinMode === "smart"
      ? "Last 4 of your phone number."
      : "Enter the PIN your project manager set up.";

  return (
    <div data-testid="scan-preview-signout">
      <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
        <div className="font-semibold tracking-tight">Taliho</div>
        <div className="text-xs text-gray-400">Sign out a tool</div>
      </div>
      <div className="p-4">
        <div className="aspect-video bg-gradient-to-br from-brand-100 to-brand-300 rounded-lg flex items-center justify-center mb-3">
          <i className="bx bxs-wrench text-3xl text-brand-800" aria-hidden />
        </div>
        <div className="text-base font-semibold text-gray-900">
          {tool.name || "Tool name"}
        </div>
        {tool.serial && (
          <div className="text-xs text-gray-500 mt-0.5">SN: {tool.serial}</div>
        )}
        {tool.homeLocation && (
          <div className="text-xs text-gray-500 mt-0.5">
            Home: {tool.homeLocation}
          </div>
        )}
        <div className="mt-3 text-xs text-gray-500">
          Not the right tool?{" "}
          <span className="text-brand-700 underline">Tell us</span>
        </div>

        {needsLogin ? (
          <div
            className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700"
            data-testid="scan-preview-login-required"
          >
            You&apos;ll need a Taliho account to sign out this tool. If you
            don&apos;t have one, ask your PM to invite you.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">
                Your name
              </div>
              <input
                disabled
                placeholder="First and last"
                className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white"
                data-testid="scan-preview-name-input"
              />
            </div>
            {needsPhone && (
              <div data-testid="scan-preview-phone-row">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  Your phone number
                </div>
                <input
                  disabled
                  placeholder="(555) 555-0123"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white"
                />
                <div className="text-[10px] text-gray-500 mt-1">
                  We&apos;ll remember this on your phone so you don&apos;t have
                  to type it next time.
                </div>
              </div>
            )}
          </div>
        )}

        {rules.pinEnabled && (
          <div className="mt-2" data-testid="scan-preview-pin-row">
            <div className="text-xs font-medium text-gray-700 mb-1">PIN</div>
            <input
              disabled
              placeholder="4 digits"
              className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white"
            />
            {pinHelper && (
              <div
                className="text-[10px] text-gray-500 mt-1"
                data-testid="scan-preview-pin-helper"
              >
                {pinHelper}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 text-[10px] text-gray-500 flex items-center gap-1.5">
          <i className="bx bx-map text-xs" aria-hidden /> Your location is
          recorded when you tap sign out.
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-4 bg-brand-600 text-white font-semibold rounded-lg py-2.5 text-sm opacity-90"
        >
          Sign this tool out
        </button>
      </div>
    </div>
  );
}

function PhotoScreen() {
  return (
    <div data-testid="scan-preview-photo">
      <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
        <div className="font-semibold tracking-tight">Taliho</div>
        <div className="text-xs text-gray-400">Add a photo (optional)</div>
      </div>
      <div className="p-4">
        <div className="text-base font-semibold text-gray-900">
          Photo of the tool
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Helps document the tool&apos;s condition. You can skip this.
        </p>
        <div
          className="mt-3 aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center"
          data-testid="scan-preview-photo-tile"
        >
          <i className="bx bx-camera text-3xl text-gray-400 mb-1" aria-hidden />
          <div className="text-sm font-medium text-gray-800">Take a photo</div>
          <div className="text-[11px] text-gray-500 mt-0.5">or upload one</div>
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-4 border border-gray-300 text-gray-800 font-semibold rounded-lg py-2.5 text-sm bg-white opacity-90"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

function SignedOutScreen({ tool }: { tool: ToolInput }) {
  return (
    <div data-testid="scan-preview-signedout">
      <div className="px-4 py-3 bg-brand-600 text-white flex items-center gap-2">
        <i className="bx bx-check text-base" aria-hidden />
        <div className="font-semibold">Signed out</div>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-700">
          You have{" "}
          <span className="font-semibold">{tool.name || "this tool"}</span>.
          Scan the same code again when you return it.
        </div>
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-xs text-amber-900">
          <i
            className="bx bx-calendar text-sm text-amber-700 mt-0.5 shrink-0"
            aria-hidden
          />
          <div>
            Due back by <span className="font-semibold">Friday 5:00 PM</span>.
          </div>
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-4 border border-gray-300 text-gray-800 font-medium rounded-lg py-2.5 text-sm opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SignedInScreen({ tool }: { tool: ToolInput }) {
  const home = tool.homeLocation?.trim();
  return (
    <div data-testid="scan-preview-signedin">
      <div className="px-4 py-3 bg-brand-600 text-white flex items-center gap-2">
        <i className="bx bx-check text-base" aria-hidden />
        <div className="font-semibold">Signed in</div>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-700">
          Thanks.{" "}
          <span className="font-semibold">{tool.name || "this tool"}</span> is
          back{home ? ` at ${home}` : ""}.
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-4 border border-gray-300 text-gray-800 font-medium rounded-lg py-2.5 text-sm opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function AlreadyOutScreen({ tool }: { tool: ToolInput }) {
  return (
    <div data-testid="scan-preview-alreadyout">
      <div className="px-4 py-3 bg-amber-500 text-white flex items-center gap-2">
        <i className="bx bx-error-circle text-base" aria-hidden />
        <div className="font-semibold">Already signed out</div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">{tool.name || "This tool"}</span> is
          currently with <span className="font-semibold">Marcus Reyes</span>.
        </div>
        <div className="text-xs text-gray-600">Signed out 2 hours ago.</div>
        <div className="text-xs text-gray-700">
          You can scan this code again once it&apos;s been returned.
        </div>
        <div className="text-xs text-amber-700 underline">
          Need it sooner? Tell us
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-2 border border-gray-300 text-gray-800 font-medium rounded-lg py-2.5 text-sm opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function OfflineScreen({ tool }: { tool: ToolInput }) {
  return (
    <div data-testid="scan-preview-offline">
      <div className="px-4 py-3 bg-amber-500 text-white flex items-start gap-2">
        <i className="bx bx-wifi-off text-base mt-0.5" aria-hidden />
        <div className="font-semibold leading-snug">
          Saved &mdash; will sync when you&apos;re back online
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-sm text-gray-700">
          You signed out{" "}
          <span className="font-semibold">{tool.name || "this tool"}</span>.
        </div>
        <div className="text-xs text-gray-600">
          We&apos;ve saved it on your phone and will send it to Taliho the next
          time you&apos;re back online.
        </div>
        <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-2">
          <strong className="block mb-0.5">What this means:</strong>
          The tool is signed out on your phone right now. No need to scan
          again.
        </div>
        <button
          type="button"
          disabled
          className="w-full mt-2 bg-amber-500 text-white font-semibold rounded-lg py-2.5 text-sm opacity-90"
        >
          OK
        </button>
      </div>
    </div>
  );
}
