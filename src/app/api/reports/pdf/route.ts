import { createClient } from "@/lib/supabase/server";
import { loadReportData } from "@/lib/reports/load-report-data";
import { renderReportPdf } from "@/lib/reports/render-pdf";
import { isPdfReportKind } from "@/lib/reports/types";

export const runtime = "nodejs";

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const elderId =
    typeof body === "object" && body && "elderId" in body
      ? String((body as { elderId: unknown }).elderId ?? "")
      : "";
  const kindRaw =
    typeof body === "object" && body && "kind" in body
      ? String((body as { kind: unknown }).kind ?? "")
      : "";
  const from =
    typeof body === "object" && body && "from" in body
      ? String((body as { from: unknown }).from ?? "")
      : "";
  const to =
    typeof body === "object" && body && "to" in body
      ? String((body as { to: unknown }).to ?? "")
      : "";

  if (!isPdfReportKind(kindRaw)) {
    return Response.json(
      { error: "kind must be medication, food, wellness, or sos" },
      { status: 400 },
    );
  }

  const loaded = await loadReportData(supabase, user.id, {
    elderId,
    kind: kindRaw,
    from,
    to,
  });

  if (!loaded.ok) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }

  try {
    const buffer = await renderReportPdf(loaded.data);
    const namePart =
      safeFilenamePart(loaded.data.elderFirstName) || "loved-one";
    const filename = `${namePart}-${kindRaw}-${from}.pdf`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed";
    console.error("[reports/pdf]", message);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
