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
