"use client";

import { useEffect, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { DevAutologin } from "@/components/auth/dev-autologin";
import { StoreProvider, useElderWiseStore } from "@/lib/store";
import { ThemeProvider } from "@/providers/theme-provider";

function AccessibilitySync({ children }: { children: ReactNode }) {
  const { store, hydrated } = useElderWiseStore();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.toggle("text-larger", store.settings.largerText);
    root.classList.toggle("contrast-boost", store.settings.increasedContrast);
    root.classList.toggle("reduce-motion", store.settings.reducedMotion);
    if (store.settings.reducedMotion) {
      root.style.setProperty("scroll-behavior", "auto");
    } else {
      root.style.removeProperty("scroll-behavior");
    }
  }, [hydrated, store.settings]);

  return <>{children}</>;
}

function ThemeStoreSync({ children }: { children: ReactNode }) {
  const { store, hydrated } = useElderWiseStore();
  const { setTheme } = useTheme();

  // Keep next-themes aligned with persisted ElderWise settings
  useEffect(() => {
    if (!hydrated) return;
    setTheme(store.settings.theme);
  }, [hydrated, store.settings.theme, setTheme]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="elderwise:theme"
      disableTransitionOnChange
    >
      <StoreProvider>
        <DevAutologin />
        <ThemeStoreSync>
          <AccessibilitySync>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </AccessibilitySync>
        </ThemeStoreSync>
      </StoreProvider>
    </ThemeProvider>
  );
}
