# Installation and removal

The package contains prebuilt ESM JavaScript. Git-source and npm distribution use the same runtime; installation requires no compiler, custom native addon or lifecycle build script. Registry publication and a hosted Git mirror are separate steps.

Installation registers an inactive bundle. Activate while the target profile's host is stopped after its work finishes. The helper does not stop DSH or approve real prompts. Use an explicit profile and inspect the proposed changes first.

Run `node lib/cli.js --help` for exact options. `doctor` inspects compatibility; `plan` prints activation changes. Configuration commands preview unless explicit write and stopped-host acknowledgements are supplied. Acknowledgement does not independently prove a host is idle.

The host must provide the matching packaged Windows ACL runner. The upstream source-tree fallback is not a portable deployment substitute.

## Upgrade and rollback

Keep the last verified package until its replacement passes compatibility and isolated acceptance. Upgrade while the target profile is stopped. If the upgrade fails, restore that package and review the recorded configuration transaction.

Removal restores only owned values still matching recorded installed values. Later edits are preserved or reported as conflicts. Restoring the previous providers can reintroduce Purge's Workspace conflict. Remove the owned configuration before uninstalling the package.

The plugin introduces no separate ACL reset procedure. Native ACL resource lifecycle remains native; do not perform blanket ACL resets.

Normal-profile activation, publication and hosted installation remain deferred. README authoring is separately owned by Antigravity; consult this directory for current implementation and acceptance information.
Developer builds use pnpm build:release. A bare build script is intentionally absent because npm treats that name as a Git-dependency preparation trigger and installs development dependencies.
