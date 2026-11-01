# Configuration lifecycle

The installed bundle adds an informational entry only. Native provider selection changes only through an explicit, idle-profile activation transaction.

The helper reads selected bundle layers, the profile patch, and the later home patch using DSH's formal insertion/name-guard semantics. It preserves JavaScript-valued YAML expressions without evaluating them. Activation creates paired rows: disable each affected original entry and insert a uniquely named generated entry with the original scope, settings and enabled/platform state. Preset plugin lists receive equivalent paired entries.

A root bridge exposes the native permission service to a facade isolated for Purge. The Purge row receives that scope and an explicit permission dependency. Native UI callers use the root service. No other Purge configuration or unrelated provider is disabled.

Fresh default behavior is native Workspace Write with approval; explicit user configuration and existing session selections are retained. Custom composition that cannot be reconciled is reported before application.

## Commands

All require an explicit profile directory. Use the package's `node lib/cli.js --help` for options.

- doctor: inspect supported bundle versions and composition.
- plan: print the proposed activation patch.
- activate: preview activation; write only with --apply --host-stopped.
- deactivate / rollback: preview removal of owned changes; the same write acknowledgements apply.

Use --home and --host-modules when the DSH home or host package root cannot be inferred. The helper does not install packages or stop any host. --host-stopped is an operator acknowledgement.

## Ownership and recovery

The receipt lives in the target profile's .workspace-guard directory. Writes use a lock, temporary files, atomic replacement and a transaction journal. A concurrent configuration change or an ambiguous interrupted transaction is reported instead of overwritten.

Removal restores the previous native providers and removes the scoped adapter. It preserves later unrelated settings and reports conflicting changes to owned identities. No deliberate tool disables remain after managed removal. Removing the package before removing its configuration can leave unresolved entries; use managed removal first.

Old prototype receipts require separate explicit migration. The normal profile was never activated by the prototype in this development session. Never infer running-host use from an offline composition check.
