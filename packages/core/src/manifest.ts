/**
 * Tether manifest model.
 *
 * A Tether manifest is a platform-issued, signed attestation bound to a photo.
 * It is deliberately aligned with C2PA's assertion/manifest model so that
 * interop with C2PA tooling (c2pa-rs / c2pa-node) can be layered on later:
 * Tether is a vertical trust layer ON C2PA, not a new provenance primitive.
 */

/** A single platform claim about the photo (e.g. uploader, listing, consent). */
export interface Claim {
  /** Claim type, namespaced, e.g. "tether.dating/uploader-attested". */
  type: string;
  /** Claim payload. Keep it privacy-safe: attestations, not raw identity. */
  value: unknown;
}

/** Content bindings: the "soft binding" pair that survives recompression. */
export interface ContentBinding {
  /** SHA-256 of the exact file bytes. Breaks on any recompression. */
  sha256: string;
  /**
   * 64-bit dHash perceptual fingerprint (hex). Survives recompression,
   * resizing and mild crops; used for similarity matching.
   */
  phash: string;
  /** Byte length of the signed payload. */
  bytes: number;
}

export interface WatermarkInfo {
  /** Watermark algorithm identifier, or null when not embedded. */
  algorithm: string | null;
  /** Whether a recoverable invisible watermark was embedded. */
  embedded: boolean;
}

export interface SignatureInfo {
  /** "Ed25519" today; "ML-DSA-65" (Dilithium) reserved for PQ signers. */
  algorithm: "Ed25519" | "ML-DSA-65";
  /** Hex-encoded public key that verifies `value`. */
  publicKey: string;
  /** Hex-encoded signature over the canonical manifest payload. */
  value: string;
}

export interface Issuer {
  /** Stable platform identifier, e.g. "dating.example.com". */
  id: string;
  /** Human-readable platform name. */
  name: string;
}

/** The signed manifest as stored and returned to verifiers. */
export interface Manifest {
  version: "tether/0.1";
  manifestId: string;
  issuer: Issuer;
  claims: Claim[];
  content: ContentBinding;
  watermark: WatermarkInfo;
  signature: SignatureInfo;
  createdAt: string; // ISO 8601
}

/**
 * Canonical signing payload: every manifest field except the signature,
 * serialized with stable key order. Signatures are computed over these bytes.
 */
export function signingPayload(manifest: Omit<Manifest, "signature">): Uint8Array {
  // Defensive: never let a signature field into its own signing payload.
  const unsigned = { ...(manifest as Manifest) };
  delete (unsigned as Partial<Manifest>).signature;
  return new TextEncoder().encode(stableStringify(unsigned));
}

/** Deterministic JSON: object keys sorted recursively, arrays keep order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}
