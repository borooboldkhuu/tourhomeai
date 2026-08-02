"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, XCircle } from "lucide-react";
import { revokePlan, setRole } from "@/app/actions/admin";
import { getEntitlement } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { UserProfile } from "@/types/database.types";

export function UserRow({ user }: { user: UserProfile }) {
  const [isPending, startTransition] = useTransition();
  const ent = getEntitlement(user);

  const run = (fn: () => Promise<{ error?: string; success?: string } | null>) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.success) toast.success(res.success);
    });

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{user.full_name ?? "—"}</p>
          {user.role === "admin" && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> админ
            </Badge>
          )}
          <Badge variant={ent.active ? "success" : ent.trialUsed ? "warning" : "muted"}>
            {ent.active ? ent.plan?.name ?? "багц" : ent.trialUsed ? "дууссан" : "туршилт"}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.company_name ? `${user.company_name} · ` : ""}
          {user.phone ? `${user.phone} · ` : ""}
          бүртгүүлсэн {formatDate(user.created_at)}
          {ent.expiresAt ? ` · дуусах ${formatDate(ent.expiresAt)}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {ent.active && (
          <Button variant="ghost" size="sm" disabled={isPending}
            onClick={() => run(() => revokePlan(user.email))}>
            <XCircle /> Цуцлах
          </Button>
        )}
        <select
          defaultValue={user.role}
          disabled={isPending}
          onChange={(e) => run(() => setRole(user.id, e.target.value as "agent" | "company" | "admin"))}
          className="h-9 rounded-full border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="agent">Зуучлагч</option>
          <option value="company">Байгууллага</option>
          <option value="admin">Админ</option>
        </select>
      </div>
    </div>
  );
}
