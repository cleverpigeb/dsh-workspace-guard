# Installation and removal

Install `@cleverpig/dsh-workspace-guard` through DSH's plugin manager using its npm or Git source. The manager enables the bundle by default. The plugin then records its configuration changes and DSH's normal profile watcher loads the repaired native providers automatically. Installation and enabling are the complete setup flow.

The package contains prebuilt ESM JavaScript and its resources. Both installation sources use that runtime. The plugin checks its supported DSH and Purge versions before changing configuration.

Automatic setup uses the Desktop profile's native HMR service (DSH's configuration reloader). Configuration and provider loading are asynchronous; the plugin logs when configuration is saved, and DSH reports provider-loading errors through its normal plugin diagnostics. A profile with HMR disabled requires its native reload service for this automatic flow.

New chats use the updated tool preset after automatic reload. DSH retains each existing agent's preset revision, including the revision inherited by its children. To refresh all existing chats, finish ongoing work and restart DSH normally; a genuine cold resume also mounts the current preset. Opening a tab for an agent that is still live retains that agent's revision. Installation and removal follow DSH's native resource lifecycle.

The CLI is optional diagnostics and recovery tooling. `doctor` inspects compatibility and owned configuration; `plan` shows the proposed changes. `recover-lock` previews residual lock records and supplies the snapshot digest needed for explicit offline cleanup. Offline recovery commands retain their explicit profile and stopped-host acknowledgements. See CONFIGURATION.md.

The host must provide the matching packaged Windows ACL runner. The upstream source-tree fallback is not a portable deployment substitute.

## Upgrade and rollback

Upgrade, disable and uninstall through DSH's plugin manager. Automatic setup is idempotent: a valid existing configuration is reused. Disabling or removing the bundle restores the previous providers through the same owned-change transaction and DSH reload process. Ordinary application shutdown keeps the active configuration for the next startup.

Removal preserves later edits or reports conflicts. An edited owned identity or conflicting configuration field needs review; its contents are retained. The CLI remains available to inspect and recover such configurations. Restoring the previous providers also restores their behavior with Purge.

DSH 0.2.1-rc.5 can finish uninstalling after a cleanup error. If manually edited ownership records cause this, retain the patch and receipt and follow CONFIGURATION.md's offline recovery procedure. Normal disable and uninstall restore configuration automatically.

Version 1.0.0 reuses valid version-2 receipts from scoped v0.2.1. For an earlier unscoped development build, first remove that bundle through DSH, then install `@cleverpig/dsh-workspace-guard`. An active receipt containing a different package name is reported before configuration writes. Use the previous verified package when rolling back an unsuccessful upgrade, and retain its ownership receipt until recovery completes.

The plugin introduces no separate ACL reset procedure. Native ACL resource lifecycle remains native; do not perform blanket ACL resets.

README authoring remains with Antigravity. Its English and Chinese v1.0.0 updates have been reviewed against the implementation.
Developer builds use pnpm build:release. A bare build script is intentionally absent because npm treats that name as a Git-dependency preparation trigger and installs development dependencies.
