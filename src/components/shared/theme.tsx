"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "tourhome-theme";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Runs before paint so the page never flashes the wrong theme.
 * Keep in sync with ThemeProvider below.
 */
export const themeScript = `(function(){try{
var s=localStorage.getItem("${STORAGE_KEY}")||"system";
var d=s==="dark"||(s==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
var e=document.documentElement;
e.classList.toggle("dark",d);
e.style.colorScheme=d?"dark":"light";
}catch(_){}})();`;

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    setResolved(apply(stored));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === "system" || !localStorage.getItem(STORAGE_KEY)) {
        setResolved(apply("system"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    setResolved(apply(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  );
}

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Гэрэлтэй" },
  { value: "dark", icon: Moon, label: "Харанхуй" },
  { value: "system", icon: Monitor, label: "Системийн" },
];

/** Three-way segmented control. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("flex items-center gap-0.5 rounded-full border border-border p-0.5", className)}>
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full transition-colors",
            mounted && theme === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
