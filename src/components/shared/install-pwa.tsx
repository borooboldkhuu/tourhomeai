"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install app" button.
 * Chrome/Edge/Android → native install prompt.
 * iOS Safari → short instructions, since Apple exposes no prompt API.
 */
export function InstallPWA({ className, compact }: { className?: string; compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only flag
      window.navigator.standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIOS) return null;

  async function install() {
    if (!deferred) return setShowHint(true);
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  if (compact) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn("h-9 w-9", className)}
        title="Апп суулгах"
        aria-label="Апп суулгах"
        onClick={install}
      >
        <Download />
      </Button>
    );
  }

  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={install}>
        <Download /> Апп суулгах
      </Button>
      {isIOS && showHint && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Share className="h-3.5 w-3.5" /> Safari → Хуваалцах → «Нүүр дэлгэцэнд нэмэх»
        </p>
      )}
    </div>
  );
}

/** Full-width prompt for the dashboard on phones, where the header has no room. */
export function InstallPWACard({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(true); // assume installed until proven otherwise

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only flag
      window.navigator.standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    setDismissed(sessionStorage.getItem("th-install-dismissed") === "1");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !isIOS) return null;

  function close() {
    sessionStorage.setItem("th-install-dismissed", "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <div className={cn("mb-6 rounded-2xl border border-border bg-card p-4 sm:hidden", className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-foreground p-2">
          <Download className="h-4 w-4 text-background" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">TourHome-г аппаар суулгах</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isIOS
              ? "Хуваалцах товч (□↑) → «Add to Home Screen» → Add"
              : "Нүүр дэлгэцээс шууд нээж, офлайн ажиллуулна."}
          </p>
          {!isIOS && (
            <Button size="sm" className="mt-3" onClick={install}>
              Суулгах
            </Button>
          )}
        </div>
        <button onClick={close} aria-label="Хаах" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
