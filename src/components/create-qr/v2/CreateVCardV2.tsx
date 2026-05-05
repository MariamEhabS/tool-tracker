/**
 * Create-QR v2 — flat single-page Business Card (V-Card) layout.
 *
 * Reachable from the Type-selection screen by clicking the Business Card
 * card. Replaces the wizard + step-tracker with a flat page that mirrors
 * the Tool Tracker / Equipment / Arrangement v2 layouts.
 *
 * Single + Bulk modes live in an in-form segmented toggle (no step
 * tracker). Bulk is gated to Procore-connected companies — for non-Procore
 * users the toggle is not rendered, and the page reduces to single-card
 * manual entry.
 *
 * BACKEND TODOS (for the dev integrating this):
 *   1. POST /api/business-cards         — create one card from form data.
 *   2. POST /api/business-cards/bulk    — create N cards from selected
 *                                         Procore directory user IDs;
 *                                         pulls each person's contact info
 *                                         from Procore at creation time;
 *                                         returns a ZIP of PNG + SVG.
 *   3. GET  /api/procore/me             — current Procore user's profile
 *                                         (powers "Use profile" auto-fill).
 *   4. GET  /api/procore/project-directory
 *                                       — directory list for the bulk
 *                                         picker (replace MOCK_DIRECTORY).
 *   5. GET  /c/:shortCode (server-rendered HTML) and
 *      GET  /c/:shortCode.vcf            — the public mobile landing page
 *                                         and vCard 3.0 download. The
 *                                         phone-frame Preview here is the
 *                                         exact visual contract for the
 *                                         landing page.
 *
 * Submission is currently stubbed with a toast — wire the two POST
 * endpoints into `handleCreateSingle` / `handleCreateBulk` once the
 * backend lands.
 */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import { icons } from "@/lib/icons";
import procoreIcon from "@assets/images/procore-icon.png";

interface CreateVCardV2Props {
  onBackToTypes?: () => void;
}

type Mode = "single" | "bulk";

interface ContactForm {
  firstName: string;
  lastName: string;
  title: string;
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

const EMPTY_FORM: ContactForm = {
  firstName: "",
  lastName: "",
  title: "",
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

// MOCK — replace with response from GET /api/procore/me.
const MOCK_PROCORE_USER: ContactForm = {
  firstName: "Marcus",
  lastName: "Chen",
  title: "Senior Project Manager",
  company: "Keystone Construction Group",
  mobile: "+1 (415) 555-0142",
  email: "m.chen@keystonecg.com",
  workPhone: "+1 (415) 555-0100",
  website: "keystonecg.com",
  street: "500 Mission Street, Suite 1200",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
  country: "USA",
};

interface DirectoryPerson {
  id: number;
  name: string;
  title: string;
  company: string;
  email: string;
}

// MOCK — replace with response from GET /api/procore/project-directory.
const MOCK_DIRECTORY: DirectoryPerson[] = [
  { id: 1, name: "Marcus Chen", title: "Senior Project Manager", company: "Keystone Construction Group", email: "m.chen@keystonecg.com" },
  { id: 2, name: "Priya Ramanathan", title: "Project Engineer", company: "Keystone Construction Group", email: "p.ramanathan@keystonecg.com" },
  { id: 3, name: "James O'Brien", title: "Superintendent", company: "Keystone Construction Group", email: "j.obrien@keystonecg.com" },
  { id: 4, name: "Sofia Delgado", title: "Safety Coordinator", company: "Keystone Construction Group", email: "s.delgado@keystonecg.com" },
  { id: 5, name: "David Kim", title: "MEP Coordinator", company: "Apex Mechanical", email: "dkim@apexmech.com" },
  { id: 6, name: "Rachel Torres", title: "Architect of Record", company: "Lumen Studio", email: "rtorres@lumenstudio.com" },
  { id: 7, name: "Tom Whitfield", title: "Structural Engineer", company: "Whitfield & Associates", email: "tom@whitfieldeng.com" },
  { id: 8, name: "Aisha Mbeki", title: "Electrical Foreman", company: "Voltaic Partners", email: "a.mbeki@voltaicpartners.com" },
  { id: 9, name: "Carlos Mendez", title: "Concrete Superintendent", company: "Solid Form Concrete", email: "cmendez@solidform.com" },
];

// Mockup flag — see Procore gating block inside the component below.
const FORCE_PROCORE_FOR_MOCKUP = true;

export default function CreateVCardV2({ onBackToTypes }: CreateVCardV2Props) {
  // ─── Procore gating ──────────────────────────────────────────────────────
  // Production rule (PRD §3): the Bulk toggle is invisible to non-Procore
  // users — no greyed-out, no upsell. Production should gate on
  // `procoreCompanyID > 0` from the company slice:
  //
  //   const company = useSelector((s: RootState) => s.company);
  //   const isProcoreConnected = (company?.procoreCompanyID ?? 0) > 0;
  //
  // For this redesign mockup the company slice isn't reliably hydrated, so
  // we force the toggle on via FORCE_PROCORE_FOR_MOCKUP. TODO(dev): swap to
  // the real selector once login wiring lands.
  const isProcoreConnected = FORCE_PROCORE_FOR_MOCKUP;

  // Default to single mode. Non-Procore users are locked into single mode
  // because the toggle is hidden.
  const [mode, setMode] = useState<Mode>("single");

  // The mocked Procore profile assumes the company has a logo on file.
  // Replace this default with a real value derived from company settings
  // once the logo upload feature is wired (PRD Phase 7).
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
          Create Business Card QR
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Share your contact info with a scan — and update it any time.
        </p>
      </div>

      <div className="max-w-3xl w-full mx-auto space-y-5">
        {isProcoreConnected && (
          <ModeToggle mode={mode} onChange={setMode} />
        )}

        {mode === "single" ? (
          <SinglePanel
            isProcoreConnected={isProcoreConnected}
            companyHasLogo={companyHasLogo}
          />
        ) : (
          <BulkPanel />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single / Bulk segmented toggle (Procore users only)
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      className="inline-flex p-1 bg-gray-100 rounded-lg"
      role="tablist"
      aria-label="Business card creation mode"
    >
      <ToggleButton
        active={mode === "single"}
        onClick={() => onChange("single")}
        icon="bx bx-user"
        label="Single card"
      />
      <ToggleButton
        active={mode === "bulk"}
        onClick={() => onChange("bulk")}
        icon="bx bx-group"
        label="Bulk from Procore"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-md transition ${
        active
          ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
          : "text-gray-600 hover:text-gray-900"
      }`}
    >
      <i className={icon}></i>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single mode
// ---------------------------------------------------------------------------

function SinglePanel({
  isProcoreConnected,
  companyHasLogo,
}: {
  isProcoreConnected: boolean;
  companyHasLogo: boolean;
}) {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [showMore, setShowMore] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(companyHasLogo);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const update = (key: keyof ContactForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const hasName =
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0;
  const hasContact =
    form.mobile.trim().length > 0 || form.email.trim().length > 0;
  const canSubmit = useMemo(
    () => hasName && hasContact,
    [hasName, hasContact],
  );

  const handleProcoreAutofill = () => {
    // TODO(dev): replace MOCK_PROCORE_USER with the response from
    // GET /api/procore/me — same shape (ContactForm) once the endpoint
    // is in place.
    setForm({ ...MOCK_PROCORE_USER });
    setShowMore(true);
    toast.success("Filled from your Procore profile.");
  };

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setTouched(false);
  };

  const handleCreate = () => {
    setTouched(true);
    if (!canSubmit) return;
    // TODO(dev): wire to POST /api/business-cards. Payload should include
    // the full ContactForm plus { includeLogo, projectId? }. Response is
    // expected to return { shortCode, qrImagePngUrl, qrImageSvgUrl } so
    // this view can swap to a Generated success state.
    toast.error("Business Card creation is coming soon — backend pending.");
  };

  return (
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
                Use my Procore profile
              </div>
              <div className="text-gray-600 truncate">
                Pre-fills your name, title, and contact info.
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleProcoreAutofill}
            className="!ring-accent-300 !text-accent-700 hover:!bg-accent-50 whitespace-nowrap"
            data-testid="vcard-procore-autofill"
          >
            Use profile
          </Button>
        </div>
      )}

      <Section title="Who you are">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="First name"
            required
            value={form.firstName}
            onChange={(v) => update("firstName", v)}
            placeholder="Jane"
            touched={touched && !hasName}
            testId="vcard-firstName"
          />
          <Field
            label="Last name"
            required
            value={form.lastName}
            onChange={(v) => update("lastName", v)}
            placeholder="Reynolds"
            touched={touched && !hasName}
            testId="vcard-lastName"
          />
          <div className="md:col-span-2">
            <Field
              label="Title"
              value={form.title}
              onChange={(v) => update("title", v)}
              placeholder="Project Superintendent"
              testId="vcard-title"
            />
          </div>
          <div className="md:col-span-2">
            <Field
              label="Company"
              value={form.company}
              onChange={(v) => update("company", v)}
              placeholder="Taliho Construction"
              testId="vcard-company"
            />
          </div>
        </div>
      </Section>

      <Section title="How to reach you">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Mobile"
            required
            value={form.mobile}
            onChange={(v) => update("mobile", v)}
            placeholder="+1 (555) 123-4567"
            type="tel"
            touched={touched && !hasContact}
            testId="vcard-mobile"
            errorMessage={
              touched && !hasContact ? "Enter a mobile or an email." : undefined
            }
          />
          <Field
            label="Email"
            required
            value={form.email}
            onChange={(v) => update("email", v)}
            placeholder="name@company.com"
            type="email"
            touched={touched && !hasContact}
            testId="vcard-email"
          />
        </div>
      </Section>

      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
          data-testid="vcard-toggle-more"
        >
          <i className={showMore ? "bx bx-minus" : "bx bx-plus"}></i>
          {showMore ? "Hide extra fields" : "Add more fields"}
        </button>
        <p className="mt-1 text-xs text-gray-500">
          Only add what you actually want shared. You can always edit these later.
        </p>
      </div>

      {showMore && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Work phone"
              value={form.workPhone}
              onChange={(v) => update("workPhone", v)}
              type="tel"
              testId="vcard-workPhone"
            />
            <Field
              label="Website"
              value={form.website}
              onChange={(v) => update("website", v)}
              placeholder="yourcompany.com"
              testId="vcard-website"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field
                label="Street address"
                value={form.street}
                onChange={(v) => update("street", v)}
                testId="vcard-street"
              />
            </div>
            <Field
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              testId="vcard-city"
            />
            <Field
              label="State / Province"
              value={form.state}
              onChange={(v) => update("state", v)}
              testId="vcard-state"
            />
            <Field
              label="ZIP / Postal"
              value={form.zip}
              onChange={(v) => update("zip", v)}
              testId="vcard-zip"
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(v) => update("country", v)}
              testId="vcard-country"
            />
          </div>
        </div>
      )}

      <div className="pt-5 border-t border-gray-100">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLogo && companyHasLogo}
            disabled={!companyHasLogo}
            onChange={(e) => setIncludeLogo(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 disabled:opacity-50"
            data-testid="vcard-logo-checkbox"
          />
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              Include my company logo
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {companyHasLogo
                ? "Your logo will appear at the top of the contact page."
                : "Upload a company logo in Settings to enable this option."}
            </p>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-gray-100">
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-gray-500 hover:text-gray-700"
          data-testid="vcard-clear"
        >
          Clear form
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewOpen(true)}
            leftIconClass="bx bx-mobile"
            data-testid="vcard-preview"
          >
            Preview
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleCreate}
            disabled={!canSubmit}
            data-testid="vcard-create-populate"
          >
            Create Business Card QR
          </Button>
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
          <PhoneCard
            contact={form}
            includeLogo={includeLogo && companyHasLogo}
          />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk mode (Procore users only — gated by ModeToggle visibility)
// ---------------------------------------------------------------------------

function BulkPanel() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // TODO(dev): replace MOCK_DIRECTORY with the response from
  // GET /api/procore/project-directory (current project scope).
  const directory = MOCK_DIRECTORY;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q),
    );
  }, [directory, search]);

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });

  const handleCreate = () => {
    if (selected.size === 0) return;
    // TODO(dev): wire to POST /api/business-cards/bulk with
    // { procoreUserIds: Array.from(selected) }. Server pulls each
    // person's contact info from Procore at creation time and returns
    // a ZIP containing PNG + SVG per generated card.
    toast.error(
      "Bulk Business Card creation is coming soon — backend pending.",
    );
  };

  const count = selected.size;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <img src={procoreIcon} alt="Procore" className="w-4 h-4" />
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          From Procore project directory
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Generate one Business Card QR per person. Great for badges, trailer
        boards, or hardhat stickers.
      </p>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, title, or company"
            className="block w-full pl-9 pr-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-brand-400 focus:ring-brand-400"
            data-testid="vcard-bulk-search"
          />
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={filtered.length === 0}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 whitespace-nowrap disabled:opacity-50"
          data-testid="vcard-bulk-toggle-all"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            No one matches that search.
          </div>
        )}
        {filtered.map((person) => {
          const isSelected = selected.has(person.id);
          return (
            <label
              key={person.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                isSelected ? "bg-brand-50/40" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(person.id)}
                className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                data-testid={`vcard-bulk-row-${person.id}`}
              />
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                {initials(person.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {person.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {person.title} · {person.company}
                </div>
              </div>
              <div className="hidden md:block text-xs text-gray-400 truncate max-w-[220px]">
                {person.email}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          {count === 0
            ? "Select people to generate cards for"
            : `${count} ${count === 1 ? "person" : "people"} selected`}
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleCreate}
          disabled={count === 0}
          data-testid="vcard-bulk-create"
        >
          {count === 0
            ? "Create Business Cards"
            : `Create ${count} Business Card${count !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared subcomponents
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Phone-framed mobile preview — visual contract for /c/:shortCode
// ---------------------------------------------------------------------------

function PhoneCard({
  contact,
  includeLogo,
}: {
  contact: ContactForm;
  includeLogo: boolean;
}) {
  const fullName =
    `${contact.firstName} ${contact.lastName}`.trim() || "Your name";
  const hasAddress = Boolean(contact.street || contact.city);
  const hasAnyDetails =
    contact.mobile ||
    contact.email ||
    contact.workPhone ||
    contact.website ||
    hasAddress;

  return (
    <div className="relative w-[320px] bg-black rounded-[2.5rem] p-2.5 shadow-2xl">
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
      <div className="bg-white rounded-[2rem] overflow-hidden min-h-[600px] relative">
        <div className="flex justify-between items-center px-6 pt-3 pb-1 text-[11px] font-semibold text-gray-900">
          <span>9:41</span>
          <span className="tracking-widest">●●●</span>
        </div>

        <div className="px-5 pt-3 pb-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-gray-900 rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">T</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-900 tracking-[0.15em]">
                TALIHO
              </span>
            </div>
            <i className="bx bx-share-alt text-gray-400 text-base"></i>
          </div>

          <div className="text-center mb-6">
            {includeLogo && (
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-md">
                  <div className="w-3 h-3 bg-brand-400 rotate-45 rounded-[2px]" />
                  <span className="text-xs font-bold tracking-[0.1em]">
                    {(contact.company || "COMPANY").toUpperCase().slice(0, 14)}
                  </span>
                </div>
              </div>
            )}
            <div className="text-xl font-bold text-gray-900 leading-tight">
              {fullName}
            </div>
            {contact.title && (
              <div className="text-xs text-gray-600 mt-1">{contact.title}</div>
            )}
            {contact.company && (
              <div className="text-xs text-gray-500">{contact.company}</div>
            )}
          </div>

          <button
            type="button"
            className="w-full py-3 rounded-2xl font-semibold text-sm bg-gray-900 text-white shadow-lg shadow-gray-900/20"
          >
            Save to Contacts
          </button>

          <div className="grid grid-cols-3 gap-2 mt-2.5">
            <QuickAction icon="bx bx-phone" label="Call" />
            <QuickAction icon="bx bx-message-square-detail" label="Text" />
            <QuickAction icon="bx bx-envelope" label="Email" />
          </div>

          {hasAnyDetails ? (
            <div className="mt-7">
              <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.12em] mb-2 px-1">
                Contact details
              </div>
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                {contact.mobile && (
                  <DetailRow icon="bx bx-phone" label="Mobile" value={contact.mobile} />
                )}
                {contact.workPhone && (
                  <DetailRow icon="bx bx-phone" label="Work" value={contact.workPhone} />
                )}
                {contact.email && (
                  <DetailRow icon="bx bx-envelope" label="Email" value={contact.email} />
                )}
                {contact.website && (
                  <DetailRow icon="bx bx-globe" label="Website" value={contact.website} />
                )}
                {hasAddress && (
                  <DetailRow
                    icon="bx bx-map"
                    label="Address"
                    value={
                      <>
                        {contact.street && <div>{contact.street}</div>}
                        {(contact.city || contact.state || contact.zip) && (
                          <div>
                            {[contact.city, contact.state]
                              .filter(Boolean)
                              .join(", ")}{" "}
                            {contact.zip}
                          </div>
                        )}
                        {contact.country && <div>{contact.country}</div>}
                      </>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mt-7 px-4 py-5 bg-gray-50 rounded-2xl text-center text-[11px] text-gray-400">
              Contact details will appear here as the form fills in.
            </div>
          )}

          <div className="mt-7 text-center">
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
    <div className="flex flex-col items-center gap-1 py-2.5 bg-gray-50 rounded-2xl">
      <i className={`${icon} text-gray-700 text-lg`}></i>
      <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3 border-b border-gray-200 last:border-b-0">
      <i className={`${icon} text-gray-400 text-base mt-0.5 flex-shrink-0`}></i>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-xs text-gray-800 break-words">{value}</div>
      </div>
    </div>
  );
}
