"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Mail, MessageSquare, Phone } from "lucide-react";
import { submitLead, type LeadState } from "@/app/actions/leads";
import { trackEvent } from "@/components/tour/view-tracker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/shared/submit-button";
import { formatPrice, pricePerSqm } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { PropertyWithMedia } from "@/types/database.types";

export function ContactCard({ property }: { property: PropertyWithMedia }) {
  const agent = property.users;
  const perSqm = pricePerSqm(property.price, property.area);
  const initials = (agent?.full_name ?? "TH").slice(0, 2).toUpperCase();

  return (
    <Card className="lg:sticky lg:top-6">
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            {formatPrice(property.price, property.currency)}
          </p>
          {perSqm && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPrice(perSqm, property.currency)} / м²
            </p>
          )}
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-border">
            {agent?.avatar_url && <AvatarImage src={agent.avatar_url} alt={agent.full_name ?? ""} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{agent?.full_name ?? "Зуучлагч"}</p>
            {agent?.company_name && (
              <p className="truncate text-sm text-muted-foreground">{agent.company_name}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {agent?.phone && (
            <Button className="w-full" size="lg" asChild
              onClick={() => trackEvent(property.id, "contact_click")}>
              <a href={`tel:${agent.phone}`}>
                <Phone /> {agent.phone}
              </a>
            </Button>
          )}

          <LeadDialog propertyId={property.id} />

          {agent?.email && (
            <Button variant="ghost" className="w-full" asChild>
              <a href={`mailto:${agent.email}`}>
                <Mail /> И-мэйл бичих
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadDialog({ propertyId }: { propertyId: string }) {
  const [state, formAction] = useActionState<LeadState, FormData>(submitLead, null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="lg">
          <MessageSquare /> Хүсэлт үлдээх
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Холбоо барих</DialogTitle>
          <DialogDescription>
            Мэдээллээ үлдээгээрэй, зуучлагч тантай эргэн холбогдоно.
          </DialogDescription>
        </DialogHeader>

        {state?.success ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {state.success}
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <div className="space-y-2">
              <Label htmlFor="lead-name">Нэр *</Label>
              <Input id="lead-name" name="name" required placeholder="Таны нэр" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Утас *</Label>
              <Input id="lead-phone" name="phone" required inputMode="tel" placeholder="99112233" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">И-мэйл</Label>
              <Input id="lead-email" name="email" type="email" placeholder="Сонголтоор" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-message">Мессеж</Label>
              <Textarea id="lead-message" name="message" rows={3} placeholder="Үзэх боломжтой цаг…" />
            </div>

            {state?.error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {state.error}
              </p>
            )}

            <SubmitButton className="w-full" size="lg">Илгээх</SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
