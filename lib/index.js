/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
// src/index.ts
const name = "workspace-guard-status";
function apply(ctx) {
	ctx.logger.info("DSH Workspace Guard installed. Native replacements require an explicit idle-profile configuration transaction.");
}
export { apply, name };
