export const name = "workspace-guard-status";
export function apply(ctx: any): void {
  ctx.logger.info(
    "DSH Workspace Guard installed. Native replacements require an explicit idle-profile configuration transaction.",
  );
}
