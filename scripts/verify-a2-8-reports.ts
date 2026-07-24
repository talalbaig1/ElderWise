/**
 * A2.8 in-process verify (anon session + render). Uses pdftotext for content.
 * Usage: npx tsx --env-file=.env.local scripts/verify-a2-8-reports.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadReportData } from "../src/lib/reports/load-report-data";
import { renderReportPdf } from "../src/lib/reports/render-pdf";
import type { PdfReportKind } from "../src/lib/reports/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const email = process.env.DEV_SEED_EMAIL ?? "ct.seed@elderwise.dev";
const password = process.env.DEV_SEED_PASSWORD ?? "ElderWise-Seed-Dev-2026!";

const SEED_ELDER = "a0000000-0000-4000-8000-000000000002";
const FOREIGN_ELDER = "732a97e5-16c5-4d48-baae-13e986c25712"; // Alice / other CT

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function pdfText(path: string): string {
  return execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
  });
}

async function main() {
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const signed = await anon.auth.signInWithPassword({ email, password });
  assert(signed.data.session && !signed.error, "seed CT sign-in");

  const from = "2026-07-01";
  const to = "2026-07-24";
  mkdirSync(join(process.cwd(), "tmp/reports"), { recursive: true });

  for (const kind of ["medication", "food", "wellness", "sos"] as PdfReportKind[]) {
    const loaded = await loadReportData(anon, signed.data.user!.id, {
      elderId: SEED_ELDER,
      kind,
      from,
      to,
    });
    assert(loaded.ok, `${kind} load ok`);
    if (!loaded.ok) continue;

    assert(loaded.data.elderTimeZone === "Asia/Kolkata", `${kind} elder TZ Kolkata`);
    assert(
      loaded.data.carePartnerTimeZone === "Asia/Riyadh",
      `${kind} CT TZ Riyadh`,
    );
    assert(loaded.data.consentConfirmedAt, `${kind} consent confirmed present`);

    const out = join(process.cwd(), `tmp/reports/kamala-${kind}.pdf`);
    const pdf = await renderReportPdf(loaded.data);
    assert(pdf.slice(0, 4).toString() === "%PDF", `${kind} PDF magic`);
    writeFileSync(out, pdf);
    console.log(`  wrote ${out} (${pdf.length} bytes)`);

    const text = pdfText(out);
    assert(text.includes("Asia/Kolkata"), `${kind} header zone Kolkata`);
    assert(text.includes("Asia/Riyadh"), `${kind} generated-on Riyadh`);
    assert(text.toLowerCase().includes("consent"), `${kind} consent line`);
    assert(!text.includes("+91"), `${kind} no WhatsApp number`);
    assert(!text.includes(SEED_ELDER), `${kind} no elder UUID`);
  }

  const empty = await loadReportData(anon, signed.data.user!.id, {
    elderId: SEED_ELDER,
    kind: "medication",
    from: "2020-01-01",
    to: "2020-01-07",
  });
  assert(empty.ok, "empty-range load ok");
  if (empty.ok) {
    assert(empty.data.checkIns.length === 0, "empty-range zero check-ins");
    assert(empty.data.respondedPct === null, "empty-range pct null");
    const out = join(process.cwd(), "tmp/reports/kamala-empty.pdf");
    const pdf = await renderReportPdf(empty.data);
    writeFileSync(out, pdf);
    const text = pdfText(out);
    assert(
      text.includes("No check-ins recorded in this period"),
      "empty PDF honest copy",
    );
    assert(!text.includes("0%"), "empty PDF no 0%");
    assert(!text.includes("100%"), "empty PDF no 100%");
  }

  const foreign = await loadReportData(anon, signed.data.user!.id, {
    elderId: FOREIGN_ELDER,
    kind: "medication",
    from,
    to,
  });
  assert(!foreign.ok && foreign.status === 404, "foreign elder 404");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(serviceKey, "service role for Devanagari fixture");
  const admin = createClient(url, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: before } = await admin
    .from("elders")
    .select("first_name")
    .eq("id", SEED_ELDER)
    .maybeSingle();
  const originalName = before?.first_name as string;
  await admin.from("elders").update({ first_name: "कमला" }).eq("id", SEED_ELDER);

  try {
    const dev = await loadReportData(anon, signed.data.user!.id, {
      elderId: SEED_ELDER,
      kind: "food",
      from,
      to,
    });
    assert(dev.ok && dev.data.elderFirstName === "कमला", "Devanagari name loaded");
    if (dev.ok) {
      const out = join(process.cwd(), "tmp/reports/kamala-devanagari.pdf");
      const pdf = await renderReportPdf(dev.data);
      writeFileSync(out, pdf);
      const text = pdfText(out);
      assert(text.includes("कमला"), "Devanagari glyphs extractable");
      console.log("  wrote", out);
    }
  } finally {
    await admin.from("elders").update({ first_name: originalName }).eq("id", SEED_ELDER);
    console.log("OK: restored Kamala first_name");
  }

  console.log("PASS — A2.8 in-process verify");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
