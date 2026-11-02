# Upstream generation and provenance

The release is generated from exact official npm build dependencies at DSH 0.2.1-rc.5. The twelve selected module inputs are listed in build/upstream.mjs, including the stateless atomic-write lock helper bundled for standalone offline recovery. They are not maintained as copied source files.

Installed peers use minimum-only ranges independently of these build pins: DSH >=0.2.1-rc.1, Cordis >=4.0.3, Schemastery >=3.18.3 and node-addon-system >=0.1.2. The selected Purge consumer requires >=1.1.70. The DSH minimum's 16 external peer packages contain 73 JavaScript files identical to the pinned baseline; HMR was compared separately. Cordis 4.0.3 and Schemastery 3.18.3 have identical inspected runtime JavaScript to their build versions. Earlier Schemastery lacks the used `volatile()` API; earlier inspected Purge configuration lacks the planner's required static `inject` declaration. These source comparisons support the floors; they are not full older-host execution or a guarantee for future releases.

## Build

1. Install the frozen pnpm lockfile.
2. Run typecheck and lint.
3. Run pnpm build:release. The build first verifies each selected official entry against build/upstream-lock.json, then bundles the selected entries and writes release provenance.

For an intentional supported-upstream update, review the dependency changes, refresh registry provenance using pnpm upstream:refresh, inspect source differences and preservation rules, and repeat functional acceptance. Refresh verifies downloaded tarballs against registry SHA-512 integrity and compares their entry bytes to local build inputs. Registry integrity is not a separate publisher signature. Network fetches are time-bounded.

The checked transformations retain Purge #22 and #48. A changed input hash or unexpected transformation count fails the development build. It does not install another runtime tool restriction.

The selected official inputs have no relative ESM imports in the inspected release. Their package imports connect selected native implementations in one graph. Build allowlists control bundled packages; host service contracts and native resources remain external. Standalone diff, yaml and zod are bundled from locked development dependencies. The lock helper adds no runtime peer requirement.

## Release records

- build/upstream-lock.json: exact versions, official archive URLs/integrity, input and license hashes.
- lib/build-manifest.json: generated chunks, imports and module graph, preserved-feature transformations.
- lib/provenance.json: input records, pnpm lockfile hash and output hashes.
- lib/THIRD_PARTY_LICENSES.txt: bundled dependency license texts.

Generated lib files are committed for Git-source installation. No prepare/postinstall compiler is needed. Builds never read .dshpurge.bak files or mutate host packages.

Windows deployment uses the external official packaged ACL runner. Its import.meta.resolve lookup must work from the installed plugin location. The upstream source fallback assumes the official source tree and is not an accepted deployment substitute.
## Shared host identities

The generated ToolRuntime uses the host's exported TOOL_RUNTIME_SCHEDULER symbol, which the unchanged native agent loop uses for dispatch. The generated sandbox helper uses the host's SandboxUnavailableError class so external native workers retain their instanceof classification. Checked build transformations import only these identities; the permission-expansion implementation remains bundled and restored. The build records these transformations separately from Purge feature preservation.
