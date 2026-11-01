// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

export const upstreamVersion = "0.2.1-rc.5";

export const entries = {
  sandbox: "@deepseek-ai/dsh-sandbox-local",
  policy: "@deepseek-ai/dsh-sandbox-policy",
  approval: "@deepseek-ai/dsh-user-approval",
  permission: "@deepseek-ai/dsh-permission-presets",
  fs: "@deepseek-ai/dsh-fs-sandbox",
  tools: "@deepseek-ai/dsh-tools",
  "tool-bash": "@deepseek-ai/dsh-tool-bash",
  "tool-pwsh": "@deepseek-ai/dsh-tool-pwsh",
  "tool-fs": "@deepseek-ai/dsh-tool-fs",
  "plugin-tools": "@deepseek-ai/dsh-plugin-manager/tools",
};

export const selectedModules = [...Object.values(entries), "@deepseek-ai/dsh-sandbox", "@deepseek-ai/dsh-atomic-write"];
export const packageName = (id) => id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0];
export const selectedPackages = [...new Set(selectedModules.map(packageName))];
export const standalonePackages = ["diff", "yaml", "zod"];
