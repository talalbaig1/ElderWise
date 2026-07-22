import { format } from "date-fns";
import type { ReportModel } from "@/lib/report-analytics";
import { reportKindToStoreType } from "@/lib/report-analytics";
import type { ReportSnapshot } from "@/types";

function escapeCsv(value: string | number) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(model: ReportModel) {
  const headers = model.csvHeaders;
  const lines = [
    headers.join(","),
    ...model.tableRows.map((row) =>
      headers.map((h) => escapeCsv(row[h] ?? "")).join(","),
    ),
  ];
  return lines.join("\r\n");
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportReportCsv(model: ReportModel) {
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const name = `${model.lovedOne.firstName}-${model.kind}-${stamp}.csv`.toLowerCase();
  downloadBlob(name, buildCsv(model), "text/csv;charset=utf-8");
}

function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal single-page text PDF for demo export (no external deps). */
export function buildSimplePdf(model: ReportModel) {
  const lines: string[] = [
    "ElderWise Care Report",
    model.title,
    `${model.lovedOne.firstName} ${model.lovedOne.surname}`,
    `Range: ${model.rangeLabel}`,
    `Generated: ${format(new Date(), "d MMM yyyy · HH:mm")}`,
    "",
    model.summary,
    "",
    "Metrics",
    ...model.metrics.map((m) => `• ${m.label}: ${m.value}${m.hint ? ` (${m.hint})` : ""}`),
    "",
    "Timeline",
    ...model.timeline.slice(0, 10).map((t) => `• ${t.time} — ${t.title}${t.status ? ` [${t.status}]` : ""}`),
    "",
    "Data rows (first 12)",
    ...model.tableRows.slice(0, 12).map((row) =>
      model.csvHeaders.map((h) => `${h}=${row[h] ?? ""}`).join(" | "),
    ),
  ];

  const contentLines = lines.flatMap((line) => {
    const chunks: string[] = [];
    let rest = line;
    while (rest.length > 90) {
      chunks.push(rest.slice(0, 90));
      rest = rest.slice(90);
    }
    chunks.push(rest);
    return chunks;
  });

  const startY = 800;
  const streamParts = ["BT", "/F1 11 Tf", "14 TL", `50 ${startY} Td`];
  contentLines.forEach((line, i) => {
    if (i === 0) {
      streamParts.push(`(${pdfEscape(line)}) Tj`);
    } else {
      streamParts.push("T*");
      streamParts.push(`(${pdfEscape(line)}) Tj`);
    }
  });
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objects.push(
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += obj;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

export function exportReportPdf(model: ReportModel) {
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const name = `${model.lovedOne.firstName}-${model.kind}-${stamp}.pdf`.toLowerCase();
  downloadBlob(name, buildSimplePdf(model), "application/pdf");
}

export function buildPrintHtml(model: ReportModel) {
  const metrics = model.metrics
    .map(
      (m) =>
        `<div class="metric"><div class="label">${m.label}</div><div class="value">${m.value}</div></div>`,
    )
    .join("");
  const timeline = model.timeline
    .map(
      (t) =>
        `<li><strong>${t.time}</strong> — ${t.title}${t.status ? ` <em>(${t.status})</em>` : ""}${
          t.description ? `<div class="muted">${t.description}</div>` : ""
        }</li>`,
    )
    .join("");
  const rows = model.tableRows
    .slice(0, 40)
    .map(
      (row) =>
        `<tr>${model.csvHeaders.map((h) => `<td>${String(row[h] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${model.title} · ElderWise</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1E2B27; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #5C6B64; margin: 28px 0 10px; }
    .brand { color: #1F4B45; font-weight: 700; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
    .meta { color: #5C6B64; font-size: 13px; margin-bottom: 16px; }
    .summary { background: #EFF2ED; padding: 14px 16px; border-radius: 12px; line-height: 1.5; }
    .metrics { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    .metric { border: 1px solid #D9DED7; border-radius: 12px; padding: 10px 14px; min-width: 120px; }
    .metric .label { font-size: 11px; color: #5C6B64; text-transform: uppercase; }
    .metric .value { font-family: "Courier New", monospace; font-size: 20px; margin-top: 4px; }
    ul { padding-left: 18px; }
    li { margin-bottom: 8px; }
    .muted { color: #5C6B64; font-size: 12px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #D9DED7; text-align: left; padding: 6px 8px; vertical-align: top; }
    th { color: #5C6B64; font-weight: 600; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="brand">ElderWise</div>
  <h1>${model.title}</h1>
  <div class="meta">
    ${model.lovedOne.firstName} ${model.lovedOne.surname} · ${model.rangeLabel}<br/>
    Generated ${format(new Date(), "d MMMM yyyy · HH:mm")}
  </div>
  <p class="summary">${model.summary}</p>
  <div class="metrics">${metrics}</div>
  <h2>Timeline</h2>
  <ul>${timeline || "<li>No timeline events in this range.</li>"}</ul>
  <h2>Detail</h2>
  <table>
    <thead><tr>${model.csvHeaders.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

export function openPrintView(model: ReportModel) {
  const html = buildPrintHtml(model);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Allow layout to settle before print
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
  return true;
}

export function toReportSnapshot(model: ReportModel): ReportSnapshot {
  return {
    id: `rep-${crypto.randomUUID()}`,
    type: reportKindToStoreType(model.kind),
    lovedOneId: model.lovedOne.id,
    generatedAt: new Date().toISOString(),
    rangeLabel: model.rangeLabel,
    adherencePercent: model.adherencePercent,
    summary: model.summary,
    metrics: model.snapshotMetrics,
  };
}
