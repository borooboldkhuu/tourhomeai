"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, Loader2, Maximize, Minimize, Minus, Plus, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyTour } from "@/types/database.types";
import type { PannellumConfig, PannellumScene, PannellumViewer } from "@/types/pannellum";

const PANNELLUM_JS = "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.js";
const PANNELLUM_CSS = "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.css";

/** Pannellum stops at 50° by default, which feels like the zoom is broken. */
const MIN_HFOV = 28;
const MAX_HFOV = 120;

function loadPannellum(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.pannellum) return resolve();

    if (!document.querySelector(`link[href="${PANNELLUM_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = PANNELLUM_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PANNELLUM_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("pannellum load failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = PANNELLUM_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pannellum load failed"));
    document.head.appendChild(script);
  });
}

interface Props {
  tours: PropertyTour[];
  className?: string;
  onSceneChange?: (sceneKey: string) => void;
}

export function PanoramaViewer({ tours, className, onSceneChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PannellumViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeScene, setActiveScene] = useState(tours[0]?.scene_key ?? "");
  const [rotating, setRotating] = useState(false);
  const [zoomPct, setZoomPct] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!tours.length || !containerRef.current) return;
    let cancelled = false;

    const scenes: Record<string, PannellumScene> = {};
    tours.forEach((tour, index) => {
      // Auto-link every room to the next one so visitors can walk through.
      const next = tours[(index + 1) % tours.length];
      scenes[tour.scene_key] = {
        type: "equirectangular",
        panorama: tour.panorama_url,
        title: tour.room_name,
        hfov: tour.hfov,
        minHfov: MIN_HFOV,
        maxHfov: MAX_HFOV,
        pitch: Number(tour.pitch),
        yaw: Number(tour.yaw),
        autoLoad: true,
        hotSpots: [
          ...(tour.hotspots ?? []).map((h) => ({
            pitch: h.pitch,
            yaw: h.yaw,
            type: h.type,
            text: h.text,
            sceneId: h.sceneId,
          })),
          ...(tours.length > 1 && next.scene_key !== tour.scene_key
            ? [{ pitch: -8, yaw: 0, type: "scene" as const, text: next.room_name, sceneId: next.scene_key }]
            : []),
        ],
      };
    });

    const config: PannellumConfig = {
      default: {
        firstScene: tours.find((t) => t.is_default)?.scene_key ?? tours[0].scene_key,
        sceneFadeDuration: 800,
        autoLoad: true,
        showControls: false,
        compass: false,
        minHfov: MIN_HFOV,
        maxHfov: MAX_HFOV,
        mouseZoom: true,
        keyboardZoom: true,
        draggable: true,
      },
      scenes,
    };

    loadPannellum()
      .then(() => {
        if (cancelled || !containerRef.current || !window.pannellum) return;
        viewerRef.current = window.pannellum.viewer(containerRef.current, config);
        viewerRef.current.on("zoomchange", (hfov) => setZoomPct(hfovToPercent(Number(hfov))));
        viewerRef.current.on("scenechange", (id) => {
          const key = String(id);
          setActiveScene(key);
          onSceneChange?.(key);
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours]);

  const goToScene = useCallback((key: string) => {
    viewerRef.current?.loadScene(key);
    setActiveScene(key);
    onSceneChange?.(key);
  }, [onSceneChange]);

  /**
   * iOS Safari has no Fullscreen API for ordinary elements, so the reliable
   * approach is a fixed overlay. Where the native API exists we also request
   * it, purely to hide the browser chrome.
   */
  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    document.body.style.overflow = "hidden";
    const el = wrapperRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }, []);

  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    document.body.style.overflow = "";
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) exitFullscreen();
    else enterFullscreen();
  }, [fullscreen, enterFullscreen, exitFullscreen]);

  // Pannellum needs a nudge after the container changes size.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => viewerRef.current?.resize?.(), 120);
    return () => clearTimeout(id);
  }, [fullscreen, ready]);

  // Escape, the Android back gesture and the native exit all close the overlay.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitFullscreen();
    const onNative = () => { if (!document.fullscreenElement) setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onNative);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onNative);
    };
  }, [fullscreen, exitFullscreen]);

  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  const zoom = (delta: number) => {
    const v = viewerRef.current;
    if (!v) return;
    const next = Math.min(MAX_HFOV, Math.max(MIN_HFOV, v.getHfov() + delta));
    v.setHfov(next);
    setZoomPct(hfovToPercent(next));
  };

  /** Double tap / double click toggles between wide and close-up. */
  const toggleZoom = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;
    const next = v.getHfov() > (MIN_HFOV + MAX_HFOV) / 2 ? MIN_HFOV + 6 : MAX_HFOV - 10;
    v.setHfov(next);
    setZoomPct(hfovToPercent(next));
  }, []);

  const toggleRotate = () => {
    const v = viewerRef.current;
    if (!v) return;
    if (rotating) v.stopAutoRotate();
    else v.startAutoRotate(-2);
    setRotating(!rotating);
  };

  if (!tours.length) return null;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden bg-neutral-950",
        fullscreen ? "fixed inset-0 z-[80] h-[100dvh] w-screen" : "h-full w-full",
        className,
      )}
    >
      {/* touch-none keeps pinch and drag inside the viewer instead of scrolling the page */}
      <div ref={containerRef} className="h-full w-full touch-none" onDoubleClick={toggleZoom} />

      {!ready && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 text-white/70">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">360° тур ачаалж байна…</p>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-center text-white/70">
          <Compass className="h-6 w-6" />
          <p className="text-sm">Үзүүлэлт ачаалж чадсангүй. Хуудсаа дахин ачаална уу.</p>
        </div>
      )}

      {/* First-time hint on touch devices */}
      {ready && !fullscreen && (
        <button
          onClick={enterFullscreen}
          className="absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-xl sm:hidden"
        >
          Бүтэн дэлгэцээр үзэх
        </button>
      )}

      {/* Room switcher */}
      {ready && tours.length > 1 && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-white/15 bg-black/40 p-1.5 backdrop-blur-xl no-scrollbar">
            {tours.map((tour) => (
              <button
                key={tour.id}
                onClick={() => goToScene(tour.scene_key)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
                  activeScene === tour.scene_key
                    ? "bg-white text-neutral-900"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                {tour.room_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Close */}
      {fullscreen && (
        <button
          onClick={exitFullscreen}
          aria-label="Хаах"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-xl transition hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Zoom read-out */}
      {ready && zoomPct > 2 && (
        <div className={cn(
          "pointer-events-none absolute left-4 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/90 backdrop-blur-xl",
          fullscreen ? "top-[max(1rem,env(safe-area-inset-top))]" : "top-4",
        )}>
          {zoomPct}% ойртсон
        </div>
      )}

      {/* Controls */}
      {ready && (
        <div className={cn(
          "absolute right-4 flex flex-col gap-1.5",
          fullscreen ? "top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))]" : "top-4",
        )}>
          <ViewerButton onClick={() => zoom(-12)} label="Ойртуулах"><Plus /></ViewerButton>
          <ViewerButton onClick={() => zoom(12)} label="Холдуулах"><Minus /></ViewerButton>
          <ViewerButton onClick={toggleRotate} label="Автомат эргэлт">
            <RotateCw className={cn(rotating && "animate-spin")} />
          </ViewerButton>
          <ViewerButton onClick={toggleFullscreen} label={fullscreen ? "Багасгах" : "Бүтэн дэлгэц"}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </ViewerButton>
        </div>
      )}
    </div>
  );
}

/** 0 % at the widest field of view, 100 % fully zoomed in. */
function hfovToPercent(hfov: number) {
  return Math.round(((MAX_HFOV - hfov) / (MAX_HFOV - MIN_HFOV)) * 100);
}

function ViewerButton({
  children, onClick, label,
}: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl transition hover:bg-black/60 [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </button>
  );
}
