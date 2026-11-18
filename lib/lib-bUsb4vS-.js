/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import { relative } from "node:path";
import { realpathSync, statSync } from "node:fs";
import "@deepseek-ai/cordis";
import { tmpdir } from "node:os";
import { SandboxEscalationError, SandboxInvalidRootError, SandboxPreparationError, SandboxProvider, SandboxUnavailableError } from "@deepseek-ai/dsh-sandbox";
import "@deepseek-ai/dsh-llm";
import "@deepseek-ai/dsh-error";
import { assertNever } from "@deepseek-ai/dsh-util-values";
// node_modules/.pnpm/@deepseek-ai+dsh-sandbox@0._941c8a988f53ac6af4b112d4599c94b2/node_modules/@deepseek-ai/dsh-sandbox/lib/index.js
/** Locale-owned sandbox approval text; audit inputs remain verbatim. */
/** English escalation messages. */
const en = { escalation: (mode, justification) => `Allow this operation with ${mode} permissions: ${justification}` };
/** Chinese escalation messages. */
const zh = { escalation: (mode, justification) => `允许本次操作使用 ${mode} 权限：${justification}` };
/** Japanese escalation messages. */
const ja = { escalation: (mode, justification) => `${mode} 権限でこの操作を許可します：${justification}` };
/** Spanish dictionary, checked against the English keys. */
const es = { escalation: (mode, justification) => `Permitir esta operación con permisos ${mode}: ${justification}` };
/** French dictionary, checked against the English keys. */
const fr = { escalation: (mode, justification) => `Autoriser cette opération avec les permissions ${mode} : ${justification}` };
/** German dictionary, checked against the English keys. */
const de = { escalation: (mode, justification) => `Diesen Vorgang mit ${mode}-Berechtigungen zulassen: ${justification}` };
/** Russian dictionary, checked against the English keys. */
const ru = { escalation: (mode, justification) => `Разрешить эту операцию с правами ${mode}: ${justification}` };
/** Portuguese dictionary, checked against the English keys. */
const pt = { escalation: (mode, justification) => `Permitir esta operação com permissões ${mode}: ${justification}` };
/**
* Build translations for the existing Client localized-text resolver.
* @param mode - requested sandbox mode.
* @param justification - raw model justification, preserved in every translation.
* @returns localized approval text.
*/
function escalationDisplayReason(mode, justification) {
	return {
		en: en.escalation(mode, justification),
		zh: zh.escalation(mode, justification),
		ja: ja.escalation(mode, justification),
		es: es.escalation(mode, justification),
		fr: fr.escalation(mode, justification),
		de: de.escalation(mode, justification),
		ru: ru.escalation(mode, justification),
		pt: pt.escalation(mode, justification)
	};
}
/** A `sandbox_permissions` request that did not produce a grant; nothing executed. */
/**
* The strictly-wider table: what a call whose effective mode is the key may
* escalate TO. Checked at EXECUTION, never baked into a tool schema — the
* schema's enum is {@link ESCALATION_TARGETS}, because schemas are
* registry-global while the effective mode is per-call truth.
*/
const WIDER_MODES = {
	"read-only": ["workspace-write", "danger-full-access"],
	"workspace-write": ["danger-full-access"]
};
/**
* The closed escalation-target vocabulary — every mode a call could ever
* escalate TO (`read-only` is the floor; nothing escalates to it). Advertised
* whenever the mounted capability confines: cutting the enum down to the modes
* wider than the composition's DEFAULT would strand a session whose effective
* mode sits below it (a `danger-full-access` default would advertise nothing
* while a narrower-switched session stays confined with no lever).
*/
const ESCALATION_TARGETS = ["workspace-write", "danger-full-access"];
/**
* Validate the escalation argument pairing a tool schema cannot express:
* `sandbox_permissions` and `justification` travel together — an approval
* prompt without a reason, or a reason driving nothing, is a malformed ask —
* and the justification must be a non-empty sentence.
* A violation throws {@link SandboxEscalationError} `SANDBOX_ESCALATION_INVALID_ARGUMENT`.
* @param sandboxPermissions - the raw `sandbox_permissions` argument, if given.
* @param justification - the raw `justification` argument, if given.
*/
function validateEscalationArgs(sandboxPermissions, justification) {
	if (sandboxPermissions !== void 0 && justification === void 0) throw new SandboxEscalationError("invalid escalation: sandbox_permissions requires a justification", "SANDBOX_ESCALATION_INVALID_ARGUMENT");
	if (justification !== void 0 && sandboxPermissions === void 0) throw new SandboxEscalationError("invalid escalation: justification is only valid together with sandbox_permissions", "SANDBOX_ESCALATION_INVALID_ARGUMENT");
	if (justification !== void 0 && justification.trim().length === 0) throw new SandboxEscalationError("invalid justification: expected a non-empty sentence", "SANDBOX_ESCALATION_INVALID_ARGUMENT");
}
/**
* The model-facing denial marker — the one vocabulary both enforcing families
* teach and report, so the model recognizes a policy denial identically
* whether the kernel refused a bash file effect or the filesystem provider's
* fence refused a mutation.
* @param mode - the mode the denied call ran under.
* @returns the marker line, exactly as the model sees it.
*/
function sandboxDenialMarker(mode) {
	return `[sandbox: file access denied under ${mode} mode]`;
}
/**
* The same-turn escalation hint that rides a denial when the composition
* advertises the escalation fields — the nudge lives at the decision point so
* the sanctioned retry does not depend on the model recalling the tool
* description.
* @param subject - the family's noun for the denied action (`command` for
*   bash, `operation` for a filesystem mutation).
* @returns the hint line, exactly as the model sees it.
*/
function escalationHintMarker(subject) {
	return `[sandbox: escalation available — retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`;
}
/**
* The model-facing `sandbox_permissions` parameter description, which carries
* the escalation rules for every enforcing family.
* @param subject - the family's noun for the denied action (`command` for
*   bash, `operation` for a filesystem mutation).
* @returns the parameter description, exactly as the model sees it.
*/
function sandboxPermissionsDescription(subject) {
	return `The narrowest wider sandbox mode for a one-shot retry of the exact ${subject} the sandbox just denied; the retry asks the user for approval.`;
}
/**
* Resolve a sandbox permission request before execution. Repeating the call's
* effective mode returns it without approval. A strictly wider mode requires
* approval and applies only to this call. Narrower or unsupported targets,
* missing approval services or agents for widening, and non-grant outcomes
* throw {@link SandboxEscalationError} before execution; a `cancelled`
* outcome while `approval.signal` is aborted rethrows the signal's reason.
* @param request - the escalation to judge (see {@link EscalationRequest}).
* @param approval - the approval ingredients the tool holds (see {@link EscalationApproval}).
* @returns the granted mode, consumed by the one call that asked.
*/
async function approveEscalation(request, approval) {
	const { requestedMode: mode, effectiveMode, justification, subject } = request;
	if (mode === effectiveMode) return effectiveMode;
	if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode)) throw new SandboxEscalationError(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`, "SANDBOX_ESCALATION_INVALID_ARGUMENT");
	if (approval.approver === void 0) throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`, "SANDBOX_ESCALATION_UNAVAILABLE");
	if (approval.agent === void 0) throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`, "SANDBOX_ESCALATION_UNAVAILABLE");
	const outcome = await approval.approver.request({
		agent: approval.agent,
		toolName: approval.toolName,
		callId: approval.callId,
		reason: `escalate sandbox to ${mode}: ${justification}`,
		displayReason: escalationDisplayReason(mode, justification),
		...approval.signal ? { signal: approval.signal } : {}
	});
	switch (outcome) {
		case "allowed-once": return mode;
		case "rejected": throw new SandboxEscalationError(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`, "SANDBOX_ESCALATION_REJECTED");
		case "cancelled":
			approval.signal?.throwIfAborted();
			throw new SandboxEscalationError(`approval for escalating to "${mode}" was cancelled`, "SANDBOX_ESCALATION_CANCELLED");
		case "unavailable": throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`, "SANDBOX_ESCALATION_UNAVAILABLE");
		default: return assertNever(outcome, "EscalationOutcome");
	}
}
/**
* The writable-root derivation shared by every enforcement dialect that
* expresses a mode as a canonical allow-list: `workspace-write` means "the
* workspace root, explicit extra directories, and platform temp areas", and this module is that
* meaning's one home. The Seatbelt profile
* (`@deepseek-ai/dsh-sandbox-local`) and the in-process filesystem fence
* (`@deepseek-ai/dsh-fs-sandbox`) both derive their allow-list here, so "the
* write tool cannot write /tmp but bash can" asymmetries cannot arise between
* them. The bwrap and Landlock dialects keep their own grant spellings (an
* ephemeral `/tmp` mount, launcher-owned flags) — the honest per-runner
* differences recorded in the sandbox RFC — with parity pinned by test.
*
* @module dsh-sandbox/roots
*/
/** A workspace root or explicit directory grant cannot be enforced without changing the caller's selected path. */
/** Resolve existing directories, rejecting aliases that differ under the host's path comparison. */
function additionalRoot(path) {
	let physical;
	let directory;
	try {
		physical = realpathSync.native(path);
		directory = statSync(physical).isDirectory();
	} catch (error) {
		throw new SandboxInvalidRootError(path, `cannot read the directory: ${String(error)}`);
	}
	if (!directory) throw new SandboxInvalidRootError(path, "expected an existing directory");
	if (relative(path, physical) !== "") throw new SandboxInvalidRootError(path, `use the physical directory path ${JSON.stringify(physical)}; symlinked grants are not supported`);
	return physical;
}
/**
* Resolve a granted root to the path the enforcement layer actually compares:
* canonical (symlinks resolved), because both Seatbelt filters and the fs
* fence's containment check match resolved paths — `/tmp` IS `/private/tmp`
* on darwin, and an as-spelled grant would match nothing.
* @param path - the root as configured or platform-reported.
* @returns the canonical path, or the spelling as-is when resolution fails
*   (a missing root matches nothing until it exists — the conservative
*   outcome; inventing a fallback would grant a path the caller never named).
*/
function canonicalPath(path) {
	try {
		return realpathSync.native(path);
	} catch {
		return path;
	}
}
/**
* The workspace-owned writable roots — the policy's workspace root plus its
* explicit extra directories, as a canonical, deduplicated allow-list. Both
* the workspace and every extra root are included by the filesystem fence and
* POSIX process backends; Windows process confinement ignores extra roots.
* This derivation is separate from each backend's platform temp policy (Seatbelt and the fs
* fence use {@link writableRoots}; bwrap and Landlock add their own temp
* grants).
* @param policy - the file-effect policy to derive the allow-list from.
* @returns the canonical workspace-owned roots; empty under `read-only`.
* @throws {SandboxInvalidRootError} An extra root cannot be inspected, is not a directory, or uses a symlink.
*/
function workspaceWritableRoots(policy) {
	if (policy.mode !== "workspace-write") return [];
	const additional = (policy.additionalWritableRoots ?? []).map(additionalRoot);
	return [.../* @__PURE__ */ new Set([canonicalPath(policy.workspaceRoot), ...additional])];
}
/**
* The roots one confined execution may WRITE under — the mode's meaning as a
* canonical, deduplicated allow-list. `read-only` allows nothing;
* `workspace-write` allows the policy's workspace root, its explicit extra
* directories, the host `/tmp`, and the per-user platform temp dir
* (`os.tmpdir()` — the real temp area for mkstemp-family tools; omitting it
* would deny what the mode promises).
* @param policy - the file-effect policy to derive the allow-list from.
* @returns the canonical writable roots; empty exactly under `read-only`.
*/
function writableRoots(policy) {
	if (policy.mode !== "workspace-write") return [];
	return [.../* @__PURE__ */ new Set([
		...workspaceWritableRoots(policy),
		canonicalPath("/tmp"),
		canonicalPath(tmpdir())
	])];
}
export { SandboxProvider as a, canonicalPath as c, sandboxPermissionsDescription as d, validateEscalationArgs as f, SandboxPreparationError as i, escalationHintMarker as l, writableRoots as m, SandboxEscalationError as n, SandboxUnavailableError as o, workspaceWritableRoots as p, SandboxInvalidRootError as r, approveEscalation as s, ESCALATION_TARGETS as t, sandboxDenialMarker as u };
