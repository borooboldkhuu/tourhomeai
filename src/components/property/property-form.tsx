"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createProperty, updateProperty, type ActionState } from "@/app/actions/properties";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { AMENITIES, DISTRICTS, PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { Property, PropertyStatus, PropertyType } from "@/types/database.types";
import { cn } from "@/lib/utils";

export function PropertyForm({ property }: { property?: Property }) {
  const action = property ? updateProperty : createProperty;
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? []);

  const toggle = (item: string) =>
    setAmenities((prev) => (prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]));

  return (
    <form action={formAction} className="space-y-6">
      {property && <input type="hidden" name="id" value={property.id} />}
      {amenities.map((a) => <input key={a} type="hidden" name="amenities" value={a} />)}

      <Card>
        <CardHeader><CardTitle>Үндсэн мэдээлэл</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Гарчиг *</Label>
            <Input id="title" name="title" defaultValue={property?.title} placeholder="3 өрөө тансаг байр — Хан-Уул" required />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Үнэ (₮) *</Label>
              <Input id="price" name="price" type="number" min={0} step={1000}
                defaultValue={property?.price ?? ""} placeholder="450000000" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property_type">Төрөл</Label>
              <select id="property_type" name="property_type" defaultValue={property?.property_type ?? "apartment"}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => (
                  <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Тайлбар</Label>
            <Textarea id="description" name="description" rows={5} defaultValue={property?.description ?? ""}
              placeholder="Байрны онцлог, засвар, орчны мэдээлэл…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Байршил</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="district">Дүүрэг</Label>
            <select id="district" name="district" defaultValue={property?.district ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Сонгох…</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Хот / аймаг</Label>
            <Input id="city" name="city" defaultValue={property?.city ?? "Улаанбаатар"} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="location">Дэлгэрэнгүй хаяг</Label>
            <Input id="location" name="location" defaultValue={property?.location ?? ""}
              placeholder="15-р хороо, Их Монгол хотхон, В блок" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Үзүүлэлт</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="area">Талбай (м²)</Label>
            <Input id="area" name="area" type="number" min={0} step="0.1" defaultValue={property?.area ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rooms">Өрөөний тоо</Label>
            <Input id="rooms" name="rooms" type="number" min={0} defaultValue={property?.rooms ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bathrooms">Угаалгын өрөө</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min={0} defaultValue={property?.bathrooms ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor">Давхар</Label>
            <Input id="floor" name="floor" type="number" defaultValue={property?.floor ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_floors">Нийт давхар</Label>
            <Input id="total_floors" name="total_floors" type="number" defaultValue={property?.total_floors ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year_built">Ашиглалтад орсон он</Label>
            <Input id="year_built" name="year_built" type="number" placeholder="2022" defaultValue={property?.year_built ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Тохижилт</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {AMENITIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                amenities.includes(item)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Видео ба төлөв</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="video_url">Видео холбоос (YouTube / Vimeo / mp4)</Label>
            <Input id="video_url" name="video_url" type="url" defaultValue={property?.video_url ?? ""}
              placeholder="https://youtu.be/…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Төлөв</Label>
            <select id="status" name="status" defaultValue={property?.status ?? "draft"}
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {(Object.keys(STATUS_LABELS) as PropertyStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Зөвхөн «Нийтлэгдсэн» зар хуваалцах холбоосоор нээгдэнэ.
            </p>
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {state.success}
        </p>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton size="lg" className="shadow-lg">
          {property ? "Хадгалах" : "Үүсгээд үргэлжлүүлэх"}
        </SubmitButton>
      </div>
    </form>
  );
}
