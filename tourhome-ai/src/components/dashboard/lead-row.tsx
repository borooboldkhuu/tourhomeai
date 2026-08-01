"use client";

import { useTransition } from "react";
import { Mail, Phone, Trash2 } from "lucide-react";
import { deleteLead, updateLeadStatus } from "@/app/actions/leads";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Lead, LeadStatus } from "@/types/database.types";

export function LeadRow({ lead, propertyTitle }: { lead: Lead; propertyTitle: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{lead.name}</p>
          <span className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{propertyTitle}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:underline">
            <Phone className="h-3.5 w-3.5" /> {lead.phone}
          </a>
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:underline">
              <Mail className="h-3.5 w-3.5" /> {lead.email}
            </a>
          )}
        </div>
        {lead.message && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{lead.message}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          defaultValue={lead.status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() => updateLeadStatus(lead.id, e.target.value as LeadStatus))
          }
          className="h-9 rounded-full border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Button
          variant="ghost" size="icon" disabled={isPending}
          onClick={() => startTransition(() => deleteLead(lead.id))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
