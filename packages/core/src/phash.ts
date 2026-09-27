import { PNG } from "pngjs";

/**
 * Perceptual fingerprint, 128 bits (32 hex chars):
 *  - first 64 bits: dHash over a 9x8 grayscale thumbnail (bit = pixel brighter
 *    than its right neighbour) - captures gradient structure
 *  - last 64 bits: aHash over an 8x8 thumbnail (bit = pixel brighter than the
 *    mean) - captures brightness distribution, which dHash misses
 *
 * Compare with Hamming distance: 0 = identical, roughly <= 18 is typically
 * the same photo after recompression, resize or mild crops.
 *
 * PNG-only for now: the signing surface decodes with pngjs so the SDK has no
 * native dependencies. JPEG/WebP decoding lands with the watermark package.
 */
export async function perceptualHash(pngBytes: Uint8Array): Promise<string> {
  const png = PNG.sync.read(Buffer.from(pngBytes));

  function grayThumb(w: number, h: number): number[] {
    const gray = new Array<number>(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Nearest-neighbour downsample into the thumbnail grid.
        const sx = Math.min(png.width - 1, Math.floor((x * png.width) / w));
        const sy = Math.min(png.height - 1, Math.floor((y * png.height) / h));
        const idx = (sy * png.width + sx) * 4;
        const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2];
        gray[y * w + x] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
    return gray;
  }

  // dHash: 9x8, horizontal gradient.
  const d = grayThumb(9, 8);
  let dBits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      dBits <<= 1n;
      if (d[y * 9 + x] > d[y * 9 + x + 1]) dBits |= 1n;
    }
  }

  // aHash: 8x8, brightness vs mean.
  const a = grayThumb(8, 8);
  const mean = a.reduce((acc, v) => acc + v, 0) / a.length;
  let aBits = 0n;
  for (const v of a) {
    aBits <<= 1n;
    if (v > mean) aBits |= 1n;
  }

  return dBits.toString(16).padStart(16, "0") + aBits.toString(16).padStart(16, "0");
}

/** Hamming distance between two hex fingerprints of equal length. */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let d = 0;
  while (x > 0n) { d += Number(x & 1n); x >>= 1n; }
  return d;
}
