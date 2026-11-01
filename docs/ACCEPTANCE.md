# Acceptance — 1.0.0 implementation candidate

Validated locally on Windows x64 with Node 26.7.0, DSH 0.2.1-rc.5 and Purge 1.6.67. This candidate retains automatic installation, native permission selection and receipt schema 2. Antigravity's README/licence update and the final release archives follow this implementation. The records below distinguish current checks from historical results.

## Current repair and build checks

- 26 maintained-source configuration scenarios and 25 generated-runtime scenarios passed. The additional source-only case checks that a transaction callback is never retried. Coverage includes ordered effective overrides and name guards, disabled generated providers, nested preset edits, comments, unrelated insertion children, conflicting permission wiring, scoped v0.2.1 receipts, and native addressing after group configuration replacement.
- Lock/recovery checks cover live and crashed native holders, dead legacy JSON records, concurrent migration, malformed records, reused process identifiers, takeover claims, canonical paths and changed snapshots. Before/after journal states finalize durably; third states are rejected. Receipt-only commits preserve patch timestamps, diagnostics stay read-only, and finalized no-op loads stay write-free.
- 36 release/build scenarios passed: valid directory layouts; file/directory and ancestor collisions in both orders; slash-terminated regular files; unsafe members, roots, sizes and checksums; each missing root notice; source archive streaming/hash/size; exact and alternate pnpm input paths; and immutable-version retry behavior.
- TypeScript, Oxlint, Actionlint and verification of all 12 pinned official inputs passed. Runtime generation and provenance completed. All 25 recorded output hashes, 12 imported provider/adapter namespaces, the shared clean helper, both host identities and preserved Purge #22/#48 transformations passed checks. The bundled lock helper adds one MIT notice, bringing generated licence sections to 15; it adds no runtime peer.
- Independent final review found no remaining actionable regression in the changed configuration, lock, CLI and release code. The exact local tarball inventory, checksum and extracted-package CLI results are recorded with the ignored implementation artifacts.

## Current isolated host evidence

Actual Cordis Loader, app-boot, HMR and PluginManager passed installation, disable, restart and removal against the rebuilt candidate. Package operations and provider implementations in this lifecycle fixture were explicit stubs. Later settings migrated back to native providers, and restoration occurred before fixture package deletion.

A separate real-provider fixture automatically loaded ten compiled providers/adapters. The exact copied Purge fresh-session hook retained Workspace Write. The native file tool wrote inside the workspace and rejected the external sentinel. Explicit root Full Access allowed an external write, and returning to Workspace succeeded. There were zero approval requests and zero owned processes after disposal. Eighteen sampled normal source/profile hashes had zero drift; normal Desktop configuration and sessions were untouched.

The official Bash smoke did not establish shell effects. Native executable discovery first selected the Windows WSL launcher and failed with `Bash/E_ACCESSDENIED`. A fixture-only subclass then changed only the first command argument to the existing bundled Bash executable; startup failed with `couldn't create signal pipe, Win32 error 5` (exit 3221225794). One clean pinned official sandbox/provider control reproduced that exact failure without Guard, Purge or OPS runtime. This is an inherited native fixture limitation, not a confirmed Guard regression. No new OPS startup/cache run was performed; earlier OPS evidence retains its original version and scope. Initial loader-setup failures and the shell failures remain in local evidence.

## Performance scope

Source inspection and focused checks establish removal of duplicate work in eight places: reuse of the lower composed tree; one parsed planning context and incremental restoration baseline; scope/id maps for nested preset pairs; reuse of explicit-field and overlay data; one normalized transform path and precomputed input lookup; Set membership for tracked source files; one filesystem stat per source input; and streamed archive hashing with metadata size lookup. Inputs are still reread after lock acquisition and checked before writing. Fresh native path checks, facade forwarding/reflection, shared identities and independent integrity checks remain intact.

No comparative benchmarks or numerical speedup claims were made. Archive timestamp reproducibility is outside this work.

## Current limits and release follow-up

Normal Desktop GUI activation, genuine npm OIDC publication and a hosted v1.0.0 installation remain unverified. Native Windows enforcement remains partial; the accepted native PowerShell failure, retained per-agent presets, teardown-error removal behavior and older untested routes remain as recorded below. The native Bash control above adds a current shell limitation, without erasing historical OPS passes.

Hosted Actions run 41318207959 previously verified the immutable v0.2.1 archives and skipped an identical published npm version. It did not exercise trusted publishing. Final v1.0.0 npm/source archives and the tag must represent the revision after Antigravity's documentation changes, with verification repeated against those exact bytes. The local candidate is not a published release.

Local evidence is under `.local/release-1.0.0/`: configuration source/generated results, release fixtures, native lifecycle/smoke/control reports and package verification. Harnesses and implementation records remain ignored. Sanitized current results and unchanged historical data are separated in `acceptance-results.json`.

## Historical record — 0.2.1 automatic installation

The remainder preserves the earlier acceptance snapshot, including its then-current publication status. It is not a claim that all older cases were rerun for 1.0.0.

This revision moves the owned configuration transaction into the plugin lifecycle. Installing/enabling applies it automatically; disabling/removing restores it through DSH's normal configuration watcher.

## Scoped package release

The release package is `@cleverpig/dsh-workspace-guard@0.2.1`. Eleven scoped configuration groups passed, including refusal to reuse an active receipt with the earlier unscoped module names and successful activation after explicit restoration. The actual Loader/HMR/PluginManager install, disable, restart and removal checks passed again with the scoped name; provider and package-operation fixtures remained explicit. The existing native ownership-conflict teardown limitation was reproduced.

The scoped real-provider smoke loaded nine compiled providers automatically. The Purge hook preserved Workspace Write; shell and filesystem writes succeeded inside the fixture workspace and left the rejected external sentinel unchanged. The first shell attempt aborted at the 15-second tool deadline. One repeat with a 40-second tool deadline passed; the original timeout cause remains unconfirmed. Both runs disposed all owned processes. The normal Desktop profile was untouched.

Eleven isolated publishing checks passed for archive identity, version, runtime contents, checksums, registry failures and identical-version retries. The workflow and helper are prepared; hosted GitHub Actions execution and npm OIDC authorization await a real publication. Package verification and publication dry runs are recorded with the local release artifacts.

## Automatic configuration and native reload

- Ten focused transaction scenario groups passed: automatic activation, repeat-load idempotence, shutdown retention, version-2 receipt reuse, later-edit preservation, disable/removal, launch-overlay conflicts, dynamic-state diagnostics, interrupted-journal recovery, and acknowledged offline recovery after package removal.
- Actual Cordis Loader, DSH app-boot, HMR and PluginManager passed isolated install, disable, restart and removal tests. The installed Guard lifecycle was the built release. Provider implementations and package-manager execution were explicit fixture stubs in this lifecycle test; loaded provider fibers and resulting files were checked.
- A separate end-to-end test used the actual copied Guard package, native DSH services and HMR. Bundle selection automatically started nine real Guard providers. The safe copied Purge fresh-session hook retained Workspace Write; actual `ops_bash` and the native file tool wrote inside the fixture workspace and rejected the external sentinel. Windows reported native partial enforcement. Zero approval prompts and zero owned processes after disposal were observed. Only the base-bundle metadata and Purge hook wrapper were fixtures.
- Normal removal restored the owned configuration before the fixture package was deleted. A later edit to an owned tools configuration migrated back to the native provider; unrelated settings survived.
- Native filesystem effects passed in Read Only, Workspace Write and Full Access. Actual OPS Bash passed Workspace Write and Full Access; its initial Read Only startup timed out, and one bounded repeat passed. The timeout cause is unconfirmed and retained in local evidence.
- Twelve generated provider/consumer entry bodies and imports match the prior release after normalizing generated shared-module filenames and import order. The pinned official inputs and preservation transformations still pass verification.
- Strict TypeScript and Oxlint passed.
- Release compatibility review removed the unrelated OPS version gate. Five focused fixture checks passed: unrelated plugin versions accepted, supported DSH accepted with an unrelated resolvable plugin, unsupported DSH/Purge manifests rejected, selected Purge checked, and unsupported DSH runtime rejected. Both README link sets and matching CLI commands passed validation; all 14 bundled license sections and 25 generated runtime/resource hashes were verified.

## Native behavior and recovery observations

DSH retains preset revisions per agent. Source inspection confirms newly mounted agents receive the updated preset, while existing agents and their children can retain the earlier static tool consumers. A genuine cold resume mounts the current revision; reopening a still-live tab reuses its agent. A normal restart refreshes surviving sessions after the user finishes ongoing work.

An ownership-conflict removal test exposed a DSH teardown limitation: Cordis logs a disposer rejection and the plugin manager can still remove the package. The edited patch and receipt were preserved, and the manager returned provider warnings. Refusal of package removal in this case failed the test. Optional offline recovery now works with a valid receipt after the package has been removed, whether its bundle remains selected or has been deselected. Conflicting identities continue to require review before restoration.

The normal Desktop profile and its running tasks were left untouched. Antigravity updated both READMEs for automatic installation; the release review corrected acceptance wording and offline recovery instructions with the user's authorization.

## Native baseline — 0.2.0

Validated on Windows x64 with Node 26.7.0, DSH 0.2.1-rc.5, Purge 1.6.67 and OPS 0.4.4. This is isolated functional evidence, not normal Desktop activation or a hosted installation.

## Results

- Build, strict TypeScript check and Oxlint: passed.
- Official input verification: 11 registry-integrity/source-hash-checked entries; checked Purge #22/#48 preservation and shared host identities.
- Native functional suite: **41 passed, zero failed, one native-baseline-unavailable**.
- A separate test with physically no approval handler passed: outcome unavailable; external sentinel unchanged.
- After explicit-target Purge Apply and reapply, separate fresh engine processes each repeated the 41 passes and the same unavailable native terminal case.
- All 16 Purge mutation targets and maintenance state were isolated physical copies. Twenty-one sampled normal source/profile hashes had zero drift.
- Formal configuration, later-edit preservation, removal after version upgrade, locks, native permission facade and selected-consumer version tests passed.
- The final configuration-only rebuild changed cli.js and provenance.json; all tested native runtime files remained byte-identical.

## Observed effects

Actual OPS Bash started with exit zero in all three modes, including Workspace with compatibility mode off. A Workspace-only write succeeded without approval; external writes were denied. OPS native worker write/copy/remove operations observed their mode envelopes. Native Windows enforcement reported partial.

Native file writes/edits, relative paths, missing parents, traversal and junction cases were exercised. Static consumer rejection, cancellation, unavailable-channel and abort paths prevented effects. Per-call run_code executed in all three modes; retained PTC state and native narrowing worked. An actual OPS background job completed. The unchanged host AgentLoop dispatched a native tool against a deterministic two-response model endpoint.

Formal scope tests used native permission/shell services, the Cordis loader, and the exact fresh-session hook extracted unchanged from installed Purge. Automatic Full Access was suppressed; explicit root Full Access and other forwarded APIs worked. Normal configuration preview retains all four preset enabled states, ten root replacement pairs and thirteen nested static-consumer pairs.

## Limitations and observations

Persistent PowerShell reported **PTY shell exited during startup**. The identical fixture with clean official providers produced the same failure. This is not counted as success; the plugin does not disable that tool. Full Access PTY operation remains unverified.

An initial reused-file case encountered ReplaceFileW EIO / Win32 1175. Its cause is unconfirmed. An isolated retry and later direct/Apply/reapply runs passed; the original observation remains in local evidence.

Native subagent/worktree adapter dispatch was exercised, but full model-backed child spawn/fork/resume, descendant lifetimes and real Git worktree operations remain unverified. GUI interaction, live LSP transport, hosted plugin-manager operations and normal-profile activation were not performed. Purge testing used explicit isolated targets, not all-host maintenance.

Windows retains native write-restriction limits: no read/network isolation or isolation of malicious plugins sharing the host process.

## Reproduction and records

Use a disposable DSH profile with supported versions, an internal workspace and separate external sentinel files. Exercise native modes and predefined approval outcomes, inspect file contents/process exits, then repeat after isolated Purge Apply/reapply and fresh engine startup. Never use normal-session prompts or all-host maintenance for these tests.

The necessary local harness and raw failure evidence remain untracked under .local/new and .local/new-validation. Sanitized results are in acceptance-results.json. Test scripts are deliberately not distributed in Git.

Both READMEs remain maintained by Antigravity. These engineering documents retain detailed evidence and its scope.
## Distribution

Local tarball and Git-source installations passed with lifecycle scripts disabled. All 24 runtime/resource files matched the release, all 13 JavaScript export entries imported, host scheduler identity matched, an actual workspace write succeeded, and an outside sentinel remained unchanged. The corrected Git install added only this package; it did not install the development toolchain. The developer build command is build:release because npm treats a bare build script as a Git preparation trigger. Hosted installation remains unverified.
