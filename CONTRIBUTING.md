# Contributing to Tether

Tether is early. The architecture is set (vertical trust layer on C2PA,
provenance cards not real/fake verdicts) and the core sign/verify loop works;
the watermark embedder, store adapters and platform adapters are being built.
Issues and PRs are welcome.

## Setup

```bash
git clone https://github.com/specterbuilds/tether.git
cd tether
npm install
npm run build
npm test
```

Node 22 is the development version (see `.nvmrc`); packages support Node 20+.

## Repo layout

npm workspaces monorepo. Packages under `packages/*` are publishable and
depend on each other through workspace references; `examples/*` holds runnable
samples that are never published. Shared TS config lives in
`tsconfig.base.json`; builds use project references (`tsc -b`).

## Workflow

1. Branch from `main`.
2. Keep changes scoped to one package where you can; cross-package changes
   need their tests updated in every affected package.
3. Run `npm run changeset` for any user-facing change and commit the
   changeset file - versions and changelogs are generated from these.
4. `npm run build && npm test && npm run lint` must pass. CI runs the same
   on Node 22.

## Rules that keep the project honest

- **No hand-rolled cryptography.** Ed25519 comes from `node:crypto`; ML-DSA
  lands only via an audited binding (liboqs or the C2PA Rust stack). If a
  feature seems to need custom crypto, open an issue first.
- **Tests use synthetic images only** (generated PNGs). Never commit real
  photos, real platform data, or anything with a person in it.
- **The manifest model stays C2PA-aligned.** Deviating from C2PA naming or
  semantics is a design decision that belongs in an issue, not a drive-by PR.
- Provenance cards are the product: any change to `verify()` output needs a
  test asserting the card's shape.

## Releasing

Maintainers merge the "Version Packages" PR that the release workflow opens;
merging it tags releases and (once npm publishing is configured) publishes
the changed packages.
