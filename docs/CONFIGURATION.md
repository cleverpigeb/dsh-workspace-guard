# Configuration lifecycle

The installed bundle adds a lifecycle entry. Installing or enabling it automatically creates the owned native-provider configuration. DSH's existing profile-file watcher performs the subsequent serialized reload. Disabling or removing the bundle automatically restores its owned changes. Ordinary shutdown retains the configuration for the next startup.

Activation accepts DSH >=0.2.1-rc.1 and Purge >=1.1.70 with no upper bound. If lifecycle initialization fails, Guard restores valid existing owned configuration before reporting the activation error, even while the bundle is still selected. Cordis discards failed initialization effects, so postponing this restoration until uninstall would lose the cleanup callback. Restoration skips activation version checks, retains receipt schema 2, and finalizes recognized interrupted transactions under the existing lock. A restoration failure reports both errors and preserves the patch and receipt.

The helper reads selected bundle layers, the profile patch, the later home patch and launch overlays using DSH's formal insertion/name-guard semantics. It preserves JavaScript-valued YAML expressions without evaluating them. Activation creates paired rows: disable each affected original entry and insert a uniquely named generated entry with the original scope, settings and enabled/platform state. Preset plugin lists receive equivalent paired entries.

A root bridge exposes the native permission service to a facade isolated for Purge. The Purge row receives that scope and an explicit permission dependency. Native UI callers use the root service. No other Purge configuration or unrelated provider is disabled.

Fresh default behavior is native Workspace Write with approval; explicit user configuration and existing session selections are retained. Custom composition that cannot be reconciled is reported before application.

## Commands

These optional diagnostic and offline recovery commands require an explicit profile directory. Normal installation and enabling apply configuration automatically. Use the package's `node lib/cli.js --help` for options.

- doctor: inspect supported bundle versions and composition.
- plan: print the proposed activation patch.
- activate: inspect or repair offline activation; write only with --apply --host-stopped.
- deactivate / rollback: preview removal of owned changes; the same write acknowledgements apply.
- recover-lock: preview the primary/migration locks and takeover claims, returning a snapshot digest. Offline removal requires --apply --host-stopped --expected-snapshot <sha256>.

Use --home and --host-modules when the DSH home or host package root cannot be inferred. The helper does not install packages or stop any host. --host-stopped is an operator acknowledgement.

## Ownership and recovery

The receipt lives in the target profile's .workspace-guard directory. Writes use a lock, temporary files, atomic replacement and a transaction journal. An already valid configuration produces no additional write. A concurrent configuration change or an ambiguous interrupted transaction is reported with the existing contents retained.

Version 1.0.0 validates effective profile overrides as well as the marked ownership records. Applicable later settings on generated providers, including disabled states and nested preset edits, are restored to native identities. Conflicting effective Purge isolation, bridge/facade wiring or root permission authority is reported before configuration is declared ready.

The bundled official writer lock uses the existing configuration.lock path and a bounded acquisition wait. A legacy JSON lock is converted under a migration mutex only when its recorded process is demonstrably gone. Recognized interrupted transactions are finalized during authorized synchronization even when the patch itself needs no change. Receipt-only finalization does not rewrite the patch; doctor and plan remain read-only. The receipt schema remains version 2.

For malformed locks, reused process identifiers or interrupted takeover claims, first stop every host and writer using the profile. Run recover-lock to inspect the exact files and obtain snapshotSha256, then repeat with --apply --host-stopped --expected-snapshot <snapshotSha256>. Keep the profile exclusively offline throughout recovery. The command removes only the identified lock records and claims, after checking their paths and snapshot; configuration and receipt contents are retained. A changed snapshot requires another preview. It does not stop processes or establish that the host is stopped.

DSH bundle removal first deselects the bundle and reloads it, allowing the lifecycle disposer to restore the previous native providers and remove the scoped adapter. The manager then removes the package and reloads the restored configuration. Later unrelated settings are preserved; conflicting changes to owned identities are reported. Direct filesystem deletion bypasses DSH's lifecycle and requires receipt-based recovery.

If an ownership, journal, lock or missing-configuration problem prevents restoration, keep the package installed until recovery succeeds. DSH 0.2.1-rc.5 can still finish removal after a cleanup error, and residual provider references can prevent startup. Resolve the reported error, then run the optional `deactivate --apply --host-stopped` recovery command from an installed or downloaded matching package, with the explicit profile directory. This recovery also works after the bundle has been deselected or removed. Ordinary removal with intact ownership completes automatically.

Old prototype receipts require separate explicit migration. The normal profile was never activated by the prototype in this development session. Never infer running-host use from an offline composition check.

## Native reload integration

The lifecycle entry depends on `profileContext` and `hmr`. It writes the configuration transaction and returns; DSH's already registered patch watcher queues the next reconciliation. This follows the host's serialization and application-readiness behavior. Calling HMR from plugin initialization, including an inherited timer context, would nest a transaction and is deliberately avoided.

This integration uses native provider lifecycles for active tools and retained resources. It adds no tool admission or process-control mechanism. Configuration conflicts and failed provider loading are distinct outcomes and retain their normal diagnostics.

Native preset revisions are retained per agent. Re-registering an updated preset affects new mounts; existing agents and their children can retain the earlier static tool consumers until their scopes end. A cold session resume mounts the current revision. A normal application restart refreshes the surviving sessions once the user has finished ongoing work.
