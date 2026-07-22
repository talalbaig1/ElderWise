"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageFade } from "@/components/shared/page-fade";
import { SkipLink } from "@/components/shared/skip-link";
import { useElderWiseStore } from "@/lib/store";

function titleFromSegment(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { store } = useElderWiseStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const items: { label: string; href?: string }[] = [{ label: "Home", href: "/dashboard" }];
    let acc = "";
    parts.forEach((part, index) => {
      acc += `/${part}`;
      let label = titleFromSegment(part);
      if (parts[0] === "loved-ones" && index === 1) {
        const lo = store.lovedOnes.find((l) => l.id === part);
        if (lo) label = lo.firstName;
      }
      items.push({
        label,
        href: index === parts.length - 1 ? undefined : acc,
      });
    });
    return items;
  }, [pathname, store.lovedOnes]);

  return (
    <div className="flex min-h-screen bg-background">
      <SkipLink />
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <div className="border-b border-border/60 px-4 py-3 sm:px-6">
          <Breadcrumbs items={crumbs} />
        </div>
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageFade key={pathname}>{children}</PageFade>
        </main>
      </div>
    </div>
  );
}
