/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import "./runtime-version-C8e7Atkv.js";
import { n as assertSelectedPurgeCompatibility } from "./compatibility-B7mVajJk.js";
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
