import test from "node:test";
import assert from "node:assert/strict";
import { MlDsaSigner, verifySignature } from "../src/index.js";

test("sign then verify a payload with ML-DSA-65", async () => {
  const signer = MlDsaSigner.generate();
  assert.equal(signer.algorithm, "ML-DSA-65");

  const payload = new TextEncoder().encode("provenance manifest bytes");
  const sig = await signer.sign(payload);
  assert.ok(sig.length > 0);

  const ok = await verifySignature("ML-DSA-65", signer.publicKeyHex, payload, sig);
  assert.equal(ok, true);
});

test("verification fails for a tampered payload", async () => {
  const signer = MlDsaSigner.generate();
  const payload = new TextEncoder().encode("original");
  const sig = await signer.sign(payload);

  const tampered = new TextEncoder().encode("original!");
  assert.equal(await verifySignature("ML-DSA-65", signer.publicKeyHex, tampered, sig), false);
});

test("verification fails under a stranger's public key", async () => {
  const signer = MlDsaSigner.generate();
  const stranger = MlDsaSigner.generate();
  const payload = new TextEncoder().encode("payload");
  const sig = await signer.sign(payload);

  assert.equal(await verifySignature("ML-DSA-65", stranger.publicKeyHex, payload, sig), false);
});

test("key custody: export and restore from seed round-trips", async () => {
  const signer = MlDsaSigner.generate();
  const seedHex = signer.export();
  assert.equal(seedHex.length, 64); // 32-byte seed as hex

  const restored = MlDsaSigner.fromPrivateKeyHex(seedHex);
  assert.equal(restored.publicKeyHex, signer.publicKeyHex);

  // A signature from the restored signer verifies under the original key.
  const payload = new TextEncoder().encode("payload");
  const sig = await restored.sign(payload);
  assert.equal(await verifySignature("ML-DSA-65", signer.publicKeyHex, payload, sig), true);
});

test("fromPrivateKeyHex rejects a wrong-length seed", () => {
  assert.throws(() => MlDsaSigner.fromPrivateKeyHex("abcd"), /seed must be 32 bytes/);
});
