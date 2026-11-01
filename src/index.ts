// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

export const name = "workspace-guard-status";
export function apply(ctx: any): void {
  ctx.logger.info(
    "DSH Workspace Guard installed. Native replacements require an explicit idle-profile configuration transaction.",
  );
}
