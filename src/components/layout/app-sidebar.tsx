"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  FileBarChart,
  HeartHandshake,
  LayoutDashboard,
  Mic,
  Settings,
  Siren,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { appNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  HeartHandshake,
  FileBarChart,
  Siren,
  Mic,
  Bell,
  Settings,
} as const;

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        <Logo showWordmark={!collapsed} href="/dashboard" />
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className="space-y-1" aria-label="Main">
            {appNav.map((item) => {
              const Icon = iconMap[item.icon];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const link = (
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );

              if (!collapsed) return <div key={item.href}>{link}</div>;

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
      </ScrollArea>
      <div className="border-t p-4">
        {!collapsed ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Staying close, from a distance
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        aria-label="Application sidebar"
        initial={false}
        animate={{ width: collapsed ? 80 : 272 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
        className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar lg:block"
      >
        {nav}
      </motion.aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#12201D]/45"
            aria-label="Close navigation"
            onClick={onMobileClose}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-sidebar shadow-xl">
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
