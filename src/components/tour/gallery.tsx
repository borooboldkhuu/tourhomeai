"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PropertyImage } from "@/types/database.types";

export function Gallery({ images }: { images: PropertyImage[] }) {
  const [index, setIndex] = useState<number | null>(null);

  if (!images.length) return null;

  const close = () => setIndex(null);
  const prev = () => setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
  const next = () => setIndex((i) => (i === null ? i : (i + 1) % images.length));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setIndex(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
          >
            <Image
              src={img.url}
              alt={img.caption ?? ""}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button onClick={close} className="absolute right-5 top-5 rounded-full p-2 text-white/70 hover:text-white">
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Өмнөх"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative h-[80vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Image src={images[index].url} alt="" fill sizes="100vw" className="object-contain" />
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Дараах"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <p className="absolute bottom-6 text-sm text-white/60">
            {index + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
