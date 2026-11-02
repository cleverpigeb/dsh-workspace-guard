// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
/** Minimum installed versions; exact generated build inputs are locked separately. */
export const SUPPORTED = {
  dsh: "0.2.1-rc.1",
  purge: "1.1.70",
  guard: "0.2.1",
} as const;
function semanticVersion(value: string | undefined) {
  if (typeof value !== "string" || value.length > 256) return undefined;
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      value,
    );
  if (!match || match[0] !== value) return undefined;
  const core = match.slice(1, 4).map(Number),
    prerelease = match[4]?.split(".") ?? [];
  if (!core.every(Number.isSafeInteger) || prerelease.some((id) => /^0\d+$/.test(id)))
    return undefined;
  return { core, prerelease };
}
/** SemVer minimum only, including prereleases as native DSH does; never an upper bound. */
export function atLeastVersion(version: string | undefined, minimum: string): boolean {
  const actual = semanticVersion(version),
    floor = semanticVersion(minimum);
  if (!actual || !floor) return false;
  for (let i = 0; i < 3; i++)
    if (actual.core[i] !== floor.core[i]) return actual.core[i] > floor.core[i];
  if (!actual.prerelease.length) return true;
  if (!floor.prerelease.length) return false;
  for (let i = 0; i < Math.min(actual.prerelease.length, floor.prerelease.length); i++) {
    const left = actual.prerelease[i],
      right = floor.prerelease[i];
    if (left === right) continue;
    const leftNumeric = /^\d+$/.test(left),
      rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) return BigInt(left) > BigInt(right);
    if (leftNumeric !== rightNumeric) return rightNumeric;
    return left > right;
  }
  return actual.prerelease.length >= floor.prerelease.length;
}
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
  if (expected && (manifest.name !== name || !atLeastVersion(manifest.version, expected)))
    throw new Error(
      `Unsupported bundle ${name}: requires >=${expected}, found ${String(manifest.version)}. Configuration activation was refused.`,
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
  if (
    !dsh ||
    dsh.name !== "@deepseek-ai/dsh-app-boot" ||
    !atLeastVersion(dsh.version, SUPPORTED.dsh)
  )
    throw new Error(
      `Unsupported DSH runtime: requires >=${SUPPORTED.dsh}, found ${dsh?.version ?? "unresolved"}.`,
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
