/**
 * Create-QR v2 — flat single-page Hard Hat layout.
 *
 * Reachable from the Type-selection screen by clicking the Hard Hat
 * tile. Replaces the wizard + step-tracker with a flat page that
 * mirrors the Business Card / Tool Tracker v2 layouts.
 *
 * Hard Hat is single-only for v1 (per PRD §2 non-goals). There is no
 * Single/Bulk toggle. Procore users see the orange auto-fill banner
 * for identity + contact fields. The credentials and emergency
 * sections are filled in manually.
 *
 * BACKEND TODOS (for the dev integrating this):
 *   1. POST /api/hard-hat-cards
 *        — create a card with payload
 *          { contact, emergency, credentials, tradeTemplate, includeLogo }.
 *          Response: { shortCode, qrImagePngUrl, qrImageSvgUrl }.
 *   2. POST /api/hard-hat-cards/:id/credentials/:credId/upload
 *        — multipart upload of a credential document (PDF, JPG, PNG,
 *          ≤ 10MB). The current mockup only stashes a fake filename in
 *          state — wire this to enqueueFileGroupUploadSmart from
 *          UploadQueueProvider (see qrcode.$qrcodeId.tsx:2033 for the
 *          call pattern). Validate type + size before enqueuing.
 *   3. GET /api/procore/me
 *        — current Procore user's profile (currently mocked as
 *          MOCK_PROCORE_WORKER below).
 *   4. GET /h/:shortCode  (server-rendered HTML)
 *      GET /h/:shortCode.vcf  (vCard 3.0 download)
 *        — public mobile landing page + vCard. The phone-frame
 *          Preview rendered here is the visual contract for that
 *          page. Extract HardHatPhoneCard, getCredentialStatus,
 *          STATUS_STYLES, and deriveCategoryLabel into a shared
 *          module under src/components/hard-hat/ when wiring the
 *          public route so the creator preview and the served page
 *          render from the same source.
 *
 * Submission and file uploads are stubbed with toasts — wire the
 * endpoints above into `handleCreate` and `simulateUpload` once the
 * backend lands.
 */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import { icons } from "@/lib/icons";
import procoreIcon from "@assets/images/procore-icon.png";

interface CreateHardHatV2Props {
  onBackToTypes?: () => void;
}

// ---------------------------------------------------------------------------
// Form shapes
// ---------------------------------------------------------------------------

interface HardHatForm {
  firstName: string;
  lastName: string;
  title: string;
  trade: string;
  company: string;
  mobile: string;
  email: string;
  workPhone: string;
  website: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  medicalNotes: string;
}

interface Credential {
  id: string;
  category: string;
  name: string;
  issuedBy: string;
  issuedDate: string;
  expiresAt: string;
  fileName: string;
}

const EMPTY_FORM: HardHatForm = {
  firstName: "",
  lastName: "",
  title: "",
  trade: "",
  company: "",
  mobile: "",
  email: "",
  workPhone: "",
  website: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

const EMPTY_EMERGENCY: EmergencyContact = {
  name: "",
  relationship: "",
  phone: "",
  medicalNotes: "",
};

// MOCK — replace with response from GET /api/procore/me. Same shape
// expectations as CreateVCardV2's MOCK_PROCORE_USER, with the addition
// of a `trade` field (Hard Hat asks for trade explicitly).
const MOCK_PROCORE_WORKER: HardHatForm = {
  firstName: "Carlos",
  lastName: "Mendez",
  title: "Crane Operator",
  trade: "Heavy Equipment",
  company: "Solid Form Concrete",
  mobile: "+1 (510) 555-0187",
  email: "cmendez@solidform.com",
  workPhone: "",
  website: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

// ---------------------------------------------------------------------------
// Trade templates (PRD §7)
// ---------------------------------------------------------------------------

type TradeTemplateKey =
  | "crane_operator"
  | "electrician"
  | "welder"
  | "general_laborer"
  | "ironworker"
  | "custom";

interface TradeTemplate {
  label: string;
  trade: string;
  categories: string[];
}

const TRADE_TEMPLATES: Record<TradeTemplateKey, TradeTemplate> = {
  crane_operator: {
    label: "Crane Operator",
    trade: "Heavy Equipment",
    categories: [
      "NCCCO Crane Certification",
      "DOT Medical Examiner Certificate",
      "OSHA 30-Hour Construction",
      "Rigging & Signal Person Qualification",
      "Annual Crane Inspection",
    ],
  },
  electrician: {
    label: "Electrician",
    trade: "Electrical",
    categories: [
      "Journeyman / Master License",
      "OSHA 10-Hour or 30-Hour",
      "Arc Flash Safety Training",
      "CPR / First Aid",
    ],
  },
  welder: {
    label: "Welder",
    trade: "Welding",
    categories: [
      "AWS Welding Certification",
      "Welding Procedure Specification (WPS)",
      "OSHA 10-Hour or 30-Hour",
      "Eye Exam Record",
    ],
  },
  general_laborer: {
    label: "General Laborer",
    trade: "General",
    categories: [
      "OSHA 10-Hour Construction",
      "Fall Protection Training",
      "Site Orientation",
      "CPR / First Aid",
    ],
  },
  ironworker: {
    label: "Ironworker",
    trade: "Structural Steel",
    categories: [
      "Ironworker Certification",
      "OSHA 30-Hour Construction",
      "Fall Protection Training",
      "Rigging Qualification",
      "Connector Training",
    ],
  },
  custom: {
    label: "Custom",
    trade: "",
    categories: [],
  },
};

const TRADE_TEMPLATE_ORDER: TradeTemplateKey[] = [
  "crane_operator",
  "electrician",
  "welder",
  "general_laborer",
  "ironworker",
  "custom",
];

// ---------------------------------------------------------------------------
// Credential status logic
//
// TODO(dev): extract getCredentialStatus, STATUS_STYLES, and
// deriveCategoryLabel to src/components/hard-hat/credentialStatus.ts
// when the public /h/:shortCode page lands. The same logic must drive
// both the desktop preview (here) and the server-rendered mobile
// page — duplicating it would let them drift.
// ---------------------------------------------------------------------------

interface CredentialStatusResult {
  status: "valid" | "expiring" | "expired";
  label: string;
  sublabel: string;
}

function getCredentialStatus(expiresAt: string): CredentialStatusResult {
  if (!expiresAt) {
    return { status: "valid", label: "Valid", sublabel: "No expiration" };
  }
  const now = new Date();
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) {
    return { status: "valid", label: "Valid", sublabel: "No expiration" };
  }
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) {
    return {
      status: "expired",
      label: "Expired",
      sublabel: `${Math.abs(daysLeft)} days ago`,
    };
  }
  if (daysLeft <= 30) {
    return {
      status: "expiring",
      label: "Expiring soon",
      sublabel: `${daysLeft} days left`,
    };
  }
  return {
    status: "valid",
    label: "Valid",
    sublabel: `Expires ${formatDate(expiresAt)}`,
  };
}

interface StatusStyle {
  border: string;
  text: string;
  badge: string;
  icon: string;
  bg: string;
}

const STATUS_STYLES: Record<CredentialStatusResult["status"], StatusStyle> = {
  valid: {
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    icon: "bx bxs-check-shield",
    bg: "bg-emerald-50",
  },
  expiring: {
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    icon: "bx bxs-error",
    bg: "bg-amber-50",
  },
  expired: {
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-800",
    icon: "bx bxs-x-circle",
    bg: "bg-rose-50",
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Maps a free-text credential category (e.g. "OSHA 30-Hour Construction")
 * to a display label shown in the phone preview ("Training"). Per PRD
 * §10 / Todd's note 2.
 */
function deriveCategoryLabel(category: string): string {
  const lower = category.toLowerCase();
  if (
    lower.includes("cert") ||
    lower.includes("license") ||
    lower.includes("nccco")
  ) {
    return "Certification";
  }
  if (
    lower.includes("osha") ||
    lower.includes("training") ||
    lower.includes("qualification")
  ) {
    return "Training";
  }
  if (
    lower.includes("medical") ||
    lower.includes("dot") ||
    lower.includes("exam")
  ) {
    return "Medical";
  }
  if (lower.includes("inspection")) {
    return "Inspection";
  }
  return "Document";
}

// Mockup flag — see Procore gating block inside the component below.
const FORCE_PROCORE_FOR_MOCKUP = true;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateHardHatV2({ onBackToTypes }: CreateHardHatV2Props) {
  // ─── Procore gating ──────────────────────────────────────────────────────
  // Production rule (PRD §3): the Procore auto-fill banner is invisible
  // to non-Procore users — no greyed-out, no upsell. Production should
  // gate on `procoreCompanyID > 0` from the company slice:
  //
  //   const company = useSelector((s: RootState) => s.company);
  //   const isProcoreConnected = (company?.procoreCompanyID ?? 0) > 0;
  //
  // For this redesign mockup the company slice isn't reliably hydrated,
  // so we force the banner on via FORCE_PROCORE_FOR_MOCKUP. TODO(dev):
  // swap to the real selector once login wiring lands.
  const isProcoreConnected = FORCE_PROCORE_FOR_MOCKUP;

  // The mocked Procore profile assumes the company has a logo on file.
  // Replace this default with a real value derived from company settings
  // once the logo upload feature is wired (PRD Phase 7 in the Hard Hat
  // PRD; mirrors the same gating from the Business Card flow).
  const companyHasLogo = true;

  return (
    <div className="grow flex flex-col p-8">
      <div className="mb-6">
        {onBackToTypes && (
          <button
            type="button"
            onClick={onBackToTypes}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
            data-testid="v2-back-to-types"
          >
            <i className="bx bx-chevron-left" aria-hidden="true" />
            Back to type
          </button>
        )}
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <i className={`${icons.qr} text-green-600 mr-2`}></i>
          Create Hard Hat QR
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Credentials, emergency info, and contact details — all accessible with a scan.
        </p>
      </div>

      <div className="max-w-3xl w-full mx-auto space-y-5">
        <SinglePanel
          isProcoreConnected={isProcoreConnected}
          companyHasLogo={companyHasLogo}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single panel (the only mode for v1)
// ---------------------------------------------------------------------------

function SinglePanel({
  isProcoreConnected,
  companyHasLogo,
}: {
  isProcoreConnected: boolean;
  companyHasLogo: boolean;
}) {
  const [form, setForm] = useState<HardHatForm>(EMPTY_FORM);
  const [emergency, setEmergency] = useState<EmergencyContact>(EMPTY_EMERGENCY);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TradeTemplateKey | "">("");
  const [showMore, setShowMore] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(companyHasLogo);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const updateField = (key: keyof HardHatForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const updateEmergency = (key: keyof EmergencyContact, value: string) =>
    setEmergency((e) => ({ ...e, [key]: value }));

  const hasName =
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0;
  const hasContact =
    form.mobile.trim().length > 0 || form.email.trim().length > 0;
  const canSubmit = useMemo(
    () => hasName && hasContact,
    [hasName, hasContact],
  );

  const handleProcoreAutofill = () => {
    // TODO(dev): replace MOCK_PROCORE_WORKER with the response from
    // GET /api/procore/me — same shape (HardHatForm) once the
    // endpoint is in place.
    setForm((f) => ({ ...f, ...MOCK_PROCORE_WORKER }));
    toast.success("Filled from Procore profile.");
  };

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setEmergency(EMPTY_EMERGENCY);
    setCredentials([]);
    setSelectedTemplate("");
    setTouched(false);
  };

  const handleTemplateSelect = (key: TradeTemplateKey) => {
    setSelectedTemplate(key);
    const template = TRADE_TEMPLATES[key];
    if (template.trade) {
      setForm((f) => ({ ...f, trade: template.trade }));
    }
    setCredentials(
      template.categories.map((cat, idx) => ({
        id: `cred-${Date.now()}-${idx}`,
        category: cat,
        name: "",
        issuedBy: "",
        issuedDate: "",
        expiresAt: "",
        fileName: "",
      })),
    );
  };

  const addCredential = () => {
    setCredentials((prev) => [
      ...prev,
      {
        id: `cred-${Date.now()}-${prev.length}`,
        category: "",
        name: "",
        issuedBy: "",
        issuedDate: "",
        expiresAt: "",
        fileName: "",
      },
    ]);
  };

  const updateCredential = (
    id: string,
    key: keyof Credential,
    value: string,
  ) => {
    setCredentials((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  };

  const removeCredential = (id: string) =>
    setCredentials((prev) => prev.filter((c) => c.id !== id));

  const simulateUpload = (id: string) => {
    // TODO(dev): replace this stub with a real file picker that uploads
    // via UploadQueueProvider's enqueueFileGroupUploadSmart (see
    // qrcode.$qrcodeId.tsx:2033 for the call pattern). Validate type ∈
    // {pdf, jpg, png} and size ≤ 10MB before enqueuing. On success,
    // set fileName to the uploaded original filename.
    updateCredential(id, "fileName", "uploaded_document.pdf");
  };

  const handleCreate = () => {
    setTouched(true);
    if (!canSubmit) return;
    // TODO(dev): wire to POST /api/hard-hat-cards. Payload:
    //   { contact: form, emergency, credentials, tradeTemplate:
    //     selectedTemplate || null, includeLogo, projectId? }.
    // Response should return { shortCode, qrImagePngUrl, qrImageSvgUrl }
    // so this view can swap to a Generated success state.
    toast.error("Hard Hat creation is coming soon — backend pending.");
  };

  return (
    <div className="space-y-5">
      {/* ─── Section 1: Identity ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {isProcoreConnected && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-accent-50 border border-accent-200 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={procoreIcon}
                alt="Procore"
                className="w-5 h-5 flex-shrink-0"
              />
              <div className="text-sm min-w-0">
                <div className="font-semibold text-gray-900">
                  Use a Procore profile
                </div>
                <div className="text-gray-600 truncate">
                  Pre-fills name, title, and contact info from their Procore profile.
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleProcoreAutofill}
              className="!ring-accent-300 !text-accent-700 hover:!bg-accent-50 whitespace-nowrap"
              data-testid="hh-procore-autofill"
            >
              Use profile
            </Button>
          </div>
        )}

        <Section title="Who is this for">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="First name"
              required
              value={form.firstName}
              onChange={(v) => updateField("firstName", v)}
              placeholder="Carlos"
              touched={touched && !hasName}
              testId="hh-firstName"
            />
            <Field
              label="Last name"
              required
              value={form.lastName}
              onChange={(v) => updateField("lastName", v)}
              placeholder="Mendez"
              touched={touched && !hasName}
              testId="hh-lastName"
            />
            <div className="md:col-span-2">
              <Field
                label="Title / Role"
                value={form.title}
                onChange={(v) => updateField("title", v)}
                placeholder="e.g. Crane Operator"
                testId="hh-title"
              />
            </div>
            <Field
              label="Trade"
              value={form.trade}
              onChange={(v) => updateField("trade", v)}
              placeholder="e.g. Heavy Equipment"
              testId="hh-trade"
            />
            <Field
              label="Company"
              value={form.company}
              onChange={(v) => updateField("company", v)}
              placeholder="Solid Form Concrete"
              testId="hh-company"
            />
          </div>
        </Section>

        <Section title="How to reach them">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Mobile"
              required
              value={form.mobile}
              onChange={(v) => updateField("mobile", v)}
              placeholder="+1 (555) 123-4567"
              type="tel"
              touched={touched && !hasContact}
              testId="hh-mobile"
              errorMessage={
                touched && !hasContact ? "Enter a mobile or an email." : undefined
              }
            />
            <Field
              label="Email"
              required
              value={form.email}
              onChange={(v) => updateField("email", v)}
              placeholder="name@company.com"
              type="email"
              touched={touched && !hasContact}
              testId="hh-email"
            />
          </div>
        </Section>

        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
            data-testid="hh-toggle-more"
          >
            <i className={showMore ? "bx bx-minus" : "bx bx-plus"}></i>
            {showMore ? "Hide extra fields" : "Add more contact fields"}
          </button>
        </div>

        {showMore && (
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Work phone"
                value={form.workPhone}
                onChange={(v) => updateField("workPhone", v)}
                type="tel"
                testId="hh-workPhone"
              />
              <Field
                label="Website"
                value={form.website}
                onChange={(v) => updateField("website", v)}
                placeholder="company.com"
                testId="hh-website"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field
                  label="Street address"
                  value={form.street}
                  onChange={(v) => updateField("street", v)}
                  testId="hh-street"
                />
              </div>
              <Field
                label="City"
                value={form.city}
                onChange={(v) => updateField("city", v)}
                testId="hh-city"
              />
              <Field
                label="State / Province"
                value={form.state}
                onChange={(v) => updateField("state", v)}
                testId="hh-state"
              />
              <Field
                label="ZIP / Postal"
                value={form.zip}
                onChange={(v) => updateField("zip", v)}
                testId="hh-zip"
              />
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => updateField("country", v)}
                testId="hh-country"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 2: Credentials ──────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Credentials &amp; Documents
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full">
              <i className="bx bxs-hard-hat text-amber-700 text-xs"></i>
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">
                Hard Hat
              </span>
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Upload certifications, training records, and inspections. Scanners
            will see each document's status and expiration at a glance.
          </p>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">
            Start from a trade template
          </div>
          <div className="flex flex-wrap gap-2">
            {TRADE_TEMPLATE_ORDER.map((key) => {
              const tmpl = TRADE_TEMPLATES[key];
              const active = selectedTemplate === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTemplateSelect(key)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  data-testid={`hh-template-${key}`}
                >
                  {tmpl.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Templates pre-fill common credential categories for a trade. You can
            add, remove, or rename any category.
          </p>
        </div>

        {credentials.length > 0 ? (
          <div className="space-y-3">
            {credentials.map((cred, idx) => (
              <CredentialCard
                key={cred.id}
                index={idx}
                credential={cred}
                onUpdate={(key, val) => updateCredential(cred.id, key, val)}
                onRemove={() => removeCredential(cred.id)}
                onSimulateUpload={() => simulateUpload(cred.id)}
              />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-8 text-center">
            <i className="bx bxs-shield text-3xl text-gray-300"></i>
            <div className="text-sm text-gray-500 mt-1">
              No credentials added yet
            </div>
            <div className="text-xs text-gray-400">
              Pick a trade template above, or add credentials manually below.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={addCredential}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
          data-testid="hh-add-credential"
        >
          <i className="bx bx-plus"></i>
          Add credential
        </button>
      </div>

      {/* ─── Section 3: Emergency contact ────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <div className="flex items-center gap-1.5">
            <i className="bx bxs-heart text-rose-500"></i>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Emergency Contact
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            This info is visible to anyone who scans the code. Only include
            details the worker is comfortable sharing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Contact name"
            value={emergency.name}
            onChange={(v) => updateEmergency("name", v)}
            placeholder="e.g. Maria Mendez"
            testId="hh-emergency-name"
          />
          <Field
            label="Relationship"
            value={emergency.relationship}
            onChange={(v) => updateEmergency("relationship", v)}
            placeholder="e.g. Spouse"
            testId="hh-emergency-relationship"
          />
          <div className="md:col-span-2">
            <Field
              label="Phone"
              value={emergency.phone}
              onChange={(v) => updateEmergency("phone", v)}
              type="tel"
              placeholder="+1 (555) 123-4567"
              testId="hh-emergency-phone"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Medical notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={emergency.medicalNotes}
            onChange={(e) => updateEmergency("medicalNotes", e.target.value)}
            placeholder="Allergies, blood type, medical conditions, or other info first responders should know."
            rows={2}
            className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 resize-none"
            data-testid="hh-emergency-notes"
          />
        </div>
      </div>

      {/* ─── Section 4: Logo + actions ───────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLogo && companyHasLogo}
            disabled={!companyHasLogo}
            onChange={(e) => setIncludeLogo(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 disabled:opacity-50"
            data-testid="hh-logo-checkbox"
          />
          <div className="text-sm">
            <div className="font-medium text-gray-900">Include company logo</div>
            <p className="mt-0.5 text-xs text-gray-500">
              {companyHasLogo
                ? "Your logo will appear at the top of the card when scanned."
                : "Upload a company logo in Settings to enable this option."}
            </p>
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-gray-700"
            data-testid="hh-clear"
          >
            Clear form
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewOpen(true)}
              leftIconClass="bx bx-mobile"
              data-testid="hh-preview"
            >
              Preview
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCreate}
              disabled={!canSubmit}
              data-testid="hh-create"
            >
              Create Hard Hat QR
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Mobile preview"
        subtitle="What scanners see when they scan this code."
        size="md"
        scrollable
      >
        <div className="flex justify-center py-2">
          <HardHatPhoneCard
            worker={form}
            credentials={credentials}
            emergency={emergency}
            includeLogo={includeLogo && companyHasLogo}
          />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CredentialCard — collapsible per-credential editor
// ---------------------------------------------------------------------------

function CredentialCard({
  index,
  credential,
  onUpdate,
  onRemove,
  onSimulateUpload,
}: {
  index: number;
  credential: Credential;
  onUpdate: (key: keyof Credential, value: string) => void;
  onRemove: () => void;
  onSimulateUpload: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-gray-400 tabular-nums">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {credential.category || "New credential"}
          </span>
          {credential.fileName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              <i className="bx bx-file"></i>
              Uploaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-gray-400 hover:text-rose-600 rounded"
            aria-label="Remove credential"
            data-testid={`hh-credential-remove-${index}`}
          >
            <i className="bx bx-trash"></i>
          </button>
          <i
            className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"} text-gray-400`}
          ></i>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Field
                label="Category"
                value={credential.category}
                onChange={(v) => onUpdate("category", v)}
                placeholder="e.g. OSHA 30-Hour"
                testId={`hh-credential-${index}-category`}
              />
            </div>
            <div className="md:col-span-2">
              <Field
                label="Document name"
                value={credential.name}
                onChange={(v) => onUpdate("name", v)}
                placeholder="Full name as shown on the document"
                testId={`hh-credential-${index}-name`}
              />
            </div>
            <div className="md:col-span-2">
              <Field
                label="Issued by"
                value={credential.issuedBy}
                onChange={(v) => onUpdate("issuedBy", v)}
                placeholder="Certifying body or organization"
                testId={`hh-credential-${index}-issuedBy`}
              />
            </div>
            <Field
              label="Issue date"
              value={credential.issuedDate}
              onChange={(v) => onUpdate("issuedDate", v)}
              type="date"
              testId={`hh-credential-${index}-issuedDate`}
            />
            <div>
              <Field
                label="Expiration date"
                value={credential.expiresAt}
                onChange={(v) => onUpdate("expiresAt", v)}
                type="date"
                testId={`hh-credential-${index}-expiresAt`}
              />
              <div className="text-[10px] text-gray-400 mt-1">
                Leave blank if it doesn't expire.
              </div>
            </div>
          </div>

          {credential.fileName ? (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center gap-2 min-w-0">
                <i className="bx bx-file text-gray-500"></i>
                <span className="text-sm text-gray-700 truncate">
                  {credential.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdate("fileName", "")}
                className="text-xs text-gray-500 hover:text-rose-600"
                data-testid={`hh-credential-${index}-file-remove`}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSimulateUpload}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-md text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              data-testid={`hh-credential-${index}-upload`}
            >
              <i className="bx bx-upload"></i>
              Upload document (PDF, JPG, PNG)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  touched?: boolean;
  testId: string;
  errorMessage?: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  touched,
  testId,
  errorMessage,
}: FieldProps) {
  const showError = Boolean(touched);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 ${
          showError
            ? "border-red-400 focus:border-red-400 focus:ring-red-400"
            : "border-gray-300"
        }`}
      />
      {showError && errorMessage && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone-frame mobile preview — visual contract for /h/:shortCode
// ---------------------------------------------------------------------------

function HardHatPhoneCard({
  worker,
  credentials,
  emergency,
  includeLogo,
}: {
  worker: HardHatForm;
  credentials: Credential[];
  emergency: EmergencyContact;
  includeLogo: boolean;
}) {
  const [contactExpanded, setContactExpanded] = useState(false);
  const fullName =
    `${worker.firstName} ${worker.lastName}`.trim() || "Worker name";

  // Derive credential statuses
  const statuses = credentials.map((c) => getCredentialStatus(c.expiresAt));
  const validCount = statuses.filter((s) => s.status === "valid").length;
  const expiringCount = statuses.filter((s) => s.status === "expiring").length;
  const expiredCount = statuses.filter((s) => s.status === "expired").length;
  const total = credentials.length;
  const allCurrent = total > 0 && expiredCount === 0 && expiringCount === 0;
  const hasIssues = expiredCount > 0;

  const summaryHeadline = allCurrent
    ? "All credentials current"
    : hasIssues
      ? `${expiredCount} expired`
      : expiringCount > 0
        ? `${expiringCount} expiring soon`
        : "No credentials yet";
  const summaryDetail =
    total === 0
      ? "Add credentials to populate this card."
      : `${validCount} of ${total} valid${expiringCount > 0 ? ` · ${expiringCount} expiring` : ""}`;
  const summaryStyle = allCurrent
    ? STATUS_STYLES.valid
    : hasIssues
      ? STATUS_STYLES.expired
      : expiringCount > 0
        ? STATUS_STYLES.expiring
        : { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", badge: "", icon: "bx bx-shield" };

  const hasEmergency = Boolean(emergency.name || emergency.phone);

  return (
    <div className="relative w-[320px] bg-black rounded-[2.5rem] p-2.5 shadow-2xl">
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
      <div className="bg-white rounded-[2rem] overflow-hidden min-h-[640px] relative">
        <div className="flex justify-between items-center px-6 pt-3 pb-1 text-[11px] font-semibold text-gray-900">
          <span>9:41</span>
          <span className="tracking-widest">●●●</span>
        </div>

        <div className="px-5 pt-3 pb-7">
          {/* ── Layer 1: Taliho header + Hard Hat badge ──────── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-gray-900 rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">T</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-900 tracking-[0.15em]">
                TALIHO
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full">
                <i className="bx bxs-hard-hat text-amber-700 text-[10px]"></i>
                <span className="text-[8px] font-bold text-amber-800 uppercase tracking-wider">
                  Hard Hat
                </span>
              </span>
              <i className="bx bx-share-alt text-gray-400 text-base"></i>
            </div>
          </div>

          {/* ── Layer 2: Identity ────────────────────────────── */}
          <div className="text-center mb-5">
            {includeLogo && (
              <div className="flex justify-center mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-md">
                  <div className="w-3 h-3 bg-brand-400 rotate-45 rounded-[2px]" />
                  <span className="text-xs font-bold tracking-[0.1em]">
                    {(worker.company || "COMPANY").toUpperCase().slice(0, 14)}
                  </span>
                </div>
              </div>
            )}
            <div className="text-xl font-bold text-gray-900 leading-tight">
              {fullName}
            </div>
            {worker.title && (
              <div className="text-xs font-medium text-gray-700 mt-1">
                {worker.title}
              </div>
            )}
            {worker.trade && (
              <div className="inline-flex mt-1.5 px-2 py-0.5 bg-gray-100 rounded-full">
                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  {worker.trade}
                </span>
              </div>
            )}
            {worker.company && (
              <div className="text-xs text-gray-500 mt-1 italic">
                {worker.company}
              </div>
            )}
          </div>

          {/* ── Layer 3: Credential status summary + cards ──── */}
          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-3 border ${summaryStyle.bg} ${summaryStyle.border}`}
          >
            <i className={`${summaryStyle.icon} text-lg ${summaryStyle.text}`}></i>
            <div>
              <div className={`text-xs font-semibold ${summaryStyle.text}`}>
                {summaryHeadline}
              </div>
              <div className={`text-[10px] ${summaryStyle.text} opacity-80`}>
                {summaryDetail}
              </div>
            </div>
          </div>

          {credentials.length > 0 ? (
            <div className="space-y-2 mb-6">
              {credentials.map((cred, idx) => {
                const s = statuses[idx]!;
                const style = STATUS_STYLES[s.status];
                return (
                  <div
                    key={cred.id}
                    className={`rounded-xl border ${style.border} px-3.5 py-2.5`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        {deriveCategoryLabel(cred.category)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${style.badge}`}
                      >
                        <i className={`${style.icon} text-[10px]`}></i>
                        {s.label}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 leading-snug">
                      {cred.name || cred.category || "Untitled credential"}
                    </div>
                    {cred.issuedBy && (
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        {cred.issuedBy}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-[9px] text-gray-500">
                        {cred.issuedDate && (
                          <span>Issued {formatDate(cred.issuedDate)}</span>
                        )}
                        <span className={style.text}>
                          <i className={`bx bx-time-five text-[10px] mr-0.5`}></i>
                          {s.sublabel}
                        </span>
                      </div>
                      {cred.fileName && (
                        <span className="flex items-center gap-1 text-[9px] font-medium text-gray-600">
                          <i className="bx bx-file"></i>
                          View
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-6 px-4 py-5 bg-gray-50 rounded-2xl text-center text-[11px] text-gray-400">
              Credentials will appear here as you add them.
            </div>
          )}

          {/* ── Layer 4: Emergency contact ───────────────────── */}
          {hasEmergency && (
            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <i className="bx bxs-heart text-rose-500 text-xs"></i>
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.12em]">
                  Emergency contact
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {emergency.name || "—"}
                    </div>
                    {emergency.relationship && (
                      <div className="text-[10px] text-gray-500">
                        {emergency.relationship}
                      </div>
                    )}
                  </div>
                  {emergency.phone && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white text-[10px] font-semibold rounded-lg">
                      <i className="bx bx-phone"></i>
                      Call
                    </span>
                  )}
                </div>
                {emergency.phone && (
                  <div className="text-[11px] text-gray-600 mt-1">
                    {emergency.phone}
                  </div>
                )}
                {emergency.medicalNotes && (
                  <div className="mt-2.5 pt-2.5 border-t border-rose-200">
                    <div className="text-[8px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">
                      Medical notes
                    </div>
                    <div className="text-[11px] text-gray-700">
                      {emergency.medicalNotes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Layer 5: Contact actions (collapsed) ─────────── */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setContactExpanded((v) => !v)}
              className="flex items-center justify-between w-full px-1 mb-2"
            >
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.12em]">
                Contact this person
              </span>
              <i
                className={`bx ${contactExpanded ? "bx-chevron-up" : "bx-chevron-down"} text-gray-400`}
              ></i>
            </button>
            {contactExpanded && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <QuickAction icon="bx bx-phone" label="Call" />
                  <QuickAction icon="bx bx-message-square-detail" label="Text" />
                  <QuickAction icon="bx bx-envelope" label="Email" />
                </div>
                <div className="w-full py-2.5 rounded-xl text-center font-semibold text-xs bg-gray-100 text-gray-700">
                  Save to Contacts
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <div className="text-[9px] text-gray-400">
              Updated just now · Powered by Taliho
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 rounded-xl">
      <i className={`${icon} text-gray-700 text-base`}></i>
      <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
