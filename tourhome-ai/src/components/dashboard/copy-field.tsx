"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyField({
  label, value, mono, highlight,
}: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} хуулагдлаа`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors",
        highlight ? "border-foreground bg-muted" : "border-border hover:bg-muted",
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className={cn("text-sm font-medium", mono && "font-mono")}>{value}</span>
        {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
      </span>
    </button>
  );
}
