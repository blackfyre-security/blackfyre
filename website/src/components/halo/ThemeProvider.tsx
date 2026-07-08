"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type HaloTheme = "light" | "dark";
export type HaloAccent = "chartreuse" | "electric" | "violet" | "tangerine" | "mint";

const THEME_KEY = "bfy-theme";
const ACCENT_KEY = "bfy-accent";

interface HaloThemeContextValue {
  theme: HaloTheme;
  setTheme: (next: HaloTheme) => void;
  accent: HaloAccent;
  setAccent: (next: HaloAccent) => void;
}

const HaloThemeContext = createContext<HaloThemeContextValue | undefined>(undefined);

function isHaloTheme(value: string | null): value is HaloTheme {
  return value === "light" || value === "dark";
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: HaloTheme;
  defaultAccent?: HaloAccent;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  defaultAccent = "chartreuse",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<HaloTheme>(defaultTheme);
  const [accent, setAccentState] = useState<HaloAccent>(defaultAccent);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      if (isHaloTheme(savedTheme)) setThemeState(savedTheme);
    } catch {
      // localStorage unavailable (private mode, SSR); ignore.
    }
  }, []);

  const setTheme = useCallback((next: HaloTheme) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const setAccent = useCallback((next: HaloAccent) => {
    setAccentState(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-accent", next);
    }
    try {
      window.localStorage.setItem(ACCENT_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Keep <html> attributes synced with state in case the initial inline script
  // didn't run or the defaults differ from what's stored.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  return (
    <HaloThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </HaloThemeContext.Provider>
  );
}

export function useTheme(): HaloThemeContextValue {
  const ctx = useContext(HaloThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
