import "./runtime-version-CNudQvOj.js";
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
