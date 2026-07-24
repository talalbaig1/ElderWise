import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatInTimeZone } from "@/lib/time/display";
import {
  registerReportFonts,
  reportFontFamilyForText,
} from "@/lib/reports/fonts";
import type { ReportPayload } from "@/lib/reports/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  brand: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  meta: {
    fontSize: 9,
    color: "#444",
    marginBottom: 2,
  },
  banner: {
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#EEF3F1",
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    paddingVertical: 4,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    fontSize: 8,
    paddingRight: 4,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingBottom: 4,
    marginBottom: 2,
  },
  headerCell: {
    flexGrow: 1,
    flexBasis: 0,
    fontSize: 8,
    fontWeight: 700,
    paddingRight: 4,
  },
  empty: {
    marginTop: 8,
    fontSize: 10,
    color: "#333",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#555",
  },
});

// Fix typo in styles - I accidentally wrote "# rec" - need to fix when writing
function fmtElder(iso: string, tz: string) {
  return formatInTimeZone(iso, tz, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtConsentDate(iso: string, tz: string) {
  return formatInTimeZone(iso, tz, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtGenerated(iso: string, tz: string) {
  return formatInTimeZone(iso, tz, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function channelLabel(channel: string | null): string {
  if (channel === "button") return "WhatsApp button";
  if (channel === "voice") return "WhatsApp voice";
  return "—";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function consentLine(data: ReportPayload): string {
  if (data.consentConfirmedAt) {
    return `WhatsApp consent confirmed ${fmtConsentDate(data.consentConfirmedAt, data.elderTimeZone)}`;
  }
  return "WhatsApp consent not yet confirmed — no check-ins have been sent to this Loved One.";
}

export function ReportPdfDocument({ data }: { data: ReportPayload }) {
  registerReportFonts();

  const elderName = `${data.elderFirstName} ${data.elderSurname}`.trim();
  const nameFont = reportFontFamilyForText(elderName);
  const baseFont = "ElderWiseReport";

  const zoneBanner = `All times shown in ${data.elderTimeZone} (${data.elderFirstName}'s local time)`;
  const generatedLine = `Generated ${fmtGenerated(data.generatedAt, data.carePartnerTimeZone)} by ${data.carePartnerFirstName} (${data.carePartnerTimeZone})`;

  return (
    <Document
      title={`ElderWise ${data.kindLabel} report — ${elderName}`}
      author="ElderWise"
      subject={`${data.kindLabel} report`}
    >
      <Page size="A4" style={{ ...styles.page, fontFamily: baseFont }}>
        <Text style={{ ...styles.brand, fontFamily: baseFont }}>ElderWise</Text>
        <Text style={{ ...styles.title, fontFamily: baseFont }}>
          {data.kindLabel} report
        </Text>
        <Text style={{ ...styles.meta, fontFamily: nameFont }}>{elderName}</Text>
        <Text style={{ ...styles.meta, fontFamily: baseFont }}>
          Period {data.rangeFrom} to {data.rangeTo}
        </Text>
        <Text style={{ ...styles.meta, fontFamily: baseFont }}>{consentLine(data)}</Text>

        <View style={styles.banner}>
          <Text style={{ fontFamily: baseFont }}>{zoneBanner}</Text>
        </View>

        {data.kind === "sos" ? (
          <SosSection data={data} baseFont={baseFont} />
        ) : (
          <CheckInSection data={data} baseFont={baseFont} />
        )}

        <Text style={{ ...styles.footer, fontFamily: baseFont }} fixed>
          {generatedLine}
        </Text>
      </Page>
    </Document>
  );
}

function CheckInSection({
  data,
  baseFont,
}: {
  data: ReportPayload;
  baseFont: string;
}) {
  if (data.checkIns.length === 0) {
    return (
      <Text style={{ ...styles.empty, fontFamily: baseFont }}>
        No check-ins recorded in this period.
      </Text>
    );
  }

  return (
    <View>
      <Text style={{ ...styles.sectionTitle, fontFamily: baseFont }}>Summary</Text>
      <Text style={{ fontFamily: baseFont, fontSize: 9, marginBottom: 2 }}>
        Check-ins in period: {data.checkIns.length}
      </Text>
      <Text style={{ fontFamily: baseFont, fontSize: 9, marginBottom: 2 }}>
        Responded: {data.respondedCount} · Missed: {data.missedCount}
      </Text>
      <Text style={{ fontFamily: baseFont, fontSize: 9, marginBottom: 8 }}>
        {data.respondedPct == null
          ? "Responded rate: not applicable (no responded or missed check-ins in this period)"
          : `Responded rate: ${data.respondedPct}% (${data.respondedCount} of ${data.respondedCount + data.missedCount} responded or missed)`}
      </Text>

      <Text style={{ ...styles.sectionTitle, fontFamily: baseFont }}>Check-ins</Text>
      <View style={styles.headerRow}>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Scheduled</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Status</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Responded</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Channel</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Response</Text>
      </View>
      {data.checkIns.map((row, i) => (
        <View key={`${row.scheduledFor}-${i}`} style={styles.row} wrap={false}>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {fmtElder(row.scheduledFor, data.elderTimeZone)}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {statusLabel(row.status)}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {row.respondedAt
              ? fmtElder(row.respondedAt, data.elderTimeZone)
              : "—"}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {channelLabel(row.responseChannel)}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {row.responseValue?.trim() || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SosSection({
  data,
  baseFont,
}: {
  data: ReportPayload;
  baseFont: string;
}) {
  if (data.sosEvents.length === 0) {
    return (
      <Text style={{ ...styles.empty, fontFamily: baseFont }}>
        No SOS events recorded in this period.
      </Text>
    );
  }

  return (
    <View>
      <Text style={{ ...styles.sectionTitle, fontFamily: baseFont }}>Summary</Text>
      <Text style={{ fontFamily: baseFont, fontSize: 9, marginBottom: 8 }}>
        SOS events in period: {data.sosEvents.length}
      </Text>

      <Text style={{ ...styles.sectionTitle, fontFamily: baseFont }}>SOS events</Text>
      <View style={styles.headerRow}>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Triggered</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Status</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Resolved</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Resolved by</Text>
        <Text style={{ ...styles.headerCell, fontFamily: baseFont }}>Channel</Text>
      </View>
      {data.sosEvents.map((row, i) => (
        <View key={`${row.triggeredAt}-${i}`} style={styles.row} wrap={false}>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {fmtElder(row.triggeredAt, data.elderTimeZone)}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {statusLabel(row.status)}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {row.resolvedAt
              ? fmtElder(row.resolvedAt, data.elderTimeZone)
              : "—"}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {row.resolvedByRole?.replace(/_/g, " ") || "—"}
          </Text>
          <Text style={{ ...styles.cell, fontFamily: baseFont }}>
            {row.resolvedChannel || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}
