// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Service } from "@deepseek-ai/cordis";
import "./runtime-version.js";
/** Root-owned reference, outside Purge's isolated permissionPresets realm. */
export default class PermissionBridge extends Service {
  static inject = ["permissionPresets"];
  constructor(ctx: any) {
    super(ctx, "workspaceGuardPermissions");
  }
  get source(): any {
    return (this.ctx as any).permissionPresets;
  }
}
