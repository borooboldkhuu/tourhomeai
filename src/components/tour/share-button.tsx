"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trackEvent } from "@/components/tour/view-tracker";

/** Facebook's brand glyph — lucide has no brand icons. */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
    </svg>
  );
}

export function ShareButton({ title, propertyId }: { title: string; propertyId: string }) {
  const [copied, setCopied] = useState(false);

  const url = () => (typeof window === "undefined" ? "" : window.location.href);

  function open(target: string) {
    trackEvent(propertyId, "share");
    window.open(target, "_blank", "noopener,noreferrer,width=640,height=680");
  }

  const shareFacebook = () =>
    open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`);

  const shareMessenger = () =>
    open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url())}&app_id=291494419107518&redirect_uri=${encodeURIComponent(url())}`);

  async function copyLink() {
    await navigator.clipboard.writeText(url());
    trackEvent(propertyId, "share");
    setCopied(true);
    toast.success("Холбоос хуулагдлаа");
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    trackEvent(propertyId, "share");
    try {
      await navigator.share({ title, url: url() });
    } catch {
      /* the visitor cancelled */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Share2 />} Хуваалцах
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={shareFacebook}>
          <FacebookIcon className="h-4 w-4" /> Facebook дээр
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareMessenger}>
          <MessageCircle /> Messenger-ээр
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => open(`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`)}
        >
          <Send /> Telegram-аар
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Copy /> Холбоос хуулах
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onClick={nativeShare}>
            <Share2 /> Бусад апп…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
