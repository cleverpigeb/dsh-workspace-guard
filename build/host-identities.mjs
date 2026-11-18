// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { pipelineSharedFile } from "./upstream.mjs";
import { sha256 } from "./verify-upstream.mjs";

const modules = [
  {
    specifier: "@deepseek-ai/dsh-sandbox",
    file: "lib/index.js",
    alias: "workspace-guard:host-sandbox",
    classes: ["SandboxEscalationError", "SandboxInvalidRootError", "SandboxPreparationError", "SandboxUnavailableError", "SandboxProvider"],
  },
  {
    specifier: "@deepseek-ai/dsh-tools",
    file: pipelineSharedFile,
    alias: "workspace-guard:host-tools",
    classes: ["JsonSchemaError", "ToolActivationError", "ToolBatchExecutionError", "ToolContextUnavailableError", "ToolExecutorUnavailableError", "ToolNotFoundError", "ToolOutputError"],
  },
];
export const hostIdentityImports = modules.map(module => module.alias);

/** The host agent loop and native workers catch the same constructors Guard's providers use. */
export function hostIdentities() {
  const records = new Map();
  return {
    name: "native-host-identities",
    resolveId(source) {
      const module = modules.find(module => module.alias === source);
      if (module) return { id: module.specifier, external: true };
    },
    transform(code, id) {
      const path = id.replaceAll("\\", "/");
      const module = modules.find(module => path.endsWith(`/node_modules/${module.specifier}/${module.file}`));
      if (!module) return;
      let changed = code;
      for (const name of module.classes) {
        const definition = new RegExp(`^var ${name} = class extends [\\w$]+ \\{[\\s\\S]*?^\\};$`, "gm");
        if ([...code.matchAll(definition)].length !== 1) throw new Error(`Native class declaration changed: ${module.specifier}.${name}`);
        changed = changed.replace(definition, "");
      }
      changed = `import { ${module.classes.join(", ")} } from "${module.alias}";\n${changed}`;
      records.set(module.specifier, { specifier: module.specifier, file: module.file, exports: module.classes,
        sourceSha256: sha256(code), transformedSha256: sha256(changed) });
      return { code: changed, map: null };
    },
    generateBundle() {
      if (records.size !== modules.length) throw new Error("Native sandbox and tool identities were not both linked to the host");
      const ordered = modules.map(module => records.get(module.specifier));
      this.emitFile({ type: "asset", fileName: "host-identities.json", source: JSON.stringify(ordered, null, 2) + "\n" });
    },
  };
}
