# Security Policy

Tether signs and verifies claims about photos; trust bugs are the worst kind
of bug here. Please report them privately, not in a public issue.

## Reporting

Open a private security advisory at
https://github.com/specterbuilds/tether/security/advisories/new

Include the affected package and version, a description of the trust
violation (e.g. a forged manifest that verifies, a fingerprint collision
that resolves an unrelated photo), and a reproduction if you have one.
Synthetic images only - never attach real photos to a report.

You will get an acknowledgement within a few days. Fixes are released as
patch versions with a changeset noting the security impact.

## Scope

In scope: signature verification bypasses, manifest tampering that goes
undetected, fingerprint matching that resolves clearly unrelated photos,
watermark recovery that yields the wrong manifest ID, revocation not being
honored.

Out of scope: the documented limitations - screenshots defeating the current
watermark stub, JPEG/WebP not yet decodable, the in-memory store being
non-persistent.
