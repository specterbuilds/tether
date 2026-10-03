/**
 * Invisible watermark: embeds a payload in image pixels so a stripped-metadata
 * image can still carry a pointer back to its manifest.
 *
 * Implementations: `LsbWatermarker` is a working lossless embedder (survives PNG
 * re-encoding, not recompression); `NoOpWatermarker` is the pass-through default.
 * A DCT-domain spread-spectrum mark aligned with C2PA Durable Content
 * Credentials' soft binding (durable across recompression) is the next upgrade.
 */
export interface Watermarker {
  readonly algorithm: string;
  /** Returns image bytes with the payload invisibly embedded. */
  embed(imageBytes: Uint8Array, payload: Uint8Array): Promise<Uint8Array>;
  /** Recovers the payload from a possibly-damaged image, or null. */
  extract(imageBytes: Uint8Array): Promise<Uint8Array | null>;
}

/** No-op watermarker used until the DCT implementation lands. */
export class NoOpWatermarker implements Watermarker {
  readonly algorithm = "none";
  async embed(imageBytes: Uint8Array): Promise<Uint8Array> {
    return imageBytes;
  }
  async extract(): Promise<Uint8Array | null> {
    return null;
  }
}
