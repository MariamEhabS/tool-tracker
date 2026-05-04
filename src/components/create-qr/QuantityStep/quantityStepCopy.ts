/**
 * Centralized copy for the Quantity step cards (Stage 1 of the
 * Quantity Step Card Redesign). Single source of truth for both
 * `SingleQRCard` and `BulkQRCard` so card components stay free of
 * inline strings and the per-type tweaks identified as a v3.1
 * candidate can be applied here without touching either card.
 *
 * Five categories (Knowledge / Action / Logging / Identity / Project)
 * appear in both cards; only the per-card examples differ. Categories
 * are stored in display order so consumers can iterate the array
 * without reordering.
 */

// ─── Single card ─────────────────────────────────────────────────────────

export const SINGLE_KICKER = "Single QR Code";

/**
 * The headline renders as two phrases — `lead` in regular weight,
 * `counterpoint` in italic + amber-700. Card components compose them
 * with the right typographic treatment.
 */
export const SINGLE_HEADLINE = {
  lead: "One code.",
  counterpoint: "One purpose.",
} as const;

export const SINGLE_LEAD =
  "A Single QR Code is a focused tap — one code, one destination, one purpose. The most flexible code in your toolkit. Print it, mount it, share it. Useful any time you want a single scan to open the right resource for one specific thing — whether that's a piece of equipment, a project document, an action you want a worker to take, or your own contact card.";

export const SINGLE_CTA_LABEL = "Create a Single QR Code";

// ─── Bulk card ───────────────────────────────────────────────────────────

export const BULK_KICKER = "Bulk QR Codes";

export const BULK_HEADLINE = {
  lead: "Many codes.",
  counterpoint: "One pass.",
} as const;

export const BULK_LEAD =
  "Bulk QR Codes are exactly what they sound like — many codes generated together, in one pass. Same flexibility as Single, just at scale. Paste from a spreadsheet to outfit a new crew, mass-tag every piece of equipment on a job, generate a code for every drawing or submittal in a project, or pre-print a stack before site kickoff. The mental model is identical to Single — pick the kind of destination — but the volume changes.";

export const BULK_CTA_LABEL = "Create Bulk QR Codes";

// ─── Category framework (locked) ─────────────────────────────────────────

export const CATEGORY_KEYS = [
  "knowledge",
  "action",
  "logging",
  "identity",
  "project",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface CategoryDefinition {
  key: CategoryKey;
  label: string;
  /**
   * Tailwind palette token name for the small uppercase label —
   * resolved to the matching `text-*-700` class by CategoryRow's
   * lookup. Locked at amber-700 / green-700 / indigo-700 / violet-700
   * / teal-700 across both cards.
   */
  colorToken:
    | "amber-700"
    | "green-700"
    | "indigo-700"
    | "violet-700"
    | "teal-700";
}

export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  { key: "knowledge", label: "Knowledge", colorToken: "amber-700" },
  { key: "action", label: "Action", colorToken: "green-700" },
  { key: "logging", label: "Logging", colorToken: "indigo-700" },
  { key: "identity", label: "Identity", colorToken: "violet-700" },
  { key: "project", label: "Project", colorToken: "teal-700" },
];

export interface CategoryContent {
  /** Comma-separated examples list — rendered bold. */
  examples: string;
  /** Tagline rendered after the em-dash; lower-emphasis. */
  description: string;
}

export const SINGLE_CATEGORY_CONTENT: Record<CategoryKey, CategoryContent> = {
  knowledge: {
    examples: "SOPs, manuals, equipment specs, safety briefings",
    description: "knowledge at the point of need.",
  },
  action: {
    examples: "Worker sign-ins, inspections, close-out sign-offs",
    description: "capture in the field.",
  },
  logging: {
    examples: "Filter changes, daily readings, condition logs",
    description: "replace clipboards entirely.",
  },
  identity: {
    examples: "V-cards, personal QRs, drawing references",
    description: "quick-share codes for people.",
  },
  project: {
    examples: "Submittals, RFIs, MSDS, drawings, and more",
    description: "project-level documents one tap away.",
  },
};

export const BULK_CATEGORY_CONTENT: Record<CategoryKey, CategoryContent> = {
  knowledge: {
    examples: "SOP libraries, manual sets, safety briefing packets",
    description: "a code per document, all at once.",
  },
  action: {
    examples: "Sign-in stations across a project, inspection points by area",
    description: "one code per location.",
  },
  logging: {
    examples: "One log per piece of equipment, one per filter, one per zone",
    description: "entire fleet covered.",
  },
  identity: {
    examples: "V-cards for the whole team, badges for every worker",
    description: "one pass, ready to print.",
  },
  project: {
    examples: "Every submittal, every RFI, every drawing, every MSDS",
    description: "full project library, codified.",
  },
};
