"use client";

/**
 * In-browser 360° panorama stitching.
 *
 * The phone's gyroscope tells us where the camera is pointing for every frame.
 * Each frame is inverse-projected onto an equirectangular canvas, so no feature
 * matching is required — accuracy comes from the device orientation sensors.
 *
 * Conventions
 *   world space : right-handed, +y up.  yaw = atan2(x, z), pitch = asin(y)
 *   equirect    : x = (yaw/2π + 0.5)·W,  y = (0.5 − pitch/π)·H
 *   camera      : looks down −z (same as three.js / WebXR)
 */

export type Mat3 = Float64Array; // row-major, world = R · camera

const DEG = Math.PI / 180;

/**
 * Per-channel difference above which a frame is assumed to be looking at
 * something that moved, and is therefore kept out of the low-frequency
 * average so a passer-by cannot tint the whole region.
 */
const MOTION_TOLERANCE = 60;

/* ------------------------------------------------------------------ math -- */

/**
 * Device orientation (W3C alpha/beta/gamma) → rotation matrix.
 * Mirrors three.js DeviceOrientationControls: Euler YXZ, then −90° about X so
 * the camera looks out of the back of the phone, then the screen rotation.
 */
export function orientationToMatrix(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
): Mat3 {
  const alpha = alphaDeg * DEG;
  const beta = betaDeg * DEG;
  const gamma = gammaDeg * DEG;
  const orient = screenAngleDeg * DEG;

  // Euler 'YXZ' → quaternion  (x: beta, y: alpha, z: −gamma)
  const c1 = Math.cos(beta / 2), s1 = Math.sin(beta / 2);
  const c2 = Math.cos(alpha / 2), s2 = Math.sin(alpha / 2);
  const c3 = Math.cos(-gamma / 2), s3 = Math.sin(-gamma / 2);

  let q: [number, number, number, number] = [
    s1 * c2 * c3 + c1 * s2 * s3, // x
    c1 * s2 * c3 - s1 * c2 * s3, // y
    c1 * c2 * s3 - s1 * s2 * c3, // z
    c1 * c2 * c3 + s1 * s2 * s3, // w
  ];

  const HALF = Math.SQRT1_2;
  q = mulQuat(q, [-HALF, 0, 0, HALF]);                                  // −90° about X
  q = mulQuat(q, [0, 0, Math.sin(-orient / 2), Math.cos(-orient / 2)]); // screen rotation

  return quatToMatrix(q);
}

function mulQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quatToMatrix(q: [number, number, number, number]): Mat3 {
  const [x, y, z, w] = q;
  const m = new Float64Array(9);
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  m[0] = 1 - (yy + zz); m[1] = xy - wz;       m[2] = xz + wy;
  m[3] = xy + wz;       m[4] = 1 - (xx + zz); m[5] = yz - wx;
  m[6] = xz - wy;       m[7] = yz + wx;       m[8] = 1 - (xx + yy);
  return m;
}

/** R' = Rx(dPitch) · Ry(dYaw) · R — nudges a camera pose in world space. */
export function rotateBy(r: Mat3, dYawDeg: number, dPitchDeg: number): Mat3 {
  const y = dYawDeg * DEG, p = dPitchDeg * DEG;
  const cy = Math.cos(y), sy = Math.sin(y);
  const cp = Math.cos(p), sp = Math.sin(p);
  // M = Rx(p) · Ry(y)
  const m = [
    cy, 0, sy,
    sp * sy, cp, -sp * cy,
    -cp * sy, sp, cp * cy,
  ];
  const o = new Float64Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = m[i * 3] * r[j] + m[i * 3 + 1] * r[3 + j] + m[i * 3 + 2] * r[6 + j];
  return o;
}

/** Rᵀ · A — used to express later frames relative to the first one. */
export function transposeMul(r: Mat3, a: Mat3): Mat3 {
  const o = new Float64Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      o[i * 3 + j] = r[i] * a[j] + r[3 + i] * a[3 + j] + r[6 + i] * a[6 + j];
    }
  }
  return o;
}

/** Direction the camera is pointing (world space). */
export function forwardOf(r: Mat3): [number, number, number] {
  return [-r[2], -r[5], -r[8]];
}

export function angleBetween(a: [number, number, number], b: [number, number, number]) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

export function dirFromYawPitch(yawDeg: number, pitchDeg: number): [number, number, number] {
  const y = yawDeg * DEG, p = pitchDeg * DEG;
  const cp = Math.cos(p);
  return [cp * Math.sin(y), Math.sin(p), cp * Math.cos(y)];
}

/* -------------------------------------------------------------- stitcher -- */

export interface CoverageTarget {
  yaw: number;
  pitch: number;
  dir: [number, number, number];
  done: boolean;
}

/** 18 aim points: a full ring, two tilted rings, zenith and nadir. */
export function buildTargets(): CoverageTarget[] {
  const specs: [number, number][] = [];
  for (let y = 0; y < 360; y += 45) specs.push([y, 0]);
  for (let y = 0; y < 360; y += 90) specs.push([y, 42]);
  for (let y = 45; y < 360; y += 90) specs.push([y, -42]);
  specs.push([0, 85], [0, -85]);
  return specs.map(([yaw, pitch]) => ({ yaw, pitch, dir: dirFromYawPitch(yaw, pitch), done: false }));
}

export class EquirectStitcher {
  readonly width: number;
  readonly height: number;
  private rgb: Uint8ClampedArray;
  private weight: Uint8Array;
  /**
   * Low-frequency accumulator at 1/4 resolution. Detail always comes from a
   * single frame (so a person who moved appears once, not twice), while the
   * slow brightness and colour drift between frames is averaged here and
   * folded back in at the end. That is what makes the seams disappear.
   */
  private lowW: number;
  private lowH: number;
  private lowSum: Float32Array;
  private lowWeight: Float32Array;
  frames = 0;
  /** Degrees of gyro drift removed from the last frame. */
  lastCorrectionDeg = 0;
  /** 0–1: how much of the last frame landed on already-captured pixels. */
  lastOverlap = 0;
  private corrections: number[] = [];

  private opts: { refine: boolean; matchExposure: boolean };

  constructor(width = 2048, opts: { refine?: boolean; matchExposure?: boolean } = {}) {
    this.opts = { refine: opts.refine ?? true, matchExposure: opts.matchExposure ?? true };
    this.width = width;
    this.height = width / 2;
    const n = this.width * this.height;
    this.rgb = new Uint8ClampedArray(n * 4);
    this.weight = new Uint8Array(n);

    this.lowW = this.width >> 2;
    this.lowH = this.height >> 2;
    this.lowSum = new Float32Array(this.lowW * this.lowH * 3);
    this.lowWeight = new Float32Array(this.lowW * this.lowH);
    // neutral dark fill for regions the user never covered
    for (let i = 0; i < n; i++) {
      this.rgb[i * 4] = 26; this.rgb[i * 4 + 1] = 26; this.rgb[i * 4 + 2] = 28; this.rgb[i * 4 + 3] = 255;
    }
  }

  /** Wipes the sphere so the same instance can composite a second time. */
  clear() {
    const n = this.width * this.height;
    this.weight.fill(0);
    this.lowSum.fill(0);
    this.lowWeight.fill(0);
    for (let i = 0; i < n; i++) {
      this.rgb[i * 4] = 26; this.rgb[i * 4 + 1] = 26; this.rgb[i * 4 + 2] = 28; this.rgb[i * 4 + 3] = 255;
    }
    this.frames = 0;
    this.corrections = [];
  }

  /** Average drift correction applied so far, in degrees. */
  get avgCorrectionDeg() {
    if (!this.corrections.length) return 0;
    return this.corrections.reduce((a, b) => a + b, 0) / this.corrections.length;
  }

  get coverage() {
    let filled = 0;
    for (let i = 0; i < this.weight.length; i += 7) if (this.weight[i] > 0) filled++;
    return filled / Math.ceil(this.weight.length / 7);
  }

  /**
   * Paint one camera frame onto the sphere.
   *
   * Before painting we do two corrections that make the difference between a
   * usable panorama and a broken one:
   *   1. drift — the gyroscope slowly wanders, so the frame is re-aligned
   *      against what is already on the sphere by maximising correlation over
   *      a small yaw/pitch search;
   *   2. exposure — phone cameras re-meter between shots, so each frame is
   *      scaled per channel to match the brightness of the overlap.
   *
   * @param frame  pixels straight from the video element
   * @param r      camera→world rotation for this frame
   * @param hFovDeg horizontal field of view of the phone camera
   */
  addFrame(frame: ImageData, r: Mat3, hFovDeg: number) {
    if (this.frames === 0) this.lastOverlap = 1;
    const aligned =
      this.frames === 0 || (!this.opts.refine && !this.opts.matchExposure)
        ? { r, gain: [1, 1, 1] as const, shift: 0 }
        : this.align(frame, r, hFovDeg);
    this.lastCorrectionDeg = aligned.shift;
    if (this.frames > 0) this.corrections.push(aligned.shift);
    this.paint(frame, aligned.r, hFovDeg, aligned.gain);
  }

  /* ------------------------------------------------------------- alignment -- */

  /** Grid of sample points inside the frame, avoiding the feathered border. */
  private sampleGrid(fw: number, fh: number) {
    const pts: [number, number][] = [];
    const nx = 22, ny = 16;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        pts.push([
          (-0.38 + (0.76 * ix) / (nx - 1)) * fw,
          (-0.38 + (0.76 * iy) / (ny - 1)) * fh,
        ]);
      }
    }
    return pts;
  }

  /**
   * Searches a small yaw/pitch offset that best lines the frame up with the
   * pixels already on the sphere, and measures the exposure difference.
   */
  private align(frame: ImageData, r: Mat3, hFovDeg: number) {
    const fw = frame.width, fh = frame.height;
    const f = (fw / 2) / Math.tan((hFovDeg * DEG) / 2);
    const pts = this.sampleGrid(fw, fh);

    const score = (rr: Mat3) => {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (const [u, v] of pts) {
        const len = Math.hypot(u, v, f);
        const cx = u / len, cy = v / len, cz = -f / len;
        const dx = rr[0] * cx + rr[1] * cy + rr[2] * cz;
        const dy = rr[3] * cx + rr[4] * cy + rr[5] * cz;
        const dz = rr[6] * cx + rr[7] * cy + rr[8] * cz;
        const yaw = Math.atan2(dx, dz);
        const pitch = Math.asin(Math.max(-1, Math.min(1, dy)));

        const px = Math.round(((yaw / (2 * Math.PI)) + 0.5) * this.width) % this.width;
        const py = Math.round((0.5 - pitch / Math.PI) * this.height);
        if (py < 0 || py >= this.height) continue;
        const idx = py * this.width + ((px + this.width) % this.width);
        if (this.weight[idx] < 40) continue;             // nothing solid there yet

        const sx = Math.round(fw / 2 + u), sy = Math.round(fh / 2 - v);
        if (sx < 0 || sx >= fw || sy < 0 || sy >= fh) continue;
        const si = (sy * fw + sx) * 4;
        const oi = idx * 4;
        const a = frame.data[si] * 0.299 + frame.data[si + 1] * 0.587 + frame.data[si + 2] * 0.114;
        const b = this.rgb[oi] * 0.299 + this.rgb[oi + 1] * 0.587 + this.rgb[oi + 2] * 0.114;
        n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
      }
      if (n < 50) return { ncc: -2, n };
      const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
      if (va <= 1e-6 || vb <= 1e-6) return { ncc: -2, n };
      return { ncc: (sab - (sa * sb) / n) / Math.sqrt(va * vb), n };
    };

    const first = score(r);
    this.lastOverlap = Math.min(1, first.n / pts.length);
    let best = { r, ncc: first.ncc, dy: 0, dp: 0 };
    if (best.ncc < -1) {
      return { r, gain: [1, 1, 1] as const, shift: 0 };   // no usable overlap
    }

    // coarse pass, then a finer one around the winner
    for (const [range, step] of (this.opts.refine ? [[3, 1], [0.75, 0.25], [0.2, 0.07]] : []) as [number, number][]) {
      const cy = best.dy, cp = best.dp;
      for (let dy = cy - range; dy <= cy + range + 1e-9; dy += step) {
        for (let dp = cp - range; dp <= cp + range + 1e-9; dp += step) {
          if (dy === best.dy && dp === best.dp) continue;
          const cand = rotateBy(r, dy, dp);
          const s = score(cand);
          if (s.ncc > best.ncc) best = { r: cand, ncc: s.ncc, dy, dp };
        }
      }
    }

    return {
      r: best.r,
      gain: this.opts.matchExposure
        ? this.exposureGain(frame, best.r, hFovDeg)
        : ([1, 1, 1] as const),
      shift: Math.hypot(best.dy, best.dp),
    };
  }

  /** Per-channel scale that makes this frame match the overlap it lands on. */
  private exposureGain(frame: ImageData, r: Mat3, hFovDeg: number): readonly [number, number, number] {
    const fw = frame.width, fh = frame.height;
    const f = (fw / 2) / Math.tan((hFovDeg * DEG) / 2);
    const sumA = [0, 0, 0], sumB = [0, 0, 0];
    let n = 0;

    for (const [u, v] of this.sampleGrid(fw, fh)) {
      const len = Math.hypot(u, v, f);
      const cx = u / len, cy = v / len, cz = -f / len;
      const dx = r[0] * cx + r[1] * cy + r[2] * cz;
      const dy = r[3] * cx + r[4] * cy + r[5] * cz;
      const dz = r[6] * cx + r[7] * cy + r[8] * cz;
      const px = Math.round(((Math.atan2(dx, dz) / (2 * Math.PI)) + 0.5) * this.width) % this.width;
      const py = Math.round((0.5 - Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI) * this.height);
      if (py < 0 || py >= this.height) continue;
      const idx = py * this.width + ((px + this.width) % this.width);
      if (this.weight[idx] < 40) continue;

      const sx = Math.round(fw / 2 + u), sy = Math.round(fh / 2 - v);
      if (sx < 0 || sx >= fw || sy < 0 || sy >= fh) continue;
      const si = (sy * fw + sx) * 4, oi = idx * 4;
      for (let c = 0; c < 3; c++) { sumA[c] += frame.data[si + c]; sumB[c] += this.rgb[oi + c]; }
      n++;
    }

    if (n < 50) return [1, 1, 1] as const;
    const g = [0, 1, 2].map((c) =>
      sumA[c] > 8 ? Math.min(1.35, Math.max(0.75, sumB[c] / sumA[c])) : 1,
    );
    return [g[0], g[1], g[2]] as const;
  }

  /* ---------------------------------------------------------------- paint -- */

  private paint(frame: ImageData, r: Mat3, hFovDeg: number, gain: readonly [number, number, number]) {
    const { width: W, height: H } = this;
    const fw = frame.width, fh = frame.height;
    const src = frame.data;
    const f = (fw / 2) / Math.tan((hFovDeg * DEG) / 2);

    // --- bounding box from the frame corners + centre ---
    const corners: [number, number, number][] = [
      [-fw / 2, fh / 2, -f], [fw / 2, fh / 2, -f],
      [-fw / 2, -fh / 2, -f], [fw / 2, -fh / 2, -f],
      [0, 0, -f],
    ];
    let minYaw = Infinity, maxYaw = -Infinity, minPitch = Infinity, maxPitch = -Infinity;
    for (const c of corners) {
      const len = Math.hypot(c[0], c[1], c[2]);
      const cx = c[0] / len, cy = c[1] / len, cz = c[2] / len;
      const dx = r[0] * cx + r[1] * cy + r[2] * cz;
      const dy = r[3] * cx + r[4] * cy + r[5] * cz;
      const dz = r[6] * cx + r[7] * cy + r[8] * cz;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.asin(Math.max(-1, Math.min(1, dy)));
      minYaw = Math.min(minYaw, yaw); maxYaw = Math.max(maxYaw, yaw);
      minPitch = Math.min(minPitch, pitch); maxPitch = Math.max(maxPitch, pitch);
    }

    const pad = 0.06;
    let x0: number, x1: number;
    if (maxYaw - minYaw > Math.PI || maxPitch > 1.35 || minPitch < -1.35) {
      x0 = 0; x1 = W - 1;                       // wraps the seam or touches a pole
    } else {
      x0 = Math.floor(((minYaw - pad) / (2 * Math.PI) + 0.5) * W);
      x1 = Math.ceil(((maxYaw + pad) / (2 * Math.PI) + 0.5) * W);
    }
    const y0 = Math.max(0, Math.floor((0.5 - (maxPitch + pad) / Math.PI) * H));
    const y1 = Math.min(H - 1, Math.ceil((0.5 - (minPitch - pad) / Math.PI) * H));

    const halfW = fw / 2, halfH = fh / 2;

    for (let py = y0; py <= y1; py++) {
      const phi = (0.5 - (py + 0.5) / H) * Math.PI;
      const cphi = Math.cos(phi), sphi = Math.sin(phi);
      const rowOut = py * W;

      for (let ix = x0; ix <= x1; ix++) {
        const px = ((ix % W) + W) % W;
        const theta = ((px + 0.5) / W - 0.5) * 2 * Math.PI;
        const dx = cphi * Math.sin(theta);
        const dy = sphi;
        const dz = cphi * Math.cos(theta);

        // camera space = Rᵀ · d
        const cz = r[2] * dx + r[5] * dy + r[8] * dz;
        if (cz > -1e-6) continue;                       // behind the camera
        const cx = r[0] * dx + r[3] * dy + r[6] * dz;
        const cy = r[1] * dx + r[4] * dy + r[7] * dz;

        const u = (f * cx) / -cz;
        const v = (f * cy) / -cz;
        if (u < -halfW || u > halfW || v < -halfH || v > halfH) continue;

        // bilinear sample — nearest neighbour visibly aliases at this scale
        const fx = halfW + u - 0.5;
        const fy = halfH - v - 0.5;
        const x0i = Math.floor(fx), y0i = Math.floor(fy);
        if (x0i < 0 || x0i + 1 >= fw || y0i < 0 || y0i + 1 >= fh) continue;
        const tx = fx - x0i, ty = fy - y0i;
        const i00 = (y0i * fw + x0i) * 4, i10 = i00 + 4;
        const i01 = i00 + fw * 4, i11 = i01 + 4;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty, w11 = tx * ty;

        // feathered weight — 0 at the frame border, 255 in the middle
        const wx = 1 - Math.abs(u) / halfW;
        const wy = 1 - Math.abs(v) / halfH;
        const w = (Math.sqrt(Math.min(wx, wy)) * 255) | 0;
        if (w <= 0) continue;

        const oi = (rowOut + px) * 4;
        const prev = this.weight[rowOut + px];

        const wins = w > prev;

        // low band: every agreeing frame contributes, weighted by its feather
        const lowIdx = ((py >> 2) * this.lowW + (px >> 2)) * 3;
        const fw01 = w / 255;
        let lowCounted = false;

        for (let c = 0; c < 3; c++) {
          const s =
            (src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11) *
            gain[c];

          // detail band: the single best frame wins outright — no averaging,
          // so moving objects cannot leave a second copy behind
          if (wins) this.rgb[oi + c] = s;

          if (wins || prev === 0 || Math.abs(s - this.rgb[oi + c]) < MOTION_TOLERANCE) {
            this.lowSum[lowIdx + c] += s * fw01;
            lowCounted = true;
          }
        }
        if (lowCounted) this.lowWeight[(py >> 2) * this.lowW + (px >> 2)] += fw01;
        if (wins) this.weight[rowOut + px] = w;
      }
    }
    this.frames++;
  }

  /* --------------------------------------------------------------- finish -- */

  /**
   * Caps the uncovered zenith/nadir with a soft colour taken from the nearest
   * captured pixels, so the poles read as ceiling and floor rather than as
   * two grey holes.
   */
  private fillHoles() {
    const { width: W, height: H } = this;

    const cap = (fromTop: boolean) => {
      const edge = new Int32Array(W).fill(-1);
      let rSum = 0, gSum = 0, bSum = 0, n = 0;

      for (let x = 0; x < W; x++) {
        for (let k = 0; k < H; k++) {
          const y = fromTop ? k : H - 1 - k;
          if (this.weight[y * W + x] > 0) {
            edge[x] = y;
            const i = (y * W + x) * 4;
            rSum += this.rgb[i]; gSum += this.rgb[i + 1]; bSum += this.rgb[i + 2];
            n++;
            break;
          }
        }
      }
      if (!n) return;
      const avg = [rSum / n, gSum / n, bSum / n];

      for (let x = 0; x < W; x++) {
        const y0 = edge[x];
        if (y0 < 0) continue;
        const e = (y0 * W + x) * 4;
        const edgeCol = [this.rgb[e], this.rgb[e + 1], this.rgb[e + 2]];
        const span = fromTop ? y0 : H - 1 - y0;
        if (span <= 0) continue;

        for (let k = 0; k < span; k++) {
          const y = fromTop ? y0 - 1 - k : y0 + 1 + k;
          const t = Math.min(1, (k + 1) / span);          // fade to the pole average
          const i = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) {
            this.rgb[i + c] = edgeCol[c] + (avg[c] - edgeCol[c]) * t;
          }
          this.rgb[i + 3] = 255;
        }
      }
    };

    cap(true);
    cap(false);
  }

  /**
   * Replaces each pixel's low frequencies with the blended average, keeping
   * its own detail. Equalises exposure and white balance across the whole
   * sphere; the correction is capped so a moving object cannot smear.
   */
  private applyLowBandCorrection(limit = 42) {
    const { width: W, height: H, lowW: LW, lowH: LH } = this;

    // the winner image's own low band, box-downsampled
    const win = new Float32Array(LW * LH * 3);
    const cnt = new Float32Array(LW * LH);
    for (let y = 0; y < H; y++) {
      const ly = y >> 2;
      for (let x = 0; x < W; x++) {
        if (!this.weight[y * W + x]) continue;
        const li = (ly * LW + (x >> 2)) * 3;
        const oi = (y * W + x) * 4;
        win[li] += this.rgb[oi];
        win[li + 1] += this.rgb[oi + 1];
        win[li + 2] += this.rgb[oi + 2];
        cnt[ly * LW + (x >> 2)]++;
      }
    }

    // difference map, sampled bilinearly back up to full resolution
    const diff = new Float32Array(LW * LH * 3);
    for (let i = 0; i < LW * LH; i++) {
      const wgt = this.lowWeight[i], n = cnt[i];
      if (wgt < 0.001 || n < 1) continue;
      for (let c = 0; c < 3; c++) {
        const blended = this.lowSum[i * 3 + c] / wgt;
        const own = win[i * 3 + c] / n;
        diff[i * 3 + c] = Math.max(-limit, Math.min(limit, blended - own));
      }
    }

    for (let y = 0; y < H; y++) {
      const fy = Math.min(LH - 1.001, (y - 1.5) / 4);
      const y0 = Math.max(0, Math.floor(fy)), ty = fy - y0;
      const y1 = Math.min(LH - 1, y0 + 1);

      for (let x = 0; x < W; x++) {
        if (!this.weight[y * W + x]) continue;
        const fx = (x - 1.5) / 4;
        const x0 = ((Math.floor(fx) % LW) + LW) % LW, tx = fx - Math.floor(fx);
        const x1 = (x0 + 1) % LW;

        const i00 = (y0 * LW + x0) * 3, i10 = (y0 * LW + x1) * 3;
        const i01 = (y1 * LW + x0) * 3, i11 = (y1 * LW + x1) * 3;
        const oi = (y * W + x) * 4;

        for (let c = 0; c < 3; c++) {
          const d =
            diff[i00 + c] * (1 - tx) * (1 - ty) + diff[i10 + c] * tx * (1 - ty) +
            diff[i01 + c] * (1 - tx) * ty + diff[i11 + c] * tx * ty;
          this.rgb[oi + c] += d;
        }
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    this.applyLowBandCorrection();
    this.fillHoles();
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(this.width, this.height);
    img.data.set(this.rgb);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  async toFile(name = `360-${Date.now()}.jpg`, quality = 0.86): Promise<File> {
    const canvas = this.toCanvas();
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
    );
    return new File([blob], name, { type: "image/jpeg" });
  }
}
