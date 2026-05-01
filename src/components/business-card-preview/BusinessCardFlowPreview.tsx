import { useMemo, useState, type ReactNode } from "react";

type BusinessCardContact = {
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
  lastUpdated?: string;
};

type DirectoryPerson = {
  id: number;
  name: string;
  title: string;
  company: string;
  email: string;
};

type FlowStep = "intro" | "single" | "bulk" | "created" | "mobile";
type CreatedMode = "single" | "bulk";
type MobileAction = {
  icon: IconName;
  label: string;
  href: string;
};
type IconName =
  | "phone"
  | "mail"
  | "globe"
  | "map"
  | "message"
  | "plus"
  | "minus"
  | "x"
  | "mobile"
  | "check"
  | "share"
  | "search"
  | "qr"
  | "user"
  | "users"
  | "briefcase"
  | "download"
  | "arrowLeft";

const emptyContact: BusinessCardContact = {
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

const mockProcoreUser: BusinessCardContact = {
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
  lastUpdated: "just now",
};

const mockProjectDirectory: DirectoryPerson[] = [
  {
    id: 1,
    name: "Marcus Chen",
    title: "Senior Project Manager",
    company: "Keystone Construction Group",
    email: "m.chen@keystonecg.com",
  },
  {
    id: 2,
    name: "Priya Ramanathan",
    title: "Project Engineer",
    company: "Keystone Construction Group",
    email: "p.ramanathan@keystonecg.com",
  },
  {
    id: 3,
    name: "James O'Brien",
    title: "Superintendent",
    company: "Keystone Construction Group",
    email: "j.obrien@keystonecg.com",
  },
  {
    id: 4,
    name: "Sofia Delgado",
    title: "Safety Coordinator",
    company: "Keystone Construction Group",
    email: "s.delgado@keystonecg.com",
  },
  {
    id: 5,
    name: "David Kim",
    title: "MEP Coordinator",
    company: "Apex Mechanical",
    email: "dkim@apexmech.com",
  },
  {
    id: 6,
    name: "Rachel Torres",
    title: "Architect of Record",
    company: "Lumen Studio",
    email: "rtorres@lumenstudio.com",
  },
  {
    id: 7,
    name: "Tom Whitfield",
    title: "Structural Engineer",
    company: "Whitfield & Associates",
    email: "tom@whitfieldeng.com",
  },
  {
    id: 8,
    name: "Aisha Mbeki",
    title: "Electrical Foreman",
    company: "Voltaic Partners",
    email: "a.mbeki@voltaicpartners.com",
  },
  {
    id: 9,
    name: "Carlos Mendez",
    title: "Concrete Superintendent",
    company: "Solid Form Concrete",
    email: "cmendez@solidform.com",
  },
];

const mockCompanyLogo = (
  <div className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-white shadow-sm">
    <div className="h-4 w-4 rotate-45 rounded-[2px] bg-brand-400" />
    <span className="text-sm font-bold tracking-[0.1em]">KEYSTONE</span>
  </div>
);

export default function BusinessCardFlowPreview({
  onClose,
}: {
  onClose: () => void;
}) {
  const [step, setStep] = useState<FlowStep>("intro");
  const [createdMode, setCreatedMode] = useState<CreatedMode>("single");
  const [previewContact, setPreviewContact] =
    useState<BusinessCardContact>(mockProcoreUser);

  const showCreated = (mode: CreatedMode, contact = mockProcoreUser) => {
    setCreatedMode(mode);
    setPreviewContact({ ...contact, lastUpdated: "just now" });
    setStep("created");
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-100 text-slate-900">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-800">
                Temporary preview
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Mock data only - not hooked up
              </span>
            </div>
            <h2 className="text-xl font-semibold text-slate-950">
              Business Card QR Flow
            </h2>
            <p className="text-sm text-slate-600">
              Click through the proposed single, bulk, created, and scanned card
              screens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PreviewNavButton
              active={step === "intro"}
              onClick={() => setStep("intro")}
            >
              Flow start
            </PreviewNavButton>
            <PreviewNavButton
              active={step === "single"}
              onClick={() => setStep("single")}
            >
              Single
            </PreviewNavButton>
            <PreviewNavButton
              active={step === "bulk"}
              onClick={() => setStep("bulk")}
            >
              Bulk
            </PreviewNavButton>
            <PreviewNavButton
              active={step === "mobile"}
              onClick={() => setStep("mobile")}
            >
              Scan view
            </PreviewNavButton>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <IconGlyph name="x" className="text-base" />
              Close
            </button>
          </div>
        </div>
      </div>

      {step === "intro" && (
        <PreviewIntro
          onStartSingle={() => setStep("single")}
          onStartBulk={() => setStep("bulk")}
          onViewMobile={() => setStep("mobile")}
        />
      )}

      {step === "single" && (
        <SingleBusinessCardCreatorPreview
          onBack={() => setStep("intro")}
          onCreate={(contact) => showCreated("single", contact)}
        />
      )}

      {step === "bulk" && (
        <BulkBusinessCardCreatorPreview
          onBack={() => setStep("intro")}
          onCreate={() => showCreated("bulk")}
        />
      )}

      {step === "created" && (
        <CreatedPreview
          mode={createdMode}
          contact={previewContact}
          onBack={() => setStep(createdMode === "bulk" ? "bulk" : "single")}
          onViewMobile={() => setStep("mobile")}
          onStartOver={() => setStep("intro")}
        />
      )}

      {step === "mobile" && (
        <MobileLandingPreview
          contact={previewContact}
          onBack={() => setStep(createdMode === "bulk" ? "created" : "single")}
        />
      )}
    </div>
  );
}

function PreviewIntro({
  onStartSingle,
  onStartBulk,
  onViewMobile,
}: {
  onStartSingle: () => void;
  onStartBulk: () => void;
  onViewMobile: () => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
              <IconGlyph name="qr" className="text-3xl" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Dashboard entry
              </div>
              <h3 className="text-2xl font-semibold text-slate-950">
                Preview the Business Card QR path
              </h3>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            This temporary preview uses the prototype screens with mock contact
            and Procore data. The buttons simulate the intended flow without
            creating QR codes, calling APIs, or writing backend data.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FlowTile
              icon="user"
              title="Single card"
              description="Manual entry or Procore profile autofill, then a phone preview."
              action="Start single flow"
              onClick={onStartSingle}
            />
            <FlowTile
              icon="users"
              title="Bulk cards"
              description="Mock Procore directory picker for selecting several people."
              action="Start bulk flow"
              onClick={onStartBulk}
            />
            <FlowTile
              icon="mobile"
              title="Scanned view"
              description="The mobile contact card a scanner would see from the short URL."
              action="View mobile page"
              onClick={onViewMobile}
            />
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-brand-300 bg-brand-50/70 p-4 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">Flow map:</span>{" "}
            Dashboard button - choose single or bulk - fill/select contacts -
            mock QR created - scanned mobile landing page.
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
                Final scan preview
              </div>
              <div className="text-lg font-semibold">Mobile card</div>
            </div>
            <button
              onClick={onViewMobile}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Open
            </button>
          </div>
          <div className="flex justify-center overflow-hidden rounded-[2rem] bg-slate-900 px-2 py-5">
            <div className="scale-[0.74]">
              <TalihoMobileCard
                contact={mockProcoreUser}
                logo={mockCompanyLogo}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleBusinessCardCreatorPreview({
  onBack,
  onCreate,
  showProcoreAutofill = true,
  companyHasLogo = true,
}: {
  onBack: () => void;
  onCreate: (contact: BusinessCardContact) => void;
  showProcoreAutofill?: boolean;
  companyHasLogo?: boolean;
}) {
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(companyHasLogo);
  const [form, setForm] = useState<BusinessCardContact>(emptyContact);

  const updateField = (key: keyof BusinessCardContact, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleProcoreAutofill = () => {
    setForm(mockProcoreUser);
    setShowMoreFields(true);
  };

  const handleClearForm = () => {
    setForm(emptyContact);
    setShowMoreFields(false);
  };

  const hasMinimumFields =
    Boolean(form.firstName.trim()) &&
    Boolean(form.lastName.trim()) &&
    Boolean(form.mobile.trim() || form.email.trim());

  return (
    <div className="min-h-[calc(100vh-105px)] bg-slate-50 pb-12 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <IconGlyph name="arrowLeft" />
                Back to flow start
              </button>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                QR Code Type
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Create Business Card QR
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Share your contact info with a scan and update it any time.
              </p>
            </div>
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <IconGlyph name="mobile" />
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {showProcoreAutofill && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ProcoreIcon className="h-5 w-5" />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">
                    Use my Procore profile
                  </div>
                  <div className="text-slate-600">
                    Pre-fills your name, title, and contact info.
                  </div>
                </div>
              </div>
              <button
                onClick={handleProcoreAutofill}
                className="whitespace-nowrap rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
              >
                Use profile
              </button>
            </div>
          )}

          <FormSection label="Who you are">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="First name"
                value={form.firstName}
                onChange={(value) => updateField("firstName", value)}
                required
              />
              <Field
                label="Last name"
                value={form.lastName}
                onChange={(value) => updateField("lastName", value)}
                required
              />
              <Field
                label="Title"
                value={form.title}
                onChange={(value) => updateField("title", value)}
                className="sm:col-span-2"
              />
              <Field
                label="Company"
                value={form.company}
                onChange={(value) => updateField("company", value)}
                className="sm:col-span-2"
              />
            </div>
          </FormSection>

          <FormSection label="How to reach you">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Mobile"
                placeholder="+1 (555) 123-4567"
                value={form.mobile}
                onChange={(value) => updateField("mobile", value)}
                type="tel"
                required
              />
              <Field
                label="Email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(value) => updateField("email", value)}
                type="email"
                required
              />
            </div>
          </FormSection>

          <button
            onClick={() => setShowMoreFields((current) => !current)}
            className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
          >
            <IconGlyph name={showMoreFields ? "minus" : "plus"} />
            {showMoreFields ? "Hide extra fields" : "Add more fields"}
          </button>
          <div className="mb-4 text-xs text-slate-500">
            Only add what you actually want shared. You can always edit these
            later.
          </div>

          {showMoreFields && (
            <div className="mb-6 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Work phone"
                  value={form.workPhone}
                  onChange={(value) => updateField("workPhone", value)}
                  type="tel"
                />
                <Field
                  label="Website"
                  placeholder="yourcompany.com"
                  value={form.website}
                  onChange={(value) => updateField("website", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Street address"
                  value={form.street}
                  onChange={(value) => updateField("street", value)}
                  className="sm:col-span-2"
                />
                <Field
                  label="City"
                  value={form.city}
                  onChange={(value) => updateField("city", value)}
                />
                <Field
                  label="State / Province"
                  value={form.state}
                  onChange={(value) => updateField("state", value)}
                />
                <Field
                  label="ZIP / Postal"
                  value={form.zip}
                  onChange={(value) => updateField("zip", value)}
                />
                <Field
                  label="Country"
                  value={form.country}
                  onChange={(value) => updateField("country", value)}
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={includeLogo && companyHasLogo}
                disabled={!companyHasLogo}
                onChange={(event) => setIncludeLogo(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 disabled:opacity-50"
              />
              <div className="text-sm">
                <div className="font-medium text-slate-900">
                  Include my company logo
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {companyHasLogo
                    ? "Your logo will appear at the top of the contact page."
                    : "Upload a company logo in Settings to enable this option."}
                </div>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleClearForm}
              className="text-left text-sm text-slate-500 transition hover:text-slate-700"
            >
              Clear form
            </button>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Save as company template
              </button>
              <button
                disabled={!hasMinimumFields}
                onClick={() => onCreate(form)}
                className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Create Business Card QR
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewOpen && (
        <PreviewModal
          contact={form}
          logo={includeLogo && companyHasLogo ? mockCompanyLogo : null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function BulkBusinessCardCreatorPreview({
  onBack,
  onCreate,
}: {
  onBack: () => void;
  onCreate: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set([1, 2, 4]),
  );
  const [directorySearch, setDirectorySearch] = useState("");

  const filteredDirectory = useMemo(() => {
    const query = directorySearch.toLowerCase().trim();
    if (!query) return mockProjectDirectory;
    return mockProjectDirectory.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        person.title.toLowerCase().includes(query) ||
        person.company.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query),
    );
  }, [directorySearch]);

  const selectedFilteredCount = filteredDirectory.filter((person) =>
    selectedIds.has(person.id),
  ).length;
  const allFilteredSelected =
    filteredDirectory.length > 0 &&
    selectedFilteredCount === filteredDirectory.length;

  const toggleSelection = (id: number) => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(id)) nextIds.delete(id);
      else nextIds.add(id);
      return nextIds;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (allFilteredSelected) {
        filteredDirectory.forEach((person) => nextIds.delete(person.id));
      } else {
        filteredDirectory.forEach((person) => nextIds.add(person.id));
      }
      return nextIds;
    });
  };

  return (
    <div className="min-h-[calc(100vh-105px)] bg-slate-50 pb-28 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <IconGlyph name="arrowLeft" />
                Back to flow start
              </button>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                QR Code Type - Bulk
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Create Business Card QRs
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Generate one Business Card QR per person. Great for badges,
                trailer boards, or hardhat stickers.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-orange-700 ring-1 ring-orange-200">
              <ProcoreIcon />
              Procore only
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ProcoreIcon />
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              From Procore project directory
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconGlyph
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400"
              />
              <input
                type="text"
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="Search name, title, company, or email"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <button
              onClick={toggleSelectAll}
              className="whitespace-nowrap text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            {filteredDirectory.map((person) => {
              const selected = selectedIds.has(person.id);
              return (
                <label
                  key={person.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 ${
                    selected ? "bg-brand-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelection(person.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                    {getInitials(person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {person.name}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {person.title} - {person.company}
                    </div>
                  </div>
                  <div className="hidden max-w-[220px] truncate text-xs text-slate-400 md:block">
                    {person.email}
                  </div>
                </label>
              );
            })}

            {filteredDirectory.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No one matches that search.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {selectedIds.size === 0
              ? "Select people to generate cards for"
              : `${selectedIds.size} ${
                  selectedIds.size === 1 ? "person" : "people"
                } selected`}
          </div>
          <button
            disabled={selectedIds.size === 0}
            onClick={onCreate}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Create {selectedIds.size || ""} Business Card
            {selectedIds.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatedPreview({
  mode,
  contact,
  onBack,
  onViewMobile,
  onStartOver,
}: {
  mode: CreatedMode;
  contact: BusinessCardContact;
  onBack: () => void;
  onViewMobile: () => void;
  onStartOver: () => void;
}) {
  const isBulk = mode === "bulk";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <IconGlyph name="arrowLeft" />
            Back to {isBulk ? "bulk selection" : "single form"}
          </button>

          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <IconGlyph name="check" className="text-3xl" />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Mock creation complete
              </div>
              <h3 className="text-2xl font-semibold text-slate-950">
                {isBulk
                  ? "Business Card QR batch is ready"
                  : "Business Card QR is ready"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                This is the handoff point after generation. In production it
                would save the dynamic card data, generate the QR image, and
                expose the public short URL.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryStat label="QR type" value="Business Card" />
            <SummaryStat
              label={isBulk ? "Cards generated" : "Short URL"}
              value={isBulk ? "3 selected" : "taliho.com/c/abc123"}
            />
            <SummaryStat
              label={isBulk ? "Export" : "Contact"}
              value={isBulk ? "PNG + SVG ZIP" : getFullName(contact)}
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onViewMobile}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <IconGlyph name="mobile" />
              View scanned mobile page
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              type="button"
            >
              <IconGlyph name={isBulk ? "download" : "qr"} />
              {isBulk ? "Download mock ZIP" : "Download mock QR"}
            </button>
            <button
              onClick={onStartOver}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Start over
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-64 w-64 items-center justify-center rounded-3xl bg-slate-950 p-5 shadow-inner">
            <MockQRCode />
          </div>
          <h4 className="text-lg font-semibold text-slate-950">
            {isBulk ? "Batch export preview" : "Business Card QR"}
          </h4>
          <p className="mt-2 text-sm text-slate-600">
            Scanning this would open the hosted card landing page.
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileLandingPreview({
  contact,
  onBack,
}: {
  contact: BusinessCardContact;
  onBack: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-105px)] bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.22),transparent_30%),linear-gradient(135deg,#e2e8f0,#f8fafc_45%,#fefce8)] px-5 py-8">
      <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur">
          <button
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <IconGlyph name="arrowLeft" />
            Back to previous step
          </button>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            Scanner experience
          </div>
          <h3 className="text-2xl font-semibold text-slate-950">
            Mobile landing page
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This is the mocked version of the `/c/:shortCode` page. The Save to
            Contacts button is a preview state toggle here, not a real vCard
            download.
          </p>
          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
            <div className="font-semibold text-white">Public URL preview</div>
            <div className="mt-1 font-mono text-brand-300">
              taliho.com/c/abc123
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <TalihoMobileCard
            contact={{ ...mockProcoreUser, ...contact }}
            logo={mockCompanyLogo}
          />
        </div>
      </div>
    </div>
  );
}

function TalihoMobileCard({
  contact,
  logo,
}: {
  contact: BusinessCardContact;
  logo?: ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  const fullName = getFullName(contact) || "Your name";
  const hasAddress = Boolean(contact.street || contact.city);
  const hasAnyDetails = Boolean(
    contact.mobile ||
      contact.workPhone ||
      contact.email ||
      contact.website ||
      hasAddress,
  );

  const quickActions: MobileAction[] = [];
  if (contact.mobile) {
    quickActions.push(
      {
        icon: "phone",
        label: "Call",
        href: `tel:${contact.mobile}`,
      },
      {
        icon: "message",
        label: "Text",
        href: `sms:${contact.mobile}`,
      },
    );
  }
  if (contact.email) {
    quickActions.push({
      icon: "mail",
      label: "Email",
      href: `mailto:${contact.email}`,
    });
  }

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="relative w-full max-w-[380px] rounded-[3rem] bg-black p-3 shadow-2xl">
      <div className="absolute left-1/2 top-3 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-black" />
      <div className="relative min-h-[720px] overflow-hidden rounded-[2.5rem] bg-white">
        <div className="flex items-center justify-between px-7 pb-1 pt-3 text-xs font-semibold text-slate-900">
          <span>9:41</span>
          <span className="tracking-widest">...</span>
        </div>
        <div className="px-6 pb-8 pt-4">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                <span className="text-[11px] font-bold text-white">T</span>
              </div>
              <span className="text-[11px] font-semibold tracking-[0.15em] text-slate-900">
                TALIHO
              </span>
            </div>
            <button className="text-slate-400 transition hover:text-slate-600">
              <IconGlyph name="share" />
            </button>
          </div>

          <div className="mb-7 text-center">
            {logo && <div className="mb-5 flex justify-center">{logo}</div>}
            <div className="text-2xl font-bold leading-tight text-slate-900">
              {fullName}
            </div>
            {contact.title && (
              <div className="mt-1.5 text-sm text-slate-600">
                {contact.title}
              </div>
            )}
            {contact.company && (
              <div className="text-sm text-slate-500">{contact.company}</div>
            )}
          </div>

          <button
            onClick={handleSave}
            className={`w-full rounded-2xl py-3.5 text-sm font-semibold transition-all ${
              saved
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "bg-slate-900 text-white shadow-lg shadow-slate-900/25 hover:bg-slate-800"
            }`}
          >
            {saved ? (
              <span className="flex items-center justify-center gap-2">
                <IconGlyph name="check" /> Added to Contacts
              </span>
            ) : (
              "Save to Contacts"
            )}
          </button>

          {quickActions.length > 0 && (
            <div
              className="mt-3 grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))`,
              }}
            >
              {quickActions.map((action) => (
                <MobileQuickAction
                  key={action.label}
                  icon={action.icon}
                  label={action.label}
                  href={action.href}
                />
              ))}
            </div>
          )}

          {hasAnyDetails ? (
            <div className="mt-8">
              <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Contact details
              </div>
              <div className="overflow-hidden rounded-2xl bg-slate-50">
                {contact.mobile && (
                  <MobileDetailRow
                    icon="phone"
                    label="Mobile"
                    value={contact.mobile}
                    action={`tel:${contact.mobile}`}
                  />
                )}
                {contact.workPhone && (
                  <MobileDetailRow
                    icon="phone"
                    label="Work"
                    value={contact.workPhone}
                    action={`tel:${contact.workPhone}`}
                  />
                )}
                {contact.email && (
                  <MobileDetailRow
                    icon="mail"
                    label="Email"
                    value={contact.email}
                    action={`mailto:${contact.email}`}
                  />
                )}
                {contact.website && (
                  <MobileDetailRow
                    icon="globe"
                    label="Website"
                    value={contact.website}
                    action={normalizeWebsiteHref(contact.website)}
                  />
                )}
                {hasAddress && (
                  <MobileDetailRow
                    icon="map"
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
            <div className="mt-8 rounded-2xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
              Contact details will appear here as the form fills in.
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="text-[10px] text-slate-400">
              Updated {contact.lastUpdated || "just now"} - Powered by Taliho
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  contact,
  logo,
  onClose,
}: {
  contact: BusinessCardContact;
  logo: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-50 rounded-full bg-white p-2 text-slate-600 shadow-lg transition hover:text-slate-900"
          aria-label="Close preview"
        >
          <IconGlyph name="x" />
        </button>
        <TalihoMobileCard contact={contact} logo={logo} />
      </div>
    </div>
  );
}

function FlowTile({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: IconName;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-md"
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900 ring-1 ring-slate-200 transition group-hover:bg-brand-100 group-hover:text-brand-800 group-hover:ring-brand-200">
        <IconGlyph name={icon} className="text-2xl" />
      </div>
      <h4 className="text-base font-semibold text-slate-950">{title}</h4>
      <p className="mt-2 min-h-12 text-sm leading-5 text-slate-600">
        {description}
      </p>
      <div className="mt-5 text-sm font-semibold text-brand-700">{action}</div>
    </button>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    </div>
  );
}

function MobileQuickAction({
  icon,
  label,
  href,
}: {
  icon: IconName;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 py-3 transition-colors hover:bg-slate-100 active:bg-slate-200"
    >
      <IconGlyph name={icon} className="text-xl text-slate-700" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </span>
    </a>
  );
}

function MobileDetailRow({
  icon,
  label,
  value,
  action,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  action?: string;
}) {
  const content = (
    <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3.5 last:border-b-0">
      <IconGlyph
        name={icon}
        className="mt-0.5 shrink-0 text-lg text-slate-400"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div className="break-words text-sm text-slate-800">{value}</div>
      </div>
    </div>
  );

  return action && typeof value === "string" ? (
    <a
      href={action}
      className="block transition-colors hover:bg-slate-100 active:bg-slate-200"
    >
      {content}
    </a>
  ) : (
    content
  );
}

function PreviewNavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function MockQRCode() {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const row = Math.floor(index / 11);
    const col = index % 11;
    const isFinder =
      (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3);
    const isFilled =
      isFinder ||
      (row * 7 + col * 5) % 4 === 0 ||
      (row + col) % 7 === 0 ||
      (row === 5 && col > 2 && col < 9);

    return (
      <div
        key={index}
        className={isFilled ? "rounded-sm bg-slate-950" : "bg-transparent"}
      />
    );
  });

  return (
    <div className="grid h-full w-full grid-cols-11 gap-1 rounded-2xl bg-white p-4">
      {cells}
    </div>
  );
}

function IconGlyph({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const iconByName: Record<IconName, string> = {
    phone: "bx bx-phone",
    mail: "bx bx-envelope",
    globe: "bx bx-globe",
    map: "bx bx-map",
    message: "bx bx-message-rounded",
    plus: "bx bx-plus",
    minus: "bx bx-minus",
    x: "bx bx-x",
    mobile: "bx bx-mobile-alt",
    check: "bx bx-check",
    share: "bx bx-share-alt",
    search: "bx bx-search",
    qr: "bx bx-qr",
    user: "bx bx-user",
    users: "bx bx-group",
    briefcase: "bx bx-briefcase",
    download: "bx bx-download",
    arrowLeft: "bx bx-left-arrow-alt",
  };

  return (
    <i aria-hidden="true" className={`${iconByName[name]} ${className}`} />
  );
}

function ProcoreIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-sm bg-orange-500 text-[10px] font-bold text-white ${className}`}
    >
      P
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function getFullName(contact: BusinessCardContact) {
  return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
}

function normalizeWebsiteHref(website: string) {
  if (/^https?:\/\//i.test(website)) {
    return website;
  }
  return `https://${website}`;
}
