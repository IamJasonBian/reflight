import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regression: BranchPicker chips ("Main plan", "Via Reykjavik", etc.) live
// inside a horizontal ScrollView. With `flexShrink` unset on `chip` and a
// tight `maxWidth: 200`, longer labels + price meta (e.g. "Via Reykjavik ·
// 2 flights · $535") get squashed / ellipsized.
//
// Fix relies on three style invariants in components/BranchPicker.tsx:
//   1. styles.chip declares `flexShrink: 0`        — scroll row can't
//                                                    compress chips
//   2. styles.chip's maxWidth is >= 240            — fits the common
//                                                    label + meta combo
//   3. styles.chipText declares `minWidth: 0`      — ellipsis works
//                                                    correctly when text
//                                                    wrapper has flexShrink
//
// Pinned with a static-source assertion (consistent with
// test-trip-meta-pills.ts) — Jest + react-test-renderer is overkill for
// three style props.

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

if (failures.length > 0) {
  console.error("FAIL: BranchPicker chip styles regressed:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

console.log(
  "PASS: BranchPicker chip pins flexShrink:0, maxWidth>=240, chipText.minWidth:0",
);
