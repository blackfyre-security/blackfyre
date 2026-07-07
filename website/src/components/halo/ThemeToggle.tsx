"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface p-0.5",
        className,
      )}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={isLight}
        aria-label="Light theme"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
          isLight
            ? "bg-surface-alt text-text"
            : "text-text-muted hover:text-text",
        )}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={!isLight}
        aria-label="Dark theme"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
          !isLight
            ? "bg-surface-alt text-text"
            : "text-text-muted hover:text-text",
        )}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
