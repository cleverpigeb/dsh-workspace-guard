/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import { i as synchronizeInstalledConfiguration } from "./configuration-B8H4Cvbs.js";
import { dirname, join, resolve } from "node:path";
// src/index.ts
const name = "workspace-guard-lifecycle";
const inject = ["profileContext", "hmr"];
/** Installing/enabling the bundle owns configuration; DSH owns provider reloads. */
async function apply(ctx) {
	const profile = ctx.get("profileContext");
	if (!profile || !ctx.get("hmr")) throw new Error("Automatic Workspace Guard activation requires a DSH profile with HMR.");
	if (resolve(profile.patchPath) !== resolve(profile.dir, "cordis.patch.yml")) throw new Error("Unsupported profile patch location for automatic Workspace Guard activation.");
	const options = {
		profile: profile.dir,
		home: profile.home,
		hostModules: join(dirname(profile.installAnchor), "node_modules"),
		overlays: profile.overlays
	};
	ctx.effect(() => async () => {
		if ((await synchronizeInstalledConfiguration(options, "dispose"))?.changed) ctx.logger.info("Workspace Guard configuration removed; DSH is restoring its providers.");
	});
	let plan;
	try {
		plan = await synchronizeInstalledConfiguration(options, "load");
		if (plan?.changed) {
			const tree = ctx.fiber?.entry?.parent.tree;
			for (const { kind, installed } of plan.receipt.owned) {
				if (kind !== "disable") continue;
				const entry = tree?.store[installed.id];
				if (entry?.options.name === installed.name && !entry.disabled) await entry.update({ disabled: true });
			}
		}
	} catch (error) {
		try {
			if ((await synchronizeInstalledConfiguration(options, "failed-load"))?.changed) ctx.logger.warn("Workspace Guard activation failed; its previous configuration was restored.");
		} catch (recoveryError) {
			throw new AggregateError([error, recoveryError], "Workspace Guard activation failed and configuration restoration also failed. Keep the package installed and resolve the reported errors before removal; the patch and receipt are retained for offline recovery.", { cause: error });
		}
		throw error;
	}
	if (!plan) return;
	ctx.logger.info(plan.changed ? "Workspace Guard configured automatically; DSH is loading the repaired providers." : "Workspace Guard configuration is ready.");
}
export { apply, inject, name };
