import type { Claim, Issuer } from "./manifest.js";

/**
 * What a verifier gets back: a provenance card, not a "real/fake" verdict.
 * The platform's attestation, the photo's history, and how well the presented
 * image matches what was signed.
 */
export interface ProvenanceCard {
  /** The manifest this card was built from. */
  manifestId: string;
  issuer: Issuer;
  createdAt: string;
  claims: Claim[];
  /**
   * How the presented image relates to the signed bytes:
   *  - "exact": SHA-256 match, byte-identical to what was signed
   *  - "similar": perceptual fingerprint match (recompressed/resized/cropped)
   *  - "mismatch": no known manifest matches this image
   */
  integrity: "exact" | "similar" | "mismatch";
  /** Hamming distance between fingerprints (0 when exact). */
  similarity: number;
  /** True when the manifest signature verifies against the issuer key. */
  signatureValid: boolean;
  /** True when the issuer has revoked this manifest. */
  revoked: boolean;
  /** All manifests recorded for this photo family, newest first. */
  history: { manifestId: string; createdAt: string; revoked: boolean }[];
}
