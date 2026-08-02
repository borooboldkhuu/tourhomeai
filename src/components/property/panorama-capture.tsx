"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, Smartphone, Sparkles, X } from "lucide-react";
import {
  EquirectStitcher, buildTargets, orientationToMatrix, transposeMul,
  forwardOf, angleBetween, type CoverageTarget, type Mat3,
} from "@/lib/pano-stitch";
import { aiUpscale, aiUpscaleAvailable, enhanceCanvas } from "@/lib/enhance";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** iOS 13+ gates the motion sensors behind an explicit permission call. */
interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<"granted" | "denied">;
}

const AIM_TOLERANCE = 12 * (Math.PI / 180); // how close you must point at a target
const STEADY_LIMIT = 1.1 * (Math.PI / 180); // max wobble per frame while capturing
const SHARPNESS_MIN = 55;                   // variance of Laplacian on the grabbed frame
const STEADY_FRAMES = 2;                    // consecutive calm frames before we shoot
const DEFAULT_HFOV = 65;

type Phase = "intro" | "capturing" | "processing" | "error";

export function PanoramaCapture({
  onCapture, onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const grabRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const stitcherRef = useRef<EquirectStitcher | null>(null);
  const targetsRef = useRef<CoverageTarget[]>([]);
  const refMatRef = useRef<Mat3 | null>(null);
  const orientRef = useRef({ alpha: 0, beta: 90, gamma: 0, ok: false });
  const prevFwdRef = useRef<[number, number, number] | null>(null);
  const rafRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(18);
  const [hFov, setHFov] = useState(DEFAULT_HFOV);
  const [hint, setHint] = useState("");
  const [progress, setProgress] = useState("");
  const steadyCountRef = useRef(0);
  const panoSizeRef = useRef(2048);
  const [panoSize, setPanoSize] = useState(2048);
  const hFovRef = useRef(DEFAULT_HFOV);
  hFovRef.current = hFov;

  /* ------------------------------------------------------- sensors + stop -- */
  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    if (e.alpha === null && e.beta === null && e.gamma === null) return;
    orientRef.current = { alpha: e.alpha ?? 0, beta: e.beta ?? 90, gamma: e.gamma ?? 0, ok: true };
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    window.removeEventListener("deviceorientation", onOrient);
    window.removeEventListener("deviceorientationabsolute", onOrient);
  }, [onOrient]);

  useEffect(() => stop, [stop]);

  /* --------------------------------------------------------------- start -- */
  async function start() {
    try {
      // 1. motion sensors (must be inside the click gesture on iOS)
      const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventStatic;
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") throw new Error("Хөдөлгөөний мэдрэгчийн зөвшөөрөл өгөгдсөнгүй");
      }
      window.addEventListener("deviceorientationabsolute", onOrient);
      window.addEventListener("deviceorientation", onOrient);

      // 2. rear camera
      // Ask for the highest sensible sensor resolution — this is the single
      // biggest factor in how sharp the finished panorama looks. The browser
      // silently falls back to whatever the camera actually supports.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // Let the camera settle, then freeze exposure, white balance and focus.
      // Without this every frame is metered differently and the seams glow.
      const track = stream.getVideoTracks()[0];
      setTimeout(() => {
        void track
          .applyConstraints({
            advanced: [
              { exposureMode: "manual" },
              { whiteBalanceMode: "manual" },
              { focusMode: "manual" },
            ],
          } as unknown as MediaTrackConstraints)
          .catch(() => {
            // not supported on this device — the stitcher compensates instead
          });
      }, 700);

      // A 2048-wide sphere cannot hold the detail of a 1440p camera: with a
      // 65° lens each frame covers ~18 % of the width, so we need ~4096 to
      // keep pixel parity with the sensor.
      const longest = Math.max(video.videoWidth, video.videoHeight);
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
      const size = longest >= 1000 && memory >= 3 ? 4096 : 2048;
      panoSizeRef.current = size;
      setPanoSize(size);

      stitcherRef.current = new EquirectStitcher(size);
      targetsRef.current = buildTargets();
      refMatRef.current = null;
      prevFwdRef.current = null;
      setTotal(targetsRef.current.length);
      setDone(0);
      setPhase("capturing");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.includes("Permission") || e.name === "NotAllowedError"
            ? "Камерын зөвшөөрөл өгөгдсөнгүй. Хөтчийн тохиргооноос зөвшөөрнө үү."
            : e.message
          : "Эхлүүлэхэд алдаа гарлаа",
      );
      setPhase("error");
    }
  }

  /* ------------------------------------------------------------- capture -- */
  /** Variance of the Laplacian — a cheap, reliable blur detector. */
  function sharpness(data: ImageData) {
    const { width: w, height: h, data: d } = data;
    const step = 2;
    let sum = 0, sum2 = 0, n = 0;
    for (let y = step; y < h - step; y += step) {
      for (let x = step; x < w - step; x += step) {
        const i = (y * w + x) * 4;
        const c = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const l =
          (d[i - step * 4] + d[i + step * 4] + d[i - step * w * 4] + d[i + step * w * 4]) * 0.299 - 4 * c;
        sum += l; sum2 += l * l; n++;
      }
    }
    if (!n) return 0;
    return sum2 / n - (sum / n) ** 2;
  }

  function grabFrame(rel: Mat3): boolean {
    const video = videoRef.current;
    const canvas = grabRef.current;
    const stitcher = stitcherRef.current;
    if (!video || !canvas || !stitcher || !video.videoWidth) return false;

    // Keep the native frame unless it is huge; 640 px was throwing away most
    // of the sensor and was the main reason panoramas looked soft.
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);

    if (sharpness(pixels) < SHARPNESS_MIN) {
      setHint("Бүдэг байна — тогтоож барина уу");
      return false;
    }

    stitcher.addFrame(pixels, rel, hFovRef.current);
    setHint("");
    navigator.vibrate?.(25);
    return true;
  }

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);

    const { alpha, beta, gamma, ok } = orientRef.current;
    if (!ok) return;

    const screenAngle = typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0;
    const abs = orientationToMatrix(alpha, beta, gamma, screenAngle);
    if (!refMatRef.current) refMatRef.current = abs;      // first pose defines yaw 0
    const rel = transposeMul(refMatRef.current, abs);

    const fwd = forwardOf(rel);
    const prev = prevFwdRef.current;
    const wobble = prev ? angleBetween(prev, fwd) : Math.PI;
    prevFwdRef.current = fwd;

    // nearest target we still need
    let nearest: CoverageTarget | null = null;
    let nearestAngle = Infinity;
    for (const t of targetsRef.current) {
      if (t.done) continue;
      const a = angleBetween(fwd, t.dir);
      if (a < nearestAngle) { nearestAngle = a; nearest = t; }
    }

    steadyCountRef.current = wobble < STEADY_LIMIT ? steadyCountRef.current + 1 : 0;

    if (nearest && nearestAngle < AIM_TOLERANCE && steadyCountRef.current >= STEADY_FRAMES) {
      if (grabFrame(rel)) {
        nearest.done = true;
        steadyCountRef.current = 0;
        setDone(targetsRef.current.filter((t) => t.done).length);
      }
    }

    drawOverlay(rel, nearest, nearestAngle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- overlay -- */
  function drawOverlay(rel: Mat3, nearest: CoverageTarget | null, nearestAngle: number) {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    const f = (W / 2) / Math.tan((hFovRef.current * Math.PI) / 360);

    const project = (d: [number, number, number]) => {
      const cx = rel[0] * d[0] + rel[3] * d[1] + rel[6] * d[2];
      const cy = rel[1] * d[0] + rel[4] * d[1] + rel[7] * d[2];
      const cz = rel[2] * d[0] + rel[5] * d[1] + rel[8] * d[2];
      if (cz > -1e-6) return null;
      return { x: W / 2 + (f * cx) / -cz, y: H / 2 - (f * cy) / -cz };
    };

    for (const t of targetsRef.current) {
      const p = project(t.dir);
      if (!p || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
      const isNext = t === nearest;
      ctx.beginPath();
      ctx.arc(p.x, p.y, t.done ? 7 : isNext ? 22 : 13, 0, Math.PI * 2);
      if (t.done) {
        ctx.fillStyle = "rgba(52,211,153,.85)";
        ctx.fill();
      } else {
        ctx.strokeStyle = isNext ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.45)";
        ctx.lineWidth = isNext ? 3 : 2;
        ctx.stroke();
      }
    }

    // centre reticle
    ctx.strokeStyle = nearest && nearestAngle < AIM_TOLERANCE ? "rgba(52,211,153,.95)" : "rgba(255,255,255,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2); ctx.stroke();

    // off-screen arrow toward the next target
    if (nearest) {
      const p = project(nearest.dir);
      const off = !p || p.x < 0 || p.x > W || p.y < 0 || p.y > H;
      if (off) {
        const cx = rel[0] * nearest.dir[0] + rel[3] * nearest.dir[1] + rel[6] * nearest.dir[2];
        const cy = rel[1] * nearest.dir[0] + rel[4] * nearest.dir[1] + rel[7] * nearest.dir[2];
        const ang = Math.atan2(-cy, cx);
        const r = Math.min(W, H) * 0.34;
        const ax = W / 2 + Math.cos(ang) * r;
        const ay = H / 2 + Math.sin(ang) * r;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-10, 10); ctx.lineTo(-10, -10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  /* -------------------------------------------------------------- finish -- */
  async function finish() {
    const stitcher = stitcherRef.current;
    if (!stitcher || stitcher.frames === 0) return;
    setPhase("processing");
    cancelAnimationFrame(rafRef.current);

    try {
      setProgress("Панорам угсарч байна…");
      let canvas = stitcher.toCanvas();

      setProgress("Цэвэрлэж, хурцлаж байна…");
      await new Promise((r) => setTimeout(r, 30));   // let the label paint
      // A 4096-wide sphere is already low-noise per pixel, so denoise lightly
      // there and keep the pass under a couple of seconds on a phone.
      enhanceCanvas(canvas, canvas.width >= 4096
        ? { denoise: 0.5, sharpen: 0.35 }
        : { denoise: 0.9, sharpen: 0.3 });

      // Only worth it when the sphere is small — a 4096 capture is already sharp.
      if (aiUpscaleAvailable(canvas.width)) {
        try {
          setProgress("AI нягтруулж байна… (модель татаж байна)");
          const up = await aiUpscale(canvas, (d, t) =>
            setProgress(`AI нягтруулж байна… ${Math.round((d / t) * 100)}%`),
          );
          if (up) canvas = up;
        } catch {
          setProgress("AI алгасав — энгийн чанараар хадгалж байна");
        }
      }

      setProgress("Хадгалж байна…");
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.92),
      );
      const file = new File([blob], `360-${Date.now()}.jpg`, { type: "image/jpeg" });
      stop();
      onCapture(file);
    } catch {
      setError("Зураг үүсгэхэд алдаа гарлаа");
      setPhase("error");
    }
  }

  function reset() {
    setHint("");
    steadyCountRef.current = 0;
    stitcherRef.current = new EquirectStitcher(panoSizeRef.current);
    targetsRef.current = buildTargets();
    refMatRef.current = null;
    setDone(0);
  }

  const percent = Math.round((done / total) * 100);
  const noSensors = typeof window !== "undefined" && !("DeviceOrientationEvent" in window);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      {/* video + overlay */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas ref={grabRef} className="hidden" />

        {phase === "intro" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 px-8 text-center">
            <Smartphone className="h-8 w-8" />
            <h2 className="text-xl font-semibold">360° зураг буулгах</h2>
            <ol className="max-w-xs space-y-2 text-left text-sm text-white/70">
              <li>1. Утсаа босоо байрлуулж, өрөөний голд зогс</li>
              <li>2. Байрандаа зогсоод биеэрээ аажим эргэ</li>
              <li>3. Цагаан тойргууд руу голыг нь чиглүүл — өөрөө автоматаар авна</li>
              <li>4. Дээш, доош ч бас чиглүүлээрэй</li>
            </ol>
            {noSensors ? (
              <p className="text-sm text-amber-300">
                Энэ төхөөрөмжид хөдөлгөөний мэдрэгч алга. Утаснаасаа нээнэ үү.
              </p>
            ) : (
              <Button variant="glass" size="lg" onClick={start}>
                <Camera /> Эхлүүлэх
              </Button>
            )}
            <button onClick={() => { stop(); onClose(); }} className="text-sm text-white/60 underline-offset-4 hover:underline">
              Болих
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            <p className="max-w-xs text-sm text-red-300">{error}</p>
            <Button variant="glass" onClick={() => { setError(""); setPhase("intro"); }}>Дахин оролдох</Button>
            <button onClick={() => { stop(); onClose(); }} className="text-sm text-white/60">Хаах</button>
          </div>
        )}

        {phase === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm text-white/80">{progress || "Панорам угсарч байна…"}</p>
            {stitcherRef.current && stitcherRef.current.avgCorrectionDeg > 0.05 && (
              <p className="flex items-center gap-1.5 text-xs text-white/50">
                <Sparkles className="h-3 w-3" />
                хазайлт {stitcherRef.current.avgCorrectionDeg.toFixed(1)}° залруулав
              </p>
            )}
          </div>
        )}

        {phase === "capturing" && (
          <>
            <button
              onClick={() => { stop(); onClose(); }}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm backdrop-blur">
              {done} / {total}
              <span className="text-xs text-white/50">{panoSize === 4096 ? "· Өндөр чанар" : ""}</span>
            </div>
            {hint && (
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-2 text-xs font-medium text-black">
                {hint}
              </div>
            )}
          </>
        )}
      </div>

      {/* bottom controls */}
      {phase === "capturing" && (
        <div className="space-y-4 bg-black px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent}%` }} />
          </div>

          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="whitespace-nowrap">Камерын өнцөг</span>
            <input
              type="range" min={45} max={90} step={1} value={hFov}
              onChange={(e) => setHFov(Number(e.target.value))}
              className="flex-1 accent-white"
            />
            <span className="w-8 text-right">{hFov}°</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="glass" size="sm" onClick={reset}>
              <RotateCcw /> Дахин
            </Button>
            <span className={cn("text-xs", done >= 6 ? "text-white/60" : "text-white/40")}>
              {done < 6 ? "Дор хаяж 6 цэг авна уу" : "Дуусгахад бэлэн"}
            </span>
            <Button size="sm" disabled={done < 6} onClick={finish} className="bg-white text-black hover:bg-white/90">
              <Check /> Дуусгах
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
