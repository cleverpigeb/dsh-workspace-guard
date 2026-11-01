/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import "./runtime-version-C8e7Atkv.js";
import { Service } from "@deepseek-ai/cordis";
// src/permission-bridge.ts
/** Root-owned reference, outside Purge's isolated permissionPresets realm. */
var PermissionBridge = class extends Service {
	static inject = ["permissionPresets"];
	constructor(ctx) {
		super(ctx, "workspaceGuardPermissions");
	}
	get source() {
		return this.ctx.permissionPresets;
	}
};
export { PermissionBridge as default };
