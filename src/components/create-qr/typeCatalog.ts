/**
 * @fileoverview Catalog of QR code Types for the Type-first Create QR flow.
 * Single source of truth for the Step 1 Type page: identity, grouping,
 * display copy, icon, quantity support, and the "What is this?" detail
 * content shown in the expander.
 *
 * Copy is verbatim from PRD §5.
 */

import { icons } from "@/lib/icons";

export type TypeId =
  | "tool-tracker"
  | "taliho-code"
  | "equipment-code"
  | "qr-arrangement"
  | "procore-location"
  | "procore-inspections"
  | "procore-tool"
  | "procore-drawing"
  | "vcard"
  | "url"
  | "simple-wifi"
  | "simple-text"
  | "simple-email"
  | "simple-call"
  | "simple-sms"
  | "simple-pdf"
  | "simple-images"
  | "simple-video"
  | "simple-social";

export type TypeGroup = "taliho" | "procore" | "simple";

export interface TypeDetail {
  /** Short descriptive sentence shown first in the expander. */
  oneLiner: string;
  /** Bullet list shown under "Best for". */
  bestFor: string[];
  /** Ordered steps shown under "How it works". */
  how: string[];
  /** Optional list of complementary features shown under "Pairs well with". */
  pairsWellWith?: string[];
}

export interface TypeCard {
  id: TypeId;
  group: TypeGroup;
  name: string;
  tagline: string;
  /** Boxicon class string, e.g. `"bx bx-qr"` or `"bx bxs-wrench"`. */
  icon: string;
  supportsSingle: boolean;
  supportsBulk: boolean;
  comingSoon: boolean;
  isNew: boolean;
  detail: TypeDetail;
}

export const TYPES: readonly TypeCard[] = [
  {
    id: "tool-tracker",
    group: "taliho",
    name: "Tool Tracker",
    tagline: "Track who has a tool and where it is.",
    icon: "bx bxs-wrench",
    supportsSingle: true,
    supportsBulk: true,
    comingSoon: false,
    isNew: true,
    detail: {
      oneLiner:
        "A QR code that gets affixed to each tool. Scanning signs the tool out to a field tech and signs it back in when returned — with GPS, timestamp, and a verified handoff record.",
      bestFor: [
        "Power tools, ladders, testing instruments, survey equipment",
        "Any crew where tools walk off without a clear trail",
        "Project managers who want an audit trail without a full asset system",
      ],
      how: [
        "PM creates a Tool Tracker code and prints the label.",
        "Label gets stuck on the tool.",
        "Field tech scans with any phone — no login required.",
        "Tech confirms their name + phone (we remember the device).",
        "Scan again on return to sign the tool back in.",
      ],
      pairsWellWith: [
        "Optional 4-digit PIN or Smart PIN (last 4 of phone)",
        "Due dates and overdue notifications",
        "Field-to-field handoffs with notification to prior custodian",
      ],
    },
  },
  {
    id: "taliho-code",
    group: "taliho",
    name: "Taliho Code",
    tagline: "Point to a file, a link, or a whole collection of items.",
    icon: icons.qr,
    supportsSingle: true,
    supportsBulk: true,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "Taliho's flagship code. A single QR can point to one file, redirect to a URL, or display a collection of items — and the PM can change what it points to anytime without reprinting the code.",
      bestFor: [
        "Assets, equipment, rooms, and file-sharing workflows",
        "Quick landing pages with mixed content",
        "Anything you might need to re-point to a different destination later",
      ],
      how: [
        "Share a PDF, image, or document with one scan.",
        "Open any web link.",
        "Display a curated collection of items.",
        "Add optional password protection.",
        "Track every scan and who opened what.",
      ],
      pairsWellWith: [
        "Auto-redirect — skip the landing page and open the content directly.",
        "Procore Fetch — add individual Procore items to a Taliho Code.",
      ],
    },
  },
  {
    id: "equipment-code",
    group: "taliho",
    name: "Equipment Code",
    tagline: "Tag equipment with sequential QR codes.",
    icon: "bx bxs-package",
    supportsSingle: false,
    supportsBulk: true,
    comingSoon: false,
    isNew: true,
    detail: {
      oneLiner:
        "Generate a series of equipment codes with a shared prefix — ideal for tagging rental equipment, fleet vehicles, or numbered inventory.",
      bestFor: [
        "Numbered equipment fleets (AHU-1 through AHU-100)",
        "Inventory that needs a human-readable label under the QR",
        "Large equipment lists already in a spreadsheet",
      ],
      how: [
        "Choose a method: Prefix + Quantity, CSV upload, or manual entry.",
        "Taliho generates the code series and prints a sheet.",
        "Apply to equipment. Scans track location and scan history.",
      ],
    },
  },
  {
    id: "qr-arrangement",
    group: "taliho",
    name: "QR Arrangement",
    tagline: "Group multiple codes into a single printable layout.",
    icon: "bx bxs-grid",
    supportsSingle: false,
    supportsBulk: true,
    comingSoon: false,
    isNew: true,
    detail: {
      oneLiner:
        "Create a sheet with multiple QR codes arranged in a grid — for printing onto a single page, binder, or posted on-site.",
      bestFor: [
        "Tool cages with many tagged items on one board",
        "Job-site signage that bundles multiple codes",
        "Document control binders with codes per drawing",
      ],
      how: [
        "Assorted Group: mix different types of QR codes into one collection.",
        "Procore Drawings: generate a sheet of drawing codes in one operation.",
      ],
    },
  },
  {
    id: "procore-location",
    group: "procore",
    name: "Procore Location",
    tagline: "Attach a QR to a Procore location.",
    icon: icons.mapPin,
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "A QR code tied to a Procore location (floor, room, zone). Scanning surfaces all documents and records Procore has filed against that location.",
      bestFor: [
        "Labeling rooms, floors, or site zones",
        "Quick on-site access to the Procore location record",
        "Giving trades the documents attached to where they're standing",
      ],
      how: [
        "Pick a Procore location from your connected project.",
        "Taliho generates a code bound to that location's ID.",
        "Print and post on-site. Scans open the location's Procore page.",
      ],
    },
  },
  {
    id: "procore-inspections",
    group: "procore",
    name: "Procore Inspections",
    tagline: "Scan to start or view an inspection.",
    icon: "bx bxs-clipboard",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR code tied to a Procore inspection or inspection template. Scanning jumps directly into the inspection flow on the field tech's phone.",
      bestFor: [
        "Pre-installation and quality inspections",
        "Safety checks that repeat at the same location",
        "Closing the gap between finding an issue and logging it",
      ],
      how: [
        "Choose a Procore inspection or template.",
        "Taliho generates a QR bound to that inspection.",
        "Scans open the Procore inspection flow directly.",
      ],
    },
  },
  {
    id: "procore-tool",
    group: "procore",
    name: "Procore Tool",
    tagline: "Link to RFIs, Submittals, or any Procore tool.",
    icon: icons.wrench,
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "A QR code that opens a specific Procore tool — RFIs, Submittals, Punch List, Observations, or any other tool on your project.",
      bestFor: [
        "Posting an RFI list at the trailer",
        "Giving the field quick access to open submittals",
        "Punch-list workflows where techs scan to see what's outstanding",
      ],
      how: [
        "Choose the Procore tool and filters.",
        "Taliho generates a QR that opens that filtered view.",
        "Scans open the tool in the Procore mobile or web app.",
      ],
    },
  },
  {
    id: "procore-drawing",
    group: "procore",
    name: "Procore Drawing(s)",
    tagline: "One code or many — point to a Procore drawing.",
    icon: icons.image,
    supportsSingle: true,
    supportsBulk: true,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "A QR code that opens a specific Procore drawing. Single mode makes one code for one drawing. Bulk mode generates a sheet of codes across a whole drawing set.",
      bestFor: [
        "Posting the latest drawing revision on-site",
        "Drawing-set rollouts where every sheet gets its own code",
        "Replacing paper drawing logs with scan-to-view",
      ],
      how: [
        "Single: pick one drawing.",
        "Bulk: pick a drawing set, generate a code per sheet.",
        "Scans always resolve to the current drawing revision in Procore.",
      ],
    },
  },
  {
    id: "vcard",
    group: "simple",
    name: "V-Card",
    tagline: "Share contact info with one scan.",
    icon: "bx bxs-contact",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "A digital business card. Scanning saves the contact directly to the scanner's phone — name, title, company, phone, email, website.",
      bestFor: [
        "On the back of a business card or nameplate",
        "Trailer signage so subcontractors can save the super's contact",
        "Anywhere you hand out contact info repeatedly",
      ],
      how: [
        "Enter the contact details.",
        "Taliho generates a vCard QR.",
        "Scans prompt the phone to save the contact.",
      ],
    },
  },
  {
    id: "url",
    group: "simple",
    name: "URL",
    tagline: "Point to any URL you choose.",
    icon: "bx bxs-link",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: false,
    isNew: false,
    detail: {
      oneLiner:
        "The simplest QR code: a single URL. Enter a web address and get a code that opens it when scanned.",
      bestFor: [
        "One-off links that don't belong in any other system",
        "External vendor portals, survey forms, or microsites",
        "Sharing a quick link without setting up a full Taliho Code",
      ],
      how: [
        "Enter the URL.",
        "Taliho generates a standard QR.",
        "Scans open the link in the phone's browser.",
      ],
    },
  },
  {
    id: "simple-wifi",
    group: "simple",
    name: "Wi-Fi",
    tagline: "Share a trailer or jobsite Wi-Fi credential.",
    icon: "bx bx-wifi",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "Generate a Wi-Fi QR that auto-connects the scanner's phone to the network you specify.",
      bestFor: [
        "Trailer break rooms and meeting spaces",
        "Client visits and subcontractor onboarding",
        "Temporary site credentials that change per project",
      ],
      how: [
        "Enter the SSID, password, and security type.",
        "Taliho generates a Wi-Fi QR.",
        "Scans prompt the phone to auto-connect.",
      ],
    },
  },
  {
    id: "simple-text",
    group: "simple",
    name: "Text",
    tagline: "Display a short text message when scanned.",
    icon: "bx bxs-message-rounded",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR code that reveals a plain text message — no website, no redirect, just text on the screen.",
      bestFor: [
        "Short instructions or reminders",
        "Safety notices and jobsite rules",
        "Any message that shouldn't require a network",
      ],
      how: [
        "Type the message you want to display.",
        "Taliho generates the QR.",
        "Scans show the text directly on the scanner's phone.",
      ],
    },
  },
  {
    id: "simple-email",
    group: "simple",
    name: "E-mail",
    tagline: "Start a pre-addressed email when scanned.",
    icon: "bx bxs-envelope",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens the scanner's email app with recipient, subject, and body pre-filled.",
      bestFor: [
        "Support intake forms posted on-site",
        "Quick contact for a specific trade lead",
        "Feedback requests with a pre-written subject",
      ],
      how: [
        "Enter the recipient, subject, and body.",
        "Taliho generates the QR.",
        "Scans open the phone's email app with everything pre-filled.",
      ],
    },
  },
  {
    id: "simple-call",
    group: "simple",
    name: "Call",
    tagline: "Dial a phone number when scanned.",
    icon: "bx bxs-phone",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that prompts the phone to call a specific number the moment it's scanned.",
      bestFor: [
        "Emergency or after-hours contact posters",
        "Quick-call to the site super or safety officer",
        "Vendor support lines posted near equipment",
      ],
      how: [
        "Enter the phone number.",
        "Taliho generates the QR.",
        "Scans open the dialer with the number ready.",
      ],
    },
  },
  {
    id: "simple-sms",
    group: "simple",
    name: "SMS",
    tagline: "Open an SMS thread with a pre-filled message.",
    icon: "bx bxs-chat",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens the scanner's text app with a recipient and message ready to send.",
      bestFor: [
        "Quick check-in texts to the super",
        "Incident reporting with a pre-written opener",
        "Text-based RSVP or confirmation flows",
      ],
      how: [
        "Enter the number and message.",
        "Taliho generates the QR.",
        "Scans open SMS with the message pre-filled.",
      ],
    },
  },
  {
    id: "simple-pdf",
    group: "simple",
    name: "PDF",
    tagline: "Link directly to a PDF file.",
    icon: "bx bxs-file-pdf",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens a specific PDF — upload once, and scans download or view it instantly.",
      bestFor: [
        "Safety data sheets at the point of use",
        "Equipment manuals attached to the equipment",
        "Spec sheets or cut sheets on a jobsite",
      ],
      how: [
        "Upload the PDF.",
        "Taliho generates the QR.",
        "Scans open the PDF directly.",
      ],
    },
  },
  {
    id: "simple-images",
    group: "simple",
    name: "Images",
    tagline: "Link to an image or simple gallery.",
    icon: "bx bxs-image",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens one image or a small gallery — no Procore required.",
      bestFor: [
        "Before/after shots at a specific location",
        "Reference images for an install",
        "Client walkthrough photo links",
      ],
      how: [
        "Upload one or more images.",
        "Taliho generates the QR.",
        "Scans open the image or gallery on the scanner's phone.",
      ],
    },
  },
  {
    id: "simple-video",
    group: "simple",
    name: "Video",
    tagline: "Link to a video clip.",
    icon: "bx bxs-video",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens a hosted video — training clips, install walkthroughs, or safety briefings.",
      bestFor: [
        "Install-training videos next to the equipment",
        "Safety briefings at site entry",
        "Vendor demos or product tutorials",
      ],
      how: [
        "Upload or link to the video.",
        "Taliho generates the QR.",
        "Scans open the video player on the scanner's phone.",
      ],
    },
  },
  {
    id: "simple-social",
    group: "simple",
    name: "Social Media",
    tagline: "Point to a social profile or link tree.",
    icon: "bx bxs-share-alt",
    supportsSingle: true,
    supportsBulk: false,
    comingSoon: true,
    isNew: false,
    detail: {
      oneLiner:
        "A QR that opens a social profile or a short link-tree page with several profiles.",
      bestFor: [
        "Company swag and business cards",
        "Trade-show booths and event materials",
        "Connecting trades to the company's channels",
      ],
      how: [
        "Pick a platform or list several.",
        "Taliho generates the QR.",
        "Scans open the profile in the scanner's app or browser.",
      ],
    },
  },
];

/** Returns the TypeCard for a given id, or null if not found. */
export function getTypeById(id: TypeId | null | undefined): TypeCard | null {
  if (!id) return null;
  return TYPES.find((t) => t.id === id) ?? null;
}

/** Group display labels for the Step 1 section headers. */
export const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
  taliho: "Power Codes",
  procore: "Procore",
  simple: "Simple Codes",
};
