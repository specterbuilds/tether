import { createHash } from "node:crypto";

/** SHA-256 of the exact file bytes, hex-encoded. */
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
