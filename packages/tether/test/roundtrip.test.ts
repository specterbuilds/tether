import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import {
  Tether,
  Ed25519Signer,
  MlDsaSigner,
  HybridSigner,
  LsbWatermarker,
  InMemoryManifestStore,
  type Issuer,
} from "../src/index.js";

/** Deterministic test image: a left-to-right gradient with a red square. */
function makePhoto(alter = 0): Uint8Array {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      png.data[i] = (x * 4 + alter) % 256; // r: horizontal gradient
      png.data[i + 1] = (y * 4) % 256; // g: vertical gradient
      png.data[i + 2] = 128; // b: flat
      png.data[i + 3] = 255;
      if (x > 16 && x < 48 && y > 16 && y < 48) png.data[i] = 255; // red square
    }
  }
  return PNG.sync.write(png);
}

const issuer: Issuer = { id: "dating.example.com", name: "Example Dating" };

function setup() {
  const signer = Ed25519Signer.generate();
  const store = new InMemoryManifestStore();
  const tether = new Tether();
  return { signer, store, tether };
}

test("sign then verify the same bytes: exact match, valid signature", async () => {
  const { signer, store, tether } = setup();
  const photo = makePhoto();
  const { manifest } = await tether.sign(photo, {
    issuer,
    claims: [{ type: "tether.dating/uploader-attested", value: { accountAgeDays: 400 } }],
    signer,
    store,
  });
  assert.equal(manifest.signature.algorithm, "Ed25519");

  const card = await tether.verify(photo, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.integrity, "exact");
  assert.equal(card.similarity, 0);
  assert.equal(card.signatureValid, true);
  assert.equal(card.revoked, false);
  assert.equal(card.issuer.id, "dating.example.com");
  assert.equal(card.claims[0].type, "tether.dating/uploader-attested");
});

test("recompressed photo still resolves via perceptual fingerprint", async () => {
  const { signer, store, tether } = setup();
  const original = makePhoto();
  await tether.sign(original, { issuer, claims: [], signer, store });

  // Simulate recompression damage: re-encode with a tiny pixel shift.
  const damaged = makePhoto(1);
  const card = await tether.verify(damaged, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.integrity, "similar");
  assert.ok(card.similarity <= 18);
  assert.equal(card.signatureValid, true);
});

test("unrelated photo returns no card", async () => {
  const { signer, store, tether } = setup();
  await tether.sign(makePhoto(), { issuer, claims: [], signer, store });

  const other = new PNG({ width: 64, height: 64, colorType: 2 });
  for (let i = 0; i < other.data.length; i += 4) {
    other.data[i] = 10;
    other.data[i + 1] = 200;
    other.data[i + 2] = 90;
    other.data[i + 3] = 255;
  }
  const card = await tether.verify(PNG.sync.write(other), {
    store,
    trustedPublicKeys: [signer.publicKeyHex],
  });
  assert.equal(card, null);
});

test("card fails closed when the issuer key is not trusted", async () => {
  const { signer, store, tether } = setup();
  const photo = makePhoto();
  await tether.sign(photo, { issuer, claims: [], signer, store });

  const stranger = Ed25519Signer.generate();
  const card = await tether.verify(photo, { store, trustedPublicKeys: [stranger.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.signatureValid, false);
});

test("revoked manifest shows revoked on the card and in history", async () => {
  const { signer, store, tether } = setup();
  const photo = makePhoto();
  const { manifest } = await tether.sign(photo, { issuer, claims: [], signer, store });
  await store.revoke(manifest.manifestId);

  const card = await tether.verify(photo, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.revoked, true);
  assert.equal(card.history.length, 1);
  assert.equal(card.history[0].revoked, true);
});

test("post-quantum: sign and verify with ML-DSA-65 through the SDK", async () => {
  const signer = MlDsaSigner.generate();
  const store = new InMemoryManifestStore();
  const tether = new Tether();
  const photo = makePhoto();

  const { manifest } = await tether.sign(photo, {
    issuer,
    claims: [{ type: "tether.dating/uploader-attested", value: { accountAgeDays: 400 } }],
    signer,
    store,
  });
  assert.equal(manifest.signature.algorithm, "ML-DSA-65");
  assert.equal(manifest.signature.publicKey, signer.publicKeyHex);

  const card = await tether.verify(photo, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.integrity, "exact");
  assert.equal(card.signatureValid, true);

  // Fails closed under an untrusted key, exactly like the Ed25519 path.
  const stranger = MlDsaSigner.generate();
  const untrusted = await tether.verify(photo, {
    store,
    trustedPublicKeys: [stranger.publicKeyHex],
  });
  assert.ok(untrusted);
  assert.equal(untrusted.signatureValid, false);
});

test("hybrid: sign and verify with Ed25519+ML-DSA-65 through the SDK", async () => {
  const signer = HybridSigner.generate();
  const store = new InMemoryManifestStore();
  const tether = new Tether();
  const photo = makePhoto();

  const { manifest } = await tether.sign(photo, { issuer, claims: [], signer, store });
  assert.equal(manifest.signature.algorithm, "Ed25519+ML-DSA-65");

  const card = await tether.verify(photo, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.ok(card);
  assert.equal(card.integrity, "exact");
  assert.equal(card.signatureValid, true);
});

test("watermark: LSB mark embeds the manifestId and survives into the signed bytes", async () => {
  const signer = Ed25519Signer.generate();
  const store = new InMemoryManifestStore();
  const tether = new Tether();
  const watermarker = new LsbWatermarker();

  const { manifest, image } = await tether.sign(makePhoto(), { issuer, claims: [], signer, store, watermarker });
  assert.equal(manifest.watermark.embedded, true);
  assert.equal(manifest.watermark.algorithm, "lsb-v1");

  // The returned `image` is the published buffer; its pixels carry the manifestId
  // and are what the content hash binds (verify resolves it back to this manifest).
  const recovered = await watermarker.extract(image);
  assert.equal(new TextDecoder().decode(recovered!), manifest.manifestId);

  const card = await tether.verify(image, { store, trustedPublicKeys: [signer.publicKeyHex] });
  assert.equal(card?.integrity, "exact");
  assert.equal(card?.signatureValid, true);
});

test("key custody: export and restore signer round-trips", async () => {
  const signer = Ed25519Signer.generate();
  const restored = Ed25519Signer.fromPrivateKeyHex(signer.export());
  assert.equal(restored.publicKeyHex, signer.publicKeyHex);
  const sig = await restored.sign(new TextEncoder().encode("payload"));
  assert.ok(sig.length > 0);
});
