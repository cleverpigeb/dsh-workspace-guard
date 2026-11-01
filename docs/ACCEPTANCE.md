# Acceptance — 0.2.0 review build

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

README.md remains byte-for-byte unchanged for Antigravity. Its earlier content is pending replacement by its owner; these engineering documents describe the current implementation.
## Distribution

Local tarball and Git-source installations passed with lifecycle scripts disabled. All 24 runtime/resource files matched the release, all 13 JavaScript export entries imported, host scheduler identity matched, an actual workspace write succeeded, and an outside sentinel remained unchanged. The corrected Git install added only this package; it did not install the development toolchain. The developer build command is build:release because npm treats a bare build script as a Git preparation trigger. Hosted installation remains unverified.
