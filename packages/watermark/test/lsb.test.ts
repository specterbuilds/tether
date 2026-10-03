import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { LsbWatermarker, NoOpWatermarker } from "../src/index.js";

function makePhoto(seed = 7): Uint8Array {
  const png = new PNG({ width: 48, height: 48 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = (i * seed) % 256;
    png.data[i + 1] = (i * 3) % 256;
    png.data[i + 2] = 128;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

test("embed then extract round-trips the payload", async () => {
  const wm = new LsbWatermarker();
  const payload = new TextEncoder().encode("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  const marked = await wm.embed(makePhoto(), payload);
  const recovered = await wm.extract(marked);
  assert.deepEqual(recovered, payload);
});

test("the watermark is invisible-ish: only low bits change", async () => {
  const wm = new LsbWatermarker();
  const original = makePhoto();
  const marked = await wm.embed(original, new TextEncoder().encode("hello"));
  const a = PNG.sync.read(Buffer.from(original)).data;
  const b = PNG.sync.read(Buffer.from(marked)).data;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i++) maxDelta = Math.max(maxDelta, Math.abs(a[i] - b[i]));
  assert.ok(maxDelta <= 1, `max per-channel delta ${maxDelta} should be <= 1`);
});

test("survives a lossless PNG re-encode", async () => {
  const wm = new LsbWatermarker();
  const payload = new TextEncoder().encode("survives-reencode");
  const marked = await wm.embed(makePhoto(), payload);
  const reencoded = PNG.sync.write(PNG.sync.read(Buffer.from(marked)));
  assert.deepEqual(await wm.extract(reencoded), payload);
});

test("extract returns null on an unmarked image", async () => {
  assert.equal(await new LsbWatermarker().extract(makePhoto(99)), null);
});

test("NoOpWatermarker passes bytes through unchanged", async () => {
  const wm = new NoOpWatermarker();
  const img = makePhoto();
  assert.deepEqual(await wm.embed(img, new Uint8Array([1, 2, 3])), img);
  assert.equal(await wm.extract(img), null);
});
