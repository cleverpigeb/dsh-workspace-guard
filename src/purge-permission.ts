import { Service } from "@deepseek-ai/cordis";
import "./runtime-version.js";
import { assertSelectedPurgeCompatibility } from "./compatibility.js";
/** Preserve the native API; only Purge's automatic Full Access set is a no-op. */
export default class PurgePermissionFacade extends Service {
  static inject = ["workspaceGuardPermissions"];
  constructor(ctx: any) {
    assertSelectedPurgeCompatibility(ctx);
    super(ctx, "permissionPresets");
    // Service registers this exact instance during super(); define forwarding
    // properties on it instead of returning a proxy the registry cannot see.
    const source = this.root;
    for (
      let layer = source;
      layer && layer !== Service.prototype && layer !== Object.prototype;
      layer = Object.getPrototypeOf(layer)
    ) {
      for (const key of Object.getOwnPropertyNames(layer)) {
        if (key in this || key === "constructor") continue;
        const descriptor = Object.getOwnPropertyDescriptor(layer, key)!;
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: () => {
            const value = source[key];
            return typeof value === "function" ? value.bind(source) : value;
          },
          ...(descriptor.writable || descriptor.set
            ? {
                set: (value: any) => {
                  source[key] = value;
                },
              }
            : {}),
        });
      }
    }
  }
  get root(): any {
    return (this.ctx as any).workspaceGuardPermissions.source;
  }
  set(session: any, name: string): any {
    if (name === "danger-full-access") return undefined;
    return this.root.set(session, name);
  }
  current(session: any): any {
    return this.root.current(session);
  }
  permissionState(session: any): any {
    return this.root.permissionState(session);
  }
  catalog(): any {
    return this.root.catalog();
  }
  registerAuto(admit: any): any {
    return this.root.registerAuto(admit);
  }
  resolve(name: string): any {
    return this.root.resolve(name);
  }
  optionOf(name: string): any {
    return this.root.optionOf(name);
  }
  get names(): any {
    return this.root.names;
  }
  get defaultPreset(): any {
    return this.root.defaultPreset;
  }
}
