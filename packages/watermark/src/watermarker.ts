/**
 * Recoverable invisible watermark: embeds a payload that survives download,
 * recompression, cropping and screenshots, so a stripped-metadata image can
 * still be traced back to its manifest.
 *
 * STATUS: interface only. The embedding implementation (DCT-domain spread
 * spectrum, aligned with C2PA Durable Content Credentials' soft-binding
 * approach) is the next build milestone. See packages/watermark/README.md.
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
