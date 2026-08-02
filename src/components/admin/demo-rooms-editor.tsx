"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { resetDemoRooms, saveDemoRooms } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/client";
import { checkEquirectangular } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DemoRoom } from "@/lib/site-settings";

const BUCKET = "site-assets";
const MAX_MB = 80;

export function DemoRoomsEditor({ initial }: { initial: DemoRoom[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rooms, setRooms] = useState<DemoRoom[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);

    const tooBig = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return toast.error(`«${tooBig.name}» ${MAX_MB}MB-аас том байна`);

    setUploading(true);
    try {
      const supabase = createClient();
      const added: DemoRoom[] = [];

      for (const file of list) {
        const dims = await checkEquirectangular(file);
        if (!dims.ok) toast.warning(`«${file.name}» 2:1 харьцаатай биш — гажиж харагдаж болзошгүй`);

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `landing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || undefined,
        });
        if (error) throw new Error(error.message);

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        added.push({
          key: path.split("/").pop()!.split(".")[0],
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Өрөө",
          url: data.publicUrl,
        });
      }

      setRooms((prev) => [...prev, ...added]);
      toast.success(`${added.length} панорама нэмэгдлээ — хадгалахаа мартуузай`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Байршуулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rooms.length) return;
    const next = [...rooms];
    [next[i], next[j]] = [next[j], next[i]];
    setRooms(next);
  };

  const rename = (i: number, name: string) =>
    setRooms((prev) => prev.map((r, k) => (k === i ? { ...r, name } : r)));

  const remove = (i: number) => setRooms((prev) => prev.filter((_, k) => k !== i));

  const save = () =>
    startTransition(async () => {
      const res = await saveDemoRooms(rooms);
      if (res?.error) toast.error(res.error);
      else if (res?.success) { toast.success(res.success); router.refresh(); }
    });

  const reset = () =>
    startTransition(async () => {
      const res = await resetDemoRooms();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res?.success ?? "Сэргээлээ");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Өрөөнүүд</CardTitle>
        <CardDescription>
          Equirectangular (2:1) панорама байршуулна. Дараалал нь турын товчны дарааллыг тодорхойлно.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver ? "border-foreground bg-muted" : "border-border hover:border-foreground/40",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Байршуулж байна…</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Панорама чирж оруулах</p>
              <p className="text-xs text-muted-foreground">2:1 харьцаа · {MAX_MB}MB хүртэл</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => void handleFiles(e.target.files)} />
        </div>

        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Одоогоор өрөө алга.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {rooms.map((room, i) => (
              <li key={`${room.url}-${i}`} className="flex items-center gap-3 p-3">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image src={room.url} alt={room.name} fill sizes="96px" className="object-cover" unoptimized />
                </div>
                <Input
                  value={room.name}
                  onChange={(e) => rename(i, e.target.value)}
                  className="h-9 flex-1 border-transparent px-2 hover:border-border"
                />
                <div className="flex shrink-0 items-center">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === rooms.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={reset}>
            <RotateCcw /> Анхны жишээ сэргээх
          </Button>
          <Button type="button" size="lg" disabled={isPending || uploading} onClick={save}>
            {isPending && <Loader2 className="animate-spin" />} Хадгалах
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
