import { verifyEd25519 } from "./ed25519.js";
import { verifyMlDsa } from "./ml-dsa.js";
import { verifyHybrid } from "./hybrid.js";

/** Signature algorithms a manifest may carry. */
export type SignatureAlgorithm = "Ed25519" | "ML-DSA-65" | "Ed25519+ML-DSA-65";

/** A manifest signer. Implementations own key custody; Tether never sees raw keys. */
export interface Signer {
  readonly algorithm: SignatureAlgorithm;
  /** Hex-encoded public key, embedded in manifests so verifiers can check. */
  readonly publicKeyHex: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/** Verify a signature against a hex public key. Algorithm-aware. */
export async function verifySignature(
  algorithm: SignatureAlgorithm,
  publicKeyHex: string,
  payload: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  switch (algorithm) {
    case "Ed25519":
      return verifyEd25519(publicKeyHex, payload, signature);
    case "ML-DSA-65":
      return verifyMlDsa(publicKeyHex, payload, signature);
    case "Ed25519+ML-DSA-65":
      return verifyHybrid(publicKeyHex, payload, signature);
  }
}
