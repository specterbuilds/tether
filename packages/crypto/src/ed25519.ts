import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import type { Signer } from "./signer.js";

/**
 * Ed25519 signer on Node's native crypto (no dependencies).
 *
 * Node serializes Ed25519 keys as SPKI/PKCS8 DER; the raw 32-byte key is the
 * last 32 bytes of the DER blob for this algorithm. We store raw hex in
 * manifests and rebuild DER with the fixed 12/16-byte prefixes below.
 */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex"); // 12 bytes
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex"); // 16 bytes

export function verifyEd25519(
  publicKeyHex: string,
  payload: Uint8Array,
  signature: Uint8Array,
): boolean {
  const der = Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]);
  const key = createPublicKey({ key: der, format: "der", type: "spki" });
  return verify(null, Buffer.from(payload), key, Buffer.from(signature));
}

export class Ed25519Signer implements Signer {
  readonly algorithm = "Ed25519" as const;
  readonly publicKeyHex: string;
  #privateKeyDer: Buffer;

  private constructor(privateKeyDer: Buffer, publicKeyHex: string) {
    this.#privateKeyDer = privateKeyDer;
    this.publicKeyHex = publicKeyHex;
  }

  /** Generate a fresh keypair. Platforms should persist `export()` output. */
  static generate(): Ed25519Signer {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privDer = privateKey.export({ format: "der", type: "pkcs8" });
    const pubDer = publicKey.export({ format: "der", type: "spki" });
    return new Ed25519Signer(privDer, pubDer.subarray(-32).toString("hex"));
  }

  /** Restore from a previously exported raw private key (hex, 32 bytes). */
  static fromPrivateKeyHex(privateKeyHex: string): Ed25519Signer {
    const raw = Buffer.from(privateKeyHex, "hex");
    if (raw.length !== 32) throw new Error("Ed25519 private key must be 32 bytes");
    const privDer = Buffer.concat([PKCS8_PREFIX, raw]);
    const privKey = createPrivateKey({ key: privDer, format: "der", type: "pkcs8" });
    const pubDer = createPublicKey(privKey).export({ format: "der", type: "spki" });
    return new Ed25519Signer(privDer, pubDer.subarray(-32).toString("hex"));
  }

  /** Export the raw private key (hex) for platform-side key custody. */
  export(): string {
    return this.#privateKeyDer.subarray(-32).toString("hex");
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const key = createPrivateKey({ key: this.#privateKeyDer, format: "der", type: "pkcs8" });
    return sign(null, Buffer.from(payload), key);
  }
}
