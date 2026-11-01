/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// src/compatibility.ts
/** Native generated implementations are build inputs; installed host source is never patched. */
const SUPPORTED = {
	dsh: "0.2.1-rc.5",
	purge: "1.6.67",
	ops: "0.4.4",
	guard: "0.2.1"
};
function validateBundleVersion(name, manifest) {
	const expected = name === "dsh-workspace-guard" ? SUPPORTED.guard : name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-") ? SUPPORTED.dsh : ["dsh-purge", "dsh-purge-community"].includes(name) ? SUPPORTED.purge : name === "dsh-ops" ? SUPPORTED.ops : void 0;
	if (expected && (manifest.name !== name || manifest.version !== expected)) throw new Error(`Unsupported bundle ${name}: expected ${expected}, found ${String(manifest.version)}. No configuration changes were made.`);
	if (/^dsh-purge(?:-|$)/.test(name) && !["dsh-purge", "dsh-purge-community"].includes(name) || /^dsh-ops(?:-|$)/.test(name) && name !== "dsh-ops") throw new Error(`Unsupported affected consumer variant: ${name}.`);
}
function manifestOf(name, parentURL = import.meta.url) {
	const resolver = createRequire(parentURL);
	let path;
	if (parentURL === import.meta.url) try {
		path = fileURLToPath(import.meta.resolve(`${name}/package.json`));
	} catch {}
	if (!path) for (const root of resolver.resolve.paths(name) ?? []) {
		const candidate = join(root, name, "package.json");
		if (existsSync(candidate)) {
			path = candidate;
			break;
		}
	}
	if (!path) return void 0;
	return JSON.parse(readFileSync(path, "utf8"));
}
let checked = false;
/** Runs before native entry registration; no tool hooks, source hashes or policy changes. */
function assertNativeRuntimeCompatibility() {
	if (checked) return;
	const dsh = manifestOf("@deepseek-ai/dsh-app-boot");
	if (!dsh || dsh.name !== "@deepseek-ai/dsh-app-boot" || dsh.version !== SUPPORTED.dsh) throw new Error(`Unsupported DSH runtime: expected ${SUPPORTED.dsh}, found ${dsh?.version ?? "unresolved"}.`);
	const ops = manifestOf("dsh-ops");
	if (ops) validateBundleVersion("dsh-ops", ops);
	checked = true;
}
/** Only the consumer actually selected in this Loader tree determines Purge compatibility. */
function assertSelectedPurgeCompatibility(ctx) {
	const tree = ctx.fiber?.entry?.parent?.tree;
	if (!tree) return;
	const entry = tree.store?.["dsh-purge"];
	if (!entry) return;
	const name = entry.options?.name;
	if (!["dsh-purge-community", "dsh-purge"].includes(name)) throw new Error(`Unsupported selected Purge consumer: ${String(name)}.`);
	const base = tree.ctx?.baseUrl ?? ctx.baseUrl;
	const manifest = manifestOf(name, base ? new URL("__workspace_guard_version.cjs", base).href : import.meta.url);
	if (!manifest) throw new Error(`Cannot resolve selected Purge consumer: ${name}.`);
	validateBundleVersion(name, manifest);
}
export { assertSelectedPurgeCompatibility as n, validateBundleVersion as r, assertNativeRuntimeCompatibility as t };
