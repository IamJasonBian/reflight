import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regression: trip-detail header has 4 meta pills:
//   `<n> branches` · `<dur> window` · `<dur> airborne` · `<price> total`
// On narrow iPhone widths the default `md` pill size makes the 4th pill
// wrap to a second line and look squished. They must stay `size="sm"`
// so all four fit on one row.
//
// We pin this with a static-source assertion (no test runner needed) —
// standing up Jest + react-test-renderer for one prop is overkill.

const file = resolve(
  __dirname,
  "../../artifacts/branchwing/app/trip/[id].tsx",
);
const src = readFileSync(file, "utf8");

const metaRowMatch = src.match(/<View style=\{styles\.metaRow\}>[\s\S]*?<\/View>/);
if (!metaRowMatch) {
  console.error("FAIL: could not locate the metaRow <View> in trip/[id].tsx");
  process.exit(1);
}

const pillCount = (metaRowMatch[0].match(/<Pill\b/g) ?? []).length;
const smCount = (metaRowMatch[0].match(/size="sm"/g) ?? []).length;

if (pillCount !== 4) {
  console.error(
    `FAIL: expected 4 <Pill> in metaRow, found ${pillCount}. ` +
      "If the design changed, update this test.",
  );
  process.exit(1);
}
if (smCount !== 4) {
  console.error(
    `FAIL: ${smCount}/${pillCount} metaRow pills declare size="sm".\n` +
      "      Without it, 4 pills overflow / wrap on iPhone widths.",
  );
  process.exit(1);
}

console.log(`PASS: all ${pillCount} metaRow pills pin size="sm"`);
