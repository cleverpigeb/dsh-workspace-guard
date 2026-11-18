/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import { n as executeToolBatch, t as ToolExecutionPipeline } from "./pipeline-CJKjgufX.js";
import "./runtime-version-BxFG0_oq.js";
import { projectToolSchema } from "@deepseek-ai/dsh-tools";
// node_modules/.pnpm/@deepseek-ai+dsh-tool-execu_72cb942c82043ad2a3cebab261df2e48/node_modules/@deepseek-ai/dsh-tool-executor-native/lib/index.js
/** Executes visible capabilities directly and owns their complete batch settlement. */
var NativeToolExecutor = class {
	maxParallel;
	pipeline;
	constructor(ctx, maxParallel = () => 10) {
		this.maxParallel = maxParallel;
		this.pipeline = new ToolExecutionPipeline(ctx);
	}
	describe(tools) {
		return { schemas: tools.map((definition) => projectToolSchema(definition, false)) };
	}
	execute(input) {
		return executeToolBatch(input, this.pipeline, this.maxParallel);
	}
};
/** Cordis plugin name. */
const name = "native-tool-executor";
/** Tool registration and scoped dispatch. */
const inject = ["tools"];
/**
* Select native execution in the mounting scope.
* @param ctx - context owning this executor's selection and lifetime.
*/
function apply(ctx) {
	ctx.tools.setExecutor(new NativeToolExecutor(ctx));
}
export { NativeToolExecutor, apply, inject, name };
