/**
 * The Tether quickstart, end to end:
 * a dating platform signs a photo at upload, and a viewer verifies a
 * recompressed copy back to its provenance card.
 *
 * Run from the repo root: npm run build && npx tsx examples/basic-sign-verify/index.ts
 * The sample images it writes land in examples/basic-sign-verify/assets/.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { Tether, Ed25519Signer, InMemoryManifestStore } from "@tether/sdk";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "assets");
mkdirSync(assets, { recursive: true });

// --- a synthetic "user photo" (64x64 gradient with a red square) ---
function makePhoto(alter = 0): Uint8Array {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      png.data[i] = (x * 4 + alter) % 256;
      png.data[i + 1] = (y * 4) % 256;
      png.data[i + 2] = 128;
      png.data[i + 3] = 255;
      if (x > 16 && x < 48 && y > 16 && y < 48) png.data[i] = 255;
    }
  }
  return PNG.sync.write(png);
}

const signer = Ed25519Signer.generate(); // platform key custody - persist signer.export()
const store = new InMemoryManifestStore(); // swap for Postgres/hosted in production
const tether = new Tether();

console.log("1. upload: platform signs a (synthetic) user photo at upload time");
const original = makePhoto();
writeFileSync(join(assets, "photo-original.png"), original);

const manifest = await tether.sign(original, {
  issuer: { id: "dating.example.com", name: "Example Dating" },
  claims: [{ type: "tether.dating/uploader-attested", value: { accountAgeDays: 400 } }],
  signer,
  store,
});
console.log(`   manifest ${manifest.manifestId}`);
console.log(`   sha256  ${manifest.content.sha256}`);
console.log(`   phash   ${manifest.content.phash}`);
console.log(`   signed  Ed25519, key ${manifest.signature.publicKey.slice(0, 16)}...`);

console.log("");
console.log("2. the photo leaves the platform: downloaded, recompressed, re-uploaded");
const recompressed = makePhoto(1); // same photo, slightly different pixels
writeFileSync(join(assets, "photo-recompressed.png"), recompressed);
console.log("   bytes differ, pixels barely do - sha256 no longer matches");

console.log("");
console.log("3. view time: verify the recompressed copy back to its provenance card");
const card = await tether.verify(recompressed, {
  store,
  trustedPublicKeys: [signer.publicKeyHex],
});
console.log(JSON.stringify(card, null, 2));
writeFileSync(join(assets, "provenance-card.json"), JSON.stringify(card, null, 2) + "\n");
console.log("");
console.log('   integrity: "similar" - not the exact signed bytes, but the same photo.');
