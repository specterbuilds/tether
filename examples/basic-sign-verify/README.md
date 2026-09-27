# basic-sign-verify

The smallest end-to-end Tether flow: sign a photo at upload, verify a
recompressed copy back to a provenance card.

```bash
npm install
npm run build
npx tsx examples/basic-sign-verify/index.ts
```

Expected output: a signed manifest ID, then a provenance card with
`integrity: "similar"` - the presented image is not the exact signed bytes,
but the perceptual fingerprint resolves it to the same photo.
