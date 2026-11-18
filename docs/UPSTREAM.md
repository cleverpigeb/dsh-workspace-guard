# Upstream generation and provenance

The release is generated from exact official npm build dependencies at DSH 0.2.2-rc.4. The fifteen selected JavaScript inputs from fourteen DSH packages are listed in build/upstream.mjs, including the stateless atomic-write lock helper bundled for standalone offline recovery. They are not maintained as copied source files.

Guard requires DSH >=0.2.2-rc.2. The rc.4 build uses sandbox error classes that rc.1 does not export. The selected provider implementations match rc.2 and rc.3. Purge still requires >=1.1.70 for its static injection declaration. The standalone CLI requires Node >=22.19.0. DSH itself specifies Node >=24.9.0.

## Build

1. Install the frozen pnpm lockfile.
2. Run typecheck and lint.
3. Run pnpm build:release. The build first verifies each selected official entry against build/upstream-lock.json, then bundles the selected entries and writes release provenance.

For an intentional supported-upstream update, review the dependency changes, refresh registry provenance using pnpm upstream:refresh, inspect source differences and preservation rules, and repeat functional acceptance. Refresh verifies downloaded tarballs against registry SHA-512 integrity and compares their entry bytes to local build inputs. Registry integrity is not a separate publisher signature. Network fetches are time-bounded.

The checked transformations retain Purge #22 (read limits), #48 (shell guidance) and #93 (file-policy wording). A changed input hash or unexpected transformation count fails the development build. It does not install another runtime tool restriction.

The tool pipeline and its private shared JavaScript file are both locked. Both executors use the same bundled pipeline. The tools registry, Cordis services and native resources come from the host. The build also bundles the locked diff, yaml and zod dependencies.

## Release records

- build/upstream-lock.json: exact versions, official archive URLs/integrity, input and license hashes.
- lib/build-manifest.json: generated chunks, imports and module graph, preserved-feature transformations.
- lib/provenance.json: input records, pnpm lockfile hash and output hashes.
- lib/THIRD_PARTY_LICENSES.txt: bundled dependency license texts.

Generated lib files are committed for Git-source installation. No prepare/postinstall compiler is needed. Builds never read .dshpurge.bak files or mutate host packages.

Windows deployment uses the external official packaged ACL runner. Its import.meta.resolve lookup must work from the installed plugin location. The upstream source fallback assumes the official source tree and is not an accepted deployment substitute.

## Shared host identities

The tools entry re-exports the host registry. Both executors import the clean pipeline, including its tool approval decision. The generated code uses the host constructors for seven tool errors, four sandbox errors and the sandbox provider base class. lib/host-identities.json lists each constructor and records the before/after hashes. The Windows ACL runner stays with DSH.
