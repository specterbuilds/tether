import { PNG } from "pngjs";
import type { Watermarker } from "./watermarker.js";

/**
 * LSB (least-significant-bit) steganographic watermarker for PNG.
 *
 * Embeds the payload in the low bit of each RGB sample (alpha is left intact),
 * behind a magic + length header so extraction can detect absence and bound the
 * read. PNG is lossless, so the payload survives download, re-saving and any
 * lossless re-encode (including the registry's sharp PNG normalization).
 *
 * HONEST LIMITS: this is a fragile binding, not a durable one. It does NOT
 * survive recompression (JPEG/WebP), resizing, cropping or screenshots - the
 * low bits are the first thing lossy pipelines discard. For resilience to those,
 * Tether's perceptual hash (soft binding) and the embedded C2PA manifest are the
 * right layers; a DCT-domain spread-spectrum mark is the future upgrade here.
 */
const MAGIC = new Uint8Array([0x54, 0x54, 0x57, 0x31]); // "TTW1"
const HEADER_BYTES = MAGIC.length + 4; // magic + uint32 length

export class LsbWatermarker implements Watermarker {
  readonly algorithm = "lsb-v1";

  async embed(imageBytes: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
    const png = PNG.sync.read(Buffer.from(imageBytes));
    const header = new Uint8Array(HEADER_BYTES);
    header.set(MAGIC, 0);
    new DataView(header.buffer).setUint32(MAGIC.length, payload.length, false);
    const bitstream = concat(header, payload);

    const capacityBits = rgbSampleCount(png.data.length);
    if (bitstream.length * 8 > capacityBits)
      throw new Error("Watermark payload is too large for this image.");

    writeBits(png.data, bitstream);
    return PNG.sync.write(png);
  }

  async extract(imageBytes: Uint8Array): Promise<Uint8Array | null> {
    let png: PNG;
    try {
      png = PNG.sync.read(Buffer.from(imageBytes));
    } catch {
      return null; // not a PNG / undecodable
    }
    const capacityBits = rgbSampleCount(png.data.length);
    if (capacityBits < HEADER_BYTES * 8) return null;

    const header = readBits(png.data, HEADER_BYTES);
    for (let i = 0; i < MAGIC.length; i++) if (header[i] !== MAGIC[i]) return null;
    const length = new DataView(header.buffer).getUint32(MAGIC.length, false);
    if (length < 0 || (HEADER_BYTES + length) * 8 > capacityBits) return null;

    return readBits(png.data, HEADER_BYTES + length).subarray(HEADER_BYTES);
  }
}

/** RGBA buffer carries 3 usable samples (R,G,B) per 4 bytes; alpha is skipped. */
function rgbSampleCount(byteLength: number): number {
  return Math.floor(byteLength / 4) * 3;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Walks RGB samples (skipping every 4th/alpha byte) writing one bit each. */
function writeBits(data: Buffer, bytes: Uint8Array): void {
  let bit = 0;
  const total = bytes.length * 8;
  for (let i = 0; i < data.length && bit < total; i++) {
    if (i % 4 === 3) continue; // alpha channel
    const value = (bytes[bit >> 3] >> (7 - (bit % 8))) & 1;
    data[i] = (data[i] & 0xfe) | value;
    bit++;
  }
}

function readBits(data: Buffer, byteCount: number): Uint8Array {
  const out = new Uint8Array(byteCount);
  let bit = 0;
  const total = byteCount * 8;
  for (let i = 0; i < data.length && bit < total; i++) {
    if (i % 4 === 3) continue; // alpha channel
    if (data[i] & 1) out[bit >> 3] |= 1 << (7 - (bit % 8));
    bit++;
  }
  return out;
}
