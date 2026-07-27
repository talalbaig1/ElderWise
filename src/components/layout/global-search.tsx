"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { appNav } from "@/lib/navigation";
import { useDomainStore } from "@/components/data/app-data-provider";
import { cn } from "@/lib/utils";

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { store, setSelectedLovedOneId } = useDomainStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const people = store.lovedOnes
      .filter((lo) =>
        `${lo.firstName} ${lo.lastName} ${lo.relationshipToCarePartner}`
          .toLowerCase()
          .includes(q),
      )
      .map((lo) => ({
        id: `lo-${lo.id}`,
        label: `${lo.firstName} ${lo.lastName}`,
        hint: lo.relationshipToCarePartner,
        href: `/loved-ones/${lo.id}`,
        onSelect: () => setSelectedLovedOneId(lo.id),
      }));

    const pages = appNav
      .filter((item) => item.label.toLowerCase().includes(q))
      .map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        hint: "Go to page",
        href: item.href,
        onSelect: undefined as (() => void) | undefined,
      }));

    const extras = [
      { label: "Voice Journal", href: "/voice-journal", hint: "Mood & transcripts" },
      { label: "SOS", href: "/sos", hint: "Emergency timeline" },
      { label: "Reports", href: "/reports", hint: "Wellbeing exports" },
      { label: "Settings", href: "/settings", hint: "Preferences" },
    ]
      .filter((item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q))
      .map((item) => ({
        id: `x-${item.href}`,
        label: item.label,
        hint: item.hint,
        href: item.href,
        onSelect: undefined as (() => void) | undefined,
      }));

    const seen = new Set<string>();
    return [...people, ...pages, ...extras].filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    }).slice(0, 8);
  }, [query, store.lovedOnes, setSelectedLovedOneId]);

  const go = (index: number) => {
    const item = results[index];
    if (!item) return;
    item.onSelect?.();
    setOpen(false);
    setQuery("");
    router.push(item.href);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // allow click on result
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search people, pages, routines…"
        className="h-10 pl-9"
        aria-label="Global search"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        role="combobox"
        autoComplete="off"
      />
      {open && query.trim() && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border bg-card shadow-[0_20px_50px_-28px_rgba(30,43,39,0.55)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches</p>
          ) : (
            <ul className="py-1">
              {results.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      index === active ? "bg-secondary" : "hover:bg-secondary/70",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(index)}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
