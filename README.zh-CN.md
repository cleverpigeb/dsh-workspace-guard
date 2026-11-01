# DSH Workspace Guard (`dsh-workspace-guard`)

[English](README.md) | **简体中文**

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![License: GPL v3 or later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Target DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-teal.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)](docs/COVERAGE.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.19.0-brightgreen.svg)](package.json)

**DSH Workspace Guard** 是面向 Windows 平台 **DeepSeek Harness (DSH)** 的第三方原生对等兼容插件。它能够在与 **Purge**（`dsh-purge` / `dsh-purge-community`）及 **OPS**（`dsh-ops`）共存的环境中，恢复官方 **Workspace（工作区读写）** 模式（`workspace-write`）与 **Read Only（只读）** 模式（`read-only`）的选定原生提供方与工具链路，且无需修改宿主程序二进制文件、无需覆写磁盘上的宿主 `node_modules` 文件，也不会禁用 Purge 本身。

---

## 目录

- [项目目标与背景](#项目目标与背景)
- [系统架构](#系统架构)
- [兼容性要求](#兼容性要求)
- [权限模式说明](#权限模式说明)
- [功能特性与覆盖矩阵](#功能特性与覆盖矩阵)
- [安装与配置生命周期](#安装与配置生命周期)
  - [第一步：安装插件包（默认静默不改动配置）](#第一步安装插件包默认静默不改动配置)
  - [第二步：激活配置文件](#第二步激活配置文件)
  - [日常使用](#日常使用)
  - [版本升级](#版本升级)
  - [停用、回滚与卸载](#停用回滚与卸载)
- [支持的能力与拦截行为](#支持的能力与拦截行为)
- [Windows 平台沙盒执行特性](#windows-平台沙盒执行特性)
- [信任假设与安全边界](#信任假设与安全边界)
- [发布状态（`0.2.0`）](#发布状态020)
- [开发与构建命令](#开发与构建命令)
- [仓库目录结构](#仓库目录结构)
- [详细文档索引](#详细文档索引)
- [开源许可与第三方声明](#开源许可与第三方声明)

---

## 项目目标与背景

在官方 DeepSeek Harness（`0.2.1-rc.5`）中，**Workspace**（`workspace-write`）与 **Read Only**（`read-only`）权限模式由五层核心组件协同实现：

1. **权限预设服务**（`permissionPresets`）：解析当前会话模式（`read-only`、`workspace-write` 或 `danger-full-access`），并提供默认的文件与命令策略。
2. **文件系统策略与提供方**（`policy`、`fs`）：执行原生写入路径边界及真实路径（realpath）/符号链接检查；核心文件读取直接放行，不提供敏感路径读取保护。
3. **命令策略与审批引擎**（`policy`、`approval`）：在命令执行前评估 Shell 命令、执行操作员审批规则，并在沙盒拒绝后触发提权审批流程（escalation）。
4. **Windows ACL 沙盒后端**（`sandbox` + `@deepseek-ai/dsh-sandbox-windows-acl`）：对子进程（`pwsh`、`bash` 及 Python `run_code`）施加原生 Windows SID/ACL 写入限制（`partial` 级别）。
5. **内置工具消费方**（`tools`、`tool-bash`、`tool-pwsh`、`tool-fs`、`plugin-tools`）：通过原生服务及静态辅助模块处理对应的文件与命令操作。

当用户对 DSH 应用 **Purge（`1.6.67`）** 时，Purge 的补丁会修改宿主沙盒、策略、审批、权限、文件系统及内置工具模块，以跳过审批与沙盒执行；同时其运行时插件（`dsh-purge`）会在新建会话（`session.created`）时自动将会话提权为 **Full Access（完全访问）**（`danger-full-access`）。这可能导致会话被自动切回 Full Access，或缺失原生沙盒与策略保护。最初的 `ops_bash` 回归源于 Purge 将沙盒限制执行改为普通令牌透传，与 OPS 的受限 IPC Bash 启动链路不兼容。

**DSH Workspace Guard（`0.2.0`）** 通过非侵入式架构解决了这一冲突：

- 基于官方 `@deepseek-ai/*@0.2.1-rc.5` 原包预构建自包含的替换服务提供方，恢复选定的原生沙盒、策略与审批链路，并保留其上游限制。
- 在替换的工具模块中精准保留 Purge 与沙盒无关的文件读取上限扩容（补丁 `#22`）及删除/移动提示词精简（补丁 `#48`），同时保留宿主层的其他 Purge 补丁（如禁用 Auto Review 的补丁 `#59`）。
- 通过 Cordis 服务隔离门面（facade）接管 `dsh-purge` 对 `permissionPresets` 的依赖，阻止新建会话被自动提权至 `danger-full-access`；默认模式仍遵循原生配置、环境设置及已有会话选择。
- 将**插件包安装**与**配置激活**完全解耦，采用可逆的配对式 Cordis 配置项与原子事务凭证（receipt）。隔离的显式目标 Purge Apply/reapply 测试已通过；这不代表任意重新打补丁流程均已验证。

---

## 系统架构

DSH Workspace Guard 由四个协同机制组成：

```
+-----------------------------------------------------------------------+
|                        Cordis 配置文件 (cordis.patch.yml)            |
|        (停用受影响的原生条目；插入配对的 workspace-guard 替换条目)    |
+-----------------------------------+-----------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                                                       |
        v                                                       v
+-------------------------------+               +-------------------------------+
|       权限隔离门面服务        |               |     官方原生对等替换提供方    |
|-------------------------------|               |  (@deepseek-ai/*@0.2.1-rc.5)  |
| - permission-bridge           |               |-------------------------------|
|   捕获根级 permissionPresets  |               | 核心服务提供方:               |
| - purge-permission            |               | - sandbox, policy, approval,  |
|   向 dsh-purge 注入独立的     |               |   permission, fs              |
|   "workspace-guard-purge"     |               | 静态工具消费方:               |
|   隔离域；忽略其自动发起的    |               | - tools, tool-bash,           |
|   set(s, "danger-full-access")|               |   tool-pwsh, tool-fs,         |
+-------------------------------+               |   plugin-tools                |
                                                +---------------+---------------+
                                                                |
                                                                v
                                                +-------------------------------+
                                                |       受检构建转换管线        |
                                                |-------------------------------|
                                                | - 保留 Purge 补丁 #22 与 #48  |
                                                | - 共享宿主身份符号:           |
                                                |   TOOL_RUNTIME_SCHEDULER 与   |
                                                |   SandboxUnavailableError     |
                                                | - 动态绑定原生 ACL 扩展       |
                                                |   dsh-sandbox-windows-acl     |
                                                +-------------------------------+
```

1. **基于官方包生成的替换提供方（`src/entries/*.ts` -> `lib/*.js`）**
   - 由通过 [`build/upstream-lock.json`](build/upstream-lock.json) SHA-256 校验的 11 个官方 `@deepseek-ai/*@0.2.1-rc.5` 模块打包生成。
   - 替换根级插件与全部 4 个智能体预设（`preset-standard`、`preset-ptc`、`preset-minimal`、`preset-cordis`）中的 5 个核心服务提供方（`sandbox`、`policy`、`approval`、`permission`、`fs`）与 5 个内置静态消费方（`tools`、`tool-bash`、`tool-pwsh`、`tool-fs`、`plugin-tools`）。
   - 所有生成的入口在构建图中共享唯一一个未经篡改的 `@deepseek-ai/dsh-sandbox` 辅助模块；`ToolRuntime` 与 `run_code` 消费同一辅助模块，避免构建图分裂。

2. **受检构建转换（[`build/preserve-purge.mjs`](build/preserve-purge.mjs) 与 [`build/host-identities.mjs`](build/host-identities.mjs)）**
   - **Purge 兼容性转换**：仅在替换的工具包内应用两项非沙盒类 Purge `1.6.67` 修改——补丁 `#22`（扩大 `@deepseek-ai/dsh-tool-fs` 的 `read` 读取上限）和补丁 `#48`（精简 `@deepseek-ai/dsh-tool-bash` 与 `@deepseek-ai/dsh-tool-pwsh` 的删除/移动操作提示），并将输入输出哈希记录在 `lib/build-manifest.json`。
   - **共享宿主身份符号**：将 `TOOL_RUNTIME_SCHEDULER` 重写为从宿主 `@deepseek-ai/dsh-tools` 导入（确保未修改的 `AgentLoop` 能解析当前激活的 `ToolRuntime` 调度器），并将 `SandboxUnavailableError` 重写为从宿主 `@deepseek-ai/dsh-sandbox` 导入（确保跨模块 `instanceof` 检查一致），审计记录保存在 `lib/host-identities.json`。

3. **Purge 权限隔离机制（[`src/permission-bridge.ts`](src/permission-bridge.ts) 与 [`src/purge-permission.ts`](src/purge-permission.ts)）**
   - `dsh-workspace-guard/permission-bridge` 捕获根级 `permissionPresets` 服务并挂载至 `workspaceGuardPermissions`。
   - `dsh-workspace-guard/purge-permission` 在 `workspace-guard-purge` Cordis 隔离域（`isolate: { permissionPresets: "workspace-guard-purge" }`）内注册 `permissionPresets` 门面服务，并仅将该隔离域注入 `dsh-purge`。
   - 该门面将所有读取和方法调用转发给根服务，唯独在 `dsh-purge` 调用 `set(session, "danger-full-access")` 时执行同步空操作（no-op）。宿主 UI 控件与操作员手动切换仍直接访问根级 `permissionPresets` 服务。

4. **配对式 Cordis 配置与事务凭证（[`src/configuration.ts`](src/configuration.ts)）**
   - 配置激活在 DSH 完全停止的状态下离线修改 `<profile>/cordis.patch.yml`。
   - 激活过程将受影响的原生条目设为 `disabled: true`，并插入配对的替换条目与权限门面。实际条目名称与数量以目标配置的 `plan` 输出为准。
   - 激活会在 `<profile>/.workspace-guard/receipt.json` 写入哈希与配置归属记录，支持移除受管变更，并通过增量合并保留无关的用户配置修改；凭证不是原配置的完整备份；遇到冲突会报告，而非直接覆盖。

---

## 兼容性要求

| 组件 / 运行环境 | 支持版本 / 要求 | 校验与执行行为 |
| :--- | :--- | :--- |
| **DeepSeek Harness (`dsh`)** | `0.2.1-rc.5` | 离线 CLI 校验所选包版本与配置组成；原生替换入口在运行时校验实际所选宿主版本。`workspace-guard-status` 仅提供信息。 |
| **Purge (`dsh-purge` / `dsh-purge-community`)** | `1.6.67` | 校验所选包版本；已测试隔离显式目标的 Apply/reapply，未测试全宿主维护。 |
| **OPS (`dsh-ops`)** | `0.4.4`（运行时可选） | 校验所选包版本；隔离环境中已执行 OPS Bash 与原生 worker 验收。 |
| **操作系统** | Windows x64 (`win32`) | 这是已验证的运行环境。`doctor` 不证明平台、架构或原生后端可用性。 |
| **Node.js** | `>=22.19.0`（已在 `26.7.0` 验证） | 运行离线 CLI 与构建脚本所需（见 `package.json` 的 `engines.node`）。 |
| **原生 Windows ACL 扩展** | `@deepseek-ai/dsh-sandbox-windows-acl` | 运行时通过 `import.meta.resolve` 解析宿主包的 runner 导出。`read-only` 与 `workspace-write` 模式下执行命令需可用的原生后端。 |

---

## 权限模式说明

在配置文件中激活后，DSH Workspace Guard 支持全部三种官方 DSH 权限模式：

| 模式 ID | 界面名称 | 新建会话默认项 | 文件系统策略 | 命令与沙盒策略 |
| :--- | :--- | :--- | :--- | :--- |
| `workspace-write` | **Workspace** | 原生默认（尊重显式配置与环境设置） | 核心读取直接放行；允许在工作区及原生临时根目录内写入，其他路径按原生策略处理。没有额外的 `.git`、`.dsh`、`.agents` 禁写规则。 | Shell 命令（`pwsh`、`bash`）与 Python `run_code` 使用原生 Windows ACL 沙盒（部分写入限制）；拒绝执行或沙盒不可用时沿用原生审批/提权流程。不承诺网络命令隔离。 |
| `read-only` | **Read Only** | 否（可按会话切换） | 允许读取文件；原生文件系统修改在此策略下被拒绝。 | Shell 命令与 `run_code` 按原生只读策略及其临时资源许可运行；工具可请求显式权限扩展。 |
| `danger-full-access` | **Full Access** | 保留显式配置与已有选择 | 跳过原生工作区写入检查，仍受操作系统权限约束。 | 命令不受原生沙盒限制。Purge 的自动提权被抑制；根服务上的显式选择仍然生效。 |

---

## 功能特性与覆盖矩阵

下表概述 DSH Workspace Guard（`0.2.0`）涉及的能力与连接方式，并非 [`docs/COVERAGE.md`](docs/COVERAGE.md) 的逐行副本或完整验收证明。实际执行结果与未验证边界见[验收测试报告](docs/ACCEPTANCE.md)：

| # | 能力链路 | 上游官方包 (`0.2.1-rc.5`) | 插件导出子路径 | `0.2.0` 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **权限预设服务**（`read-only`、`workspace-write`、`danger-full-access`） | `@deepseek-ai/dsh-permission-presets` | `dsh-workspace-guard/permission` | 已恢复（遵循原生默认与显式选择） |
| 2 | **Purge 会话权限隔离**（`permissionPresets` 隔离门面） | `@deepseek-ai/dsh-permission-presets` + `dsh-purge@1.6.67` | `dsh-workspace-guard/permission-bridge`、`dsh-workspace-guard/purge-permission` | 已启用（阻止 Purge 自动提权至 Full Access） |
| 3 | **文件系统策略与提供方**（`fs`、`policy`、写入路径与真实路径检查） | `@deepseek-ai/dsh-fs-sandbox`、`@deepseek-ai/dsh-sandbox-policy` | `dsh-workspace-guard/fs`、`dsh-workspace-guard/policy` | 已恢复 |
| 4 | **命令策略与审批引擎**（`policy`、`approval`、失败后提权审批） | `@deepseek-ai/dsh-sandbox-policy`、`@deepseek-ai/dsh-user-approval` | `dsh-workspace-guard/policy`、`dsh-workspace-guard/approval` | 已恢复 |
| 5 | **原生 Windows ACL 沙盒**（`sandbox`、`@deepseek-ai/dsh-sandbox-windows-acl`） | `@deepseek-ai/dsh-sandbox-local` | `dsh-workspace-guard/sandbox` | 已恢复（依赖宿主 Windows ACL 原生扩展） |
| 6 | **内置文件工具**（`read`、`read_image`、`write`、`edit`） | `@deepseek-ai/dsh-tool-fs` | `dsh-workspace-guard/tool-fs` | 已恢复 + 保留 Purge 补丁 `#22` |
| 7 | **PowerShell 工具（`pwsh`）**（单次执行、后台任务、持久终端链路） | `@deepseek-ai/dsh-tool-pwsh` | `dsh-workspace-guard/tool-pwsh` | 已恢复 + 保留 Purge 补丁 `#48`（ConPTY 测试用例启动失败尚未解决，详见[发布状态](#发布状态020)） |
| 8 | **Bash 工具（`bash`）** | `@deepseek-ai/dsh-tool-bash` | `dsh-workspace-guard/tool-bash` | 已恢复 + 保留 Purge 补丁 `#48` |
| 9 | **工具运行时与 Python `run_code`（`preset-ptc`）** | `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-sandbox` | `dsh-workspace-guard/tools` | 已恢复（共享宿主 `TOOL_RUNTIME_SCHEDULER`） |
| 10 | **智能体预设**（`preset-standard`、`preset-ptc`、`preset-minimal`、`preset-cordis`） | 宿主预设配置 | `cordis.patch.yml` 配对嵌套条目 | 全部 4 个预设已完成重连 |
| 11 | **子智能体（Subagent）与后台任务继承** | 宿主子智能体与后台任务服务 | 根级 `sandbox`、`policy`、`approval`、`fs`、`permission` | 已验证适配器分派及 OPS 后台任务；完整子智能体生命周期未验证 |
| 12 | **Git Worktree 适配器链路** | 宿主 VCS 适配器、`@deepseek-ai/dsh-fs-sandbox`、`@deepseek-ai/dsh-sandbox-local` | 根级 `fs`、`policy`、`sandbox` | 已验证适配器分派；真实 Git worktree 创建未验证 |
| 13 | **LSP 与插件工具桥接**（`lsp`、`plugin-tools`） | 宿主 LSP 服务、`@deepseek-ai/dsh-plugin-manager/tools` | `dsh-workspace-guard/plugin-tools` + 根级 `fs` | 已连接原生链路；真实 LSP 传输未验证 |

### 保留的 Purge 兼容性规则

| Purge `1.6.67` 补丁 | 上游目标模块 | DSH Workspace Guard 下的行为 |
| :--- | :--- | :--- |
| **补丁 `#22`** | `@deepseek-ai/dsh-tool-fs` | **在替换构建中保留**：`READ_MAX_LINE_LENGTH = 10,000`、`READ_MAX_BYTES = 1,048,576`（1 MiB）、`READ_LIMIT = 20,000`。 |
| **补丁 `#48`** | `@deepseek-ai/dsh-tool-bash`、`@deepseek-ai/dsh-tool-pwsh` | **在替换构建中保留**：将冗长的 git/归档删除绕过提示替换为 `"Proceed with operator-requested paths. "`。 |
| **补丁 `#59`** | 宿主 Auto Review 实现 | **在宿主中保留**：位于选定替换入口之外，继续保持禁用 Auto Review。 |

---

## 安装与配置生命周期

DSH Workspace Guard 采用**两步式安装与激活设计**：

1. **第一步 — 安装插件包（默认静默不改动配置）**：在 DSH 插件界面安装并勾选插件包后，仅会通过 `cordis.patch.yml` 注册提供安装信息的 `workspace-guard-status` 插件。在显式执行激活命令前，**不会**改动 `sandbox`、`policy`、`approval`、`permission`、`fs` 或 `dsh-purge`。
2. **第二步 — 激活配置文件**：在关闭 DSH 的状态下运行离线 `dsh-workspace-guard` CLI，对 `<profile>/cordis.patch.yml` 进行配对式重写，并在 `<profile>/.workspace-guard/receipt.json` 中记录可逆事务凭证。

### 第一步：安装插件包（默认静默不改动配置）

#### 首选方式（推荐）：通过 DSH 插件安装界面从官方 npm 源安装

1. 打开 **DeepSeek Harness (DSH)**，进入 **插件（Plugins）** 安装界面（**安装插件 / Install Plugin** 包来源输入框）。
2. 输入官方 npm 仓库中的包名进行安装：
   - **安装最新版本**：
     ```text
     dsh-workspace-guard
     ```
   - **安装固定版本（对应当前 `package.json` 元数据版本 `0.2.0`）**：
     ```text
     dsh-workspace-guard@0.2.0
     ```
3. 安装完成后，在目标配置文件（Profile）中启用/勾选 **`dsh-workspace-guard`**，使 DSH 将其写入 `<profile>/package.json` 并安装至 `<profile>/node_modules/dsh-workspace-guard`。
4. 完全关闭 DSH，然后继续执行[第二步：激活配置文件](#第二步激活配置文件)。

> **说明**：发布的 npm 包内已包含预构建的 `lib/` 产物，且维护者构建脚本命名为 `build:release`（而非 `build` 或 `prepare`），因此安装无需编译或运行构建脚本。`diff`、`yaml`、`zod` 来自构建依赖并已打包；共享的宿主 peer 依赖仍由宿主提供。

#### 备选方式：从 Git 源码仓库安装

如果需要直接从包含预构建 `lib/` 目录的 Git 仓库 URL 或本地 Git 检出目录安装：

1. 在 DSH 插件安装界面（或 `<profile>/package.json`）中指定 Git 来源：
   ```text
   git+https://github.com/<owner>/dsh-workspace-guard.git#v0.2.0
   ```
2. 在目标 Profile 中启用该插件，确认其已链接至 `<profile>/node_modules/dsh-workspace-guard`，随后完全关闭 DSH 并执行第二步。

---

### 第二步：激活配置文件

配置激活必须在 **DSH 所有窗口与后台进程完全退出** 的离线状态下执行。

在 PowerShell 中设置路径变量。下列为已检查的 Desktop 路径示例；请先确认并选择自己的目标 Profile、DSH 主目录与宿主模块目录：

```powershell
$ProfileDir  = "$env:USERPROFILE\.dsh\profiles\desktop"
$DshHome     = "$env:USERPROFILE\.dsh"
$HostModules = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app\dsh\node_modules"
$Cli         = "$ProfileDir\node_modules\dsh-workspace-guard\lib\cli.js"
```

*（如果 `<profile>\node_modules\.bin\dsh-workspace-guard.cmd` 已加入 PATH 或直接调用，也可直接使用 `dsh-workspace-guard` 命令代替 `node $Cli`。）*

1. **运行 `doctor`（只读环境与兼容性检查）**
   离线校验所选 DSH `0.2.1-rc.5`、Purge `1.6.67` / OPS `0.4.4`（若已安装）的包清单与配置组成，并报告 `<profile>/cordis.patch.yml` 状态；这不能证明实际原生后端能够执行：
   ```powershell
   node $Cli doctor --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```

2. **运行 `plan`（空跑预览配置变更）**
   在不修改任何文件的前提下，预览将被停用的原生条目与即将插入的配对条目：
   ```powershell
   node $Cli plan --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```

3. **运行 `activate`（写入配对配置与事务凭证）**
   确认 **所有 DeepSeek Harness 窗口和后台进程均已关闭**，然后执行激活：
   ```powershell
   node $Cli activate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   - 命令会写入受管配置变更，并生成 `<profile>/.workspace-guard/receipt.json` 归属与哈希凭证。
   - 当输出显示 `"status": "active"` 后，即可正常启动 DSH。

---

### 日常使用

- **新建会话默认模式**：抑制 `dsh-purge` 的自动 Full Access 提权，保留原生默认（通常为 `workspace-write`）、显式配置与环境设置；已有会话的选择不被重设。
- **手动切换权限模式**：可随时通过 DSH 界面上的会话权限选择器，在 **Read Only**（`read-only`）、**Workspace**（`workspace-write`）与 **Full Access**（`danger-full-access`）之间自由切换。
- **重新运行 Purge（`Apply` 或 `dsh-purge --reapply`）后**：隔离的显式目标测试中，独立的预构建提供方与配置选择继续生效。其他目标、版本与全宿主维护未验证。运行 `doctor` 检查配置是否仍报告 `"status": "active"`，并在隔离环境复验实际执行行为。

---

### 版本升级

当需要将 `dsh-workspace-guard` 升级至新版本时：

1. 等待当前任务结束，完全关闭受影响的 DSH 窗口与后台进程，然后替换已加载的插件包。可提前获取新包，但不要在宿主运行时覆盖其正在使用的安装目录。
2. 对目标 Profile 运行 `doctor` 与 `plan`，确认新版本与当前安装的 DSH 版本兼容。
3. 重新运行 `activate --apply --host-stopped`：
   ```powershell
   node $Cli activate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   `activate` 校验当前激活凭证并保留无关的用户编辑，遇到冲突会报告。配置回滚不等于插件包版本回滚。

---

### 停用、回滚与卸载

> **重要提示**：在 DSH 中卸载 `dsh-workspace-guard` 插件包之前，**必须先运行 `deactivate`（或 `rollback`）**。如果在原生提供方仍处于 `disabled: true` 且 `cordis.patch.yml` 仍引用 `dsh-workspace-guard/*` 时直接删除插件包，该 Profile 将无法加载对应的核心服务。

1. 完全关闭所有 DSH 进程。
2. **执行 `deactivate`（推荐 — 保留用户对其他插件的配置修改）**：
   移除受管替换条目并恢复配对原生条目的原始设置，同时保留激活后对 `cordis.patch.yml` 中其他无关条目的修改：
   ```powershell
   node $Cli deactivate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   **或者执行 `rollback`（按凭证移除受管变更）**：
   与 `deactivate` 一样，依据凭证恢复受管条目并保留无关编辑，不承诺按字节还原整个文件：
   ```powershell
   node $Cli rollback --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
3. `deactivate` 返回 `"status": "inactive"`，`rollback` 返回 `"status": "rolled-back"`；再运行带相同目标路径参数的 `doctor` 检查配置状态。
4. 启动 DSH，按需在插件管理界面中卸载 `dsh-workspace-guard`。

移除替换条目后会恢复使用当前宿主提供方，也可能重新出现 Purge 的 Workspace 冲突。

---

## 支持的能力与拦截行为

| 操作 / 行为 | Read Only (`read-only`) | Workspace (`workspace-write`) | Full Access (`danger-full-access`) |
| :--- | :--- | :--- | :--- |
| 核心文件读取（包括工作区外与敏感路径） | 原生读取直接放行 | 原生读取直接放行 | 允许 |
| 对工作区内普通文件执行 `write` / `edit` | 拦截 / 请求审批 | **允许** | 允许 |
| 对工作区与原生临时根目录之外执行 `write` / `edit` | 拦截 / 请求审批 | **拦截 / 请求审批** | 允许 |
| 通过符号链接或目录联接（junction）逃逸出可写根目录范围写入 | 按当前策略拒绝 | 按当前策略拒绝；工具可请求权限扩展 | 受操作系统权限约束 |
| 写入工作区内的 `.git`、`.dsh`、`.agents` | 按原生只读策略处理 | 无额外目录禁写规则 | 允许 |
| Shell（`pwsh` / `bash`）或 Python（`run_code`）读取文件 | 允许 | **允许** | 允许 |
| Shell（`pwsh` / `bash`）或 Python（`run_code`）在工作区内写入 | 由策略 / ACL 拦截 | **允许** | 允许 |
| Shell（`pwsh` / `bash`）或 Python（`run_code`）在工作区与原生临时根目录外写入 | 由原生策略 / ACL 限制 | **由 Windows ACL 限制**（部分写入限制），拒绝后沿用原生提权审批流程 | 允许 |
| Shell（`pwsh` / `bash`）执行网络命令（如 `curl`、`Invoke-WebRequest`） | 无网络隔离保证 | 无网络隔离保证 | 允许 |
| Git worktree 适配器 | 已测试分派，真实创建未验证 | 已测试分派；不额外注册可写根目录 | 同左 |
| `dsh-purge` 新建会话自动提权至 Full Access | 已抑制 | **已抑制**（保留原生/显式选择） | 不适用 |

---

## Windows 平台沙盒执行特性

DSH Workspace Guard 采用 DeepSeek Harness 官方的 Windows 沙盒架构（`@deepseek-ai/dsh-sandbox-local` + `@deepseek-ai/dsh-sandbox-windows-acl`）。在 Windows 环境下使用时，请注意以下原生执行特性：

1. **原生部分写入限制**：
   - Windows ACL 后端通过 Windows SID 与 DACL 权限项，为受限子进程令牌配置工作区与原生临时根目录的写入范围。此为原生部分写入限制，不包含额外的 `.git`、`.dsh`、`.agents` 目录禁写规则，也不承诺任意 Windows 路径均受完整隔离。
   - 如果磁盘分区、文件系统或宿主环境缺失 `@deepseek-ai/dsh-sandbox-windows-acl`，`workspace-write` 与 `read-only` 不会静默退化为无沙盒执行，而是抛出 `SandboxUnavailableError` 并要求操作员显式审批。
2. **Windows 下无内核级读取隔离与网络命名空间隔离**：
   - Windows ACL 沙盒**不提供**读取隔离或网络隔离。
   - 核心 `fs` 读取直接放行；此插件不承诺敏感文件读取审批或网络命令拦截。原生策略/审批仍处理其支持的执行决策。
3. **ACL 生命周期**：
   - 原生提供方在释放服务时撤销私有临时目录的授权；工作区访问控制项（ACE）保留以供复用。并非每条命令结束后恢复全部 ACL；异常退出后的残留不在此清理保证内。
4. **ConPTY（`persistent-pwsh`）测试观察**：
   - 在 `0.2.1-rc.5` Windows 测试环境中，`persistent-pwsh`（基于 `ConPTY` 的持久终端）在纯净官方 DSH 基线与生成的替换提供方中表现完全一致，均在启动阶段因 `PTY shell exited during startup` 退出。DSH Workspace Guard 原样保留了官方 `@deepseek-ai/dsh-tool-pwsh` 实现，未人为屏蔽持久终端功能。

---

## 信任假设与安全边界

DSH Workspace Guard 的定位是**防止误操作与恢复工作流安全边界的兼容性控制组件**，用于在启用 Purge 的环境中恢复 DSH 原生权限模式，**而非**抵御恶意代码或多租户隔离的强安全容器：

- **同进程 Cordis 插件互信假设**：加载到同一个 DSH Node.js/Electron 进程中的所有插件共享根级 Cordis 上下文与进程内存。`workspace-guard-purge` 服务隔离能够阻止 `dsh-purge` 标准的 `ctx.permissionPresets.set(session, "danger-full-access")` 监听器自动提权新建会话，但无法防御刻意绕过 Cordis 依赖注入或直接调用底层 API 篡改文件系统的恶意同进程代码。
- **未替换宿主模块的完整性假设**：Workspace Guard 打包了 11 个选定的沙盒、策略、审批、权限、文件系统与工具入口，并从宿主绑定了两个身份敏感符号（`TOOL_RUNTIME_SCHEDULER` 与 `SandboxUnavailableError`）。它假定其余宿主运行时组件（`AgentLoop`、Electron 主进程、UI 渲染进程及 `@deepseek-ai/dsh-sandbox-windows-acl`）未被恶意篡改。
- **操作员显式操作具有最高权威**：操作员在界面中主动将会话切换为 **Full Access**（`danger-full-access`），或在审批弹窗中批准提权请求时，系统会按预期授予相应的非受限执行权限。
- **离线激活前提（`--host-stopped`）**：CLI 使用配置文件锁（`<profile>/.workspace-guard/configuration.lock`）、临时文件与原子重命名保护写入过程，但依赖操作员在传入 `--apply --host-stopped` 时确保 DSH 已完全关闭，以免运行中的宿主在退出时覆写 `cordis.patch.yml`。
- **内容主题中立性**：此修复恢复原生权限模式、路径检查与审批结果，不新增提示词主题或文档内容分类。已有的外部审批答复组件保持不变。

---

## 发布状态（`0.2.0`）

- **当前版本**：`0.2.0`（面向 `dsh@0.2.1-rc.5`、`dsh-purge@1.6.67`、`dsh-ops@0.4.4` 的**审查 / 候选发布版本**）。
- **自动化与隔离运行时验收结果**（详见 [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)、[`docs/acceptance-results.json`](docs/acceptance-results.json)）：
  - 隔离的临时 Profile 中，原生功能套件为 **41 项通过、0 项失败、1 项 `native-baseline-unavailable`（原生基线不可用）**；另有无审批处理器测试通过，共 42 项不同的通过用例。
  - 直接运行及隔离显式目标的 Purge `Apply`、`reapply` 后，分别启动的新进程重复通过上述 41 项，并出现同一原生终端不可用项；额外的无审批处理器用例单独执行。
  - 验证前后对全部 21 个正常安装与配置监控文件进行 SHA-256 校验，**哈希漂移为 0**。
- **已记录的运行时观察项**：
  1. **`persistent-pwsh`（ConPTY）**：归类为 `native-baseline-unavailable`（在纯净官方 `0.2.1-rc.5` 基线与 `dsh-workspace-guard` 下均报 `PTY shell exited during startup`）。未计入通过项，也未人为禁用。
  2. **Windows `ReplaceFileW`（`EIO` / Win32 `1175`）**：在初始复用文件的测试用例中曾出现过一次，具体原因尚未确定。在随后的隔离重试以及直接运行、显式目标 Apply/reapply 测试中均通过。
- **`0.2.0` 尚未验证的边界**：
  - 真实桌面 GUI 界面的交互式点击验收与正常用户 Profile 的原地修改（所有验收均在隔离临时副本中执行，以保持宿主环境零污染）。
  - `danger-full-access` 模式下 ConPTY 可正常启动时的 `persistent-pwsh` 行为。
  - 接入真实模型的子智能体（Subagent）`spawn`/`fork`/`resume` 多轮对话，以及父会话关闭后后台任务的持续存活。
  - 通过在线 VCS 服务完整执行 `git worktree add` 检出流程。
  - 外部真实 LSP 语言服务器的 stdio/socket 通信传输。
  - 宿主插件管理器通过网络从远程注册表下载安装的过程。

---

## 开发与构建命令

维护者构建与校验脚本需要 **Node.js `>=22.19.0`**、固定的 **pnpm `12.10.1`**，以及与 [`build/upstream-lock.json`](build/upstream-lock.json) 匹配的锁定官方构建依赖：

```powershell
# 按锁文件安装构建依赖
pnpm install --frozen-lockfile

# 对 src/、build/ 及生成的入口绑定运行 TypeScript 类型检查
pnpm run typecheck

# 对 src/、build/ 与 tsdown.config.ts 运行 oxlint 代码检查
pnpm run lint

# 使用 oxfmt 格式化 src/ 下的 TypeScript 源码
pnpm run format

# 构建预编译运行时产物至 lib/ 并生成 lib/provenance.json
# （命名为 build:release 以避免 npm/Git 安装时触发 devDependencies 构建）
pnpm run build:release

# 仅在审查并接受上游输入更新后刷新溯源锁；普通构建不需要此步骤
# pnpm run upstream:refresh

# 导出源码归档（详见文末源码分发说明）
pnpm run source:release
```

---

## 仓库目录结构

```text
dsh-workspace-guard/
|-- build/
|   |-- host-identities.mjs        # 重写共享宿主身份符号 (TOOL_RUNTIME_SCHEDULER, SandboxUnavailableError)
|   |-- preserve-purge.mjs         # 应用并校验 Purge 1.6.67 补丁 #22 与 #48
|   |-- provenance.mjs             # 生成 lib/provenance.json 与 lib/THIRD_PARTY_LICENSES.txt
|   |-- source-lock.json           # 锁定的上游源码归档版本与哈希
|   |-- source-release.mjs         # 导出项目文件、锁定的上游源码与发布清单
|   |-- upstream-lock.json         # 11 个官方 @deepseek-ai/*@0.2.1-rc.5 模块的 SHA-256 锁文件
|   |-- upstream.mjs               # 选定的上游模块与入口映射
|   `-- verify-upstream.mjs        # 校验上游输入；仅显式刷新时更新溯源锁
|-- docs/
|   |-- ACCEPTANCE.md              # 0.2.0 验收测试报告、运行观察项与未验证边界说明
|   |-- acceptance-results.json    # 机器可读的验收测试矩阵结果
|   |-- CONFIGURATION-PREVIEW.yml  # 配对式 Cordis 配置变更示例
|   |-- CONFIGURATION.md           # Cordis 配置结构与 CLI 命令参考
|   |-- COVERAGE.md                # Purge 兼容性链路矩阵
|   |-- DESIGN.md                  # 架构设计与冲突根因分析
|   |-- INSTALLATION.md            # 详细安装、激活与故障恢复指南
|   `-- UPSTREAM.md                # 上游模块溯源与构建校验指南
|-- lib/                           # 预构建的 ESM 运行时产物、CLI、清单及许可证声明
|-- locale/
|   |-- en.json                    # 英文界面本地化词条
|   `-- zh.json                    # 简体中文界面本地化词条
|-- src/
|   |-- entries/                   # 10 个替换服务提供方的入口封装
|   |-- cli.ts                     # 离线 CLI 工具 (doctor, plan, activate, deactivate, rollback)
|   |-- compatibility.ts           # 所选 DSH、Purge、OPS 版本与配置组成检查
|   |-- configuration.ts           # 配对式 Cordis 配置规划、增量合并与凭证管理器
|   |-- index.ts                   # 安装信息插件 (workspace-guard-status)
|   |-- permission-bridge.ts       # 捕获根级 permissionPresets 服务
|   |-- purge-permission.ts        # 面向 dsh-purge 的隔离 permissionPresets 门面服务
|   `-- runtime-version.ts         # 运行时版本探测辅助函数
|-- cordis.patch.yml               # 默认静默的插件安装补丁（仅注册 workspace-guard-status）
|-- LICENSE                        # GNU 通用公共许可证第 3 版全文（含 GPL-3.0-or-later 声明）
|-- package.json                   # 包元数据、导出子路径与脚本定义
|-- README.md                      # 英文版说明文档 (British English)
|-- README.zh-CN.md                # 简体中文版说明文档（本文档）
|-- THIRD_PARTY_NOTICES.md         # 第三方组件归属说明与完整上游许可证文本
`-- tsdown.config.ts               # lib/ 产物的打包配置
```

---

## 详细文档索引

- [**能力覆盖矩阵 (`docs/COVERAGE.md`)**](docs/COVERAGE.md) — Workspace / Read-Only 相关链路及 Purge `1.6.67` 补丁处理策略；验收结果另见测试报告。
- [**架构与设计说明 (`docs/DESIGN.md`)**](docs/DESIGN.md) — Purge 补丁冲突根因分析、单实例 `@deepseek-ai/dsh-sandbox` 构建图设计及 Cordis 隔离域机制。
- [**安装与恢复指南 (`docs/INSTALLATION.md`)**](docs/INSTALLATION.md) — 分步安装说明、离线 CLI 激活流程、Purge 重新应用步骤及紧急回滚操作。
- [**配置参考 (`docs/CONFIGURATION.md`)**](docs/CONFIGURATION.md) 与 [**配置预览 (`docs/CONFIGURATION-PREVIEW.yml`)**](docs/CONFIGURATION-PREVIEW.yml) — 配对式 Cordis 配置与 `<profile>/.workspace-guard/receipt.json` 的结构；以实际 `plan` 输出为准。
- [**验收测试报告 (`docs/ACCEPTANCE.md`)**](docs/ACCEPTANCE.md) 与 [**测试数据 (`docs/acceptance-results.json`)**](docs/acceptance-results.json) — `0.2.0` 已记录的测试结果、ConPTY 与 `ReplaceFileW` 观察记录以及文件哈希零漂移审计。
- [**上游模块溯源 (`docs/UPSTREAM.md`)**](docs/UPSTREAM.md) — 官方 `@deepseek-ai/*@0.2.1-rc.5` 输入源码校验与构建清单说明。

---

## 开源许可与第三方声明

### 项目许可证（`GPL-3.0-or-later`）

**DSH Workspace Guard (`dsh-workspace-guard`)** 是自由软件：您可以根据自由软件基金会（Free Software Foundation）发布的 **GNU 通用公共许可证（GNU General Public License）** 条款对其进行重新分发和/或修改；适用版本为**该许可证的第 3 版，或（由您选择）任何后续版本**（`GPL-3.0-or-later`）。

根目录下的 [`LICENSE`](LICENSE) 文件包含了完整、未修改的 GNU General Public License 第 3 版正文，以及本项目明确的“第 3 版或任何后续版本（version 3 or any later version）”授权声明。

### 第三方组件与版权声明

`lib/` 目录下的预构建运行时产物集成了采用与 GPLv3 兼容的宽松许可证发布的官方 DeepSeek Harness 模块及开源运行时依赖：

| 组件分组 | 包含的包名 | 版本 | 许可证 | 版权所有者 |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek Harness 官方模块** | `@deepseek-ai/dsh-sandbox-local`、`@deepseek-ai/dsh-sandbox-policy`、`@deepseek-ai/dsh-user-approval`、`@deepseek-ai/dsh-permission-presets`、`@deepseek-ai/dsh-fs-sandbox`、`@deepseek-ai/dsh-sandbox`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-tool-bash`、`@deepseek-ai/dsh-tool-pwsh`、`@deepseek-ai/dsh-tool-fs`、`@deepseek-ai/dsh-plugin-manager`（仅 `./tools`） | `0.2.1-rc.5` | `MIT` | `Copyright (c) 2026 DeepSeek` |
| **jsdiff (`diff`)** | `diff` | `9.0.0` | `BSD-3-Clause` | `Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>` |
| **yaml** | `yaml` | `2.9.0` | `ISC` | `Copyright Eemeli Aro <eemeli@gmail.com>` |
| **Zod (`zod`)** | `zod` | `4.4.3` | `MIT` | `Copyright (c) 2025 Colin McDonnell` |

完整的上游版权声明以及未经修改的 `MIT`、`BSD-3-Clause` 和 `ISC` 许可证全文保存在以下文件中：

- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)（仓库根目录下的第三方开源许可与组件说明文档）
- [`lib/THIRD_PARTY_LICENSES.txt`](lib/THIRD_PARTY_LICENSES.txt) 与 [`lib/provenance.json`](lib/provenance.json)（随构建产物分发的许可证全文及 SHA-256 溯源清单）

### 源码分发与重建

维护者应先将维护的发布文件纳入 Git 跟踪或暂存，再运行 `pnpm source:release`。默认生成 `.local/artifacts/dsh-workspace-guard-0.2.0-source.tar.gz`，可用 `pnpm source:release --output <目录>` 指定输出目录。归档包含当前受跟踪文件在工作区中的内容，以及四个锁定的上游仓库源码归档。将此源码包与对应版本的二进制发布一同提供；接收者应获取同版本的配套源码包。

从 npm 包重建时，先将 `lib/build-lock.yaml` 还原为 `pnpm-lock.yaml`，再运行上述冻结依赖安装、检查与构建命令。DSH 上游源码依据匹配的 tag/包版本选择；这不证明能够逐字节重建 npm 产物，也未确认完整组合宿主的全部源码义务。详细来源与边界见 [THIRD_PARTY_NOTICES.md 的源码分发说明](THIRD_PARTY_NOTICES.md#source-access-and-redistribution)。
