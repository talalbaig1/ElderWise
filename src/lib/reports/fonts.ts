import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

/**
 * Load report TTFs as module-adjacent assets (not process.cwd()/public alone).
 * Tries import.meta.url first (bundled/traced), then cwd fallback for local.
 * Verify on deployed preview — local success alone is not enough.
 */
function loadFontDataUri(filename: string): string {
  const adjacent = join(dirname(fileURLToPath(import.meta.url)), "fonts", filename);
  let buf: Buffer;
  try {
    buf = readFileSync(adjacent);
  } catch {
    buf = readFileSync(join(process.cwd(), "src/lib/reports/fonts", filename));
  }
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

let registered = false;

/** Latin + Devanagari. Arabic shaping/bidi is unsupported by @react-pdf — known limitation. */
export function registerReportFonts() {
  if (registered) return;

  Font.register({
    family: "ElderWiseReport",
    fonts: [
      { src: loadFontDataUri("NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: loadFontDataUri("NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });

  Font.register({
    family: "ElderWiseReportDevanagari",
    src: loadFontDataUri("NotoSansDevanagari-Regular.ttf"),
  });

  registered = true;
}

export function reportFontFamilyForText(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "ElderWiseReportDevanagari";
  return "ElderWiseReport";
}
