/**
 * The Tether quickstart, end to end:
 * a dating platform signs a photo at upload, and a viewer verifies a
 * recompressed copy back to its provenance card.
 *
 * Run from the repo root: npm run build && npx tsx examples/basic-sign-verify/index.ts
 */
import { PNG } from "pngjs";
import { Tether, Ed25519Signer, InMemoryManifestStore } from "@tether/sdk";

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

// 1. At upload: bind the photo to a signed manifest.
const manifest = await tether.sign(makePhoto(), {
  issuer: { id: "dating.example.com", name: "Example Dating" },
  claims: [{ type: "tether.dating/uploader-attested", value: { accountAgeDays: 400 } }],
  signer,
  store,
});
console.log("signed manifest:", manifest.manifestId);

// 2. The photo gets downloaded, recompressed, re-uploaded elsewhere.
const recompressed = makePhoto(1);

// 3. At view time: resolve it back to a provenance card.
const card = await tether.verify(recompressed, {
  store,
  trustedPublicKeys: [signer.publicKeyHex],
});
console.log(JSON.stringify(card, null, 2));
// card.integrity === "similar" - not the exact bytes, but the same photo.
