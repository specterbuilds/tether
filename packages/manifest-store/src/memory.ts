import { hammingDistance, type Manifest } from "@tether/core";
import type { ManifestStore } from "./store.js";

/**
 * In-memory reference implementation, for tests, demos and local dev.
 * Production stores: Postgres adapter (platform-side) and the hosted
 * Tether repository are planned packages; both must keep this append-only
 * contract.
 */
export class InMemoryManifestStore implements ManifestStore {
  #byId = new Map<string, Manifest>();
  #revoked = new Set<string>();

  async put(manifest: Manifest): Promise<void> {
    if (this.#byId.has(manifest.manifestId)) {
      throw new Error(`manifest ${manifest.manifestId} already recorded (append-only)`);
    }
    this.#byId.set(manifest.manifestId, manifest);
  }

  async getByContentHash(sha256: string): Promise<Manifest | null> {
    for (const m of this.#byId.values()) {
      if (m.content.sha256 === sha256) return m;
    }
    return null;
  }

  async findByFingerprint(phash: string, maxDistance: number): Promise<Manifest[]> {
    const out: Manifest[] = [];
    for (const m of this.#byId.values()) {
      if (hammingDistance(m.content.phash, phash) <= maxDistance) out.push(m);
    }
    return out;
  }

  async historyForIssuer(issuerId: string): Promise<Manifest[]> {
    return [...this.#byId.values()]
      .filter((m) => m.issuer.id === issuerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async revoke(manifestId: string): Promise<void> {
    if (!this.#byId.has(manifestId)) throw new Error(`unknown manifest ${manifestId}`);
    this.#revoked.add(manifestId);
  }

  async isRevoked(manifestId: string): Promise<boolean> {
    return this.#revoked.has(manifestId);
  }
}
