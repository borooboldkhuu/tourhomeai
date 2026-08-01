"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { togglePublish } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PropertyStatus } from "@/types/database.types";

export function SharePanel({
  propertyId, slug, status, paused,
}: { propertyId: string; slug: string; status: PropertyStatus; paused?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isPending, startTransition] = useTransition();

  const published = status === "published";
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tour/${slug}` : `/tour/${slug}`;
  const qrSrc = `/api/qr?slug=${slug}&size=512`;

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Холбоос хуулагдлаа");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Хуваалцах</CardTitle>
          <Badge variant={paused && published ? "warning" : published ? "success" : "muted"}>
            {paused && published ? "Түр зогссон" : published ? "Нийтлэгдсэн" : "Ноорог"}
          </Badge>
        </div>
        <CardDescription>
          {paused && published
            ? "Хугацаа дууссан тул холбоос түр хаагдсан. Багц идэвхжүүлмэгц яг энэ хаягаар нээгдэнэ."
            : published
              ? "Энэ холбоосыг хэн ч нэвтрэхгүйгээр нээж үзнэ."
              : "Нийтлэсний дараа холбоос идэвхжинэ."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input readOnly value={shareUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" onClick={copy} title="Хуулах">
            {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild disabled={!published}>
            <a href={`/tour/${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink /> Нээж үзэх
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}>
            <QrCode /> QR код
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={`${qrSrc}&size=1024`} download={`tourhome-${slug}.png`}>
              <Download /> QR татах
            </a>
          </Button>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/40 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR код" width={200} height={200} className="rounded-xl bg-white p-2" />
            <p className="text-xs text-muted-foreground">Утсаараа уншуулаад турыг нээнэ</p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          variant={published ? "outline" : "default"}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await togglePublish(propertyId, !published);
              if (res?.error) toast.error(res.error, { duration: 6000 });
              else if (res?.success) toast.success(res.success);
            })
          }
        >
          {published ? "Нийтлэлээс буцаах" : "Нийтлэх"}
        </Button>
      </CardContent>
    </Card>
  );
}
