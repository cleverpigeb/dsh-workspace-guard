# Publishing the tested npm archive

The workflow publishes `@cleverpig/dsh-workspace-guard` from the existing GitHub release assets. It does not build or repack them. No npm token is stored in the workflow. Hosted run [41318207959](https://github.com/cleverpigeb/dsh-workspace-guard/actions/runs/41318207959) verified the v0.2.1 release checkout and assets, then skipped its identical published npm tarball. That run established hosted verification and retry behavior, but did not exercise genuine npm OIDC publication.

Version 1.1.0 replaces the unpublished 1.0.1 preparation. Final immutable archives are prepared from the reviewed 1.1.0 revision and checked against its tag. GitHub Release creation and npm publication remain separate from local preparation and pushing the source/tag.

## One-time npm setup

The npm account/scope is `cleverpig`; the GitHub owner is `cleverpigeb`. They are different names.

If this package does not exist yet, first create it using an authenticated maintainer session and the reviewed tarball, for example `npm publish ./cleverpig-dsh-workspace-guard-0.2.1.tgz --access public --ignore-scripts`. This is a manual bootstrap step, not something the workflow performs. Alternatively, [npm supports staged creation of new packages](https://github.blog/changelog/2026-10-02-npm-staged-publishing-now-supports-creating-new-packages/): `npm stage publish` creates the package with its first version awaiting maintainer promotion. Configure trusted publishing after package creation; promotion requires a maintainer.

In the package's npm settings, add a GitHub Actions trusted publisher:

| Setting | Value |
| --- | --- |
| Organization or user | `cleverpigeb` |
| Repository | `dsh-workspace-guard` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty; the workflow declares none |
| Allowed actions | Enable direct publishing with `npm publish` |

The workflow must already exist at `.github/workflows/publish.yml`. It uses GitHub-hosted Ubuntu, Node.js 24, npm 11.5.1 and `id-token: write`. These satisfy the [documented trusted-publishing prerequisites](https://docs.npmjs.com/trusted-publishers/). Do not add an npm publish token or use `npm whoami` as an OIDC authorization test.

Complete the first successful trusted publish within 48 hours of configuring the relationship. [Unused configurations expire after that window](https://github.blog/changelog/2026-10-02-unvalidated-npm-trusted-publishing-configurations-now-expire/); recreate an expired configuration. A retry that skips an already-published identical version performs no publish and does not establish successful trusted authorization. After a manual bootstrap, the next new version is the first opportunity to validate this workflow's publishing identity.

## Prepare each release

1. Finish the normal build and acceptance checks on the release checkout. Include the publishing workflow, helper and documentation in Git, together with all generated runtime/resource files. Keep repository text files in the canonical LF form specified by `.gitattributes` before packing, including on Windows: verification compares archive bytes with the Linux tag checkout. The version in `package.json` must match the stable tag `vX.Y.Z`, and the package name must be `@cleverpig/dsh-workspace-guard`.
2. Create the npm tarball once with scripts disabled and test that exact tarball. Generate the matching source companion with `pnpm source:release`. The source archive contains the tracked project files, four locked upstream archives and `source-manifest.json`.
3. Upload these three assets to a draft release before publishing it:

   - `cleverpig-dsh-workspace-guard-X.Y.Z.tgz`
   - `cleverpig-dsh-workspace-guard-X.Y.Z-source.tar.gz`
   - `SHA256SUMS`, containing standard SHA-256 lines for both filenames, for example `64-hex-digits  filename`.

4. Commit/tag the exact files represented by those archives, push that tag and publish the stable GitHub release. The `release: published` event starts publishing. Drafts and prereleases are excluded. Updating assets on an already-published release does not start another automatic run.

Do not rebuild between testing the tarball and uploading it. Hashes prove that the checked assets are the uploaded bytes; acceptance evidence must identify the exact tested tarball separately.

## Verification and retry

The workflow confirms that the release is published and stable, checks out its exact tag, and downloads only its two named archives and `SHA256SUMS` using the repository's read-only GitHub token. `build/publish-release.mjs` verifies the package identity/version and checksums, compares the npm contents with that checkout, requires all tracked runtime/resource files, and verifies the source archive's project file set and four upstream hashes. It publishes the verified `.tgz` using `npm publish --access public --ignore-scripts`.

Before publishing, it reads the public npm version metadata. A version with the same SHA-512 tarball integrity succeeds without publishing again. Different bytes fail; npm versions cannot be replaced. Registry lookup errors also fail. This retry check does not alter npm distribution tags.

For local inspection without credentials or publishing, use Node.js with `RELEASE_TAG` and `RELEASE_ASSETS_DIR` set, then run `node build/publish-release.mjs --verify-only` from the matching release checkout. The files must already be tracked; this verifies the archive against the current checkout and does not claim that a tag or hosted workflow ran locally.

To retry a published release, use **Actions → Publish to npm → Run workflow** and enter its exact stable tag. The same release, tag, archive and registry checks run again. The workflow must also exist on the default branch for this manual trigger. A retry does not bypass failed checks or missing npm trust configuration.

For the next genuine new-version publication, inspect the workflow logs and public npm tarball and record the result. Recheck the trusted-publisher relationship first because an unvalidated configuration can expire. An identical-version skip does not establish trusted authorization.
