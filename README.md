# DSH Workspace Guard

`dsh-workspace-guard` is an independent Windows plugin that restores workspace write restrictions affected by Purge in DeepSeek Harness Desktop. It keeps Purge, the existing permission selector, and `ops_bash`. It uses plugin-owned clean services and formal Cordis configuration; it does not patch installed DSH, Purge or OPS source.

**Initial compatibility target:** DSH `0.2.1-rc.5`, Purge `1.6.67`, OPS `0.4.4`, Windows x64. This is a review release. Read [coverage](docs/COVERAGE.md) and [acceptance](docs/ACCEPTANCE.md) before activating a profile. Unsupported affected routes are blocked; package installation by itself is deliberately inactive.

## Behavior

- New sessions use Workspace Write with real approval. Read Only and explicitly selected Full Access remain available. Existing session selections remain intact; loaded Full Access sessions are reported.
- A permission expansion belongs to one registry-created invocation, including its tool definition, frozen arguments, agent, session, workspace and permission generation. Rejection, cancellation, missing channels and changed identity prevent dispatch.
- Permission changes close new admission and wait for managed work to finish. The old mode remains effective while waiting; active work is not killed.
- Clean filesystem and process adapters recheck authority before effects. Windows processes use DSH's existing restricted backend; `ops_bash` does not require compatibility mode.
- Purge gets a read-through permission facade that refuses its automatic widening. The root permission service still owns the existing user controls.

Persistent terminals, `run_code`, unvalidated OPS native-worker tools, model-started/resumed subagents, workflows, worktree creation, and tool-driven Purge maintenance are withheld. The Minimal preset is disabled; Standard and Cordis remain available. Exact names and effects are in the coverage matrix. This release does not silently run an unsupported route with Full Access.

## Install and activate separately

The repository includes `lib/`, the ready-to-run ESM build. A Git-source installation needs no TypeScript compiler, native addon build, Rust toolchain or install lifecycle script. Shared DSH services and the existing Windows native resources remain host dependencies. A hosted Git mirror has not yet been published or tested.

1. Review this repository, its acceptance record and the proposed configuration.
2. Add this package through DSH's plugin package workflow, using a published Git mirror when one is available. Select its bundle. Installation only exposes an inactive status plugin.
3. Use the configuration helper to inspect and preview an **explicit** profile. It never defaults to the normal desktop profile.
4. Stop the host using that profile after its tasks finish, then apply the reviewed activation. Do not hot-swap providers under running work.

```powershell
node <package-directory>/lib/cli.js doctor --profile <profile-directory> --home <dsh-home> --host-modules <host-node_modules>
node <package-directory>/lib/cli.js plan --profile <profile-directory> --home <dsh-home> --host-modules <host-node_modules>
node <package-directory>/lib/cli.js activate --profile <profile-directory> --home <dsh-home> --host-modules <host-node_modules> --apply --host-stopped
```

Angle-bracket values are placeholders, not executable examples. `--host-stopped` is an operator acknowledgement, not a process detector. The helper does not stop any process. Read [installation and rollback](docs/INSTALLATION.md) for the ownership receipt, safety disables, conflicts and upgrade procedure.

## Boundaries

These are Windows write restrictions, not read or network isolation. DSH's backend reports partial enforcement. Same-process malicious plugins, direct writes by unrelated plugins, and hostile host configuration are not isolated. Runtime housekeeping still needs its private files. Explicit Full Access intentionally permits outside writes.

Path handling uses DSH's canonical-path and Windows backend contracts. Do not interpret passing junction fixtures as protection against every hostile filesystem race, pre-existing hard link, inherited handle or filesystem implementation. Unknown affected execution routes must stay disabled until reviewed.

## Maintain

Source is separated into compatibility, admission/permissions, approval, enforcement, and configuration lifecycle modules under `src/`. [Upstream provenance](docs/UPSTREAM.md) records integrity-verified incorporated sources and deliberate changes. MIT licenses and upstream notices are retained.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm pack
```

The stack is strict TypeScript 7, tsdown/Rolldown, ESM, Cordis, Schemastery, pnpm, Oxlint and Oxfmt. No comparative benchmarks or measured performance claims are made. Build outputs are maintained because remote installation takes priority over speculative native acceleration. Tests, isolated profiles, logs and receipts stay outside Git in `.local/`; concise acceptance procedures and sanitized results are maintained in `docs/`.

During unattended development, only owned disposable profiles and fixture processes are used. Publishing, pushing, activating the normal profile and approving its prompts are separate actions left to the user after review.
