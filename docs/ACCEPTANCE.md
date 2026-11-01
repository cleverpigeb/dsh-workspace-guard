# Acceptance — 0.2.1 automatic installation

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
