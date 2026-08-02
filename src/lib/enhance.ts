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

  // ---- 1. edge-aware denoise (bilateral-lite over a 3×3 window) ----
  // The weight only depends on |luma difference|, so it is a 256-entry lookup
  // instead of an exp() per tap — that alone is most of the speed here.
  if (o.denoise > 0) {
    const sigma = 26 / Math.max(0.05, o.denoise);
    const lut = new Float32Array(256);
    for (let d = 0; d < 256; d++) lut[d] = Math.exp(-(d * d) / (2 * sigma * sigma));

    const lum = new Float32Array(W * H);
    for (let i = 0, p = 0; p < W * H; p++, i += 4) lum[p] = luma(src, i);

    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const c = p * 4;
        const lc = lum[p];
        let wsum = 0, a0 = 0, a1 = 0, a2 = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const row = (y + dy) * W;
          for (let dx = -1; dx <= 1; dx++) {
            const q = row + (((x + dx) % W) + W) % W;
            const w = lut[(Math.abs(lum[q] - lc) | 0) & 255];
            const n = q * 4;
            wsum += w;
            a0 += src[n] * w; a1 += src[n + 1] * w; a2 += src[n + 2] * w;
          }
        }
        const b = o.denoise, inv = 1 / wsum;
        out[c] = src[c] * (1 - b) + a0 * inv * b;
        out[c + 1] = src[c + 1] * (1 - b) + a1 * inv * b;
        out[c + 2] = src[c + 2] * (1 - b) + a2 * inv * b;
      }
    }
  }

  // ---- 2. unsharp mask, separable 3×3 box blur (6 taps instead of 27) ----
  if (o.sharpen > 0) {
    const base = new Uint8ClampedArray(out);
    const tmp = new Float32Array(W * H * 3);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o1 = (y * W + x) * 3;
        const l = (y * W + (((x - 1) % W) + W) % W) * 4;
        const c = (y * W + x) * 4;
        const r = (y * W + (x + 1) % W) * 4;
        tmp[o1] = (base[l] + base[c] + base[r]) / 3;
        tmp[o1 + 1] = (base[l + 1] + base[c + 1] + base[r + 1]) / 3;
        tmp[o1 + 2] = (base[l + 2] + base[c + 2] + base[r + 2]) / 3;
      }
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const c = p * 4, t = p * 3;
        const up = t - W * 3, dn = t + W * 3;
        for (let ch = 0; ch < 3; ch++) {
          const blur = (tmp[up + ch] + tmp[t + ch] + tmp[dn + ch]) / 3;
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

/* ------------------------------------------------------------ AI upscale -- */

/**
 * Free, on-device 2× super-resolution.
 *
 * Model: ESRGAN-slim from UpscalerJS — MIT licensed, 900 KB of weights served
 * by jsDelivr. No account, no API key, no server: TensorFlow.js runs it in the
 * browser, so the panorama never leaves the phone.
 *
 *   https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/models/x2/model.json
 *
 * The network is fully convolutional (input [null, null, null, 3]) so it takes
 * any tile size; we feed overlapping tiles and crop the seams away.
 */
const TFJS_CDN = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
const MODEL_URL =
  process.env.NEXT_PUBLIC_SR_MODEL_URL ||
  "https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/models/x2/model.json";

/** Upscaling a 4096-wide sphere would need ~130 MB of pixels — not worth it. */
const MAX_INPUT_WIDTH = 2048;

interface TfTensor {
  dispose(): void;
  data(): Promise<Float32Array>;
  shape: number[];
}
interface TfNamespace {
  ready(): Promise<void>;
  loadLayersModel(url: string): Promise<{ predict(t: TfTensor): TfTensor }>;
  browser: { fromPixels(src: ImageData | HTMLCanvasElement): TfTensor };
  tidy<T>(fn: () => T): T;
  div(a: TfTensor, b: number): TfTensor;
  mul(a: TfTensor, b: number): TfTensor;
  clipByValue(a: TfTensor, min: number, max: number): TfTensor;
  expandDims(a: TfTensor, axis: number): TfTensor;
  squeeze(a: TfTensor): TfTensor;
  setBackend(name: string): Promise<boolean>;
}

declare global {
  interface Window { tf?: TfNamespace }
}

/** Always available — the model is public and needs no configuration. */
export function aiUpscaleAvailable(width = 0) {
  if (process.env.NEXT_PUBLIC_DISABLE_AI === "1") return false;
  return width === 0 || width <= MAX_INPUT_WIDTH;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("TensorFlow.js ачаалагдсангүй"));
    document.head.appendChild(el);
  });
}

let modelPromise: Promise<{ predict(t: TfTensor): TfTensor }> | null = null;

/**
 * Doubles the resolution of a panorama with the ESRGAN-slim network.
 * Returns null when the input is already large or anything goes wrong —
 * callers keep the original image in that case.
 */
export async function aiUpscale(
  canvas: HTMLCanvasElement,
  onProgress?: (done: number, total: number) => void,
  tile = 192,
  overlap = 8,
): Promise<HTMLCanvasElement | null> {
  if (!aiUpscaleAvailable(canvas.width)) return null;

  await loadScript(TFJS_CDN);
  const tf = window.tf;
  if (!tf) return null;
  await tf.ready();

  if (!modelPromise) modelPromise = tf.loadLayersModel(MODEL_URL);
  const model = await modelPromise;

  const srcCtx = canvas.getContext("2d", { willReadFrequently: true })!;
  const out = document.createElement("canvas");
  out.width = canvas.width * 2;
  out.height = canvas.height * 2;
  const outCtx = out.getContext("2d")!;

  const cols = Math.ceil(canvas.width / tile);
  const rows = Math.ceil(canvas.height / tile);
  const total = cols * rows;
  let done = 0;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      // read the tile with a margin so the convolutions have context
      const x0 = Math.max(0, tx * tile - overlap);
      const y0 = Math.max(0, ty * tile - overlap);
      const x1 = Math.min(canvas.width, (tx + 1) * tile + overlap);
      const y1 = Math.min(canvas.height, (ty + 1) * tile + overlap);
      const patch = srcCtx.getImageData(x0, y0, x1 - x0, y1 - y0);

      const result = tf.tidy(() =>
        tf.clipByValue(
          tf.mul(
            tf.squeeze(
              model.predict(tf.expandDims(tf.div(tf.browser.fromPixels(patch), 255), 0)) as TfTensor,
            ),
            255,
          ),
          0,
          255,
        ),
      );
      const [h, w] = result.shape;
      const raw = await result.data();
      result.dispose();

      const img = new ImageData(w, h);
      for (let i = 0, p = 0; p < w * h; p++, i += 4) {
        img.data[i] = raw[p * 3];
        img.data[i + 1] = raw[p * 3 + 1];
        img.data[i + 2] = raw[p * 3 + 2];
        img.data[i + 3] = 255;
      }

      // drop the margin, then paste at 2× coordinates
      const cropX = (tx * tile - x0) * 2;
      const cropY = (ty * tile - y0) * 2;
      const keepW = Math.min(tile * 2, w - cropX);
      const keepH = Math.min(tile * 2, h - cropY);

      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      tmp.getContext("2d")!.putImageData(img, 0, 0);
      outCtx.drawImage(tmp, cropX, cropY, keepW, keepH, tx * tile * 2, ty * tile * 2, keepW, keepH);

      onProgress?.(++done, total);
      await new Promise((r) => setTimeout(r, 0));    // keep the UI alive
    }
  }

  return out;
}
