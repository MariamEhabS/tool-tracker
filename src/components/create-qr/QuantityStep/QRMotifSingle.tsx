import type { CSSProperties } from "react";

/**
 * Decorative QR motif for `SingleQRCard` (Quantity Step Card Redesign
 * Stage 1). Architectural single-tile look — 120×120, dark gradient,
 * amber radial highlight, three corner registration marks, 9×9 grid
 * of dots. The pattern is illustrative; it doesn't scan.
 *
 * Component is `aria-hidden` and contains no text — screen readers
 * skip it entirely. Heavy use of inline `style` props because the
 * gradients, shadows, and exact pixel offsets aren't worth expressing
 * as Tailwind arbitrary-value classes; layout/sizing stays in
 * Tailwind for consistency.
 */

// 9×9 = 81 cells. Pattern matches the AFTER mockup exactly so the
// rendered DOM lines up with the visual contract. `false` = transparent.
const DOT_PATTERN: readonly boolean[] = [
  // row 1
  true,  false, true,  true,  false, true,  false, true,  true,
  // row 2
  false, true,  false, true,  true,  false, true,  true,  false,
  // row 3
  true,  true,  true,  false, true,  true,  false, true,  true,
  // row 4
  true,  false, true,  true,  true,  false, true,  true,  false,
  // row 5
  false, true,  true,  false, true,  true,  true,  false, true,
  // row 6
  true,  true,  false, true,  false, true,  true,  true,  true,
  // row 7
  true,  false, true,  true,  true,  true,  false, true,  true,
  // row 8
  true,  true,  true,  false, true,  true,  true,  false, true,
  // row 9
  false, true,  false, true,  true,  false, true,  true,  true,
];

const TILE_BACKGROUND: CSSProperties = {
  background: "linear-gradient(140deg, #1f2937, #111827)",
  boxShadow: "0 14px 28px -10px rgba(17,24,39,.4)",
};

const HIGHLIGHT_OVERLAY: CSSProperties = {
  background:
    "radial-gradient(circle at 80% 0%, rgba(251,191,36,.32), transparent 60%)",
};

const CORNER: CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid #ffffff",
  borderRadius: 5,
  background: "#111827",
};

const CORNER_INNER: CSSProperties = {
  width: 10,
  height: 10,
  background: "#ffffff",
  borderRadius: 1,
};

const DOT_ON: CSSProperties = { background: "rgba(255,255,255,.92)" };
const DOT_OFF: CSSProperties = { background: "transparent" };

export default function QRMotifSingle() {
  return (
    <div
      className="relative w-[120px] h-[120px] rounded-2xl overflow-hidden shrink-0"
      style={TILE_BACKGROUND}
      aria-hidden="true"
      data-testid="qr-motif-single"
    >
      {/* Amber radial highlight, upper-right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={HIGHLIGHT_OVERLAY}
      />

      {/* Three corner registration marks (corner + inner registration center) */}
      <span
        className="absolute"
        style={{ ...CORNER, top: 14, left: 14 }}
      />
      <span
        className="absolute"
        style={{ ...CORNER_INNER, top: 23, left: 23 }}
      />
      <span
        className="absolute"
        style={{ ...CORNER, top: 14, right: 14 }}
      />
      <span
        className="absolute"
        style={{ ...CORNER_INNER, top: 23, right: 23 }}
      />
      <span
        className="absolute"
        style={{ ...CORNER, bottom: 14, left: 14 }}
      />
      <span
        className="absolute"
        style={{ ...CORNER_INNER, bottom: 23, left: 23 }}
      />

      {/* 9×9 dot grid, inset 16px from the tile edges */}
      <div
        className="absolute grid grid-cols-9 grid-rows-9 gap-[2px]"
        style={{ inset: 16 }}
        data-testid="qr-motif-single-grid"
      >
        {DOT_PATTERN.map((on, i) => (
          <span
            key={i}
            className="rounded-[2px]"
            style={on ? DOT_ON : DOT_OFF}
          />
        ))}
      </div>
    </div>
  );
}
