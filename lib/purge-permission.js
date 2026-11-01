import "./runtime-version-CNudQvOj.js";
import { n as assertSelectedPurgeCompatibility } from "./compatibility-DgfB-Kno.js";
import { Service } from "@deepseek-ai/cordis";
// src/purge-permission.ts
/** Preserve the native API; only Purge's automatic Full Access set is a no-op. */
var PurgePermissionFacade = class extends Service {
	static inject = ["workspaceGuardPermissions"];
	constructor(ctx) {
		assertSelectedPurgeCompatibility(ctx);
		super(ctx, "permissionPresets");
		const source = this.root;
		for (let layer = source; layer && layer !== Service.prototype && layer !== Object.prototype; layer = Object.getPrototypeOf(layer)) for (const key of Object.getOwnPropertyNames(layer)) {
			if (key in this || key === "constructor") continue;
			const descriptor = Object.getOwnPropertyDescriptor(layer, key);
			Object.defineProperty(this, key, {
				configurable: true,
				enumerable: descriptor.enumerable,
				get: () => {
					const value = source[key];
					return typeof value === "function" ? value.bind(source) : value;
				},
				...descriptor.writable || descriptor.set ? { set: (value) => {
					source[key] = value;
				} } : {}
			});
		}
	}
	get root() {
		return this.ctx.workspaceGuardPermissions.source;
	}
	set(session, name) {
		if (name === "danger-full-access") return void 0;
		return this.root.set(session, name);
	}
	current(session) {
		return this.root.current(session);
	}
	permissionState(session) {
		return this.root.permissionState(session);
	}
	catalog() {
		return this.root.catalog();
	}
	registerAuto(admit) {
		return this.root.registerAuto(admit);
	}
	resolve(name) {
		return this.root.resolve(name);
	}
	optionOf(name) {
		return this.root.optionOf(name);
	}
	get names() {
		return this.root.names;
	}
	get defaultPreset() {
		return this.root.defaultPreset;
	}
};
export { PurgePermissionFacade as default };
