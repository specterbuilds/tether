import {
  contentHash,
  perceptualHash,
  signingPayload,
  hammingDistance,
  type Claim,
  type Issuer,
  type Manifest,
  type ProvenanceCard,
} from "@tether/core";
import { verifySignature, type Signer } from "@tether/crypto";
import type { ManifestStore } from "@tether/manifest-store";
import { NoOpWatermarker, type Watermarker } from "@tether/watermark";
import { randomUUID } from "node:crypto";

/** Max fingerprint distance treated as "the same photo, recompressed". */
const SIMILARITY_THRESHOLD = 18; // 128-bit fingerprint

export interface SignOptions {
  issuer: Issuer;
  claims: Claim[];
  signer: Signer;
  store: ManifestStore;
  watermarker?: Watermarker;
}

export interface VerifyOptions {
  store: ManifestStore;
  /**
   * Trusted issuer public keys (hex). Verification fails closed: a manifest
   * signed by a key the verifier does not trust is not a provenance card,
   * it's a claim by a stranger.
   */
  trustedPublicKeys: string[];
}

/**
 * The Tether SDK entry point. One instance per integrating platform.
 *
 * sign():  at upload, bind the photo to a signed manifest (content hash +
 *          perceptual fingerprint + platform claims), embed the watermark,
 *          and record the manifest in the repository.
 * verify(): at view time, resolve an image back to a provenance card with
 *          issuer, claims, history and revocation status.
 */
/** Result of signing: the manifest to record, and the published image bytes. */
export interface SignResult {
  manifest: Manifest;
  /**
   * The image to publish and serve. When a watermarker is used these bytes differ
   * from the input (the mark is embedded before hashing), so integrators MUST
   * publish THIS buffer - its pixels are what the manifest's content hash binds.
   */
  image: Uint8Array;
}

export class Tether {
  async sign(imageBytes: Uint8Array, opts: SignOptions): Promise<SignResult> {
    const watermarker = opts.watermarker ?? new NoOpWatermarker();
    const manifestId = randomUUID();

    // Watermark first so the hash and fingerprint bind the published pixels.
    const payload = new TextEncoder().encode(manifestId);
    const embedded = await watermarker.embed(imageBytes, payload);

    const unsigned = {
      version: "tether/0.1" as const,
      manifestId,
      issuer: opts.issuer,
      claims: opts.claims,
      content: {
        sha256: contentHash(embedded),
        phash: await perceptualHash(embedded),
        bytes: embedded.length,
      },
      watermark: {
        algorithm: watermarker.algorithm === "none" ? null : watermarker.algorithm,
        embedded: watermarker.algorithm !== "none",
      },
      createdAt: new Date().toISOString(),
    };
    const signature = await opts.signer.sign(signingPayload(unsigned));
    const manifest: Manifest = {
      ...unsigned,
      signature: {
        algorithm: opts.signer.algorithm,
        publicKey: opts.signer.publicKeyHex,
        value: Buffer.from(signature).toString("hex"),
      },
    };
    await opts.store.put(manifest);
    return { manifest, image: embedded };
  }

  async verify(imageBytes: Uint8Array, opts: VerifyOptions): Promise<ProvenanceCard | null> {
    const sha = contentHash(imageBytes);
    const phash = await perceptualHash(imageBytes);

    // Exact match first, then fingerprint similarity (recompression path).
    let manifest = await opts.store.getByContentHash(sha);
    let integrity: ProvenanceCard["integrity"] = "exact";
    if (!manifest) {
      const candidates = await opts.store.findByFingerprint(phash, SIMILARITY_THRESHOLD);
      if (candidates.length === 0) return null; // unknown image: no card
      candidates.sort(
        (a, b) => hammingDistance(a.content.phash, phash) - hammingDistance(b.content.phash, phash),
      );
      manifest = candidates[0];
      integrity = "similar";
    }

    const trusted = opts.trustedPublicKeys.includes(manifest.signature.publicKey);
    const signatureValid =
      trusted &&
      (await verifySignature(
        manifest.signature.algorithm,
        manifest.signature.publicKey,
        signingPayload(manifest),
        Buffer.from(manifest.signature.value, "hex"),
      ));

    const history = await opts.store.historyForIssuer(manifest.issuer.id);
    const revoked = await opts.store.isRevoked(manifest.manifestId);

    return {
      manifestId: manifest.manifestId,
      issuer: manifest.issuer,
      createdAt: manifest.createdAt,
      claims: manifest.claims,
      integrity,
      similarity: hammingDistance(manifest.content.phash, phash),
      signatureValid,
      revoked,
      history: await Promise.all(
        history.map(async (m) => ({
          manifestId: m.manifestId,
          createdAt: m.createdAt,
          revoked: await opts.store.isRevoked(m.manifestId),
        })),
      ),
    };
  }
}
