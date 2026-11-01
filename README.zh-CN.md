# DSH Workspace Guard (`dsh-workspace-guard`)

[English](README.md) | **简体中文**

[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](package.json)
[![License: GPL v3 or later](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
[![Target DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-teal.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)](docs/COVERAGE.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.19.0-brightgreen.svg)](package.json)

**DSH Workspace Guard** 是面向 Windows 平台 **DeepSeek Harness (DSH)** 的第三方原生对等兼容插件。它能够在与 **Purge**（`dsh-purge` / `dsh-purge-community`）共存的环境中，恢复官方 **Workspace（工作区读写）** 模式（`workspace-write`）与 **Read Only（只读）** 模式（`read-only`）的选定原生提供方与工具链路，且无需修改宿主程序二进制文件、无需覆写磁盘上的宿主 `node_modules` 文件，也不会禁用 Purge 本身。

---

## 目录

- [项目目标与背景](#项目目标与背景)
- [系统架构](#系统架构)
- [兼容性要求](#兼容性要求)
- [权限模式说明](#权限模式说明)
- [功能特性与覆盖矩阵](#功能特性与覆盖矩阵)
- [安装与配置生命周期](#安装与配置生命周期)
  - [安装与自动配置](#安装与自动配置)
  - [日常使用与原生会话行为](#日常使用与原生会话行为)
  - [版本升级、停用与卸载](#版本升级停用与卸载)
  - [高级诊断与离线恢复（CLI）](#高级诊断与离线恢复cli)
- [支持的能力与拦截行为](#支持的能力与拦截行为)
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

当用户对 DSH 应用 **Purge（`1.6.67`）** 时，Purge 的补丁会修改宿主沙盒、策略、审批、权限、文件系统及内置工具模块，以跳过审批与沙盒执行；同时其运行时插件（`dsh-purge`）会在新建会话（`session.created`）时自动将会话提权为 **Full Access（完全访问）**（`danger-full-access`）。这可能导致会话被自动切回 Full Access，或缺失原生沙盒与策略保护。恢复原生提供方即可修复沙盒与策略执行，并保持正常的会话权限行为。

**DSH Workspace Guard（`0.2.1`）** 通过非侵入式架构解决了这一冲突：

- 基于官方 `@deepseek-ai/*@0.2.1-rc.5` 原包预构建自包含的替换服务提供方，恢复选定的原生沙盒、策略与审批链路，并保留其上游限制。
- 在替换的工具模块中精准保留 Purge 与沙盒无关的文件读取上限扩容（补丁 `#22`）及删除/移动提示词精简（补丁 `#48`），同时保留宿主层的其他 Purge 补丁（如禁用 Auto Review 的补丁 `#59`）。
- 通过 Cordis 服务隔离门面（facade）接管 `dsh-purge` 对 `permissionPresets` 的依赖，阻止新建会话被自动提权至 `danger-full-access`；默认模式仍遵循原生配置、环境设置及已有会话选择。
- 直接接入 DSH 插件生命周期：在插件管理器中安装或启用插件包时，会自动写入可逆的配对式 Cordis 配置项与原子归属凭证（receipt），并由 DSH 原生配置监听器（HMR）自动加载修复后的提供方；停用或卸载时自动恢复原有配置。

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

4. **配对式 Cordis 配置与事务凭证（[`src/index.ts`](src/index.ts) 与 [`src/configuration.ts`](src/configuration.ts)）**
   - 在插件管理器中安装或启用插件包会触发 `workspace-guard-lifecycle` 生命周期入口（`cordis.patch.yml`），自动将受管的配对配置写入 `<profile>/cordis.patch.yml`，并由 DSH 原生配置监听器（HMR）在下一轮序列化重载中加载修复后的提供方。停用或移除插件包会自动恢复受管变更，正常关闭宿主程序则会保留当前激活配置供下次启动使用。
   - 激活过程将受影响的原生条目设为 `disabled: true`，并插入配对的替换条目与权限门面。实际条目名称与数量也可通过 `plan` 命令预览。
   - 激活会在 `<profile>/.workspace-guard/receipt.json` 写入哈希与配置归属记录，支持移除受管变更，并通过增量合并保留无关的用户配置修改；遇到冲突会报告而非直接覆盖。可选的 CLI 命令可用于诊断与离线恢复。

---

## 兼容性要求

| 组件 / 运行环境 | 支持版本 / 要求 | 校验与执行行为 |
| :--- | :--- | :--- |
| **DeepSeek Harness (`dsh`)** | `0.2.1-rc.5` | 自动生命周期配置、生成的运行时替换入口及可选 CLI 命令（`doctor`、`plan`、`activate`）均会校验所选宿主与包版本。自动配置使用 Desktop Profile 的原生 HMR 服务。 |
| **Purge (`dsh-purge` / `dsh-purge-community`)** | `1.6.67` | 校验所选包版本；已测试隔离显式目标的 Apply/reapply，未测试全宿主维护。 |
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

下表概述 DSH Workspace Guard（`0.2.1`）涉及的能力与连接方式，并非 [`docs/COVERAGE.md`](docs/COVERAGE.md) 的逐行副本或完整验收证明。实际执行结果与未验证边界见[验收测试报告](docs/ACCEPTANCE.md)：

| # | 能力链路 | 上游官方包 (`0.2.1-rc.5`) | 插件导出子路径 | `0.2.1` 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **权限预设服务**（`read-only`、`workspace-write`、`danger-full-access`） | `@deepseek-ai/dsh-permission-presets` | `dsh-workspace-guard/permission` | 已恢复（遵循原生默认与显式选择） |
| 2 | **Purge 会话权限隔离**（`permissionPresets` 隔离门面） | `@deepseek-ai/dsh-permission-presets` + `dsh-purge@1.6.67` | `dsh-workspace-guard/permission-bridge`、`dsh-workspace-guard/purge-permission` | 已启用（阻止 Purge 自动提权至 Full Access） |
| 3 | **文件系统策略与提供方**（`fs`、`policy`、写入路径与真实路径检查） | `@deepseek-ai/dsh-fs-sandbox`、`@deepseek-ai/dsh-sandbox-policy` | `dsh-workspace-guard/fs`、`dsh-workspace-guard/policy` | 已恢复 |
| 4 | **命令策略与审批引擎**（`policy`、`approval`、失败后提权审批） | `@deepseek-ai/dsh-sandbox-policy`、`@deepseek-ai/dsh-user-approval` | `dsh-workspace-guard/policy`、`dsh-workspace-guard/approval` | 已恢复 |
| 5 | **原生 Windows ACL 沙盒**（`sandbox`、`@deepseek-ai/dsh-sandbox-windows-acl`） | `@deepseek-ai/dsh-sandbox-local` | `dsh-workspace-guard/sandbox` | 已恢复（依赖宿主 Windows ACL 原生扩展） |
| 6 | **内置文件工具**（`read`、`read_image`、`write`、`edit`） | `@deepseek-ai/dsh-tool-fs` | `dsh-workspace-guard/tool-fs` | 已恢复 + 保留 Purge 补丁 `#22` |
| 7 | **PowerShell 工具（`pwsh`）**（单次执行、后台任务、持久终端链路） | `@deepseek-ai/dsh-tool-pwsh` | `dsh-workspace-guard/tool-pwsh` | 已恢复 + 保留 Purge 补丁 `#48`（ConPTY 测试用例启动失败尚未解决，详见[验收报告](docs/ACCEPTANCE.md)） |
| 8 | **Bash 工具（`bash`）** | `@deepseek-ai/dsh-tool-bash` | `dsh-workspace-guard/tool-bash` | 已恢复 + 保留 Purge 补丁 `#48` |
| 9 | **工具运行时与 Python `run_code`（`preset-ptc`）** | `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-sandbox` | `dsh-workspace-guard/tools` | 已恢复（共享宿主 `TOOL_RUNTIME_SCHEDULER`） |
| 10 | **智能体预设**（`preset-standard`、`preset-ptc`、`preset-minimal`、`preset-cordis`） | 宿主预设配置 | `cordis.patch.yml` 配对嵌套条目 | 全部 4 个预设已完成重连 |
| 11 | **子智能体（Subagent）与后台任务继承** | 宿主子智能体与后台任务服务 | 根级 `sandbox`、`policy`、`approval`、`fs`、`permission` | 已验证适配器分派及后台任务执行；完整子智能体生命周期未验证 |
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

通过 DSH 插件管理器安装并启用 `dsh-workspace-guard` 即完成全部设置流程：

- **安装 / 启用时自动配置**：DSH 插件管理器默认启用已安装的插件包。插件的生命周期入口（`workspace-guard-lifecycle`）会自动校验受支持的宿主与 Purge 版本，将受管的配对配置写入 `<profile>/cordis.patch.yml` 与 `<profile>/.workspace-guard/receipt.json`，并由 DSH 原生配置监听器（HMR）自动加载修复后的原生提供方。
- **停用 / 卸载时自动恢复**：在 DSH 插件管理器中停用或卸载本插件时，生命周期释放钩子会通过同一受管事务自动恢复原有的原生提供方并移除 Purge 隔离域，随后由 DSH 重载恢复后的配置。日常正常关闭 DSH 会保留当前激活的配置供下次启动使用。
- **可选的 CLI 诊断与离线恢复**：`doctor`、`plan`、`activate`、`deactivate` 与 `rollback` 命令作为可选的诊断与离线恢复工具提供（详见[高级诊断与离线恢复（CLI）](#高级诊断与离线恢复cli)）。

### 安装与自动配置

#### 首选方式（推荐）：通过 DSH 插件安装界面从官方 npm 源安装

1. 打开 **DeepSeek Harness (DSH)**，进入 **插件（Plugins）** 安装界面（**安装插件 / Install Plugin** 包来源输入框）。
2. 输入官方 npm 仓库中的包名进行安装：
   - **安装最新版本**：
     ```text
     dsh-workspace-guard
     ```
   - **安装固定版本（对应当前 `package.json` 元数据版本 `0.2.1`）**：
     ```text
     dsh-workspace-guard@0.2.1
     ```
3. 保持 **`dsh-workspace-guard`** 处于启用状态（DSH 插件管理器默认启用）。插件会自动保存配置变更，并由 DSH 的 Profile 配置监听器自动加载修复后的提供方。

> **说明**：发布的 npm 包内已包含预构建的 `lib/` 产物，且维护者构建脚本命名为 `build:release`（而非 `build` 或 `prepare`），因此安装无需编译或运行构建脚本。`diff`、`yaml`、`zod` 来自构建依赖并已打包；共享的宿主 peer 依赖仍由宿主提供。自动配置使用 Desktop Profile 的原生 HMR 服务。

#### 备选方式：从 Git 源码仓库安装

如果需要直接从包含预构建 `lib/` 目录的 Git 仓库 URL 或本地 Git 检出目录安装：

1. 在 DSH 插件安装界面（或 `<profile>/package.json`）中指定 Git 来源：
   ```text
   git+https://github.com/cleverpigeb/dsh-workspace-guard.git#v0.2.1
   ```
2. 确认插件在目标 Profile 中处于启用状态，DSH 将自动完成配置并重载修复后的提供方。

---

### 日常使用与原生会话行为

- **新建会话默认模式**：抑制 `dsh-purge` 的自动 Full Access 提权，保留原生默认（通常为 `workspace-write`）、显式配置与环境设置；已有会话的选择不被重设。
- **原生聊天会话与预设重载行为**：
  - **新建聊天会话**：自动重载完成后，新建的聊天会立即使用更新后的工具预设（preset）。
  - **已有智能体及其子任务**：DSH 按智能体保留预设版本，已运行的智能体及其派生的子智能体会继续使用早先的预设版本直至其作用域结束；重新打开仍处于活动状态的标签页会复用当前智能体。
  - **刷新已有会话**：真正的冷恢复（cold resume）会挂载当前最新预设版本；也可以在手头任务结束后正常重启 DSH，以刷新所有存续会话。
- **手动切换权限模式**：可随时通过 DSH 界面上的会话权限选择器，在 **Read Only**（`read-only`）、**Workspace**（`workspace-write`）与 **Full Access**（`danger-full-access`）之间自由切换。
- **重新运行 Purge（`Apply` 或 `dsh-purge --reapply`）后**：隔离的显式目标测试中，独立的预构建提供方与 `cordis.patch.yml` 配置选择继续生效。其他目标、版本与全宿主维护未验证。

---

### 版本升级、停用与卸载

日常升级、启用、停用与卸载均可直接通过 **DSH 插件管理器** 完成：

- **版本升级**：在 DSH 插件管理器中更新至 `dsh-workspace-guard@0.2.1`。自动配置具有幂等性，会直接复用已有的有效配置（包括已激活的 `0.2.0` v2 凭证；若原先安装了未激活的 `0.2.0` 插件包，升级后将自动完成配置）。升级后如需刷新已打开的活动聊天标签页，请在手头工作完成后正常重启 DSH。
- **正常关闭程序**：日常关闭 DSH 会保留 `<profile>/cordis.patch.yml` 中的激活配置，供下次启动直接使用。
- **停用与卸载**：在 DSH 插件管理器中停用或卸载插件包时，会自动恢复原有的原生提供方并移除 Purge 隔离域配置。恢复原有提供方后，也会恢复其与 Purge 原有的交互行为。
- **配置归属与冲突处理**：
  - 正常移除会保留后续对 `<profile>/cordis.patch.yml` 中无关条目的编辑，将受管工具条目的配置修改迁回原生提供方，并在受管标识发生冲突时报告冲突而非强制覆盖。
  - 在 DSH `0.2.1-rc.5` 中，如果因手动修改受管标识导致卸载清理阶段报告冲突，宿主会记录释放错误并继续完成插件包移除，同时保留 `<profile>/cordis.patch.yml` 与 `<profile>/.workspace-guard/receipt.json` 以供恢复。遇到此情况时，请先排查报告的冲突项，再参照下方[高级诊断与离线恢复（CLI）](#高级诊断与离线恢复cli)执行恢复。

---

### 高级诊断与离线恢复（CLI）

CLI 命令（`doctor`、`plan`、`activate`、`deactivate`、`rollback`）作为可选的诊断与离线恢复工具提供。各命令默认仅作只读预览；离线写入操作需显式指定 `--profile` 目录，并在使用该 Profile 的所有 DSH 进程完全停止时传入 `--apply --host-stopped`。

在 PowerShell 中设置目标 Profile 与宿主模块路径变量（以下为已检查的 Windows Desktop 路径示例）：

```powershell
$ProfileDir  = "$env:USERPROFILE\.dsh\profiles\desktop"
$DshHome     = "$env:USERPROFILE\.dsh"
$HostModules = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app\dsh\node_modules"
$Cli         = "$ProfileDir\node_modules\dsh-workspace-guard\lib\cli.js"
```

*（插件包移除后，请将 `$Cli` 指向下载的同版本 `dsh-workspace-guard@0.2.1` 包或源码目录中的 `lib\cli.js`，然后直接执行第 4 项恢复。第 1–3 项用于检查或配置已安装且被选中的插件包。）*

1. **检查版本兼容性与受管配置状态（`doctor`）**：
   ```powershell
   node $Cli doctor --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
2. **空跑预览配置变更（`plan`）**：
   ```powershell
   node $Cli plan --profile $ProfileDir --home $DshHome --host-modules $HostModules
   ```
3. **离线激活或修复配置（`activate`）**：
   在确认所有 DSH 进程已停止后执行：
   ```powershell
   node $Cli activate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
4. **离线停用或卸载冲突后的恢复（`deactivate` / `rollback`）**：
   在确认所有 DSH 进程已停止后执行，依据有效凭证恢复原生提供方并保留无关修改（即使插件包已被取消勾选或移除也同样适用）：
   ```powershell
   node $Cli deactivate --profile $ProfileDir --home $DshHome --host-modules $HostModules --apply --host-stopped
   ```
   *（也可使用带相同参数的 `rollback` 命令，在凭证中记录 `"status": "rolled-back"`。）*

需要持续停用时，请在 DSH 插件管理器中停用或取消勾选该插件包。保持启用的插件包会在下次启动时重新应用配置。

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
|   |-- ACCEPTANCE.md              # 0.2.1 验收测试报告、运行观察项与未验证边界说明
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
|   |-- cli.ts                     # 可选离线诊断与恢复 CLI (doctor, plan, activate, deactivate, rollback)
|   |-- compatibility.ts           # 所选 DSH、Purge 版本与配置组成检查
|   |-- configuration.ts           # 配对式 Cordis 配置规划、增量合并与凭证管理器
|   |-- index.ts                   # 自动配置生命周期插件 (workspace-guard-lifecycle)
|   |-- permission-bridge.ts       # 捕获根级 permissionPresets 服务
|   |-- purge-permission.ts        # 面向 dsh-purge 的隔离 permissionPresets 门面服务
|   `-- runtime-version.ts         # 运行时版本探测辅助函数
|-- cordis.patch.yml               # 插件包生命周期补丁（注册 workspace-guard-status）
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
- [**安装与恢复指南 (`docs/INSTALLATION.md`)**](docs/INSTALLATION.md) — 自动安装与还原流程、聊天会话行为说明、Purge 重新应用步骤及可选的离线 CLI 恢复指南。
- [**配置参考 (`docs/CONFIGURATION.md`)**](docs/CONFIGURATION.md) 与 [**配置预览 (`docs/CONFIGURATION-PREVIEW.yml`)**](docs/CONFIGURATION-PREVIEW.yml) — 配对式 Cordis 配置与 `<profile>/.workspace-guard/receipt.json` 的结构；以实际 `plan` 输出为准。
- [**验收测试报告 (`docs/ACCEPTANCE.md`)**](docs/ACCEPTANCE.md) 与 [**测试数据 (`docs/acceptance-results.json`)**](docs/acceptance-results.json) — `0.2.1` 自动生命周期验收记录、`0.2.0` 运行时基线结果、ConPTY 与 `ReplaceFileW` 观察记录以及文件哈希零漂移审计。
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

维护者应先将维护的发布文件纳入 Git 跟踪或暂存，再运行 `pnpm source:release`。默认生成 `.local/artifacts/dsh-workspace-guard-0.2.1-source.tar.gz`，可用 `pnpm source:release --output <目录>` 指定输出目录。归档包含当前受跟踪文件在工作区中的内容，以及四个锁定的上游仓库源码归档。将此源码包与对应版本的二进制发布一同提供；接收者应获取同版本的配套源码包。

从 npm 包重建时，先将 `lib/build-lock.yaml` 还原为 `pnpm-lock.yaml`，再运行上述冻结依赖安装、检查与构建命令。DSH 上游源码依据匹配的 tag/包版本选择；这不证明能够逐字节重建 npm 产物，也未确认完整组合宿主的全部源码义务。详细来源与边界见 [THIRD_PARTY_NOTICES.md 的源码分发说明](THIRD_PARTY_NOTICES.md#source-access-and-redistribution)。
