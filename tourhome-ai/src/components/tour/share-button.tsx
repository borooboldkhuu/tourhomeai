"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/components/tour/view-tracker";

export function ShareButton({ title, propertyId }: { title: string; propertyId: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    trackEvent(propertyId, "share");

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Холбоос хуулагдлаа");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={share}>
      {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Share2 />} Хуваалцах
    </Button>
  );
}
