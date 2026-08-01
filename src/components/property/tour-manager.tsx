"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Rotate3d, Trash2, UploadCloud } from "lucide-react";
import { addTourScene, deleteTourScene, renameTourScene } from "@/app/actions/properties";
import { checkEquirectangular, uploadFile } from "@/lib/upload";
import { BUCKETS, DEFAULT_ROOM_PRESETS, MAX_PANORAMA_MB } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PanoramaCapture } from "@/components/property/panorama-capture";
import { cn } from "@/lib/utils";
import type { PropertyTour } from "@/types/database.types";

export function TourManager({ propertyId, tours }: { propertyId: string; tours: PropertyTour[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [roomName, setRoomName] = useState<string>(DEFAULT_ROOM_PRESETS[0]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [capturing, setCapturing] = useState(false);

  /** Upload one equirectangular image and register it as a room. */
  async function upload(file: File) {
    setUploading(true);
    try {
      const { url, path } = await uploadFile(BUCKETS.panoramas, file, propertyId);
      const res = await addTourScene({ propertyId, roomName, panoramaUrl: url, storagePath: path });
      if (res?.error) throw new Error(res.error);
      toast.success(`«${roomName}» өрөө нэмэгдлээ`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Байршуулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_PANORAMA_MB * 1024 * 1024) {
      return toast.error(`Панорама ${MAX_PANORAMA_MB}MB-аас бага байх ёстой`);
    }

    const dims = await checkEquirectangular(file);
    if (!dims.ok) {
      toast.warning("2:1 харьцаатай equirectangular зураг биш байна — үзүүлэлт гажиж болзошгүй.");
    }
    await upload(file);
  }

  /** Panorama produced by the in-browser 360° capture. */
  async function handleCaptured(file: File) {
    setCapturing(false);
    await upload(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>360° виртуал тур</CardTitle>
        <CardDescription>
          Өрөө бүрийн equirectangular (2:1) панорамыг байршуулна. Үзэгч эдгээр өрөө хооронд шилжинэ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Өрөөний нэр</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_ROOM_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRoomName(preset)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  roomName === preset
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Өрөөний нэр" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          disabled={uploading}
          onClick={() => setCapturing(true)}
        >
          <Camera /> Утсаараа 360° буулгах
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> эсвэл файлаас <span className="h-px flex-1 bg-border" />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragOver ? "border-foreground bg-muted" : "border-border hover:border-foreground/40",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Панорама байршуулж байна…</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">360° панорамаа энд оруулна уу</p>
              <p className="text-xs text-muted-foreground">2:1 харьцаа · {MAX_PANORAMA_MB}MB хүртэл</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void handleFile(e.target.files)} />
        </div>

        {tours.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Rotate3d className="h-4 w-4" /> Одоогоор 360° өрөө нэмээгүй байна.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {tours.map((tour, i) => (
              <li key={tour.id} className="flex items-center gap-4 p-3">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image src={tour.panorama_url} alt={tour.room_name} fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    defaultValue={tour.room_name}
                    className="h-9 border-transparent px-2 hover:border-border"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== tour.room_name) {
                        startTransition(async () => {
                          await renameTourScene(tour.id, propertyId, value);
                          router.refresh();
                        });
                      }
                    }}
                  />
                  <p className="mt-1 px-2 text-xs text-muted-foreground">
                    Дараалал {i + 1}{tour.is_default ? " · Эхлэх өрөө" : ""}
                  </p>
                </div>
                <Button
                  type="button" variant="ghost" size="icon" disabled={isPending}
                  onClick={() => startTransition(async () => {
                    await deleteTourScene(tour.id, propertyId);
                    router.refresh();
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {capturing && (
        <PanoramaCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />
      )}
    </Card>
  );
}
