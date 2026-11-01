# DSH Workspace Guard (`dsh-workspace-guard`)

**English** | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](package.json)
[![License: GPL v3 or later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Target DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-teal.svg)](package.json)
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
- [Windows Enforcement Characteristics](#windows-enforcement-characteristics)
- [Trust Assumptions and Security Boundaries](#trust-assumptions-and-security-boundaries)
- [Release Status (`0.2.1`)](#release-status-021)
- [Development Commands](#development-commands)
- [Repository Structure](#repository-structure)
- [Detailed Documentation](#detailed-documentation)
- [Licensing](#licensing)

---

## Purpose and Background

In official DeepSeek Harness (`0.2.1-rc.5`), the **Workspace** (`workspace-write`) and **Read Only** (`read-only`) permission presets combine five layers:

1. **Permission Preset Service** (`permissionPresets`): Resolves the active session mode (`read-only`, `workspace-write`, or `danger-full-access`) and supplies default file and command policies.
2. **File-System Policy and Provider** (`policy`, `fs`): Enforces native write-mode and writable-root checks, including realpath/symlink containment. Reads pass through unchanged.
3. **Sandbox Policy and Approval Broker** (`policy`, `approval`): Resolves native permission policies, forwards approval decisions, and supports tool-driven escalation requests.
4. **Windows ACL Sandbox Backend** (`sandbox` + `@deepseek-ai/dsh-sandbox-windows-acl`): Applies native Windows SID/ACL write restrictions (`partial` level) to child processes (`pwsh`, `bash`, and Python `run_code`).
5. **Built-in Tool Consumers** (`tools`, `tool-bash`, `tool-pwsh`, `tool-fs`, `plugin-tools`): Route file operations and command executions through the active policy, approval, and sandbox providers.

When **Purge (`1.6.67`)** is applied to a DSH installation, its patches alter native sandbox, filesystem, approval, permission, and tool modules to bypass approval gates and sandbox execution, while its runtime plugin (`dsh-purge`) automatically promotes new sessions to **Full Access** (`danger-full-access`). Restoring the native providers repairs sandbox and policy enforcement while preserving normal session permission behaviour.

**DSH Workspace Guard (`0.2.1`)** resolves this conflict cleanly:

- It ships prebuilt, self-contained replacement providers generated directly from official `@deepseek-ai/*@0.2.1-rc.5` packages.
- It preserves Purge's non-sandbox file-read capacity and delete/move prompt ergonomics inside the replacement tool modules, while leaving Purge's host-level patches (such as Auto Review disabling) untouched.
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
|-------------------------------|               |  (@deepseek-ai/*@0.2.1-rc.5)  |
| - permission-bridge           |               |-------------------------------|
|   Captures root               |               | Core Services:                |
|   permissionPresets           |               | - sandbox, policy, approval,  |
| - purge-permission            |               |   permission, fs              |
|   Provides isolated           |               | Static Consumers:             |
|   "workspace-guard-purge"     |               | - tools, tool-bash,           |
|   realm to dsh-purge;         |               |   tool-pwsh, tool-fs,         |
|   ignores automatic           |               |   plugin-tools                |
|   set(s, "danger-full-access")|               +---------------+---------------+
+-------------------------------+                               |
                                                                v
                                                +-------------------------------+
                                                |   Checked Build Transforms    |
                                                |-------------------------------|
                                                | - Preserves Purge patches     |
                                                |   #22 (FS limits) & #48 (rm)  |
                                                | - Shares host identities:     |
                                                |   TOOL_RUNTIME_SCHEDULER &    |
                                                |   SandboxUnavailableError     |
                                                | - Binds Windows ACL addon     |
                                                |   dsh-sandbox-windows-acl     |
                                                +-------------------------------+
```

1. **Generated Official Replacement Providers (`src/entries/*.ts` -> `lib/*.js`)**
   - Built from 11 official `@deepseek-ai/*@0.2.1-rc.5` packages verified by SHA-256 against [`build/upstream-lock.json`](build/upstream-lock.json).
   - Replaces five core service providers (`sandbox`, `policy`, `approval`, `permission`, `fs`) and five built-in static consumers (`tools`, `tool-bash`, `tool-pwsh`, `tool-fs`, `plugin-tools`) across root plugins and all four agent presets (`preset-standard`, `preset-ptc`, `preset-minimal`, `preset-cordis`).
   - The generated consumers share one restored `@deepseek-ai/dsh-sandbox` helper in the bundle graph. This includes the native `ToolRuntime` containing reserved `run_code`; no duplicate tool registration is added.

2. **Checked Build Transforms ([`build/preserve-purge.mjs`](build/preserve-purge.mjs) & [`build/host-identities.mjs`](build/host-identities.mjs))**
   - **Purge Compatibility Transforms**: Applies only the two non-sandbox Purge `1.6.67` modifications that live inside replaced tool packages—patch `#22` (expanded `read` limits in `@deepseek-ai/dsh-tool-fs`) and patch `#48` (simplified delete/move guidance in `@deepseek-ai/dsh-tool-bash` and `@deepseek-ai/dsh-tool-pwsh`)—recording exact source and output hashes in `lib/build-manifest.json`.
   - **Shared Host Identities**: Rewrites `TOOL_RUNTIME_SCHEDULER` to import from the host's `@deepseek-ai/dsh-tools` (so unmodified `AgentLoop` resolves the active `ToolRuntime` scheduler) and `SandboxUnavailableError` to import from the host's `@deepseek-ai/dsh-sandbox` (so `instanceof` checks succeed across module boundaries), audited in `lib/host-identities.json`.

3. **Purge Permission Isolation ([`src/permission-bridge.ts`](src/permission-bridge.ts) & [`src/purge-permission.ts`](src/purge-permission.ts))**
   - `dsh-workspace-guard/permission-bridge` captures the root `permissionPresets` service on `workspaceGuardPermissions`.
   - `dsh-workspace-guard/purge-permission` registers a `permissionPresets` facade inside the `workspace-guard-purge` Cordis isolation scope (`isolate: { permissionPresets: "workspace-guard-purge" }`), which is applied exclusively to `dsh-purge`.
   - The facade forwards all queries and updates to the root service except `set(session, "danger-full-access")`, which becomes a synchronous no-op when called by `dsh-purge`. Host UI controls and operator actions still access the root `permissionPresets` service directly.

4. **Paired Cordis Configuration and Transaction Receipt ([`src/index.ts`](src/index.ts) & [`src/configuration.ts`](src/configuration.ts))**
   - Installing or enabling the bundle activates the `workspace-guard-lifecycle` entry (`cordis.patch.yml`), which automatically writes the owned paired configuration to `<profile>/cordis.patch.yml`. DSH's native profile watcher (HMR) then loads the repaired providers in the next serialized reload. Disabling or removing the bundle automatically restores the owned changes, while ordinary application shutdown retains the active configuration for the next startup.
   - It disables affected original provider rows and inserts uniquely named paired entries, plus the root permission bridge and Purge facade. The exact rows and preserved enabled states can also be inspected with `plan`.
   - Activation writes an ownership receipt and transaction hashes to `<profile>/.workspace-guard/receipt.json`. Removal restores owned configuration values while preserving unrelated later edits; it reports conflicts rather than overwriting them. Optional CLI commands remain available for diagnostics and offline recovery.

---

## Compatibility

| Component / Environment | Supported Version / Requirement | Enforcement & Verification Behaviour |
| :--- | :--- | :--- |
| **DeepSeek Harness (`dsh`)** | `0.2.1-rc.5` | Checked by automatic lifecycle setup, generated runtime entries, and optional CLI commands (`doctor`, `plan`, `activate`). Automatic setup uses the Desktop profile's native HMR service. |
| **Purge (`dsh-purge` / `dsh-purge-community`)** | `1.6.67` | The selected consumer is version-checked. Explicit-target Apply/reapply was tested in isolation; all-host maintenance remains unverified. |
| **Operating System** | Windows x64 (`win32`) | Validated target for this release. Offline `doctor` does not verify OS, architecture, or native-backend availability. |
| **Node.js** | `>=22.19.0` (tested on `26.7.0`) | Required for offline CLI and build scripts (`package.json` `engines.node`). |
| **Native Windows ACL Addon** | `@deepseek-ai/dsh-sandbox-windows-acl` | The generated sandbox resolves the host package’s `./runner` export with `import.meta.resolve`. Actual restricted execution requires that packaged runner and its native resources. |

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

DSH Workspace Guard (`0.2.1`) retains the following native routes. This summary distinguishes source restoration from executed acceptance; consult [`docs/COVERAGE.md`](docs/COVERAGE.md) and [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) for the recorded evidence.

| # | Capability Route | Upstream Package (`0.2.1-rc.5`) | Package Export | Status in `0.2.1` |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Permission Presets** (`read-only`, `workspace-write`, `danger-full-access`) | `@deepseek-ai/dsh-permission-presets` | `dsh-workspace-guard/permission` | Native default and selector restored; explicit settings retained |
| 2 | **Purge Session Isolation** (`permissionPresets` facade) | `@deepseek-ai/dsh-permission-presets` + selected Purge package | `dsh-workspace-guard/permission-bridge`, `dsh-workspace-guard/purge-permission` | Suppresses Purge auto-promotion to Full Access |
| 3 | **File-System Policy & Provider** (`fs`, `policy`, realpath checks) | `@deepseek-ai/dsh-fs-sandbox`, `@deepseek-ai/dsh-sandbox-policy` | `dsh-workspace-guard/fs`, `dsh-workspace-guard/policy` | Native write checks restored |
| 4 | **Sandbox Policy & Approval Broker** | `@deepseek-ai/dsh-sandbox-policy`, `@deepseek-ai/dsh-user-approval` | `dsh-workspace-guard/policy`, `dsh-workspace-guard/approval` | Native approval outcomes restored |
| 5 | **Native Windows ACL Sandbox** | `@deepseek-ai/dsh-sandbox-local` | `dsh-workspace-guard/sandbox` | Restored; requires host Windows runner |
| 6 | **Built-in File Tools** (`read`, `read_image`, `write`, `edit`) | `@deepseek-ai/dsh-tool-fs` | `dsh-workspace-guard/tool-fs` | Restored + Purge patch `#22` preserved |
| 7 | **PowerShell Tool (`pwsh`)** (one-shot, background, and persistent terminal paths) | `@deepseek-ai/dsh-tool-pwsh` | `dsh-workspace-guard/tool-pwsh` | Native implementation + Purge patch `#48` retained; persistent startup failed in the fixture (see [Release Status](#release-status-021)) |
| 8 | **Bash Tool (`bash`)** | `@deepseek-ai/dsh-tool-bash` | `dsh-workspace-guard/tool-bash` | Restored + Purge patch `#48` preserved |
| 9 | **Tool Runtime & Python `run_code` (`preset-ptc`)** | `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-sandbox` | `dsh-workspace-guard/tools` | Restored (shares host `TOOL_RUNTIME_SCHEDULER`) |
| 10 | **Agent Presets** (`preset-standard`, `preset-ptc`, `preset-minimal`, `preset-cordis`) | Native host preset bundles | Paired nested entries in `cordis.patch.yml` | All 4 presets rewired |
| 11 | **Subagents & Background Work** | Native host consumers | Root replacement services | Native behaviour retained; adapter dispatch and background job execution tested, full child lifecycle unverified |
| 12 | **Git Worktree Adapter** | Native host VCS consumers | Native workspace policy | Adapter dispatch tested; real Git worktree operations unverified |
| 13 | **LSP & Plugin Tool Bridges** | Native LSP consumers; `@deepseek-ai/dsh-plugin-manager/tools` | `dsh-workspace-guard/plugin-tools`; root `fs` | Static helper restored; live LSP transport unverified |

### Preserved Purge Compatibility Rules

| Purge `1.6.67` Patch | Upstream Target | Behaviour under DSH Workspace Guard |
| :--- | :--- | :--- |
| **Patch `#22`** | `@deepseek-ai/dsh-tool-fs` | **Preserved in bundle**: `READ_MAX_LINE_LENGTH = 10,000`, `READ_MAX_BYTES = 1,048,576` (1 MiB), `READ_LIMIT = 20,000`. |
| **Patch `#48`** | `@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-pwsh` | **Preserved in bundle**: Replaces verbose git/archive deletion workaround guidance with `"Proceed with operator-requested paths. "`. |
| **Patch `#59`** | Host Auto Review implementation | **Preserved in host**: Remains in the host bundle outside the 11 replaced modules, keeping Auto Review disabled. |

---

## Installation and Configuration Lifecycle

Installing and enabling `dsh-workspace-guard` through DSH's plugin manager is the complete setup flow:

- **Automatic Configuration on Install / Enable**: DSH's plugin manager enables the bundle by default. The plugin's lifecycle entry (`workspace-guard-lifecycle`) checks supported host and Purge versions, writes the owned paired configuration to `<profile>/cordis.patch.yml` and `<profile>/.workspace-guard/receipt.json`, and DSH's native profile watcher (HMR) loads the repaired providers automatically.
- **Automatic Restoration on Disable / Uninstall**: Disabling or uninstalling the bundle in DSH's plugin manager automatically restores the previous native providers and removes the scoped Purge adapter through the same owned-change transaction and native profile reload. Ordinary application shutdown retains the active configuration for the next startup.
- **Optional CLI Diagnostics and Recovery**: The `doctor`, `plan`, `activate`, `deactivate`, and `rollback` CLI commands are provided as optional diagnostics and offline recovery tools (see [Advanced Diagnostics and Offline Recovery (CLI)](#advanced-diagnostics-and-offline-recovery-cli)).

### Installation and Automatic Setup

#### Primary Method (Recommended): Official npm Registry via DSH Plugin Installer

1. Open **DeepSeek Harness (DSH)** and navigate to the **Plugins** installation interface (**Install Plugin** / package source input).
2. Install from the official npm registry using the package name:
   - **Latest release**:
     ```text
     dsh-workspace-guard
     ```
   - **Version-pinned installation (matching current package metadata `0.2.1`)**:
     ```text
     dsh-workspace-guard@0.2.1
     ```
3. Keep the **`dsh-workspace-guard`** bundle enabled (the default in DSH's plugin manager). The plugin automatically saves its configuration changes and DSH's profile watcher loads the repaired providers.

> **Note**: The package includes prebuilt `lib/` artefacts with `diff`, `yaml`, and `zod` bundled. Shared host dependencies and native resources remain external. Installation requires no compiler or installation-time build; maintainer builds use `build:release`. Automatic setup uses the Desktop profile's native HMR service.

#### Alternative Method: Git-Source Installation

If you are installing directly from a Git repository URL or a local Git checkout that includes the prebuilt `lib/` directory:

1. In DSH's plugin installation interface (or in `<profile>/package.json`), specify the Git source:
   ```text
   git+https://github.com/cleverpigeb/dsh-workspace-guard.git#v0.2.1
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
  - Isolated explicit-target Apply/reapply and fresh engine starts passed. Full Desktop/all-host maintenance remains unverified.

---

### Upgrading, Disabling, and Uninstalling

Manage upgrades, enabling, disabling, and uninstallation directly through **DSH's normal plugin manager**:

- **Upgrading**: Install or update to `dsh-workspace-guard@0.2.1` in DSH's plugin manager. Automatic setup is idempotent and reuses a valid existing configuration (including active `0.2.0` version-2 receipts, while an installed but inactive `0.2.0` bundle is configured automatically on upgrade). To refresh existing live chat tabs after an upgrade, finish ongoing work and restart DSH normally.
- **Ordinary Shutdown**: Closing DSH normally keeps the active configuration in `<profile>/cordis.patch.yml` for the next startup.
- **Disabling and Uninstalling**: Disabling or removing the bundle in DSH's plugin manager automatically restores the previous native providers and removes the scoped Purge adapter before package deletion. Restoring the previous providers also restores their behaviour with Purge.
- **Configuration Ownership and Conflict Handling**:
  - Normal removal preserves later unrelated edits to `<profile>/cordis.patch.yml`, migrates edited owned tool settings back to their native providers, and reports conflicting changes to owned identities rather than overwriting them.
  - On DSH `0.2.1-rc.5`, if an ownership conflict prevents automatic restoration during uninstall, the host logs the teardown error and can still finish removing the package while leaving `<profile>/cordis.patch.yml` and `<profile>/.workspace-guard/receipt.json` intact for recovery. If this occurs, resolve the reported conflict and run the [optional offline recovery procedure](#advanced-diagnostics-and-offline-recovery-cli) below.

---

### Advanced Diagnostics and Offline Recovery (CLI)

The CLI (`doctor`, `plan`, `activate`, `deactivate`, `rollback`) is optional diagnostics and offline recovery tooling. Commands preview by default; offline writes require an explicit `--profile` directory and `--apply --host-stopped` while every DSH process using that profile is stopped.

Set your target profile and host module paths in PowerShell (this example uses the inspected Windows Desktop layout):

```powershell
$ProfileDir  = "$env:USERPROFILE\.dsh\profiles\desktop"
$DshHome     = "$env:USERPROFILE\.dsh"
$HostModules = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app\dsh\node_modules"
$Cli         = "$ProfileDir\node_modules\dsh-workspace-guard\lib\cli.js"
```

*(After package removal, set `$Cli` to `lib\cli.js` inside a downloaded matching `dsh-workspace-guard@0.2.1` package or checkout, then proceed directly to step 4. Steps 1–3 inspect or configure an installed, selected bundle.)*

1. **Inspect Compatibility and Owned Status (`doctor`)**:
   ```powershell
   node $Cli doctor --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
2. **Preview Proposed Configuration Changes (`plan`)**:
   ```powershell
   node $Cli plan --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
3. **Offline Activation or Repair (`activate`)**:
   With all DSH processes stopped:
   ```powershell
   node $Cli activate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
4. **Offline Deactivation or Post-Uninstall Conflict Recovery (`deactivate` / `rollback`)**:
   With all DSH processes stopped, restore the native providers while preserving unrelated later edits (also works with a valid receipt after the bundle has been deselected or removed):
   ```powershell
   node $Cli deactivate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   *(Or use `rollback` with the same flags to record `"status": "rolled-back"` in the receipt.)*

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
| Shell (`pwsh` / `bash`) or Python (`run_code`) reading files | Allowed | **Allowed** | Allowed |
| Shell (`pwsh` / `bash`) or Python (`run_code`) writing inside workspace | Blocked by policy / ACL | **Allowed** | Allowed |
| Shell (`pwsh` / `bash`) or Python (`run_code`) writing outside the workspace and native temporary-directory roots | Native backend restrictions | Native partial write restrictions; tools may request escalation | Subject to OS permissions |
| Shell (`pwsh` / `bash`) network commands (`curl`, `Invoke-WebRequest`, etc.) | No network isolation supplied by this mode | No network isolation supplied by this mode | No network isolation supplied by this mode |
| Write in another Git worktree | Native write denial | Depends on the effective workspace/writable roots; real worktree execution unverified | Subject to OS permissions |
| Automatic session promotion to Full Access by `dsh-purge` | Suppressed | **Suppressed** (preserves the selected mode) | N/A |

---

## Windows Enforcement Characteristics

DSH Workspace Guard uses DeepSeek Harness's official Windows sandbox architecture (`@deepseek-ai/dsh-sandbox-local` + `@deepseek-ai/dsh-sandbox-windows-acl`). Operators should understand the enforcement characteristics of this native backend on Windows:

1. **`partial` Write Restriction Level**:
   - The native Windows ACL backend provides partial write restriction using restricted child tokens and ACL grants for workspace and native temporary roots. It does not add special `.git`, `.dsh`, or `.agents` exclusions inside an allowed workspace.
   - If a drive, filesystem, or host installation lacks `@deepseek-ai/dsh-sandbox-windows-acl`, `workspace-write` and `read-only` refuse to fall back silently to unsandboxed execution; instead, they surface `SandboxUnavailableError` and require explicit operator approval.
2. **No Kernel Read or Network Isolation on Windows**:
   - The Windows ACL sandbox provides neither kernel-level read isolation nor network isolation.
   - The restored filesystem provider passes reads through. Its write-containment checks and tool approval flow do not establish sensitive-read filtering or general network-command blocking.
3. **Temporary ACL Cleanup**:
   - On provider disposal, native cleanup revokes private-temp grants and removes owned temporary directories; standing workspace ACL entries remain for reuse. A crash can leave temporary residue. There is no per-command restoration or persistent ACL journal provided by this plugin.
4. **ConPTY (`persistent-pwsh`) Test Observation**:
   - In the `0.2.1-rc.5` Windows test environment, `persistent-pwsh` (`ConPTY`) fails identically in both the clean official DSH baseline and the generated provider with `PTY shell exited during startup`. DSH Workspace Guard preserves the official `@deepseek-ai/dsh-tool-pwsh` implementation without artificially disabling persistent terminals.

---

## Trust Assumptions and Security Boundaries

DSH Workspace Guard is an **accidental-damage and workflow safety control** that restores DSH's native permission modes alongside Purge. It is **not** a hostile-code or multi-tenant containment boundary:

- **Same-Process Cordis Plugins Are Trusted**: All plugins loaded into the same DSH Node.js/Electron process share the root Cordis context and process memory. The `workspace-guard-purge` service isolation prevents `dsh-purge`'s standard `ctx.permissionPresets.set(session, "danger-full-access")` listener from promoting new sessions, but it cannot stop arbitrary in-process code that intentionally bypasses Cordis DI or mutates the filesystem directly.
- **Host Integrity Outside Replaced Modules**: Workspace Guard replaces the 11 sandbox, policy, approval, permission, filesystem, and tool modules and binds two identity-sensitive symbols (`TOOL_RUNTIME_SCHEDULER` and `SandboxUnavailableError`) from the host. It assumes the remaining host runtime (`AgentLoop`, Electron main process, UI renderer, and `@deepseek-ai/dsh-sandbox-windows-acl`) has not been maliciously trojanised.
- **Operator Actions Are Authoritative**: Explicitly switching a session to **Full Access** (`danger-full-access`) or approving an escalation prompt intentionally grants unrestricted execution for that session or command.
- **Offline CLI Recovery Requirement (`--host-stopped`)**: Normal installation and removal run inside DSH's plugin lifecycle and HMR watcher. When using the optional CLI recovery commands (`activate`, `deactivate`, `rollback`), the CLI uses a profile lockfile (`<profile>/.workspace-guard/configuration.lock`), temporary files, and atomic renames, and relies on the operator ensuring DSH is stopped when passing `--apply --host-stopped`.
- **Subject-Matter Neutrality**: The repair restores native permission modes, path checks, and approval outcomes; it adds no prompt-topic or document-content classification. Existing external approval answerers remain unchanged.

---

## Release Status (`0.2.1`)

- **Current Version**: `0.2.1` (targeting `dsh@0.2.1-rc.5` and `dsh-purge@1.6.67`).
- **Automated & Isolated Runtime Acceptance** ([`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md), [`docs/acceptance-results.json`](docs/acceptance-results.json)):
  - **Automatic Activation & Lifecycle Suite (`0.2.1`)**: Passed 10 focused transaction scenario groups (automatic activation, repeat-load idempotence, shutdown retention, `0.2.0` version-2 receipt reuse, later-edit preservation, disable/removal restoration, launch-overlay conflicts, dynamic-state diagnostics, interrupted-journal recovery, and offline recovery after package removal), isolated Cordis Loader / DSH `app-boot` / HMR / `PluginManager` lifecycle tests, and end-to-end isolated activation with real compiled Guard providers.
  - **Native Functional Baseline (`0.2.0`)**: **41 passed, 0 failed, 1 `native-baseline-unavailable`** in the native suite, plus a separate physically absent approval-handler check (**42 distinct passing checks**), verified across direct runtime execution, explicit-target Purge `Apply`, and Purge `reapply` with **0 source/profile hash drift** across 21 monitored normal installation and profile files.
  - **Normal Desktop Profile Status**: Left untouched during engineering verification and remains awaiting user installation.
- **Documented Runtime Observations**:
  1. **`persistent-pwsh` (ConPTY)**: Categorised as `native-baseline-unavailable` (`PTY shell exited during startup` on both clean official `0.2.1-rc.5` and `dsh-workspace-guard`). Not counted as a pass and not artificially disabled.
  2. **Transient Windows `ReplaceFileW` (`EIO` / Win32 `1175`)**: Observed once in an initial reused-file fixture. Its cause remains unconfirmed. An isolated retry and later direct/Apply/reapply runs passed.
  3. **Read Only Shell Startup**: One initial isolated startup timed out; a bounded repeat passed. The cause remains unconfirmed.
- **Unverified Boundaries in `0.2.1`**:
  - Live Desktop GUI interactive click-through and normal user profile installation (all tests ran in isolated temporary copies to preserve the host untouched).
  - `persistent-pwsh` under `danger-full-access` where ConPTY can spawn.
  - Live model-backed subagent `spawn`/`fork`/`resume` turns and background task survival past parent session close.
  - End-to-end `git worktree add` checkout via a live VCS service.
  - Live external LSP server stdio/socket transport.
  - Hosted plugin-manager registry download over the network.

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
|   |-- host-identities.mjs        # Rewrites shared host symbols (TOOL_RUNTIME_SCHEDULER, SandboxUnavailableError)
|   |-- preserve-purge.mjs         # Applies and verifies Purge 1.6.67 patches #22 and #48
|   |-- provenance.mjs             # Generates lib/provenance.json and lib/THIRD_PARTY_LICENSES.txt
|   |-- source-lock.json           # Pinned upstream source archive revisions and hashes
|   |-- source-release.mjs         # Exports auditable source release metadata
|   |-- upstream-lock.json         # SHA-256 lockfile for 11 official @deepseek-ai/*@0.2.1-rc.5 packages
|   |-- upstream.mjs               # Selected upstream modules and bundled dependencies
|   `-- verify-upstream.mjs        # Verifies pinned inputs; refreshes provenance only on request
|-- docs/
|   |-- ACCEPTANCE.md              # 0.2.1 acceptance test report, observations, and unverified boundaries
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
|   |-- entries/                   # Entry wrappers for the 10 generated replacement providers
|   |-- cli.ts                     # Optional offline diagnostics and recovery CLI (doctor, plan, activate, deactivate, rollback)
|   |-- compatibility.ts           # DSH and Purge version checks
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

- [**Coverage Matrix (`docs/COVERAGE.md`)**](docs/COVERAGE.md) — Breakdown of documented native routes and Purge `1.6.67` patch handling.
- [**Architecture & Design (`docs/DESIGN.md`)**](docs/DESIGN.md) — Root-cause analysis of Purge's patches, single-instance `@deepseek-ai/dsh-sandbox` graph design, and Cordis realm isolation.
- [**Installation & Recovery Guide (`docs/INSTALLATION.md`)**](docs/INSTALLATION.md) — Automatic setup, native reload behaviour, upgrade/removal lifecycle, and offline recovery procedures.
- [**Configuration Reference (`docs/CONFIGURATION.md`)**](docs/CONFIGURATION.md) & [**Preview (`docs/CONFIGURATION-PREVIEW.yml`)**](docs/CONFIGURATION-PREVIEW.yml) — Formal paired Cordis configuration and `<profile>/.workspace-guard/receipt.json`.
- [**Acceptance Report (`docs/ACCEPTANCE.md`)**](docs/ACCEPTANCE.md) & [**Results (`docs/acceptance-results.json`)**](docs/acceptance-results.json) — Full `0.2.1` automatic installation and `0.2.0` baseline test results, observations, and hash-drift audit.
- [**Upstream Provenance (`docs/UPSTREAM.md`)**](docs/UPSTREAM.md) — Verification of official `@deepseek-ai/*@0.2.1-rc.5` inputs and build manifests.

---

## Licensing

### Project License (`GPL-3.0-or-later`)

**DSH Workspace Guard (`dsh-workspace-guard`)** is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License** as published by the Free Software Foundation, **either version 3 of the License, or (at your option) any later version** (`GPL-3.0-or-later`).

The complete, unmodified text of the GNU General Public License version 3 and the project's explicit "version 3 or any later version" licensing notice are provided in [`LICENSE`](LICENSE).

### Third-Party Components and Notices

The prebuilt runtime bundles in `lib/` incorporate code from official DeepSeek Harness packages and open-source runtime dependencies under GPLv3-compatible permissive licenses:

| Component Group | Packages | Version | License | Copyright Holder |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek Harness Modules** | `@deepseek-ai/dsh-sandbox-local`, `@deepseek-ai/dsh-sandbox-policy`, `@deepseek-ai/dsh-user-approval`, `@deepseek-ai/dsh-permission-presets`, `@deepseek-ai/dsh-fs-sandbox`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-pwsh`, `@deepseek-ai/dsh-tool-fs`, `@deepseek-ai/dsh-plugin-manager`, `@deepseek-ai/dsh-sandbox` (plugin-manager tools subentry only) | `0.2.1-rc.5` | `MIT` | `Copyright (c) 2026 DeepSeek` |
| **jsdiff (`diff`)** | `diff` | `9.0.0` | `BSD-3-Clause` | `Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>` |
| **yaml** | `yaml` | `2.9.0` | `ISC` | `Copyright Eemeli Aro <eemeli@gmail.com>` |
| **Zod (`zod`)** | `zod` | `4.4.3` | `MIT` | `Copyright (c) 2025 Colin McDonnell` |

Complete upstream copyright notices and the full, unmodified `MIT`, `BSD-3-Clause`, and `ISC` license texts are maintained in:

- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) (root human-readable third-party licensing documentation)
- [`lib/THIRD_PARTY_LICENSES.txt`](lib/THIRD_PARTY_LICENSES.txt) and [`lib/provenance.json`](lib/provenance.json) (bundled distribution notices and SHA-256 provenance manifest)

### Source Distribution

The npm package includes project TypeScript and build scripts. To rebuild its contents, first copy `lib/build-lock.yaml` to `pnpm-lock.yaml`, then use the development commands above.

Maintainers run `pnpm source:release` in the Git checkout to generate `.local/artifacts/dsh-workspace-guard-0.2.1-source.tar.gz`; `pnpm source:release --output <directory>` selects another destination. It includes the current tracked project files, four pinned upstream archives, and a checksum manifest. Publish that companion archive beside the matching release and link it from the package’s release documentation. Upstream archive URLs and checksums are also available in [`build/source-lock.json`](build/source-lock.json). See [the source-distribution details and verification limits](THIRD_PARTY_NOTICES.md#source-access-and-redistribution).
