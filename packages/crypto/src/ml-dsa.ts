import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import type { Signer } from "./signer.js";

/**
 * ML-DSA-65 (FIPS 204, Dilithium) signer for post-quantum provenance.
 *
 * Backed by @noble/post-quantum - an audited, dependency-free TypeScript
 * implementation - so it runs on the same Node baseline as the Ed25519 signer
 * without native addons or an OpenSSL 3.5 build (native ML-DSA only landed in
 * Node 24+). Keys and signatures are large by design: a public key is ~1952
 * bytes and a signature ~3309 bytes, versus 32/64 for Ed25519.
 *
 * Key custody mirrors Ed25519Signer: the platform persists the 32-byte seed
 * (export()), and the full keypair is deterministically re-derived from it
 * (fromPrivateKeyHex()). The seed is the secret - guard it like any private key.
 *
 * Tether's manifest model is algorithm-aware (SignatureInfo.algorithm), so a
 * manifest signed here with "ML-DSA-65" verifies alongside Ed25519 manifests.
 */
export class MlDsaSigner implements Signer {
  readonly algorithm = "ML-DSA-65" as const;
  readonly publicKeyHex: string;
  #seed: Uint8Array;
  #secretKey: Uint8Array;

  private constructor(seed: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) {
    this.#seed = seed;
    this.#secretKey = secretKey;
    this.publicKeyHex = Buffer.from(publicKey).toString("hex");
  }

  /** Generate a fresh keypair. Platforms should persist `export()` output. */
  static generate(): MlDsaSigner {
    const seed = crypto.getRandomValues(new Uint8Array(ml_dsa65.lengths.seed!));
    return MlDsaSigner.#fromSeed(seed);
  }

  /** Restore from a previously exported seed (hex, 32 bytes). */
  static fromPrivateKeyHex(seedHex: string): MlDsaSigner {
    const seed = Buffer.from(seedHex, "hex");
    if (seed.length !== ml_dsa65.lengths.seed)
      throw new Error(`ML-DSA-65 seed must be ${ml_dsa65.lengths.seed} bytes`);
    return MlDsaSigner.#fromSeed(seed);
  }

  static #fromSeed(seed: Uint8Array): MlDsaSigner {
    const { publicKey, secretKey } = ml_dsa65.keygen(seed);
    return new MlDsaSigner(seed, secretKey, publicKey);
  }

  /** Export the raw seed (hex) for platform-side key custody. */
  export(): string {
    return Buffer.from(this.#seed).toString("hex");
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    return ml_dsa65.sign(payload, this.#secretKey);
  }
}

/** Verify an ML-DSA-65 signature against a hex public key. */
export function verifyMlDsa(
  publicKeyHex: string,
  payload: Uint8Array,
  signature: Uint8Array,
): boolean {
  return ml_dsa65.verify(signature, payload, Buffer.from(publicKeyHex, "hex"));
}
