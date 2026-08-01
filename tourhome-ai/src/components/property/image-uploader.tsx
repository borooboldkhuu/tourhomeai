"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { deleteImage, registerImage, setCoverImage } from "@/app/actions/properties";
import { uploadFile } from "@/lib/upload";
import { BUCKETS, MAX_IMAGE_MB } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImageKind, PropertyImage } from "@/types/database.types";

interface Props {
  propertyId: string;
  images: PropertyImage[];
  coverUrl: string | null;
  kind?: ImageKind;
  title?: string;
  hint?: string;
}

export function ImageUploader({
  propertyId, images, coverUrl, kind = "photo",
  title = "Зурагнууд",
  hint = "JPG эсвэл PNG. Нэг зураг 25MB хүртэл.",
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);

    const tooBig = list.find((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    if (tooBig) return toast.error(`«${tooBig.name}» хэт том байна (${MAX_IMAGE_MB}MB хязгаар)`);

    setUploading(true);
    setProgress({ done: 0, total: list.length });

    try {
      for (let i = 0; i < list.length; i++) {
        const { url, path } = await uploadFile(BUCKETS.images, list[i], propertyId);
        await registerImage({
          propertyId, url, storagePath: path, kind,
          sortOrder: images.length + i,
        });
        setProgress({ done: i + 1, total: list.length });
      }
      toast.success(`${list.length} файл байршуулав`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Байршуулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragOver ? "border-foreground bg-muted" : "border-border hover:border-foreground/40",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">{progress.done} / {progress.total} байршуулж байна…</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Зургаа энд чирж оруулна уу</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {images.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImagePlus className="h-4 w-4" /> Одоогоор зураг байхгүй.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => {
              const isCover = coverUrl === img.url;
              return (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  <Image src={img.url} alt={img.caption ?? ""} fill sizes="200px" className="object-cover" />
                  {isCover && (
                    <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                      Нүүр зураг
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {kind === "photo" && !isCover && (
                      <Button
                        type="button" size="icon" variant="glass" className="h-8 w-8"
                        title="Нүүр зураг болгох"
                        disabled={isPending}
                        onClick={() => startTransition(async () => {
                          await setCoverImage(propertyId, img.url);
                          router.refresh();
                        })}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button" size="icon" variant="glass" className="h-8 w-8"
                      title="Устгах"
                      disabled={isPending}
                      onClick={() => startTransition(async () => {
                        await deleteImage(img.id, propertyId);
                        router.refresh();
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
