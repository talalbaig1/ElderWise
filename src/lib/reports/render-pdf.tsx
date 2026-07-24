import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdfDocument } from "@/lib/reports/pdf-document";
import type { ReportPayload } from "@/lib/reports/types";

export async function renderReportPdf(data: ReportPayload): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReportPdfDocument data={data} />);
  return Buffer.from(buffer);
}
