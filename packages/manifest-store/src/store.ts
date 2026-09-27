import type { Manifest } from "@tether/core";

/**
 * Tamper-evident manifest repository. The platform (or Tether's hosted
 * repository) records every signed manifest; verifiers look manifests up by
 * content hash or fingerprint. Implementations must be append-only: history
 * is the product.
 */
export interface ManifestStore {
  put(manifest: Manifest): Promise<void>;
  /** Exact lookup by content SHA-256. */
  getByContentHash(sha256: string): Promise<Manifest | null>;
  /** Fuzzy lookup by perceptual fingerprint, max Hamming distance. */
  findByFingerprint(phash: string, maxDistance: number): Promise<Manifest[]>;
  /** All manifests issued by a platform, newest first. */
  historyForIssuer(issuerId: string): Promise<Manifest[]>;
  /** Revoke a manifest (e.g. consent withdrawn). Revocation is itself recorded. */
  revoke(manifestId: string): Promise<void>;
  isRevoked(manifestId: string): Promise<boolean>;
}
