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
  frames = 0;

  constructor(width = 2048) {
    this.width = width;
    this.height = width / 2;
    const n = this.width * this.height;
    this.rgb = new Uint8ClampedArray(n * 4);
    this.weight = new Uint8Array(n);
    // neutral dark fill for regions the user never covered
    for (let i = 0; i < n; i++) {
      this.rgb[i * 4] = 26; this.rgb[i * 4 + 1] = 26; this.rgb[i * 4 + 2] = 28; this.rgb[i * 4 + 3] = 255;
    }
  }

  get coverage() {
    let filled = 0;
    for (let i = 0; i < this.weight.length; i += 7) if (this.weight[i] > 0) filled++;
    return filled / Math.ceil(this.weight.length / 7);
  }

  /**
   * Paint one camera frame onto the sphere.
   * @param frame  pixels straight from the video element
   * @param r      camera→world rotation for this frame
   * @param hFovDeg horizontal field of view of the phone camera
   */
  addFrame(frame: ImageData, r: Mat3, hFovDeg: number) {
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

        const sx = (halfW + u) | 0;
        const sy = (halfH - v) | 0;
        if (sx < 0 || sx >= fw || sy < 0 || sy >= fh) continue;

        // feathered weight — 0 at the frame border, 255 in the middle
        const wx = 1 - Math.abs(u) / halfW;
        const wy = 1 - Math.abs(v) / halfH;
        const w = (Math.sqrt(Math.min(wx, wy)) * 255) | 0;
        if (w <= 0) continue;

        const si = (sy * fw + sx) * 4;
        const oi = (rowOut + px) * 4;
        const prev = this.weight[rowOut + px];
        const a = w / (w + prev + 1);

        this.rgb[oi] += (src[si] - this.rgb[oi]) * a;
        this.rgb[oi + 1] += (src[si + 1] - this.rgb[oi + 1]) * a;
        this.rgb[oi + 2] += (src[si + 2] - this.rgb[oi + 2]) * a;
        if (w > prev) this.weight[rowOut + px] = w;
      }
    }
    this.frames++;
  }

  toCanvas(): HTMLCanvasElement {
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
