// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
/** Native generated implementations are build inputs; installed host source is never patched. */
export const SUPPORTED = {
  dsh: "0.2.1-rc.5",
  purge: "1.6.67",
  guard: "1.0.0",
} as const;
export function validateBundleVersion(
  name: string,
  manifest: { name?: string; version?: string },
): void {
  const expected =
    name === "@cleverpig/dsh-workspace-guard"
      ? SUPPORTED.guard
      : name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-")
        ? SUPPORTED.dsh
        : ["dsh-purge", "dsh-purge-community"].includes(name)
          ? SUPPORTED.purge
          : undefined;
  if (expected && (manifest.name !== name || manifest.version !== expected))
    throw new Error(
      `Unsupported bundle ${name}: expected ${expected}, found ${String(manifest.version)}. No configuration changes were made.`,
    );
  if (/^dsh-purge(?:-|$)/.test(name) && !["dsh-purge", "dsh-purge-community"].includes(name))
    throw new Error(`Unsupported affected consumer variant: ${name}.`);
}
function manifestOf(
  name: string,
  parentURL = import.meta.url,
): { name?: string; version?: string } | undefined {
  const resolver = createRequire(parentURL);
  let path: string | undefined;
  if (parentURL === import.meta.url) {
    try {
      path = fileURLToPath(import.meta.resolve(`${name}/package.json`));
    } catch {
      /* filesystem metadata need not be exported */
    }
  }
  if (!path)
    for (const root of resolver.resolve.paths(name) ?? []) {
      const candidate = join(root, name, "package.json");
      if (existsSync(candidate)) {
        path = candidate;
        break;
      }
    }
  if (!path) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}
let checked = false;
/** Runs before native entry registration; no tool hooks, source hashes or policy changes. */
export function assertNativeRuntimeCompatibility(): void {
  if (checked) return;
  const dsh = manifestOf("@deepseek-ai/dsh-app-boot");
  if (!dsh || dsh.name !== "@deepseek-ai/dsh-app-boot" || dsh.version !== SUPPORTED.dsh)
    throw new Error(
      `Unsupported DSH runtime: expected ${SUPPORTED.dsh}, found ${dsh?.version ?? "unresolved"}.`,
    );
  checked = true;
}
/** Only the consumer actually selected in this Loader tree determines Purge compatibility. */
export function assertSelectedPurgeCompatibility(ctx: any): void {
  const tree = ctx.fiber?.entry?.parent?.tree;
  if (!tree) return; // Direct synthetic Context tests have no configured consumer.
  const entry = tree.store?.["dsh-purge"];
  if (!entry) return;
  const name = entry.options?.name;
  if (!["dsh-purge-community", "dsh-purge"].includes(name))
    throw new Error(`Unsupported selected Purge consumer: ${String(name)}.`);
  const base = tree.ctx?.baseUrl ?? ctx.baseUrl;
  const parentURL = base ? new URL("__workspace_guard_version.cjs", base).href : import.meta.url;
  const manifest = manifestOf(name, parentURL);
  if (!manifest) throw new Error(`Cannot resolve selected Purge consumer: ${name}.`);
  validateBundleVersion(name, manifest);
}
