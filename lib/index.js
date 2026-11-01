// src/index.ts
const name = "workspace-guard-status";
function apply(ctx) {
	ctx.logger.info("DSH Workspace Guard installed. Native replacements require an explicit idle-profile configuration transaction.");
}
export { apply, name };
