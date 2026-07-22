"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Profile editing lives in Settings → Profile. */
export default function ProfilePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings#profile");
  }, [router]);
  return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
}
