"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install app" button.
 * Chrome/Edge/Android → native install prompt.
 * iOS Safari → short instructions, since Apple exposes no prompt API.
 */
export function InstallPWA({ className }: { className?: string }) {
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
