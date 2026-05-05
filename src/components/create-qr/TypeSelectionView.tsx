import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import {
  TYPES,
  TYPE_GROUP_LABELS,
  type TypeCard,
  type TypeGroup,
  type TypeId,
} from "./typeCatalog";

export interface TypeSelectionViewProps {
  onPick: (typeId: TypeId) => void;
}

const MODE_STORAGE_KEY = "taliho.createQR.typeMode";
const BROWSE_ORDER: TypeGroup[] = ["taliho", "procore", "simple"];

type Tone = "brand" | "accent" | "info";
const TONES: Record<
  Tone,
  { bg: string; ring: string; text: string; label: string }
> = {
  brand: {
    bg: "bg-brand-100",
    ring: "border-brand-200",
    text: "text-brand-700",
    label: "text-brand-700",
  },
  accent: {
    bg: "bg-accent-100",
    ring: "border-accent-200",
    text: "text-accent-700",
    label: "text-accent-700",
  },
  info: {
    bg: "bg-info-100",
    ring: "border-info-200",
    text: "text-info-700",
    label: "text-info-700",
  },
};

function groupTone(group: TypeGroup): Tone {
  if (group === "taliho") return "brand";
  if (group === "procore") return "accent";
  return "info";
}

interface ModuleDef {
  id: "m1" | "m2" | "m3";
  title: string;
  desc: string;
  icon: string;
  tone: Tone;
  typeIds: TypeId[];
}

function buildModules(): ModuleDef[] {
  return [
    {
      id: "m1",
      title: "Share Project Info on the Job Site",
      desc: "Drawings, files, collections — anything your crew needs to see.",
      icon: "bx bxs-buildings",
      tone: "brand",
      // Hero shows the V3 production modules: Taliho Code + the four
      // Procore cards + Hard Hat. Procore cards are always visible
      // (their flows handle the not-Procore-connected state
      // downstream); Inspections is marked `comingSoon` in the
      // catalog and renders disabled.
      typeIds: [
        "taliho-code",
        "procore-location",
        "procore-tool",
        "procore-drawing",
        "procore-inspections",
        "hard-hat",
      ],
    },
    {
      id: "m2",
      title: "Tag Tools or Equipment",
      desc: "Track a tool, a piece of equipment, or a whole fleet.",
      icon: "bx bxs-wrench",
      tone: "accent",
      typeIds: ["tool-tracker", "equipment-code", "qr-arrangement"],
    },
    {
      id: "m3",
      title: "Something More Simple",
      desc: "A URL, contact card, or quick-share code.",
      icon: "bx bxs-zap",
      tone: "info",
      typeIds: [
        "url",
        "vcard",
        "simple-wifi",
        "simple-text",
        "simple-email",
        "simple-call",
        "simple-sms",
        "simple-pdf",
        "simple-images",
        "simple-video",
        "simple-social",
      ],
    },
  ];
}

export default function TypeSelectionView({ onPick }: TypeSelectionViewProps) {
  const company = useSelector((state: RootState) => state.company);
  const isProcoreConnected = useMemo(() => {
    const id = company?.procoreCompanyID;
    return Boolean(id && Number(id) > 0);
  }, [company?.procoreCompanyID]);

  const [mode, setMode] = useState<"guided" | "browse">(() => {
    if (typeof window === "undefined") return "guided";
    try {
      const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
      return saved === "browse" ? "browse" : "guided";
    } catch {
      return "guided";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable in private mode — non-fatal.
    }
  }, [mode]);

  const [drilledModule, setDrilledModule] = useState<"m2" | "m3" | null>(null);

  const visibleBrowseGroups = useMemo(
    () =>
      isProcoreConnected
        ? BROWSE_ORDER
        : BROWSE_ORDER.filter((g) => g !== "procore"),
    [isProcoreConnected],
  );
  const [browseGroup, setBrowseGroup] = useState<TypeGroup>("taliho");
  useEffect(() => {
    if (!visibleBrowseGroups.includes(browseGroup)) {
      setBrowseGroup(visibleBrowseGroups[0] ?? "taliho");
    }
  }, [visibleBrowseGroups, browseGroup]);

  const modules = useMemo(() => buildModules(), []);

  const handleCardPick = (card: TypeCard) => {
    if (card.comingSoon) return;
    onPick(card.id);
  };

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 py-6">
      <GuidedBrowsePill
        mode={mode}
        onChange={(m) => {
          setMode(m);
          setDrilledModule(null);
        }}
      />

      <header className="mb-8 pr-44">
        <h2 className="text-2xl font-semibold text-gray-900">
          What are you tagging?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Pick a category, then a type. You can switch the view any time.
        </p>
      </header>

      {mode === "guided" ? (
        <GuidedHero
          modules={modules}
          isProcoreConnected={isProcoreConnected}
          drilledModule={drilledModule}
          onDrill={setDrilledModule}
          onCardPick={handleCardPick}
        />
      ) : (
        <BrowseView
          groups={visibleBrowseGroups}
          activeGroup={browseGroup}
          onGroupChange={setBrowseGroup}
          onCardPick={handleCardPick}
        />
      )}
    </div>
  );
}

/* ===================== Floating Guided / Browse pill ===================== */

function GuidedBrowsePill({
  mode,
  onChange,
}: {
  mode: "guided" | "browse";
  onChange: (m: "guided" | "browse") => void;
}) {
  return (
    <div
      className="absolute top-4 right-4 inline-flex bg-gray-900 text-white rounded-full p-1 shadow-lg z-20"
      data-testid="type-mode-pill"
    >
      <button
        type="button"
        onClick={() => onChange("guided")}
        className={`px-4 py-1.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 transition-colors ${
          mode === "guided"
            ? "bg-white text-gray-900"
            : "text-gray-300 hover:text-white"
        }`}
        data-testid="type-mode-guided"
      >
        <i className="bx bxs-compass" aria-hidden="true" />
        Guided
      </button>
      <button
        type="button"
        onClick={() => onChange("browse")}
        className={`px-4 py-1.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 transition-colors ${
          mode === "browse"
            ? "bg-white text-gray-900"
            : "text-gray-300 hover:text-white"
        }`}
        data-testid="type-mode-browse"
      >
        <i className="bx bx-list-ul" aria-hidden="true" />
        Browse
      </button>
    </div>
  );
}

/* ============================ Guided Hero ============================ */

function GuidedHero({
  modules,
  isProcoreConnected,
  drilledModule,
  onDrill,
  onCardPick,
}: {
  modules: ModuleDef[];
  isProcoreConnected: boolean;
  drilledModule: "m2" | "m3" | null;
  onDrill: (id: "m2" | "m3" | null) => void;
  onCardPick: (card: TypeCard) => void;
}) {
  const [m1, m2, m3] = modules;
  const drilled = drilledModule === "m2" ? m2 : drilledModule === "m3" ? m3 : null;

  return (
    <>
      <HeroModule
        m={m1}
        isProcoreConnected={isProcoreConnected}
        onCardPick={onCardPick}
      />

      {drilled ? (
        <DrilledModule
          m={drilled}
          onBack={() => onDrill(null)}
          onCardPick={onCardPick}
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <ModuleTileButton m={m2} onClick={() => onDrill("m2")} />
          <ModuleTileButton m={m3} onClick={() => onDrill("m3")} />
        </div>
      )}
    </>
  );
}

function HeroModule({
  m,
  isProcoreConnected,
  onCardPick,
}: {
  m: ModuleDef;
  isProcoreConnected: boolean;
  onCardPick: (card: TypeCard) => void;
}) {
  const tone = TONES[m.tone];
  const types = m.typeIds
    .map((id) => TYPES.find((t) => t.id === id))
    .filter((t): t is TypeCard => Boolean(t));
  return (
    <section
      className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 md:p-7 mb-6"
      data-testid="type-module-m1"
    >
      <div className="flex items-start gap-4 mb-5 flex-col md:flex-row">
        <div
          className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${tone.bg} ${tone.text} flex items-center justify-center shrink-0 border ${tone.ring}`}
        >
          <i className={`${m.icon} text-2xl md:text-3xl`} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div
            className={`text-[11px] uppercase tracking-wider ${tone.label} font-semibold`}
          >
            Most common
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-gray-900">
            {m.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">{m.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {types.map((type) => (
          <TypeTileCompact
            key={type.id}
            card={type}
            tone={tone}
            onPick={() => onCardPick(type)}
          />
        ))}
      </div>

      {!isProcoreConnected && (
        <p className="mt-4 text-xs text-gray-500 italic">
          Procore-linked types are visible above; connect Procore to use
          them.
        </p>
      )}
    </section>
  );
}

function ModuleTileButton({ m, onClick }: { m: ModuleDef; onClick: () => void }) {
  const tone = TONES[m.tone];
  const total = m.typeIds.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-4 h-full hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      data-testid={`type-module-${m.id}`}
    >
      <div
        className={`w-14 h-14 rounded-2xl ${tone.bg} ${tone.text} flex items-center justify-center border ${tone.ring}`}
      >
        <i className={`${m.icon} text-3xl`} aria-hidden="true" />
      </div>
      <div>
        <div className="text-lg font-semibold text-gray-900 leading-tight">
          {m.title}
        </div>
        <div className="text-sm text-gray-500 mt-1">{m.desc}</div>
      </div>
      <div
        className={`mt-auto pt-2 text-xs ${tone.label} font-semibold inline-flex items-center gap-1`}
      >
        {total} type{total === 1 ? "" : "s"}{" "}
        <i className="bx bx-chevron-right" aria-hidden="true" />
      </div>
    </button>
  );
}

function DrilledModule({
  m,
  onBack,
  onCardPick,
}: {
  m: ModuleDef;
  onBack: () => void;
  onCardPick: (card: TypeCard) => void;
}) {
  const tone = TONES[m.tone];
  const types = m.typeIds
    .map((id) => TYPES.find((t) => t.id === id))
    .filter((t): t is TypeCard => Boolean(t));
  return (
    <section className="mt-6" data-testid={`type-drilled-${m.id}`}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div
            className={`text-[11px] uppercase tracking-wider ${tone.label}`}
          >
            {m.title}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mt-0.5">
            Pick a type
          </h3>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          <i className="bx bx-left-arrow-alt" aria-hidden="true" /> Back
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((t) => (
          <TypeTile
            key={t.id}
            card={t}
            tone={tone}
            onPick={() => onCardPick(t)}
          />
        ))}
      </div>
    </section>
  );
}

/* ============================ Browse View ============================ */

function BrowseView({
  groups,
  activeGroup,
  onGroupChange,
  onCardPick,
}: {
  groups: TypeGroup[];
  activeGroup: TypeGroup;
  onGroupChange: (g: TypeGroup) => void;
  onCardPick: (card: TypeCard) => void;
}) {
  const activeTypes = TYPES.filter((t) => t.group === activeGroup);
  const tone = TONES[groupTone(activeGroup)];
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6"
      data-testid="type-browse"
    >
      <aside className="p-3 bg-gray-50/60 rounded-xl border border-gray-100 h-max">
        {groups.map((g) => {
          const active = g === activeGroup;
          const gtone = TONES[groupTone(g)];
          return (
            <button
              key={g}
              type="button"
              onClick={() => onGroupChange(g)}
              className={`w-full text-left rounded-xl px-3 py-3 mb-1.5 transition-colors ${
                active
                  ? "bg-white shadow-sm border border-gray-200"
                  : "hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg ${gtone.bg} ${gtone.text} flex items-center justify-center`}
                >
                  <i className="bx bx-folder" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm">
                    {TYPE_GROUP_LABELS[g]}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {TYPES.filter((t) => t.group === g).length} types
                  </div>
                </div>
                <i
                  className="bx bx-chevron-right text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </aside>
      <div>
        <div className="flex items-start gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-xl ${tone.bg} ${tone.text} flex items-center justify-center shrink-0`}
          >
            <i className="bx bx-info-circle text-2xl" aria-hidden="true" />
          </div>
          <div>
            <div
              className={`text-[11px] uppercase tracking-wider ${tone.label}`}
            >
              {TYPE_GROUP_LABELS[activeGroup]}
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              {TYPE_GROUP_LABELS[activeGroup]}
            </h3>
            <p className="text-sm text-gray-600">
              {activeTypes.length} type{activeTypes.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTypes.map((t) => (
            <TypeTile
              key={t.id}
              card={t}
              tone={tone}
              onPick={() => onCardPick(t)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =============================== Tiles =============================== */

function TypeTile({
  card,
  tone,
  onPick,
}: {
  card: TypeCard;
  tone: (typeof TONES)[Tone];
  onPick: () => void;
}) {
  const comingSoon = card.comingSoon;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-disabled={comingSoon}
      disabled={comingSoon}
      className={`relative text-left rounded-xl border border-gray-200 bg-white p-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        comingSoon
          ? "opacity-60 cursor-not-allowed"
          : "hover:-translate-y-0.5 hover:shadow-lg hover:border-brand-200"
      }`}
      data-testid={`type-card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`w-12 h-12 rounded-xl ${tone.bg} ${tone.text} flex items-center justify-center border ${tone.ring}`}
        >
          <i className={`${card.icon} text-2xl`} aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1.5">
          {card.isNew && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-brand-100 text-brand-700">
              New
            </span>
          )}
          {comingSoon && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 inline-flex items-center gap-1">
              <i className="bx bx-lock-alt" aria-hidden="true" />
              Coming soon
            </span>
          )}
        </div>
      </div>
      <h4 className="font-semibold text-gray-900 mt-4">{card.name}</h4>
      <p className="text-sm text-gray-600 mt-1 leading-snug">{card.tagline}</p>
      <div className="flex items-center gap-3 mt-4 text-[10px] uppercase tracking-wider text-gray-500">
        {card.supportsSingle && (
          <span className="inline-flex items-center gap-1">
            <i className="bx bx-qr-scan" aria-hidden="true" /> Single
          </span>
        )}
        {card.supportsBulk && (
          <span className="inline-flex items-center gap-1">
            <i className="bx bx-collection" aria-hidden="true" /> Bulk
          </span>
        )}
      </div>
    </button>
  );
}

function TypeTileCompact({
  card,
  tone,
  onPick,
}: {
  card: TypeCard;
  tone: (typeof TONES)[Tone];
  onPick: () => void;
}) {
  const comingSoon = card.comingSoon;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-disabled={comingSoon}
      disabled={comingSoon}
      className={`relative text-left rounded-xl border border-gray-200 bg-white p-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        comingSoon
          ? "opacity-60 cursor-not-allowed"
          : "hover:-translate-y-0.5 hover:shadow-md hover:border-brand-200"
      }`}
      data-testid={`type-card-${card.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${tone.bg} ${tone.text} flex items-center justify-center shrink-0`}
        >
          <i className={`${card.icon} text-xl`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm truncate">
              {card.name}
            </h4>
            {comingSoon && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 inline-flex items-center gap-0.5 shrink-0">
                <i className="bx bx-lock-alt" aria-hidden="true" /> Soon
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {card.tagline}
          </p>
        </div>
      </div>
    </button>
  );
}

