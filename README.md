# DSH Workspace Guard (`@cleverpig/dsh-workspace-guard`)

**English** | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![License: GPL v3 or later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Target DSH](https://img.shields.io/badge/DSH-0.2.2--rc.4-teal.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)](docs/COVERAGE.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.19.0-brightgreen.svg)](package.json)

**DSH Workspace Guard** is a third-party native-parity compatibility plugin for **DeepSeek Harness (DSH)** on Windows. It restores official **Workspace** mode (`workspace-write`) and **Read Only** mode (`read-only`) when running alongside **Purge** (`dsh-purge` / `dsh-purge-community`), without modifying host binaries, patching installed `node_modules` files on disk, or disabling Purge itself.

---

## Table of Contents

- [Purpose and Background](#purpose-and-background)
- [Architecture](#architecture)
- [Compatibility](#compatibility)
- [Permission Modes](#permission-modes)
- [Functionality and Coverage Matrix](#functionality-and-coverage-matrix)
- [Installation and Configuration Lifecycle](#installation-and-configuration-lifecycle)
  - [Installation and Automatic Setup](#installation-and-automatic-setup)
  - [Daily Usage and Native Chat Behaviour](#daily-usage-and-native-chat-behaviour)
  - [Upgrading, Disabling, and Uninstalling](#upgrading-disabling-and-uninstalling)
  - [Advanced Diagnostics and Offline Recovery (CLI)](#advanced-diagnostics-and-offline-recovery-cli)
- [Supported Capabilities and Blocked Actions](#supported-capabilities-and-blocked-actions)
- [Development Commands](#development-commands)
- [Repository Structure](#repository-structure)
- [Detailed Documentation](#detailed-documentation)
- [Licensing](#licensing)

---

## Purpose and Background

In official DeepSeek Harness (`0.2.2-rc.4`), the **Workspace** (`workspace-write`) and **Read Only** (`read-only`) permission presets combine five layers:

1. **Permission Preset Service** (`permissionPresets`): Resolves the active session mode (`read-only`, `workspace-write`, or `danger-full-access`) and supplies default file and command policies.
2. **File-System Policy and Provider** (`policy`, `fs`): Enforces native write-mode and writable-root checks, including realpath/symlink containment. Reads pass through unchanged.
3. **Sandbox Policy and Approval Broker** (`policy`, `approval`): Resolves native permission policies, forwards approval decisions, and supports tool-driven escalation requests.
4. **Windows ACL Sandbox Backend** (`sandbox` + `@deepseek-ai/dsh-sandbox-windows-acl`): Applies native Windows SID/ACL write restrictions (`partial` level) to child processes, including the shell and the Node runtime used by the stock `run_code` preset.
5. **Built-in Tool Consumers** (`tool-executor-native`, `tool-executor-ptc`, `tool-bash`, `tool-pwsh`, `tool-fs`, `plugin-tools`): Route tool calls and `run_code` through the active policy, approval, and sandbox providers. Both executors use the host's `tools` service.

When **Purge** is applied to a DSH installation, its patches can change native sandbox, filesystem, approval, permission, and tool execution behaviour. Its runtime plugin (`dsh-purge`) can also promote new sessions to **Full Access** (`danger-full-access`).

**DSH Workspace Guard (`2.0.0`)** restores the affected native paths:

- It ships prebuilt replacement providers and executors generated directly from official `@deepseek-ai/*@0.2.2-rc.4` packages.
- It preserves Purge's expanded file-read limits, shorter delete/move guidance and file-policy wording. The installed host still supplies Purge's Auto Review change.
- It isolates `dsh-purge`'s `permissionPresets` dependency through a Cordis service facade, suppressing automatic Full Access promotion while preserving the native Workspace fallback and explicit settings.
- It integrates directly into DSH's plugin lifecycle: installing or enabling the bundle automatically writes reversible paired Cordis configuration entries and an atomic ownership receipt, and DSH's native profile watcher loads the repaired providers. Disabling or uninstalling the bundle restores the original configuration automatically.

---

## Architecture

DSH Workspace Guard consists of four coordinated mechanisms:

```
+-----------------------------------------------------------------------+
|                       Cordis Profile Configuration                    |
|  (Disables affected host rows; enables paired workspace-guard rows)   |
+-----------------------------------+-----------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                                                       |
        v                                                       v
+-------------------------------+               +-------------------------------+
|  Permission Isolation Facade  |               |  Generated Official Providers |
|-------------------------------|               |  (@deepseek-ai/*@0.2.2-rc.4)    |
| - permission-bridge           |               |-------------------------------|
|   Captures root               |               | Core Services:                |
|   permissionPresets           |               | - sandbox, policy, approval,  |
| - purge-permission            |               |   permission, fs              |
|   Provides isolated           |               | Static Consumers:             |
|   "workspace-guard-purge"     |               | - Native and PTC executors     |
|   realm to dsh-purge;         |               | - tool-bash, tool-pwsh,        |
|   ignores automatic           |               |   tool-fs, plugin-tools       |
|   set(s, "danger-full-access")|               +---------------+---------------+
+-------------------------------+                               |
                                                                v
                                                +-------------------------------+
                                                |   Checked Build Transforms    |
                                                |-------------------------------|
                                                | - Preserves Purge patches     |
                                                |   #22, #48 and #93             |
                                                | - Shared host classes from    |
                                                |   dsh-tools and dsh-sandbox    |
                                                | - Clean shared tool pipeline  |
                                                | - Binds Windows ACL addon     |
                                                |   dsh-sandbox-windows-acl     |
                                                +-------------------------------+
```

1. **Generated Official Replacement Providers (`src/entries/*.ts` -> `lib/*.js`)**
   - Built from 14 official `@deepseek-ai/*@0.2.2-rc.4` packages. [`build/upstream-lock.json`](build/upstream-lock.json) locks 15 input files by SHA-256, including the native file-lock helper used for configuration and offline recovery.
   - Pairs five service providers (`sandbox`, `policy`, `approval`, `permission`, `fs`) and six tool consumers (`tool-executor-native`, `tool-executor-ptc`, `tool-bash`, `tool-pwsh`, `tool-fs`, `plugin-tools`) across the root and four agent presets (`preset-standard`, `preset-ptc`, `preset-minimal`, `preset-cordis`). The `tools` entry forwards the installed host registry.
   - The generated native executor and PTC executor, which handles `run_code`, share the verified clean `@deepseek-ai/dsh-tools/pipeline` and its internal helper. Generated providers also share the restored sandbox helper.

2. **Checked Build Transforms ([`build/preserve-purge.mjs`](build/preserve-purge.mjs) & [`build/host-identities.mjs`](build/host-identities.mjs))**
   - Checked transforms preserve Purge `#22` (expanded `read` limits), `#48` (shorter delete/move guidance) and `#93` (file-policy wording). `lib/build-manifest.json` records the source and output hashes.
   - Seven tool error classes come from the host's `@deepseek-ai/dsh-tools`. Four sandbox error classes and `SandboxProvider` come from its `@deepseek-ai/dsh-sandbox`. Using the same class objects lets host code recognise errors from Guard's providers. `lib/host-identities.json` records the exact classes.

3. **Purge Permission Isolation ([`src/permission-bridge.ts`](src/permission-bridge.ts) & [`src/purge-permission.ts`](src/purge-permission.ts))**
   - `@cleverpig/dsh-workspace-guard/permission-bridge` captures the root `permissionPresets` service on `workspaceGuardPermissions`.
   - `@cleverpig/dsh-workspace-guard/purge-permission` registers a `permissionPresets` facade inside the `workspace-guard-purge` Cordis isolation scope (`isolate: { permissionPresets: "workspace-guard-purge" }`), which is applied exclusively to `dsh-purge`.
   - The facade forwards all queries and updates to the root service except `set(session, "danger-full-access")`, which becomes a synchronous no-op when called by `dsh-purge`. Host UI controls and operator actions still access the root `permissionPresets` service directly.

4. **Paired Cordis Configuration and Transaction Receipt ([`src/index.ts`](src/index.ts) & [`src/configuration.ts`](src/configuration.ts))**
   - Installing or enabling the bundle activates the `workspace-guard-lifecycle` entry (`cordis.patch.yml`), which automatically writes the owned paired configuration to `<profile>/cordis.patch.yml`. DSH's native profile watcher (HMR) then loads the repaired providers in the next serialized reload. Disabling or removing the bundle automatically restores the owned changes, while ordinary application shutdown retains the active configuration for the next startup.
   - It disables affected original provider rows and inserts uniquely named paired entries, plus the root permission bridge and Purge facade. The exact rows and preserved enabled states can also be inspected with `plan`.
   - Activation writes an ownership receipt and transaction hashes to `<profile>/.workspace-guard/receipt.json`. Removal restores owned configuration values while preserving unrelated later edits; it reports conflicts rather than overwriting them. Optional CLI commands remain available for diagnostics and offline recovery.

---

## Compatibility

| Component / Environment | Supported Version / Requirement | Enforcement & Verification Behaviour |
| :--- | :--- | :--- |
| **DeepSeek Harness (`dsh`)** | `>=0.2.2-rc.2` | Checked by automatic lifecycle setup, generated runtime entries, and optional CLI commands (`doctor`, `plan`, `activate`). Automatic setup uses the Desktop profile's native HMR service. |
| **Purge (`dsh-purge` / `dsh-purge-community`)** | `>=1.1.70` | The selected consumer is version-checked. Earlier release tests covered isolated explicit-target Apply/reapply. |
| **Operating System** | Windows x64 (`win32`) | Validated target. Offline `doctor` does not verify OS, architecture, or native-backend availability. |
| **Node.js** | `>=22.19.0` | Required for offline CLI and build scripts (`package.json` `engines.node`). |
| **Native Windows ACL Addon** | `@deepseek-ai/dsh-sandbox-windows-acl` | The generated sandbox resolves the host package’s `./runner` export with `import.meta.resolve`. Actual restricted execution requires that packaged runner and its native resources. |

Installed dependencies have minimum versions with no upper bound. Shared host peers require Cordis `>=4.0.3`, Schemastery `>=3.18.3`, and node-addon-system `>=0.1.2`. The build inputs are pinned to DSH `0.2.2-rc.4`. See the acceptance report for tested versions and conditions.

---

## Permission Modes

Once activated in a profile, DSH Workspace Guard supports all three official DSH permission modes:

| Mode ID | UI Label | Default for New Sessions | File-System Policy | Command & Sandbox Policy |
| :--- | :--- | :--- | :--- | :--- |
| `workspace-write` | **Workspace** | **Yes**, unless explicitly configured otherwise | Reads allowed; writes constrained to the active workspace and native temporary-directory roots. | Shell commands and `run_code` use the native Windows restricted backend. Tools can request explicit permission expansion; rejection prevents that expanded invocation. |
| `read-only` | **Read Only** | No (selectable per session) | Reads allowed; native filesystem mutations are denied under this policy. | Commands use the native read-only policy and its temporary-resource allowances; tools can request explicit permission expansion. |
| `danger-full-access` | **Full Access** | Preserves explicit configuration and recorded selections | Native workspace write checks are bypassed, subject to operating-system permissions. | Commands run without native sandbox confinement. Purge’s automatic promotion is suppressed; explicit root-service selection remains available. |

---

## Functionality and Coverage Matrix

The current source retains the following native routes. The coverage and acceptance reports record which routes were exercised in current and earlier versions.

| # | Capability Route | Upstream Package (`0.2.2-rc.4`) | Package Export | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Permission Presets** (`read-only`, `workspace-write`, `danger-full-access`) | `@deepseek-ai/dsh-permission-presets` | `@cleverpig/dsh-workspace-guard/permission` | Native default and selector restored; explicit settings retained |
| 2 | **Purge Session Isolation** (`permissionPresets` facade) | `@deepseek-ai/dsh-permission-presets` + selected Purge package | `@cleverpig/dsh-workspace-guard/permission-bridge`, `@cleverpig/dsh-workspace-guard/purge-permission` | Suppresses Purge auto-promotion to Full Access |
| 3 | **File-System Policy & Provider** (`fs`, `policy`, realpath checks) | `@deepseek-ai/dsh-fs-sandbox`, `@deepseek-ai/dsh-sandbox-policy` | `@cleverpig/dsh-workspace-guard/fs`, `@cleverpig/dsh-workspace-guard/policy` | Native write checks restored |
| 4 | **Sandbox Policy & Approval Broker** | `@deepseek-ai/dsh-sandbox-policy`, `@deepseek-ai/dsh-user-approval` | `@cleverpig/dsh-workspace-guard/policy`, `@cleverpig/dsh-workspace-guard/approval` | Native approval outcomes restored |
| 5 | **Native Windows ACL Sandbox** | `@deepseek-ai/dsh-sandbox-local` | `@cleverpig/dsh-workspace-guard/sandbox` | Restored; requires host Windows runner |
| 6 | **Built-in File Tools** (`read`, `read_image`, `write`, `edit`) | `@deepseek-ai/dsh-tool-fs` | `@cleverpig/dsh-workspace-guard/tool-fs` | Restored + Purge patch `#22` preserved |
| 7 | **PowerShell Tool (`pwsh`)** (one-shot, background, and persistent terminal paths) | `@deepseek-ai/dsh-tool-pwsh` | `@cleverpig/dsh-workspace-guard/tool-pwsh` | Native implementation + Purge patch `#48` retained. See the acceptance report for persistent-terminal limits. |
| 8 | **Bash Tool (`bash`)** | `@deepseek-ai/dsh-tool-bash` | `@cleverpig/dsh-workspace-guard/tool-bash` | Restored + Purge patch `#48` preserved |
| 9 | **Direct tool calls & `run_code`** | `@deepseek-ai/dsh-tool-executor-native`, `@deepseek-ai/dsh-tool-executor-ptc`, `@deepseek-ai/dsh-tools` | `@cleverpig/dsh-workspace-guard/tool-executor-native`, `@cleverpig/dsh-workspace-guard/tool-executor-ptc`, `@cleverpig/dsh-workspace-guard/tools` | Both executors share the clean pipeline and the host tool registry |
| 10 | **Agent Presets** (`preset-standard`, `preset-ptc`, `preset-minimal`, `preset-cordis`) | Native host preset bundles | Paired nested entries in `cordis.patch.yml` | All 4 presets rewired |
| 11 | **Subagents & Background Work** | Native host consumers | Root replacement services | Native behaviour retained; adapter dispatch and background job execution tested, full child lifecycle unverified |
| 12 | **Git Worktree Adapter** | Native host VCS consumers | Native workspace policy | Adapter dispatch tested; real Git worktree operations unverified |
| 13 | **LSP & Plugin Tool Bridges** | Native LSP consumers; `@deepseek-ai/dsh-plugin-manager/tools` | `@cleverpig/dsh-workspace-guard/plugin-tools`; root `fs` | Static helper restored; live LSP transport unverified |

### Preserved Purge Compatibility Rules

| Purge Patch | Upstream Target | Behaviour under DSH Workspace Guard |
| :--- | :--- | :--- |
| **Patch `#22`** | `@deepseek-ai/dsh-tool-fs` | **Preserved in bundle**: `READ_MAX_LINE_LENGTH = 10,000`, `READ_MAX_BYTES = 1,048,576` (1 MiB), `READ_LIMIT = 20,000`. |
| **Patch `#48`** | `@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-pwsh` | **Preserved in bundle**: Replaces verbose git/archive deletion workaround guidance with `"Proceed with operator-requested paths. "`. |
| **Patch `#59`** | Host Auto Review implementation | **Preserved in host**: Purge can still disable Auto Review. |
| **Patch `#93`** | `@deepseek-ai/dsh-sandbox-policy` | **Preserved in bundle**: Removes the DSH brand from file-policy messages and keeps native policy checks. |

---

## Installation and Configuration Lifecycle

Installing and enabling `@cleverpig/dsh-workspace-guard` through DSH's plugin manager is the complete setup flow:

- **Automatic Configuration on Install / Enable**: DSH's plugin manager enables the bundle by default. The plugin's lifecycle entry (`workspace-guard-lifecycle`) checks supported host and Purge versions, writes the owned paired configuration to `<profile>/cordis.patch.yml` and `<profile>/.workspace-guard/receipt.json`, and DSH's native profile watcher (HMR) loads the repaired providers automatically.
- **Automatic Restoration on Disable / Uninstall**: Disabling or uninstalling the bundle in DSH's plugin manager automatically restores the previous native providers and removes the scoped Purge adapter through the same owned-change transaction and native profile reload. Ordinary application shutdown retains the active configuration for the next startup.
- **Failed Activation**: If configuration activation fails after profile validation, Guard attempts to restore valid existing owned configuration before reporting the error. Successful restoration prevents a later uninstall from leaving those provider references behind.
- **Optional CLI Diagnostics and Recovery**: The `doctor`, `plan`, `activate`, `deactivate`, `rollback`, and `recover-lock` CLI commands are provided as optional diagnostics and offline recovery tools (see [Advanced Diagnostics and Offline Recovery (CLI)](#advanced-diagnostics-and-offline-recovery-cli)).

### Installation and Automatic Setup

Guard `2.0.0` requires DSH `0.2.2-rc.2` or newer. The following examples pin this Guard version. You can also install a matching `.tgz` archive through DSH's plugin manager.

#### Published Versions: Official npm Registry via DSH Plugin Installer

1. Open **DeepSeek Harness (DSH)** and navigate to the **Plugins** installation interface (**Install Plugin** / package source input).
2. Install from the official npm registry using the package name:
   - **Registry default**:
     ```text
     @cleverpig/dsh-workspace-guard
     ```
   - **Pin Guard 2.0.0**:
     ```text
     @cleverpig/dsh-workspace-guard@2.0.0
     ```
3. Keep the **`@cleverpig/dsh-workspace-guard`** bundle enabled (the default in DSH's plugin manager). The plugin automatically saves its configuration changes and DSH's profile watcher loads the repaired providers.

> **Note**: The package includes prebuilt `lib/` artefacts with `diff`, `yaml`, and `zod` bundled. Shared host dependencies and native resources remain external. Installation requires no compiler or installation-time build; maintainer builds use `build:release`. Automatic setup uses the Desktop profile's native HMR service.

#### Alternative Method: Git-Source Installation

If you are installing directly from a Git repository URL or a local Git checkout that includes the prebuilt `lib/` directory:

1. In DSH's plugin installation interface (or in `<profile>/package.json`), specify the source. The following example selects the `v2.0.0` tag:
   ```text
   git+https://github.com/cleverpigeb/dsh-workspace-guard.git#v2.0.0
   ```
2. Ensure the bundle is enabled in your target profile so DSH runs the automatic configuration and reloads the repaired providers.

---

### Daily Usage and Native Chat Behaviour

- **New Sessions**: The native fallback default is **Workspace** (`workspace-write`). Explicit configuration, `DSH_PERMISSION_MODE`, and recorded session selections are retained; Purge’s automatic promotion is suppressed.
- **Native Chat and Preset Reload Behaviour**:
  - **New chats** created after automatic reload immediately use the updated tool preset.
  - **Existing agents and their children** retain their earlier preset revision until their scopes end; reopening an already-live tab reuses its current agent.
  - **Refreshing existing sessions**: A genuine cold session resume mounts the current preset revision, or you can finish ongoing work and restart DSH normally to refresh all surviving sessions.
- **Switching Modes**: Use the standard DSH session permission selector to switch any session between **Read Only** (`read-only`), **Workspace** (`workspace-write`), and **Full Access** (`danger-full-access`).
- **After Running Purge (Apply/reapply)**:
  - Guard’s prebuilt providers are independent of the host packages Purge patches and remain selected through formal `cordis.patch.yml` configuration.
  - Earlier release tests passed isolated explicit-target Apply/reapply and fresh engine starts. See the acceptance report for the current verification scope.

---

### Upgrading, Disabling, and Uninstalling

Manage upgrades, enabling, disabling, and uninstallation directly through **DSH's normal plugin manager**:

- **Upgrading**: Select a Guard build compatible with your DSH version in the plugin manager. Automatic setup reuses valid version-2 receipts belonging to the scoped package and adds the new executor pairs. If you used an earlier unscoped development build, remove that bundle through DSH before installing `@cleverpig/dsh-workspace-guard`. To refresh existing live chat tabs after an upgrade, finish ongoing work and restart DSH normally.
- **Ordinary Shutdown**: Closing DSH normally keeps the active configuration in `<profile>/cordis.patch.yml` for the next startup.
- **Disabling and Uninstalling**: Disabling or removing the bundle in DSH's plugin manager automatically restores the previous native providers and removes the scoped Purge adapter before package deletion. Restoring the previous providers also restores their behaviour with Purge.
- **Configuration Ownership and Conflict Handling**:
  - Normal removal preserves later unrelated edits to `<profile>/cordis.patch.yml` (including non-marker comments), migrates applicable later settings on generated providers (including disabled states and nested preset edits) back to their native identities, and reports conflicting or ambiguous changes to owned identities rather than overwriting them.
  - If restoration reports an ownership, journal, lock or missing-configuration error, keep the package installed and resolve it before uninstalling. DSH `0.2.2-rc.3` can continue removal after a cleanup error. Residual provider references can then prevent startup. Retain `<profile>/cordis.patch.yml` and `<profile>/.workspace-guard/receipt.json` and use the offline recovery procedure below.

---

### Advanced Diagnostics and Offline Recovery (CLI)

The CLI (`doctor`, `plan`, `activate`, `deactivate`, `rollback`, `recover-lock`) is optional diagnostics and offline recovery tooling. Commands preview by default; offline writes require an explicit `--profile` directory and `--apply --host-stopped` while every DSH process and writer using that profile is stopped.

Set your target profile and host paths in PowerShell. Recent Windows Desktop versions pack their host modules inside `app.asar`. Run the CLI through the Desktop executable in Node mode so it can read that archive:

```powershell
$ProfileDir  = "$env:USERPROFILE\.dsh\profiles\desktop"
$DshHome     = "$env:USERPROFILE\.dsh"
$DshInstall  = "$env:LOCALAPPDATA\Programs\DeepSeek Harness"
$HostModules = "$DshInstall\resources\app.asar\dsh\node_modules"
$DshExe      = "$DshInstall\DeepSeek Harness.exe"
$Cli         = "$ProfileDir\node_modules\@cleverpig\dsh-workspace-guard\lib\cli.js"

function Invoke-GuardCli {
    $Previous = $env:ELECTRON_RUN_AS_NODE
    try {
        $env:ELECTRON_RUN_AS_NODE = '1'
        & $DshExe $Cli @args | Write-Output
    } finally {
        $env:ELECTRON_RUN_AS_NODE = $Previous
    }
}
```

After package removal, set `$Cli` to `lib\cli.js` in a matching Guard archive or checkout, then proceed to step 4 or 5. Configuration restoration uses the relevant bundle files and the receipt. Steps 1–3 operate on an installed, selected bundle. For unpacked hosts, the CLI can use system Node with the actual host module directory.

1. **Inspect Compatibility and Owned Status (`doctor`)**:
   ```powershell
   Invoke-GuardCli doctor --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
2. **Preview Proposed Configuration Changes (`plan`)**:
   ```powershell
   Invoke-GuardCli plan --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
3. **Offline Activation or Repair (`activate`)**:
   With all DSH processes stopped:
   ```powershell
   Invoke-GuardCli activate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
4. **Offline Deactivation or Post-Uninstall Conflict Recovery (`deactivate` / `rollback`)**:
   With all DSH processes stopped, restore the native providers while preserving unrelated later edits (also works with a valid receipt after the bundle has been deselected or removed):
   ```powershell
   Invoke-GuardCli deactivate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   *(Or use `rollback` with the same flags to record `"status": "rolled-back"` in the receipt.)*
5. **Offline Lock and Takeover-Claim Recovery (`recover-lock`)**:
   For residual primary/migration locks, malformed lock records, reused PIDs, or interrupted takeover claims, stop every host and writer using the profile, then preview the lock records to obtain `snapshotSha256`:
   ```powershell
   Invoke-GuardCli recover-lock --profile $ProfileDir
   ```
   Keep the profile exclusively offline. Replace the quoted placeholder below with the `snapshotSha256` from the preview you reviewed:
   ```powershell
   Invoke-GuardCli recover-lock --profile $ProfileDir --apply --host-stopped --expected-snapshot 'REPLACE_WITH_REVIEWED_SHA256'
   ```
   *(Rechecks canonical regular-file paths and the snapshot, removes only the identified claims and locks while leaving configuration and receipts intact, and aborts if the snapshot changed. `--host-stopped` is an operator acknowledgement and does not stop running processes.)*

For lasting disablement, disable or deselect the bundle in DSH's plugin manager. An enabled bundle reapplies its configuration on the next startup.

---

## Supported Capabilities and Blocked Actions

| Action / Operation | Read Only (`read-only`) | Workspace (`workspace-write`) | Full Access (`danger-full-access`) |
| :--- | :--- | :--- | :--- |
| Read regular workspace and system files | Allowed | Allowed | Allowed |
| Read paths labelled sensitive by another component | No additional restriction from this native mode | No additional restriction from this native mode | Subject to OS permissions |
| `write` / `edit` on regular workspace files | Blocked / Prompts for approval | **Allowed** | Allowed |
| `write` / `edit` outside the workspace and native temporary-directory roots | Blocked / Prompts for approval | **Blocked / Prompts for approval** | Allowed |
| `write` / `edit` via symlink/junction escaping the writable roots | Denied under the current policy | Denied under the current policy; tools may request expansion | Subject to OS permissions |
| Modify `.git`, `.dsh`, or `.agents` inside the workspace | Native write denial | Ordinary workspace containment applies; no special exclusion supplied here | Subject to OS permissions |
| Shell (`pwsh` / `bash`) or `run_code` reading files | Allowed | **Allowed** | Allowed |
| Shell (`pwsh` / `bash`) or `run_code` writing inside workspace | Blocked by policy / ACL | **Allowed** | Allowed |
| Shell (`pwsh` / `bash`) or `run_code` writing outside the workspace and native temporary-directory roots | Native backend restrictions | Native partial write restrictions; tools may request escalation | Subject to OS permissions |
| Shell (`pwsh` / `bash`) network commands (`curl`, `Invoke-WebRequest`, etc.) | No network isolation supplied by this mode | No network isolation supplied by this mode | No network isolation supplied by this mode |
| Write in another Git worktree | Native write denial | Depends on the effective workspace/writable roots; real worktree execution unverified | Subject to OS permissions |
| Automatic session promotion to Full Access by `dsh-purge` | Suppressed | **Suppressed** (preserves the selected mode) | N/A |

---

## Development Commands

Maintainer build and verification scripts use **Node.js `>=22.19.0`**, the pinned **pnpm `12.10.1`**, and locked official build dependencies matching [`build/upstream-lock.json`](build/upstream-lock.json):

```powershell
# Install the pinned development dependencies
pnpm install --frozen-lockfile

# Verify the official input hashes without changing provenance
node build/verify-upstream.mjs

# Run TypeScript type-checking across src/, build/, and generated entry bindings
pnpm run typecheck

# Run oxlint across src/, build/, and tsdown.config.ts
pnpm run lint

# Format TypeScript sources in src/
pnpm run format

# Build precompiled runtime bundles into lib/ and generate lib/provenance.json
# (Named build:release so npm/Git installs do not trigger devDependency builds)
pnpm run build:release

# Export tracked project files and pinned upstream source archives
pnpm run source:release
```

---

Run `pnpm upstream:refresh` only after reviewing an intentional upstream update; it rewrites pinned provenance. Source archive generation requires Git-tracked/staged maintained files; see [Source Distribution](#source-distribution).

## Repository Structure

```text
dsh-workspace-guard/
|-- build/
|   |-- host-identities.mjs        # Links shared host tool and sandbox classes
|   |-- preserve-purge.mjs         # Applies and verifies Purge patches #22, #48 and #93
|   |-- provenance.mjs             # Generates lib/provenance.json and lib/THIRD_PARTY_LICENSES.txt
|   |-- source-lock.json           # Pinned upstream source archive revisions and hashes
|   |-- source-release.mjs         # Exports auditable source release metadata
|   |-- upstream-lock.json         # SHA-256 lockfile for 15 files from 14 official DSH 0.2.2-rc.4 packages
|   |-- upstream.mjs               # Selected upstream modules and bundled dependencies
|   `-- verify-upstream.mjs        # Verifies pinned inputs; refreshes provenance only on request
|-- docs/
|   |-- ACCEPTANCE.md              # Acceptance checks, historical baselines, and remaining limits
|   |-- acceptance-results.json    # Machine-readable acceptance matrix results
|   |-- CONFIGURATION-PREVIEW.yml  # Example paired Cordis configuration delta
|   |-- CONFIGURATION.md           # Cordis configuration format and CLI reference
|   |-- COVERAGE.md                # 13-route capability and Purge compatibility matrix
|   |-- DESIGN.md                  # Architectural design and root-cause analysis
|   |-- INSTALLATION.md            # Detailed installation, activation, and recovery guide
|   `-- UPSTREAM.md                # Upstream module provenance and build verification guide
|-- lib/                           # Prebuilt ESM runtime bundles, CLI, manifests, and license notices
|-- locale/
|   |-- en.json                    # English UI locale strings
|   `-- zh.json                    # Simplified Chinese UI locale strings
|-- src/
|   |-- entries/                   # Replacement entry wrappers and host tool-registry forwarding
|   |-- cli.ts                     # Optional offline diagnostics and recovery CLI (doctor, plan, activate, deactivate, rollback, recover-lock)
|   |-- compatibility.ts           # DSH and Purge version checks
|   |-- configuration-lock.ts      # Native file-lock, legacy lock migration, and lock-recovery helper
|   |-- configuration.ts           # Paired Cordis configuration planner, merger, and receipt manager
|   |-- index.ts                   # Lifecycle plugin for automatic configuration (workspace-guard-lifecycle)
|   |-- permission-bridge.ts       # Captures root permissionPresets service
|   |-- purge-permission.ts        # Isolated permissionPresets facade for dsh-purge
|   `-- runtime-version.ts         # Runtime version discovery helpers
|-- cordis.patch.yml               # Bundle lifecycle patch (registers workspace-guard-status)
|-- LICENSE                        # GNU General Public License v3.0 (with GPL-3.0-or-later notice)
|-- package.json                   # Package metadata, exports, and scripts
|-- README.md                      # British English documentation (this file)
|-- README.zh-CN.md                # Simplified Chinese documentation
|-- THIRD_PARTY_NOTICES.md         # Third-party attribution and full upstream license texts
`-- tsdown.config.ts               # Bundler configuration for lib/ artefacts
```

---

## Detailed Documentation

- [**Coverage Matrix (`docs/COVERAGE.md`)**](docs/COVERAGE.md) — Native routes and Purge patch handling.
- [**Architecture & Design (`docs/DESIGN.md`)**](docs/DESIGN.md) — Root-cause analysis of Purge's patches, single-instance `@deepseek-ai/dsh-sandbox` graph design, and Cordis realm isolation.
- [**Installation & Recovery Guide (`docs/INSTALLATION.md`)**](docs/INSTALLATION.md) — Automatic setup, native reload behaviour, upgrade/removal lifecycle, and offline recovery procedures.
- [**Configuration Reference (`docs/CONFIGURATION.md`)**](docs/CONFIGURATION.md) & [**Preview (`docs/CONFIGURATION-PREVIEW.yml`)**](docs/CONFIGURATION-PREVIEW.yml) — Formal paired Cordis configuration and `<profile>/.workspace-guard/receipt.json`.
- [**Acceptance Report (`docs/ACCEPTANCE.md`)**](docs/ACCEPTANCE.md) & [**Results (`docs/acceptance-results.json`)**](docs/acceptance-results.json) — Current checks and historical validation records.
- [**Upstream Provenance (`docs/UPSTREAM.md`)**](docs/UPSTREAM.md) — Verification of official `@deepseek-ai/*@0.2.2-rc.4` inputs and build manifests.

---

## Licensing

### Project License (`GPL-3.0-or-later`)

**DSH Workspace Guard (`@cleverpig/dsh-workspace-guard`)** is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License** as published by the Free Software Foundation, **either version 3 of the License, or (at your option) any later version** (`GPL-3.0-or-later`).

The complete, unmodified text of the GNU General Public License version 3 and the project's explicit "version 3 or any later version" licensing notice are provided in [`LICENSE`](LICENSE).

### Third-Party Components and Notices

The prebuilt runtime bundles in `lib/` incorporate code from official DeepSeek Harness packages and open-source runtime dependencies under GPLv3-compatible permissive licenses:

| Component Group | Packages | Version | License | Copyright Holder |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek Harness Modules** | `@deepseek-ai/dsh-sandbox-local`, `@deepseek-ai/dsh-sandbox-policy`, `@deepseek-ai/dsh-user-approval`, `@deepseek-ai/dsh-permission-presets`, `@deepseek-ai/dsh-fs-sandbox`, `@deepseek-ai/dsh-tools` (pipeline and helper), `@deepseek-ai/dsh-tool-executor-native`, `@deepseek-ai/dsh-tool-executor-ptc`, `@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-pwsh`, `@deepseek-ai/dsh-tool-fs`, `@deepseek-ai/dsh-plugin-manager` (`./tools` only), `@deepseek-ai/dsh-sandbox`, `@deepseek-ai/dsh-atomic-write` | `0.2.2-rc.4` | `MIT` | `Copyright (c) 2026 DeepSeek` |
| **jsdiff (`diff`)** | `diff` | `9.0.0` | `BSD-3-Clause` | `Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>` |
| **yaml** | `yaml` | `2.9.0` | `ISC` | `Copyright Eemeli Aro <eemeli@gmail.com>` |
| **Zod (`zod`)** | `zod` | `4.6.6` | `MIT` | `Copyright (c) 2025 Colin McDonnell` |

Complete upstream copyright notices and the full, unmodified `MIT`, `BSD-3-Clause`, and `ISC` license texts are maintained in:

- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) (root human-readable third-party licensing documentation)
- [`lib/THIRD_PARTY_LICENSES.txt`](lib/THIRD_PARTY_LICENSES.txt) and [`lib/provenance.json`](lib/provenance.json) (bundled distribution notices and SHA-256 provenance manifest)

### Source Distribution

The npm package includes project TypeScript and build scripts. To rebuild its contents, first copy `lib/build-lock.yaml` to `pnpm-lock.yaml`, then use the development commands above.

Maintainers run `pnpm source:release` in the Git checkout to generate `.local/artifacts/cleverpig-dsh-workspace-guard-<version>-source.tar.gz`. Use `pnpm source:release --output <directory>` to select another destination. It includes the current tracked project files, pinned upstream archives, and a checksum manifest. Publish that companion archive beside the matching release and link it from the package’s release documentation. Upstream archive URLs and checksums are also available in [`build/source-lock.json`](build/source-lock.json). See [the source-distribution details and verification limits](THIRD_PARTY_NOTICES.md#source-access-and-redistribution).
