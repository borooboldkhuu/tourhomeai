"use client";

import { PanoramaViewer } from "@/components/tour/panorama-viewer";
import type { PropertyTour } from "@/types/database.types";

/** Sample rooms so visitors can try the viewer before signing up. */
export function DemoTour({ tours }: { tours: PropertyTour[] }) {
  if (!tours.length) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-neutral-950 shadow-2xl dark:border-white/10">
      <div className="flex h-11 items-center gap-1.5 border-b border-white/10 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 truncate text-xs text-white/40">tourhome.ai/tour/jishee-3-oroo</span>
      </div>

      <div className="relative aspect-[16/10] sm:aspect-[16/9]">
        <PanoramaViewer tours={tours} />
        <span className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur">
          Жишээ тур · чирж эргүүлээрэй
        </span>
      </div>
    </div>
  );
}
