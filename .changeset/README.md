# Changesets

Versioning and changelogs here follow the changesets workflow (same as c2pa-node):

1. Make your change on a branch.
2. Run `npm run changeset` and describe it - this adds a markdown file here.
3. Merge. The release workflow opens a "Version Packages" PR that bumps
   versions and updates each package's CHANGELOG.md.
4. Merging that PR publishes to npm (once npm publishing is wired up with a
   token; until then releases are tags + changelogs only).
