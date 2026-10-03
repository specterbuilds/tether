import { Ed25519Signer, verifyEd25519 } from "./ed25519.js";
import { MlDsaSigner, verifyMlDsa } from "./ml-dsa.js";
import type { Signer } from "./signer.js";

/**
 * Hybrid Ed25519 + ML-DSA-65 signer for post-quantum migration.
 *
 * Produces BOTH a classical and a post-quantum signature over the same payload;
 * verification requires both to pass. This is the belt-and-suspenders path: the
 * manifest stays trustworthy if ML-DSA is later weakened (Ed25519 still holds)
 * or if a quantum adversary breaks Ed25519 (ML-DSA still holds).
 *
 * Both primitives are fixed-length, so the two parts compose by concatenation
 * with no manifest-schema change beyond the "Ed25519+ML-DSA-65" algorithm tag:
 *   publicKeyHex = <ed25519 pubkey (32B)> || <ml-dsa pubkey>   (hex)
 *   signature    = <ed25519 sig (64B)>   || <ml-dsa sig>       (bytes)
 * The 32-byte Ed25519 public key is a fixed 64-hex prefix, so the parts split
 * unambiguously. Key custody persists both seeds: "<ed-seed-hex>.<mldsa-seed-hex>".
 */
const ED25519_PUBKEY_HEX = 64; // 32 bytes
const ED25519_SIG_BYTES = 64;

export class HybridSigner implements Signer {
  readonly algorithm = "Ed25519+ML-DSA-65" as const;
  readonly publicKeyHex: string;
  #ed: Ed25519Signer;
  #mldsa: MlDsaSigner;

  private constructor(ed: Ed25519Signer, mldsa: MlDsaSigner) {
    this.#ed = ed;
    this.#mldsa = mldsa;
    this.publicKeyHex = ed.publicKeyHex + mldsa.publicKeyHex;
  }

  /** Generate a fresh hybrid keypair. Platforms should persist `export()`. */
  static generate(): HybridSigner {
    return new HybridSigner(Ed25519Signer.generate(), MlDsaSigner.generate());
  }

  /** Restore from a previously exported "<ed-seed-hex>.<mldsa-seed-hex>". */
  static fromPrivateKeyHex(exported: string): HybridSigner {
    const [edHex, mldsaHex, ...rest] = exported.split(".");
    if (!edHex || !mldsaHex || rest.length > 0)
      throw new Error('Hybrid key must be "<ed25519-seed-hex>.<ml-dsa-seed-hex>"');
    return new HybridSigner(
      Ed25519Signer.fromPrivateKeyHex(edHex),
      MlDsaSigner.fromPrivateKeyHex(mldsaHex),
    );
  }

  /** Export both seeds for platform-side key custody. */
  export(): string {
    return `${this.#ed.export()}.${this.#mldsa.export()}`;
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const [edSig, mldsaSig] = await Promise.all([
      this.#ed.sign(payload),
      this.#mldsa.sign(payload),
    ]);
    const out = new Uint8Array(edSig.length + mldsaSig.length);
    out.set(edSig, 0);
    out.set(mldsaSig, edSig.length);
    return out;
  }
}

/** Verify a hybrid signature: BOTH the Ed25519 and ML-DSA-65 parts must pass. */
export function verifyHybrid(
  publicKeyHex: string,
  payload: Uint8Array,
  signature: Uint8Array,
): boolean {
  const edPublicKeyHex = publicKeyHex.slice(0, ED25519_PUBKEY_HEX);
  const mldsaPublicKeyHex = publicKeyHex.slice(ED25519_PUBKEY_HEX);
  const edSig = signature.subarray(0, ED25519_SIG_BYTES);
  const mldsaSig = signature.subarray(ED25519_SIG_BYTES);
  return (
    verifyEd25519(edPublicKeyHex, payload, edSig) &&
    verifyMlDsa(mldsaPublicKeyHex, payload, mldsaSig)
  );
}
