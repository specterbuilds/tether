import type { Signer } from "./signer.js";

/**
 * ML-DSA-65 (FIPS 204, Dilithium) signer - interface placeholder.
 *
 * Tether's manifest model is post-quantum ready: SignatureInfo.algorithm and
 * the Signer interface already accept "ML-DSA-65", so manifests signed today
 * with Ed25519 will verify alongside future PQ-signed manifests.
 *
 * Blocked on a production-grade WASM/Node binding for ML-DSA (liboqs-node or
 * the C2PA Rust crypto stack via c2pa-node). Do NOT implement Dilithium in
 * pure TypeScript - hand-rolled PQ crypto is worse than classical crypto.
 */
export class MlDsaSigner implements Signer {
  readonly algorithm = "ML-DSA-65" as const;
  get publicKeyHex(): string {
    throw new Error("ML-DSA-65 is not implemented yet; track packages/crypto#ml-dsa");
  }
  async sign(): Promise<Uint8Array> {
    throw new Error("ML-DSA-65 is not implemented yet; track packages/crypto#ml-dsa");
  }
}
