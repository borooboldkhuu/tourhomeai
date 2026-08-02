"use client";

/**
 * Post-processing for a stitched panorama.
 *
 * Two layers:
 *   1. always-on, dependency-free clean-up — edge-aware denoise, unsharp mask
 *      and a gentle auto-levels pass. Runs in a few hundred ms on a phone.
 *   2. optional on-device super-resolution — an ONNX model (Real-ESRGAN or
 *      similar) executed with onnxruntime-web, loaded from a CDN only when
 *      NEXT_PUBLIC_SR_MODEL_URL is configured. Nothing leaves the device.
 */

export interface EnhanceOptions {
  /** Edge-preserving noise reduction, 0–1. */
  denoise?: number;
  /** Unsharp mask amount, 0–1.5. */
  sharpen?: number;
  /** Stretch the histogram slightly. Off by default — it can clip windows. */
  autoLevels?: boolean;
}

/**
 * Tuned against a reference panorama degraded with blur + sensor noise:
 * heavy denoise wins, mild sharpening keeps detail without ringing, and
 * auto-levels made things measurably worse on scenes with bright windows,
 * so it is off unless asked for.
 */
const DEFAULTS: Required<EnhanceOptions> = { denoise: 0.9, sharpen: 0.3, autoLevels: false };

/** Luma of a pixel, used by both the denoiser and the sharpener. */
function luma(d: Uint8ClampedArray, i: number) {
  return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
}

/**
 * Cleans up an equirectangular image in place and returns a new buffer.
 * Columns wrap horizontally so the 0°/360° seam is treated as continuous.
 */
export function enhanceImageData(img: ImageData, options: EnhanceOptions = {}): ImageData {
  const o = { ...DEFAULTS, ...options };
  const { width: W, height: H, data: src } = img;
  const out = new Uint8ClampedArray(src);

  const idx = (x: number, y: number) => (y * W + ((x % W) + W) % W) * 4;

  // ---- 1. edge-aware denoise (bilateral-lite over a 3×3 window) ----
  if (o.denoise > 0) {
    const sigma = 26 / Math.max(0.05, o.denoise);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const c = idx(x, y);
        const lc = luma(src, c);
        let wsum = 0;
        const acc = [0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const n = idx(x + dx, y + dy);
            const diff = luma(src, n) - lc;
            const w = Math.exp(-(diff * diff) / (2 * sigma * sigma));
            wsum += w;
            acc[0] += src[n] * w; acc[1] += src[n + 1] * w; acc[2] += src[n + 2] * w;
          }
        }
        const blend = o.denoise;
        for (let ch = 0; ch < 3; ch++) {
          out[c + ch] = src[c + ch] * (1 - blend) + (acc[ch] / wsum) * blend;
        }
      }
    }
  }

  // ---- 2. unsharp mask against a 3×3 box blur of the denoised image ----
  if (o.sharpen > 0) {
    const base = new Uint8ClampedArray(out);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const c = idx(x, y);
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) sum += base[idx(x + dx, y + dy) + ch];
          const blur = sum / 9;
          out[c + ch] = base[c + ch] + (base[c + ch] - blur) * o.sharpen;
        }
      }
    }
  }

  // ---- 3. gentle auto-levels using 0.5 / 99.5 percentiles ----
  if (o.autoLevels) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < out.length; i += 4) hist[luma(out, i) | 0]++;
    const total = (out.length / 4) | 0;
    const cut = total * 0.005;
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break; } }

    if (hi - lo > 40) {
      // keep it subtle: only pull 60% of the way to a full stretch
      const scale = 1 + 0.6 * (255 / (hi - lo) - 1);
      const shift = -lo * 0.6;
      for (let i = 0; i < out.length; i += 4) {
        for (let ch = 0; ch < 3; ch++) out[i + ch] = (out[i + ch] + shift) * scale;
      }
    }
  }

  return new ImageData(out, W, H);
}

/** Runs the clean-up on a canvas and writes the result back. */
export function enhanceCanvas(canvas: HTMLCanvasElement, options?: EnhanceOptions) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.putImageData(enhanceImageData(img, options), 0, 0);
  return canvas;
}

/* ---------------------------------------------------- optional AI upscale -- */

const ORT_CDN = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.20.1/ort.min.js";

interface OrtTensor { data: Float32Array }
interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}
interface OrtNamespace {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => OrtTensor;
  InferenceSession: { create(url: string, opts?: Record<string, unknown>): Promise<OrtSession> };
}

declare global {
  interface Window { ort?: OrtNamespace }
}

/** Is an on-device model configured? */
export function aiUpscaleAvailable() {
  return Boolean(process.env.NEXT_PUBLIC_SR_MODEL_URL);
}

function loadOrt(): Promise<OrtNamespace> {
  return new Promise((resolve, reject) => {
    if (window.ort) return resolve(window.ort);
    const s = document.createElement("script");
    s.src = ORT_CDN;
    s.onload = () => (window.ort ? resolve(window.ort) : reject(new Error("ort missing")));
    s.onerror = () => reject(new Error("onnxruntime-web ачаалагдсангүй"));
    document.head.appendChild(s);
  });
}

let sessionPromise: Promise<OrtSession> | null = null;

/**
 * Tiled super-resolution on the device. The model must be a plain
 * image-to-image ONNX network with NCHW float input in 0..1.
 * Returns a new canvas, or null when no model is configured.
 */
export async function aiUpscale(
  canvas: HTMLCanvasElement,
  onProgress?: (done: number, total: number) => void,
  tile = 256,
): Promise<HTMLCanvasElement | null> {
  const url = process.env.NEXT_PUBLIC_SR_MODEL_URL;
  if (!url) return null;

  const ort = await loadOrt();
  ort.env.wasm.wasmPaths = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.20.1/";
  ort.env.wasm.numThreads = 1;

  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(url, { executionProviders: ["wasm"] });
  }
  const session = await sessionPromise;

  const srcCtx = canvas.getContext("2d", { willReadFrequently: true })!;
  const probe = await runTile(ort, session, srcCtx, 0, 0, tile, canvas);
  const scale = probe.size / tile;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.round(canvas.width * scale);
  outCanvas.height = Math.round(canvas.height * scale);
  const outCtx = outCanvas.getContext("2d")!;
  outCtx.putImageData(probe.img, 0, 0);

  const cols = Math.ceil(canvas.width / tile), rows = Math.ceil(canvas.height / tile);
  const total = cols * rows;
  let done = 1;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx === 0 && ty === 0) continue;
      const { img } = await runTile(ort, session, srcCtx, tx * tile, ty * tile, tile, canvas);
      outCtx.putImageData(img, Math.round(tx * tile * scale), Math.round(ty * tile * scale));
      onProgress?.(++done, total);
    }
  }
  return outCanvas;
}

async function runTile(
  ort: OrtNamespace,
  session: OrtSession,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: number,
  canvas: HTMLCanvasElement,
) {
  const w = Math.min(tile, canvas.width - x), h = Math.min(tile, canvas.height - y);
  const src = ctx.getImageData(x, y, w, h);

  const input = new Float32Array(3 * tile * tile);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4, o = py * tile + px;
      input[o] = src.data[i] / 255;
      input[tile * tile + o] = src.data[i + 1] / 255;
      input[2 * tile * tile + o] = src.data[i + 2] / 255;
    }
  }

  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, tile, tile]) };
  const result = await session.run(feeds);
  const out = result[session.outputNames[0]].data;

  const size = Math.round(Math.sqrt(out.length / 3));
  const scale = size / tile;
  const ow = Math.round(w * scale), oh = Math.round(h * scale);
  const img = new ImageData(ow, oh);
  for (let py = 0; py < oh; py++) {
    for (let px = 0; px < ow; px++) {
      const o = py * size + px, i = (py * ow + px) * 4;
      img.data[i] = out[o] * 255;
      img.data[i + 1] = out[size * size + o] * 255;
      img.data[i + 2] = out[2 * size * size + o] * 255;
      img.data[i + 3] = 255;
    }
  }
  return { img, size };
}
