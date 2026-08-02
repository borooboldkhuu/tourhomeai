"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Camera, Rotate3d } from "lucide-react";
import { PanoramaViewer } from "@/components/tour/panorama-viewer";
import { trackEvent } from "@/components/tour/view-tracker";
import { cn } from "@/lib/utils";
import type { PropertyTour } from "@/types/database.types";

/** Full-bleed hero: 360° tour when available, cover photo otherwise. */
export function TourHero({
  propertyId, tours, coverUrl, title,
}: { propertyId: string; tours: PropertyTour[]; coverUrl: string | null; title: string }) {
  const [mode, setMode] = useState<"tour" | "photo">(tours.length ? "tour" : "photo");

  const handleSceneChange = useCallback(
    (sceneKey: string) => trackEvent(propertyId, "scene_change", sceneKey),
    [propertyId],
  );

  return (
    <section className="relative h-[62vh] min-h-[360px] w-full bg-neutral-950 sm:h-[78vh] sm:min-h-[460px]">
      {mode === "tour" && tours.length > 0 ? (
        <PanoramaViewer tours={tours} onSceneChange={handleSceneChange} />
      ) : coverUrl ? (
        <Image src={coverUrl} alt={title} fill priority sizes="100vw" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-white/40">
          <Camera className="h-8 w-8" />
        </div>
      )}

      {tours.length > 0 && coverUrl && (
        <div className="absolute left-4 top-4 flex gap-1.5 rounded-full border border-white/15 bg-black/40 p-1.5 backdrop-blur-xl">
          <ModeButton active={mode === "tour"} onClick={() => setMode("tour")}>
            <Rotate3d className="h-3.5 w-3.5" /> 360°
          </ModeButton>
          <ModeButton active={mode === "photo"} onClick={() => setMode("photo")}>
            <Camera className="h-3.5 w-3.5" /> Зураг
          </ModeButton>
        </div>
      )}
    </section>
  );
}

function ModeButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-white text-neutral-900" : "text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
