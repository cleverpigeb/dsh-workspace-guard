// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { sha256 } from "./verify-upstream.mjs";

const external = {
  "workspace-guard:host-tools": "@deepseek-ai/dsh-tools",
  "workspace-guard:host-sandbox": "@deepseek-ai/dsh-sandbox",
};
export const hostIdentityImports = Object.keys(external);

/** Keep identity-sensitive ABI exports shared with unmodified host consumers. */
export function hostIdentities() {
  const changes = new Map();
  return {
    name: "native-host-identities",
    resolveId(source) {
      if (Object.hasOwn(external, source)) return { id: external[source], external: true };
    },
    transform(code, id) {
      const path = id.replaceAll("\\", "/");
      let specifier, exported, before, after;
      if (path.endsWith("/node_modules/@deepseek-ai/dsh-tools/lib/index.js")) {
        specifier = "@deepseek-ai/dsh-tools";
        exported = "TOOL_RUNTIME_SCHEDULER";
        before = 'const TOOL_RUNTIME_SCHEDULER = Symbol("@deepseek-ai/dsh-tools.scheduler");';
        after = 'import { TOOL_RUNTIME_SCHEDULER } from "workspace-guard:host-tools";';
      } else if (path.endsWith("/node_modules/@deepseek-ai/dsh-sandbox/lib/index.js")) {
        specifier = "@deepseek-ai/dsh-sandbox";
        exported = "SandboxUnavailableError";
        const start = 'var SandboxUnavailableError = class extends HarnessError {';
        const end = '\n/**\n* Abstract process-sandbox service.';
        if (code.split(start).length !== 2 || code.split(end).length !== 2) throw new Error("Sandbox error class boundary changed");
        before = code.slice(code.indexOf(start), code.indexOf(end));
        if (!before.endsWith('};')) throw new Error("Sandbox error class terminator changed");
        after = 'import { SandboxUnavailableError } from "workspace-guard:host-sandbox";';
      } else return;
      if (code.split(before).length !== 2) throw new Error(`Native identity declaration changed: ${specifier}.${exported}`);
      const changed = code.replace(before, after);
      changes.set(specifier, { specifier, exported, sourceSha256: sha256(code), transformedSha256: sha256(changed) });
      return { code: changed, map: null };
    },
    generateBundle() {
      if (changes.size !== 2) throw new Error("Native identity transforms did not cover both ABI exports");
      this.emitFile({ type: "asset", fileName: "host-identities.json",
        source: JSON.stringify([...changes.values()].sort((a, b) => a.specifier.localeCompare(b.specifier)), null, 2) + "\n" });
    },
  };
}
