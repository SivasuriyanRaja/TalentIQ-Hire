---
name: Expo package maturity
description: How to handle newly released Expo SDK modules blocked by the workspace package registry.
---

When Expo CLI resolves a newly released native module but pnpm rejects it for not meeting the registry's release-age policy, do not bypass that policy or keep retrying the same version. Keep using a compatible mature version only after checking its peer/API support, or leave a patch-level compatibility warning explicit until the package matures.

**Why:** Expo CLI can recommend packages before the workspace package registry allows those versions to install, especially immediately after a new SDK release.

**How to apply:** On an Expo install failure that names a release-age constraint, check for a prior stable compatible release and validate the app; otherwise defer the package update and report the constraint plainly.
