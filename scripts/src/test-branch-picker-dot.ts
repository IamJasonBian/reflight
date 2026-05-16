import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regression: in BranchPicker, the colored branch dot must declare
// `flexShrink: 0` so iOS doesn't compress it down to 0px when 4+
// branches force the chip's flex children to share constrained space.
//
// We pin this with a static-source assertion (no test runner needed)
// because the dot has no role/text and isn't queryable from a render
// tree without standing up Jest + react-test-renderer just for this.

const file = resolve(
  __dirname,
  "../../artifacts/branchwing/components/BranchPicker.tsx",
);
const src = readFileSync(file, "utf8");

const dotBlock = src.match(/dot:\s*\{[^}]*\}/);
if (!dotBlock) {
  console.error("FAIL: could not locate `dot:` style block in BranchPicker.tsx");
  process.exit(1);
}

if (!/flexShrink:\s*0\b/.test(dotBlock[0])) {
  console.error(
    "FAIL: BranchPicker `dot` style is missing `flexShrink: 0`.\n" +
      "      Re-add it — without it, iOS shrinks the dot to 0px when 4+\n" +
      "      branches squeeze the chip row.\n\n" +
      "      Found block:\n" +
      dotBlock[0],
  );
  process.exit(1);
}

console.log("PASS: BranchPicker dot style pins flexShrink: 0");
