"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, EyeOff, Upload } from "lucide-react";
import { setPropertyStatus } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatPrice } from "@/lib/utils";
import type { Property } from "@/types/database.types";

export function AdminPropertyRow({
  property, ownerEmail,
}: { property: Property; ownerEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const published = property.status === "published";

  const toggle = () =>
    startTransition(async () => {
      const res = await setPropertyStatus(property.id, published ? "draft" : "published");
      if (res?.error) toast.error(res.error);
      else if (res?.success) toast.success(res.success);
    });

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{property.title}</p>
          <Badge variant={published ? "success" : "muted"}>{STATUS_LABELS[property.status]}</Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {formatPrice(property.price, property.currency)}
          {property.location ? ` · ${property.location}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {ownerEmail} · {property.view_count} үзэлт · {formatDate(property.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {published && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/tour/${property.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink /> Үзэх
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={isPending} onClick={toggle}>
          {published ? <><EyeOff /> Хасах</> : <><Upload /> Нийтлэх</>}
        </Button>
      </div>
    </div>
  );
}
