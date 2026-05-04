import type { CSSProperties } from "react";

/**
 * Decorative QR motif for `BulkQRCard` (Quantity Step Card Redesign
 * Stage 1). Three offset rotated mini-tiles suggest a stack — same
 * dark + amber treatment as `QRMotifSingle`, smaller per-tile
 * (86×86), with subtle rotations (-6° / +2° / +8°) and z-index
 * layering. The middle tile is at 90% opacity to deepen the stack
 * effect.
 *
 * Component is `aria-hidden`. Each child mini-tile uses a unique
 * 7×7 dot pattern so the stack doesn't read as three identical
 * copies.
 */

// 7×7 = 49 cells per tile, three distinct patterns. Patterns match
// the AFTER mockup so the stack visually matches the contract.
const PATTERN_T1: readonly boolean[] = [
  true,  false, true,  true,  false, true,  true,
  false, true,  false, true,  true,  false, true,
  true,  true,  true,  false, true,  true,  false,
  true,  false, true,  true,  true,  false, true,
  false, true,  true,  false, true,  true,  true,
  true,  true,  false, true,  false, true,  true,
  true,  false, true,  true,  true,  true,  false,
];

const PATTERN_T2: readonly boolean[] = [
  true,  true,  false, true,  false, true,  true,
  false, true,  true,  false, true,  true,  false,
  true,  false, true,  true,  true,  false, true,
  true,  true,  false, true,  false, true,  true,
  false, true,  true,  false, true,  true,  true,
  true,  true,  false, true,  true,  false, true,
  true,  false, true,  true,  false, true,  true,
];

const PATTERN_T3: readonly boolean[] = [
  true,  false, true,  true,  true,  false, true,
  false, true,  false, true,  false, true,  true,
  true,  true,  true,  false, true,  true,  false,
  true,  false, true,  true,  true,  false, true,
  false, true,  false, true,  true,  true,  true,
  true,  true,  true,  false, false, true,  true,
  true,  false, true,  true,  true,  true,  false,
];

const TILE_BACKGROUND: CSSProperties = {
  background: "linear-gradient(140deg, #1f2937, #111827)",
  boxShadow: "0 8px 16px -6px rgba(17,24,39,.4)",
};

const HIGHLIGHT_OVERLAY: CSSProperties = {
  background:
    "radial-gradient(circle at 80% 0%, rgba(251,191,36,.28), transparent 60%)",
};

const MINI_CORNER: CSSProperties = {
  width: 18,
  height: 18,
  border: "3px solid #ffffff",
  borderRadius: 4,
  background: "#111827",
};

const MINI_CORNER_INNER: CSSProperties = {
  width: 6,
  height: 6,
  background: "#ffffff",
  borderRadius: 1,
};

const DOT_ON: CSSProperties = { background: "rgba(255,255,255,.92)" };
const DOT_OFF: CSSProperties = { background: "transparent" };

interface MiniTileProps {
  pattern: readonly boolean[];
  /** Position within the 120×120 stack container. */
  offsetTop: number;
  offsetLeft: number;
  /** Stacking order — lower z-index sits behind. */
  zIndex: number;
  /** Subtle rotation (-6 / +2 / +8 in the locked design). */
  rotateDeg: number;
  /** Optional opacity override for the middle tile. */
  opacity?: number;
  testIdSuffix: "t1" | "t2" | "t3";
}

function MiniTile({
  pattern,
  offsetTop,
  offsetLeft,
  zIndex,
  rotateDeg,
  opacity = 1,
  testIdSuffix,
}: MiniTileProps) {
  return (
    <div
      className="absolute w-[86px] h-[86px] rounded-[14px] overflow-hidden border-2 border-white"
      style={{
        ...TILE_BACKGROUND,
        top: offsetTop,
        left: offsetLeft,
        zIndex,
        opacity,
        transform: `rotate(${rotateDeg}deg)`,
      }}
      data-testid={`qr-motif-stack-tile-${testIdSuffix}`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={HIGHLIGHT_OVERLAY}
      />

      <span
        className="absolute"
        style={{ ...MINI_CORNER, top: 8, left: 8 }}
      />
      <span
        className="absolute"
        style={{ ...MINI_CORNER_INNER, top: 14, left: 14 }}
      />
      <span
        className="absolute"
        style={{ ...MINI_CORNER, top: 8, right: 8 }}
      />
      <span
        className="absolute"
        style={{ ...MINI_CORNER_INNER, top: 14, right: 14 }}
      />
      <span
        className="absolute"
        style={{ ...MINI_CORNER, bottom: 8, left: 8 }}
      />
      <span
        className="absolute"
        style={{ ...MINI_CORNER_INNER, bottom: 14, left: 14 }}
      />

      <div
        className="absolute grid grid-cols-7 grid-rows-7 gap-[2px]"
        style={{ inset: 10 }}
        data-testid={`qr-motif-stack-tile-${testIdSuffix}-grid`}
      >
        {pattern.map((on, i) => (
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

export default function QRMotifStack() {
  return (
    <div
      className="relative w-[120px] h-[120px] shrink-0"
      aria-hidden="true"
      data-testid="qr-motif-stack"
    >
      <MiniTile
        pattern={PATTERN_T1}
        offsetTop={0}
        offsetLeft={0}
        zIndex={1}
        rotateDeg={-6}
        testIdSuffix="t1"
      />
      <MiniTile
        pattern={PATTERN_T2}
        offsetTop={12}
        offsetLeft={16}
        zIndex={2}
        rotateDeg={2}
        opacity={0.9}
        testIdSuffix="t2"
      />
      <MiniTile
        pattern={PATTERN_T3}
        offsetTop={26}
        offsetLeft={32}
        zIndex={3}
        rotateDeg={8}
        testIdSuffix="t3"
      />
    </div>
  );
}
