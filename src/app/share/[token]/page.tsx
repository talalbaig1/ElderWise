import type { Metadata } from "next";
import { ShareGate } from "@/components/share/share-gate";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "SilaCares care summary",
  description: "Private Family Doctor care summary",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // No Open Graph / Twitter cards — crawlers must not get preview rich tags.
};

export default async function DoctorSharePage({ params }: Props) {
  const { token } = await params;
  return <ShareGate token={token} />;
}
