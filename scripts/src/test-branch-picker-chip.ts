import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regression: BranchPicker chips ("Main plan", "Via Reykjavik", etc.) live
// inside a horizontal ScrollView. With `flexShrink` unset on `chip` and a
// tight `maxWidth: 200`, longer labels + price meta (e.g. "Via Reykjavik ·
// 2 flights · $535") get squashed / ellipsized.
//
// Fix relies on four style invariants in components/BranchPicker.tsx:
//   1. styles.chip declares `flexShrink: 0`        — scroll row can't
//                                                    compress chips
//   2. styles.chip's maxWidth is >= 240            — fits the common
//                                                    label + meta combo
//   3. styles.chipText declares `minWidth: 0`      — ellipsis works
//                                                    correctly when text
//                                                    wrapper has flexShrink
//   4. borderRadius <= paddingVertical + borderWidth — rounded corners stay
//                                                    inside the vertical
//                                                    padding band, so the
//                                                    pill boundary is a
//                                                    straight edge beside
//                                                    every text row and can
//                                                    never touch/clip the
//                                                    label or meta. A full
//                                                    pill (999) breaks this.
//
// Pinned with a static-source assertion (consistent with
// test-trip-meta-pills.ts) — Jest + react-test-renderer is overkill for
// these style props.

const file = resolve(
  __dirname,
  "../../artifacts/branchwing/components/BranchPicker.tsx",
);
const src = readFileSync(file, "utf8");

function block(name: string): string {
  const re = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m");
  const m = src.match(re);
  if (!m) {
    console.error(`FAIL: could not locate styles.${name} block`);
    process.exit(1);
  }
  return m[1];
}

const chip = block("chip");
const chipText = block("chipText");
const dot = block("dot");
const newBtn = block("newBtn");

const failures: string[] = [];

if (!/flexShrink:\s*0\b/.test(chip)) {
  failures.push(
    "styles.chip is missing `flexShrink: 0` — chips will compress in the " +
      "horizontal ScrollView and labels get squashed.",
  );
}

const maxWidthMatch = chip.match(/maxWidth:\s*(\d+)/);
if (!maxWidthMatch) {
  failures.push("styles.chip is missing a maxWidth cap.");
} else {
  const mw = Number(maxWidthMatch[1]);
  if (mw < 240) {
    failures.push(
      `styles.chip.maxWidth is ${mw}; needs to be >= 240 to fit common ` +
        'labels like "Via Reykjavik · 2 flights · $535" without ellipsis.',
    );
  }
}

if (!/minWidth:\s*0\b/.test(chipText)) {
  failures.push(
    "styles.chipText is missing `minWidth: 0` — required for ellipsis to " +
      "work correctly alongside flexShrink: 1.",
  );
}

// Boundary-safety: the rounded corner must stay inside the vertical padding
// band so the left/right edges are straight beside the text rows. If
// borderRadius exceeds paddingVertical + borderWidth, the pill curves into
// the label/meta and the clearance becomes content-height-dependent (i.e.
// inconsistent across chips).
const radiusMatch = chip.match(/borderRadius:\s*(\d+)/);
const padYMatch = chip.match(/paddingVertical:\s*(\d+)/);
const borderMatch = chip.match(/borderWidth:\s*(\d+)/);
if (!radiusMatch || !padYMatch || !borderMatch) {
  failures.push(
    "styles.chip needs literal borderRadius, paddingVertical and borderWidth " +
      "so the boundary-safety invariant can be verified.",
  );
} else {
  const radius = Number(radiusMatch[1]);
  const safeMax = Number(padYMatch[1]) + Number(borderMatch[1]);
  if (radius > safeMax) {
    failures.push(
      `styles.chip.borderRadius is ${radius} but must be <= paddingVertical + ` +
        `borderWidth (${safeMax}). Larger radii (e.g. a 999 pill) curve into ` +
        "the text rows and let the boundary touch/clip the label or meta.",
    );
  }
}

// Coherence: the swatch is a solid fill — a same-colour border just shrinks
// the visible dot under box-sizing: border-box and adds nothing.
if (/borderWidth:/.test(dot)) {
  failures.push(
    "styles.dot declares a borderWidth — the swatch should be a solid fill " +
      "with no border (a same-colour border only eats into the 8px dot).",
  );
}

// Coherence: the "New branch" affordance must share the chip's geometry so
// the row reads as one set (and inherits the same boundary-safety radius).
const chipRadius = chip.match(/borderRadius:\s*(\d+)/)?.[1];
const newRadius = newBtn.match(/borderRadius:\s*(\d+)/)?.[1];
if (chipRadius && newRadius && chipRadius !== newRadius) {
  failures.push(
    `styles.newBtn.borderRadius (${newRadius}) does not match styles.chip ` +
      `(${chipRadius}); keep them in lockstep so the picker row is coherent.`,
  );
}
const chipPadY = chip.match(/paddingVertical:\s*(\d+)/)?.[1];
const newPadY = newBtn.match(/paddingVertical:\s*(\d+)/)?.[1];
if (chipPadY && newPadY && chipPadY !== newPadY) {
  failures.push(
    `styles.newBtn.paddingVertical (${newPadY}) does not match styles.chip ` +
      `(${chipPadY}); the chip and New-branch button should be the same height.`,
  );
}

if (failures.length > 0) {
  console.error("FAIL: BranchPicker chip styles regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

console.log(
  "PASS: BranchPicker — flexShrink:0, maxWidth>=240, chipText.minWidth:0, " +
    "borderRadius<=paddingVertical+borderWidth, solid dot, newBtn matches chip",
);
