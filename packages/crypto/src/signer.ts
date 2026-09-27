import { verifyEd25519 } from "./ed25519.js";

/** A manifest signer. Implementations own key custody; Tether never sees raw keys. */
export interface Signer {
  readonly algorithm: "Ed25519" | "ML-DSA-65";
  /** Hex-encoded public key, embedded in manifests so verifiers can check. */
  readonly publicKeyHex: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/** Verify a signature against a hex public key. Algorithm-aware. */
export async function verifySignature(
  algorithm: "Ed25519" | "ML-DSA-65",
  publicKeyHex: string,
  payload: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  switch (algorithm) {
    case "Ed25519":
      return verifyEd25519(publicKeyHex, payload, signature);
    case "ML-DSA-65":
      throw new Error(
        "ML-DSA-65 verification is not implemented yet; see MlDsaSigner docs",
      );
  }
}
