// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { dirname, join, resolve } from "node:path";
import { synchronizeInstalledConfiguration } from "./configuration.js";

export const name = "workspace-guard-lifecycle";
export const inject = ["profileContext", "hmr"];

/** Installing/enabling the bundle owns configuration; DSH owns provider reloads. */
export async function apply(ctx: any): Promise<void> {
  const profile = ctx.get("profileContext");
  if (!profile || !ctx.get("hmr"))
    throw new Error("Automatic Workspace Guard activation requires a DSH profile with HMR.");
  if (resolve(profile.patchPath) !== resolve(profile.dir, "cordis.patch.yml"))
    throw new Error("Unsupported profile patch location for automatic Workspace Guard activation.");
  const options = {
    profile: profile.dir,
    home: profile.home,
    hostModules: join(dirname(profile.installAnchor), "node_modules"),
    overlays: profile.overlays,
  };
  ctx.effect(() => async () => {
    const removal = await synchronizeInstalledConfiguration(options, "dispose");
    if (removal?.changed)
      ctx.logger.info("Workspace Guard configuration removed; DSH is restoring its providers.");
  });
  let plan;
  try {
    plan = await synchronizeInstalledConfiguration(options, "load");
    // The Loader starts replacement rows concurrently with disabling their
    // originals. Release the affected live entries before HMR starts that
    // pass, so the new instances can register the same root services.
    if (plan?.changed) {
      const tree = ctx.fiber?.entry?.parent.tree;
      for (const { kind, installed } of plan.receipt.owned) {
        if (kind !== "disable") continue;
        const entry = tree?.store[installed.id];
        if (entry?.options.name === installed.name && !entry.disabled)
          await entry.update({ disabled: true });
      }
    }
  } catch (error) {
    // Cordis clears failed-initialization effects. A later uninstall would have
    // no cleanup callback, so restore valid owned state before reporting failure.
    try {
      const restoration = await synchronizeInstalledConfiguration(options, "failed-load");
      if (restoration?.changed)
        ctx.logger.warn(
          "Workspace Guard activation failed; its previous configuration was restored.",
        );
    } catch (recoveryError) {
      throw new AggregateError(
        [error, recoveryError],
        "Workspace Guard activation failed and configuration restoration also failed. Keep the package installed and resolve the reported errors before removal; the patch and receipt are retained for offline recovery.",
        { cause: error },
      );
    }
    throw error;
  }
  if (!plan) return;
  ctx.logger.info(
    plan.changed
      ? "Workspace Guard configured automatically; DSH is loading the repaired providers."
      : "Workspace Guard configuration is ready.",
  );
  // HMR already watches this profile's patch file. Its watcher schedules the
  // next serialized reconciliation outside the current installation transaction.
  // Calling HMR here (even from a timer) would nest its transaction context.
}
