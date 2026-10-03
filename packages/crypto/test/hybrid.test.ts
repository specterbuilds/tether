import test from "node:test";
import assert from "node:assert/strict";
import { HybridSigner, verifySignature } from "../src/index.js";

test("hybrid sign then verify (both parts valid)", async () => {
  const signer = HybridSigner.generate();
  assert.equal(signer.algorithm, "Ed25519+ML-DSA-65");
  const payload = new TextEncoder().encode("hybrid manifest bytes");
  const sig = await signer.sign(payload);
  assert.equal(await verifySignature(signer.algorithm, signer.publicKeyHex, payload, sig), true);
});

test("hybrid verification fails if the payload is tampered", async () => {
  const signer = HybridSigner.generate();
  const sig = await signer.sign(new TextEncoder().encode("a"));
  const ok = await verifySignature(
    signer.algorithm,
    signer.publicKeyHex,
    new TextEncoder().encode("b"),
    sig,
  );
  assert.equal(ok, false);
});

test("hybrid fails closed if the ML-DSA half is corrupted (Ed25519 alone is not enough)", async () => {
  const signer = HybridSigner.generate();
  const payload = new TextEncoder().encode("payload");
  const sig = await signer.sign(payload);
  sig[sig.length - 1] ^= 0xff; // flip a bit in the ML-DSA portion
  assert.equal(
    await verifySignature(signer.algorithm, signer.publicKeyHex, payload, sig),
    false,
  );
});

test("hybrid fails closed if the Ed25519 half is corrupted", async () => {
  const signer = HybridSigner.generate();
  const payload = new TextEncoder().encode("payload");
  const sig = await signer.sign(payload);
  sig[0] ^= 0xff; // flip a bit in the Ed25519 portion
  assert.equal(
    await verifySignature(signer.algorithm, signer.publicKeyHex, payload, sig),
    false,
  );
});

test("hybrid key custody: export and restore round-trips", async () => {
  const signer = HybridSigner.generate();
  const restored = HybridSigner.fromPrivateKeyHex(signer.export());
  assert.equal(restored.publicKeyHex, signer.publicKeyHex);
  const payload = new TextEncoder().encode("payload");
  const sig = await restored.sign(payload);
  assert.equal(await verifySignature(signer.algorithm, signer.publicKeyHex, payload, sig), true);
});
