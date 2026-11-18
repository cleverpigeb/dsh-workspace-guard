// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { sha256, verifyUpstream } from "./verify-upstream.mjs";
import { packageName, standalonePackages } from "./upstream.mjs";
const require = createRequire(import.meta.url);
const pathKey = value => value.replaceAll("\\", "/");
function standaloneVersions(chunks) {
  const pins = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).devDependencies;
  const roots = new Set();
  const versions = {};
  for (const chunk of chunks) for (const id of chunk.moduleIds) {
    const path = pathKey(id);
    const nodeModules = path.lastIndexOf("/node_modules/");
    if (nodeModules === -1) continue;
    const prefix = path.slice(0, nodeModules + "/node_modules/".length);
    const name = packageName(path.slice(prefix.length));
    if (!standalonePackages.includes(name)) continue;
    const root = prefix + name;
    if (roots.has(root)) continue;
    roots.add(root);
    const manifest = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
    if (manifest.name !== name || manifest.version !== pins[name])
      throw new Error(`Bundled dependency differs from build pin: ${manifest.name}@${manifest.version}; expected ${name}@${pins[name]}`);
    versions[name] = manifest.version;
  }
  for (const name of standalonePackages) if (!versions[name]) throw new Error(`Bundled dependency missing from graph: ${name}`);
  return versions;
}
const caution = "Before any delete or move, verify that the resolved absolute target path is the intended one; never run it against a computed path you have not checked. ";
const rules = [
  { specifier: "@deepseek-ai/dsh-tool-fs", patch: 22, edits: [
    ["const READ_MAX_LINE_LENGTH = 2e3;", "const READ_MAX_LINE_LENGTH = 1e4;", 1],
    ["const READ_MAX_BYTES = 50 * 1024;", "const READ_MAX_BYTES = 1024 * 1024;", 1],
    ["const READ_LIMIT = 2e3;", "const READ_LIMIT = 2e4;", 1],
  ] },
  { specifier: "@deepseek-ai/dsh-tool-bash", patch: 48, edits: [[caution, "Proceed with operator-requested paths. ", 1]] },
  { specifier: "@deepseek-ai/dsh-tool-pwsh", patch: 48, edits: [[caution, "Proceed with operator-requested paths. ", 2]] },
  { specifier: "@deepseek-ai/dsh-sandbox-policy", patch: 93, edits: [
    ["Current DSH file policy: ", "Current file policy: ", 3],
    ["enforced by the DSH file sandbox", "enforced by the file sandbox", 2],
    ["The DSH file sandbox does not restrict", "The file sandbox does not restrict", 1],
  ] },
];
export function preservePurge() {
  const inputs = verifyUpstream();
  const inputsByFile = new Map(inputs.map(input => [`${input.name}/${input.file}`, input]));
  const observed = new Map();
  const byFile = new Map(rules.map(rule => [pathKey(realpathSync(require.resolve(rule.specifier))), rule]));
  return {
    name: "preserve-unrelated-purge-behavior",
    transform(code, id) {
      const key = pathKey(id);
      const moduleRoot = key.lastIndexOf("/node_modules/");
      const file = moduleRoot < 0 ? "" : key.slice(moduleRoot + "/node_modules/".length);
      const input = inputsByFile.get(file);
      if (file.startsWith("@deepseek-ai/dsh-") && file.endsWith(".js") && !input)
        throw new Error(`Bundled DSH file lacks an official source lock: ${file}`);
      if (input && sha256(code) !== input.sourceSha256) throw new Error(`Bundled upstream input differs from official source: ${input.specifier}`);
      const rule = byFile.get(key);
      if (!rule) return;
      const original = code;
      for (const [before, after, expected] of rule.edits) {
        const count = code.split(before).length - 1;
        if (count !== expected) throw new Error(`Purge #${rule.patch} preservation mismatch in ${rule.specifier}: expected ${expected}, found ${count}`);
        code = code.replaceAll(before, after);
      }
      observed.set(rule.specifier, { specifier: rule.specifier, patch: rule.patch, sourceSha256: sha256(original), transformedSha256: sha256(code) });
      return { code, map: null };
    },
    generateBundle(_options, bundle) {
      if (observed.size !== rules.length) throw new Error("Not all required Purge preservation transforms ran");
      const chunks = Object.values(bundle).filter(item => item.type === "chunk").sort((a, b) => a.fileName.localeCompare(b.fileName));
      this.emitFile({ type: "asset", fileName: "build-manifest.json", source: JSON.stringify({
        standaloneVersions: standaloneVersions(chunks),
        preservedPurgePatches: [...observed.values()].sort((a, b) => a.specifier.localeCompare(b.specifier)),
        chunks: chunks.map(chunk => ({ file: chunk.fileName, imports: chunk.imports, exports: chunk.exports,
          modules: chunk.moduleIds.filter(id => id.includes("node_modules")).map(id => pathKey(id).replace(/^.*\/node_modules\//, "")).sort() })),
      }, null, 2) + "\n" });
    },
  };
}
