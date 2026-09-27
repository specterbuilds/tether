# Tether

[![ci](https://github.com/specterbuilds/tether/actions/workflows/ci.yml/badge.svg)](https://github.com/specterbuilds/tether/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A vertical trust layer for photos, built on C2PA.**

Dating apps, marketplaces and AI tools all have the same problem: anyone can
upload anyone's photo, and once it leaves your platform it carries nothing
with it. Tether lets a platform sign a photo at upload and lets anyone
verify it later - and what verification returns is a **provenance card**, not
a "real/fake" verdict: who attested to this photo, what they claimed, its
history, and whether that attestation still stands.

Tether does not reinvent provenance. The C2PA ecosystem (Content Credentials,
c2pa-rs, Adobe's open tooling) already solved the primitive. Tether is the
vertical layer on top: platform-issued photo attestations, stolen-photo reuse
detection, consent and revocation, and a clean verify UX aimed at the
industries where photo trust is the product.

## How it works

```
upload ──▶ sign() ──▶ manifest ──▶ manifest repository
             │         (content hash + perceptual
             │          fingerprint + platform claims,
             ▼          Ed25519-signed, PQ-ready)
        watermarked photo

any image ──▶ verify() ──▶ provenance card
                            (issuer, claims, integrity,
                             history, revocation status)
```

- **Content hash** (SHA-256): byte-exact binding.
- **Perceptual fingerprint** (dHash): survives recompression, resizing and
  mild crops - the "same photo, different bytes" path.
- **Recoverable invisible watermark** _(in progress)_: survives screenshots
  and metadata stripping. See `packages/watermark`.
- **Signatures**: Ed25519 today, ML-DSA-65 (FIPS 204 Dilithium) post-quantum
  signers slot into the same interface.
- **Tamper-evident repository**: manifests are append-only; revocation
  (consent withdrawn, fraud confirmed) is recorded, never silent.

## See it work

Real output from [`examples/basic-sign-verify`](examples/basic-sign-verify)
(run it yourself: `npm run build && npx tsx examples/basic-sign-verify/index.ts`).
A platform signs a photo at upload; the photo gets recompressed off-platform;
`verify()` still resolves it to a provenance card:

<table>
  <tr>
    <td align="center"><img src="examples/basic-sign-verify/assets/photo-original.png" width="128"><br><sub>signed at upload</sub></td>
    <td align="center"><img src="examples/basic-sign-verify/assets/photo-recompressed.png" width="128"><br><sub>recompressed copy</sub></td>
    <td align="center">&#8594;<br><a href="examples/basic-sign-verify/assets/provenance-card.json">provenance-card.json</a><br><sub>what verify() returns</sub></td>
  </tr>
</table>

```console
1. upload: platform signs a (synthetic) user photo at upload time
   manifest 9d7ca5cb-6d45-45b5-8b81-d5d3cd99a786
   sha256  7f918f97c781c1c92482b95d4dbf4afe21193ab8cd5a19d3df3777fbb01cd70c
   phash   00000002020200000000001f1f3fffff
   signed  Ed25519, key 07588f2289657d70...

2. the photo leaves the platform: downloaded, recompressed, re-uploaded
   bytes differ, pixels barely do - sha256 no longer matches

3. view time: verify the recompressed copy back to its provenance card
{
  "manifestId": "9d7ca5cb-6d45-45b5-8b81-d5d3cd99a786",
  "issuer": {
    "id": "dating.example.com",
    "name": "Example Dating"
  },
  "createdAt": "2026-09-27T12:01:58.464Z",
  "claims": [
    {
      "type": "tether.dating/uploader-attested",
      "value": {
        "accountAgeDays": 400
      }
    }
  ],
  "integrity": "similar",
  "similarity": 1,
  "signatureValid": true,
  "revoked": false,
  "history": [
    {
      "manifestId": "9d7ca5cb-6d45-45b5-8b81-d5d3cd99a786",
      "createdAt": "2026-09-27T12:01:58.464Z",
      "revoked": false
    }
  ]
}

   integrity: "similar" - not the exact signed bytes, but the same photo.
```

The two images above have different bytes - their SHA-256 hashes do not
match. The perceptual fingerprint does, so the card comes back
`integrity: "similar"` with the platform's attestation, claims, history and
revocation status. That is the whole idea: provenance survives the trip
through the internet's recompression blender.

## Packages

| Package                  | What it is                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `@tether/sdk`            | The entry point: `sign()` and `verify()`.                                 |
| `@tether/core`           | Manifest model, content hashing, perceptual fingerprint, provenance card. |
| `@tether/crypto`         | Signer interface, Ed25519 implementation, ML-DSA placeholder.             |
| `@tether/manifest-store` | Repository interface + in-memory reference implementation.                |
| `@tether/watermark`      | Watermark interface; DCT-domain implementation in progress.               |

## Quick start

```ts
import { Tether, Ed25519Signer, InMemoryManifestStore } from "@tether/sdk";

const signer = Ed25519Signer.generate(); // platform key custody
const store = new InMemoryManifestStore(); // swap for Postgres/hosted
const tether = new Tether();

// At upload:
const manifest = await tether.sign(photoBytes, {
  issuer: { id: "dating.example.com", name: "Example Dating" },
  claims: [{ type: "tether.dating/uploader-attested", value: { accountAgeDays: 400 } }],
  signer,
  store,
});

// At view time:
const card = await tether.verify(presentedBytes, {
  store,
  trustedPublicKeys: [signer.publicKeyHex],
});
// card.integrity: "exact" | "similar" | (null = unknown photo)
// card.revoked, card.claims, card.history, card.signatureValid
```

## Status

Working, tested: sign/verify round-trip, exact + fingerprint-similarity
matching, revocation, fail-closed trust. In progress: the watermark embedder,
JPEG/WebP decoding, Postgres store adapter, C2PA interop via c2pa-node,
platform adapters (dating first).

## Repository layout

```
packages/           publishable packages (npm workspaces, tsc project references)
  core/             @tether/core - manifest model, hashing, fingerprint, provenance card
  crypto/           @tether/crypto - Signer interface, Ed25519, ML-DSA placeholder
  manifest-store/   @tether/manifest-store - append-only repository + in-memory impl
  watermark/        @tether/watermark - watermark interface (DCT impl in progress)
  tether/           @tether/sdk - the facade: sign() and verify()
examples/           runnable samples, never published
  basic-sign-verify/  the quickstart as code
.github/            CI, release workflow, issue/PR templates, dependabot
.changeset/         versioning + changelogs (changesets)
```

## Development

```bash
npm install
npm run build   # tsc -b (project references)
npm test        # build + tsx --test
npm run lint    # eslint (typescript-eslint)
npm run docs    # typedoc -> docs/api
```

Contributing, security reporting and the release workflow are documented in
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and
[.changeset/README.md](.changeset/README.md).

## License

MIT
