// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import {
  isMap,
  isNode,
  isSeq,
  parseDocument,
  visit,
  type Document,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import { validateBundleVersion } from "./compatibility.js";
import { withConfigurationLock } from "./configuration-lock.js";
export { recoverConfigurationLocks } from "./configuration-lock.js";

export const PACKAGE_NAME = "@cleverpig/dsh-workspace-guard";
export const REPLACEMENTS: Record<string, string> = {
  "@deepseek-ai/dsh-sandbox-local": "sandbox",
  "@deepseek-ai/dsh-sandbox-policy": "policy",
  "@deepseek-ai/dsh-user-approval": "approval",
  "@deepseek-ai/dsh-permission-presets": "permission",
  "@deepseek-ai/dsh-fs-sandbox": "fs",
  "@deepseek-ai/dsh-tools": "tools",
  "@deepseek-ai/dsh-tool-bash": "tool-bash",
  "@deepseek-ai/dsh-tool-pwsh": "tool-pwsh",
  "@deepseek-ai/dsh-tool-fs": "tool-fs",
  "@deepseek-ai/dsh-plugin-manager/tools": "plugin-tools",
};
const LABEL = "workspace-guard-purge",
  MARKER = "workspace-guard v2 owned: ";
type Row = Record<string, any>;
type Pair = { path: string[]; original: Row; replacement: Row };
type Owned = {
  key: string;
  kind: "disable" | "replacement" | "preset" | "purge" | "service";
  installed: Row;
  origin?: Row;
  pairs?: Pair[];
};
export type GuardReceipt = {
  version: 2;
  profile: string;
  status: "active" | "inactive" | "rolled-back";
  owned: Owned[];
  transaction?: { before: string; after: string; previous?: GuardReceipt };
};
export type PreviewInput = {
  patch: string;
  bundleLayers: string[];
  homePatch?: string;
  overlays?: Row[];
  profile: string;
  receipt?: GuardReceipt;
};
export type GuardPlan = {
  patch: string;
  receipt: GuardReceipt;
  changed: boolean;
  summary: string[];
};
export type ProfileOptions = {
  profile: string;
  home?: string;
  hostModules?: string;
  /** Launcher patches, applied after the home layer and never persisted. */
  overlays?: Row[];
};
type LifecyclePhase = "load" | "dispose" | "failed-load";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const same = (a: any, b: any): boolean => JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(value: T): T => structuredClone(value);
const js = (value: any): boolean =>
  !!value &&
  typeof value === "object" &&
  typeof value.__jsExpr === "string" &&
  Object.keys(value).length === 1;
const jsTag: any = {
  tag: "tag:yaml.org,2002:js",
  identify: js,
  resolve: (value: string) => ({ __jsExpr: value }),
  stringify: (item: any) => JSON.stringify(item.value.__jsExpr),
};
function document(source: string): Document {
  const doc = parseDocument(source || "[]\n", { customTags: [jsTag], uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length)
    throw new Error(
      `Unsupported YAML: ${[...doc.errors, ...doc.warnings].map((error) => error.message).join("; ")}`,
    );
  if (!isSeq(doc.contents)) throw new Error("Patch must be a top-level YAML sequence.");
  return doc;
}
function rows(source: string): Row[] {
  return document(source).toJS({ maxAliasCount: 100 });
}
function overlaySource(overlays: Row[] = []): string {
  const doc = document("[]\n");
  for (const row of overlays) append(doc, row);
  return String(doc);
}
function indexRows(entries: Row[], result = new Map<string, Row>()): Map<string, Row> {
  for (const row of entries) {
    if (row.id) {
      if (result.has(row.id)) throw new Error(`Duplicate inserted id: ${row.id}`);
      result.set(row.id, row);
    }
    if (row.group && Array.isArray(row.config)) indexRows(row.config, result);
  }
  return result;
}
/** The addressing map intentionally follows native insertion-time indexing. */
function composition(layers: Row[][] = []) {
  const tree: Row[] = [],
    address = new Map<string, Row>();
  let finalIndex: Map<string, Row> | undefined;
  const apply = (entries: Row[], applied?: (patch: Row, target: Row) => void): void => {
    for (const patch of entries) {
      const { id, name, insert, ...fields } = patch;
      if (insert) {
        if (!Array.isArray(insert)) throw new Error("insert must be an array.");
        const parent = id ? address.get(id) : undefined;
        if (id && (!parent || !parent.group))
          throw new Error(`Insert target is missing or not a group: ${id}`);
        const added = clone(insert);
        if (parent && !Array.isArray(parent.config)) parent.config = [];
        (parent ? parent.config : tree).push(...added);
        indexRows(added, address);
      } else {
        const target = address.get(id);
        if (target && (!name || target.name === name)) {
          applied?.(patch, target);
          Object.assign(target, clone(fields));
        }
      }
    }
    finalIndex = undefined;
  };
  for (const layer of layers) apply(layer);
  return { tree, apply, index: () => (finalIndex ??= indexRows(tree)) };
}
/** Mirror the formal boot loader's replacement, insertion and name-guard rules. */
export function composeLayers(layers: string[]): Row[] {
  return composition(layers.map(rows)).tree;
}
function planning(input: PreviewInput) {
  const doc = document(input.patch),
    profileRows = doc.toJS({ maxAliasCount: 100 }) as Row[];
  const bundles = input.bundleLayers.map(rows),
    later = [rows(input.homePatch ?? "[]"), clone(input.overlays ?? [])];
  const explicit = new Map<string, Set<string>>();
  for (const list of [profileRows, ...later])
    for (const row of list) {
      if (!row.id || !row.config || typeof row.config !== "object") continue;
      const keys = explicit.get(row.id) ?? new Set<string>();
      for (const key of Object.keys(row.config)) keys.add(key);
      explicit.set(row.id, keys);
    }
  return { doc, profileRows, bundles, later, explicit };
}
type Planning = ReturnType<typeof planning>;
function append(doc: Document, entry: Row, key?: string): void {
  const node = doc.createNode(entry) as YAMLMap;
  if (key) node.commentBefore = MARKER + key;
  (doc.contents as YAMLSeq).items.push(node);
}
function marked(doc: Document, owned: Owned): YAMLMap {
  const found = (doc.contents as YAMLSeq).items.filter(
    (node) =>
      isMap(node) &&
      node.commentBefore?.split("\n").some((line) => line.trim() === MARKER + owned.key),
  );
  if (found.length !== 1) throw new Error(`Ownership marker missing or duplicated: ${owned.key}.`);
  return found[0] as YAMLMap;
}
function identity(current: Row, expected: Row): void {
  if (current.id !== expected.id || current.name !== expected.name)
    throw new Error(`Owned identity changed: ${expected.id ?? "<insert>"}.`);
}
/** Rebase only later user changes onto the current underlying config. */
function mergeDelta(before: any, edited: any, live: any, baseline: any = before): any {
  if (same(before, edited)) return clone(live);
  if (Array.isArray(before) && Array.isArray(edited) && Array.isArray(live)) {
    if (
      [...before, ...edited, ...live].every(
        (row) => row && typeof row === "object" && typeof row.id === "string",
      )
    ) {
      const prior = new Map(before.map((row) => [row.id, row])),
        current = new Map(live.map((row) => [row.id, row])),
        bases = new Map(
          (Array.isArray(baseline) ? baseline : before).map((row: Row) => [row.id, row]),
        );
      const result: Row[] = [];
      for (const row of edited) {
        if (!prior.has(row.id)) result.push(clone(row));
        else if (current.has(row.id))
          result.push(mergeDelta(prior.get(row.id), row, current.get(row.id), bases.get(row.id)));
        else if (!same(prior.get(row.id), row))
          throw new Error(`Conflicting user edit and lower-layer deletion: ${row.id}.`);
      }
      for (const row of live)
        if (!prior.has(row.id) && !edited.some((item) => item.id === row.id))
          result.push(clone(row));
      return result;
    }
    if ([...before, ...edited, ...live].every((value) => typeof value === "string"))
      return [
        ...live.filter((value) => !before.includes(value) || edited.includes(value)),
        ...edited.filter((value) => !before.includes(value) && !live.includes(value)),
      ];
    return clone(edited);
  }
  if (
    before &&
    edited &&
    live &&
    typeof before === "object" &&
    typeof edited === "object" &&
    typeof live === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(edited) &&
    !Array.isArray(live) &&
    !js(before) &&
    !js(edited)
  ) {
    const result = clone(live);
    for (const key of new Set([...Object.keys(before), ...Object.keys(edited)])) {
      if (!(key in edited)) delete result[key];
      else if (!(key in before)) result[key] = clone(edited[key]);
      else if (!same(before[key], edited[key]))
        result[key] = mergeDelta(before[key], edited[key], live[key], baseline?.[key]);
    }
    return result;
  }
  if (!same(live, baseline) && !same(edited, live))
    throw new Error(
      "Conflicting edits affect the same native field; preserve both and resolve before removal.",
    );
  return clone(edited);
}
function changedFields(before: Row, after: Row): Row {
  const fields: Row = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (key !== "id" && key !== "name" && !same(before[key], after[key]))
      fields[key] = key in after ? clone(after[key]) : null;
  return fields;
}
function nestedList(config: Row, path: string[]): Row[] {
  let list = config.plugins;
  for (const id of path) {
    const parent = list?.find((row: Row) => row.id === id);
    if (!parent || !parent.group || !Array.isArray(parent.config))
      throw new Error(`Owned nested scope moved: ${path.join("/")}`);
    list = parent.config;
  }
  if (!Array.isArray(list)) throw new Error("Preset plugin list changed shape.");
  return list;
}
function undoPreset(config: Row, pairs: Pair[]): Row {
  const result = clone(config);
  for (const pair of pairs) {
    const list = nestedList(result, pair.path),
      original = list.find((row) => row.id === pair.original.id),
      replacement = list.find((row) => row.id === pair.replacement.id);
    if (!original || !replacement)
      throw new Error(`Owned nested pair removed: ${pair.original.id}.`);
    identity(original, pair.original);
    identity(replacement, pair.replacement);
    if (original.disabled !== true)
      throw new Error(`Owned native disable changed: ${pair.original.id}.`);
    if ("disabled" in pair.original) original.disabled = clone(pair.original.disabled);
    else delete original.disabled;
    const restored = mergeDelta(pair.replacement, replacement, original, pair.original);
    restored.id = pair.original.id;
    restored.name = pair.original.name;
    list[list.indexOf(original)] = restored;
    list.splice(list.indexOf(replacement), 1);
  }
  return result;
}
function restoreOwned(
  doc: Document,
  receipt: GuardReceipt | undefined,
  plan: Planning,
): Row[] | undefined {
  if (!receipt || receipt.status !== "active") return;
  const nodes = (doc.contents as YAMLSeq).items;
  const saved = receipt.owned.map((owned) => ({ owned, node: marked(doc, owned) }));
  const ownedNodes = new Set(saved.map((item) => item.node));
  const residuals = new Map<unknown, YAMLMap>();
  for (const { owned, node } of saved)
    if (owned.kind === "replacement") {
      const residual = node.clone() as YAMLMap,
        inserted = residual.get("insert", true);
      if (!isSeq(inserted)) continue; // The ownership validation below reports this.
      const ownedId = owned.installed.insert[0].id;
      inserted.items = inserted.items.filter((item) => !isMap(item) || item.get("id") !== ownedId);
      if (inserted.items.length) {
        residual.commentBefore =
          residual.commentBefore
            ?.split("\n")
            .filter((line) => line.trim() !== MARKER + owned.key)
            .join("\n") || undefined;
        residuals.set(node, residual);
      }
    }
  const disappearing = new Set(
    receipt.owned
      .filter((item) => item.kind === "replacement" || item.kind === "service")
      .map((item) => item.installed.insert[0].id),
  );
  const ownedPositions = new Map(
    saved
      .filter((item) => item.owned.kind === "preset" || item.owned.kind === "purge")
      .map((item) => [item.owned.installed.id, nodes.indexOf(item.node)]),
  );
  const effective = composition(plan.bundles),
    consumed = new Set<unknown>();
  // Only consume overrides which really matched at their position in the native
  // patch stream. Earlier unmatched and name-mismatched patches remain untouched.
  nodes.forEach((node, position) => {
    const row = plan.profileRows[position];
    if (row.insert && disappearing.has(row.id))
      throw new Error(`Cannot migrate an insertion targeting an owned provider: ${row.id}.`);
    effective.apply([row], (_patch, target) => {
      if (
        !ownedNodes.has(node as YAMLMap) &&
        (disappearing.has(target.id) || position > (ownedPositions.get(target.id) ?? Infinity))
      )
        consumed.add(node);
    });
  });
  const effectiveIndex = effective.index();
  verifyEffectiveServices(receipt, effectiveIndex);
  for (const source of plan.later)
    homeConflicts(
      source,
      new Set([
        ...disappearing,
        ...receipt.owned
          .filter(
            (item) => item.kind === "preset" || item.kind === "purge" || item.kind === "disable",
          )
          .map((item) => item.installed.id),
      ]),
    );
  const retained: Row[] = [];
  const comments: string[] = [];
  const collectComments = (node: unknown, marker?: string): void => {
    if (isNode(node))
      visit(node, (_key, item) => {
        if (isNode(item)) {
          for (const text of [item.commentBefore, item.comment])
            if (text) {
              const kept = text
                .split("\n")
                .filter((line) => line.trim() !== marker)
                .join("\n");
              if (kept) comments.push(kept);
            }
        }
      });
  };
  const savedByNode = new Map(saved.map((item) => [item.node, item.owned]));
  for (const node of nodes) {
    const owned = savedByNode.get(node as YAMLMap);
    if (!owned) {
      if (consumed.has(node)) collectComments(node);
    } else if (!residuals.has(node)) collectComments(node, MARKER + owned.key);
    else {
      // The residual clone already retains wrapper/sequence/unrelated-child
      // comments. Only the removed owned child's comments need relocating.
      const inserted = (node as YAMLMap).get("insert", true);
      if (isSeq(inserted))
        for (const child of inserted.items)
          if (isMap(child) && child.get("id") === owned.installed.insert[0].id)
            collectComments(child, MARKER + owned.key);
    }
  }
  if (comments.length) doc.comment = [doc.comment, ...comments].filter(Boolean).join("\n");
  for (let position = nodes.length - 1; position >= 0; position--) {
    const node = nodes[position];
    const residual = residuals.get(node);
    if (residual) {
      // Unrelated children stay at the original insertion position so later
      // native overrides still see them, with their YAML comments intact.
      nodes[position] = residual;
      retained.unshift(residual.toJSON() as Row);
    } else if (ownedNodes.has(node as YAMLMap) || consumed.has(node)) {
      // Non-marker comments survive in a readable trailing block, including
      // comments inside owned nodes when native deltas replace those nodes.
      nodes.splice(position, 1);
    } else retained.unshift(plan.profileRows[position]);
  }
  const live = composition([...plan.bundles, retained]);
  const lowerTree = clone(live.tree);
  const emit = (row: Row): void => {
    append(doc, row);
    live.apply([row]);
  };
  for (const { owned, node } of saved) {
    const current = node.toJSON() as Row,
      installed = owned.installed,
      liveIndex = live.index();
    if (owned.kind === "disable") {
      identity(current, installed);
      if (current.disabled !== true)
        throw new Error(`Owned native disable changed: ${installed.id}.`);
      const extras = { ...current };
      delete extras.disabled;
      if (Object.keys(extras).some((key) => key !== "id" && key !== "name")) emit(extras);
    } else if (owned.kind === "replacement") {
      if (current.id !== installed.id || !Array.isArray(current.insert))
        throw new Error(`Owned insertion changed: ${owned.key}.`);
      const expected = installed.insert[0],
        markedReplacement = current.insert.find((row: Row) => row.id === expected.id),
        replacement = effectiveIndex.get(expected.id);
      if (!markedReplacement) throw new Error(`Owned replacement removed: ${expected.id}.`);
      identity(markedReplacement, expected);
      if (!replacement) throw new Error(`Owned replacement removed: ${expected.id}.`);
      identity(replacement, expected);
      const live = liveIndex.get(owned.origin!.id);
      if (!live || live.name !== owned.origin!.name)
        throw new Error(`Native origin changed: ${owned.origin!.id}.`);
      const updated = mergeDelta(expected, replacement, live, owned.origin);
      updated.id = live.id;
      updated.name = live.name;
      const fields = changedFields(live, updated);
      if (Object.keys(fields).length) emit({ id: live.id, name: live.name, ...fields });
    } else if (owned.kind === "preset") {
      identity(current, installed);
      const live = liveIndex.get(installed.id);
      if (!live || live.name !== installed.name)
        throw new Error(`Preset origin changed: ${installed.id}.`);
      const effectivePreset = effectiveIndex.get(installed.id);
      if (!effectivePreset) throw new Error(`Preset origin changed: ${installed.id}.`);
      const merged = mergeDelta(
          owned.origin!.config,
          undoPreset(effectivePreset.config, owned.pairs!),
          live.config,
        ),
        extra = changedFields({ ...owned.origin, ...installed }, effectivePreset);
      delete extra.config;
      if (!same(merged, live.config) || Object.keys(extra).length)
        emit({ id: live.id, name: live.name, ...extra, config: merged });
    } else if (owned.kind === "purge") {
      identity(current, installed);
      if (current.isolate?.permissionPresets !== LABEL)
        throw new Error("Owned Purge isolation changed.");
      const cleaned = clone(effectiveIndex.get(installed.id)!);
      if (owned.origin!.isolate?.permissionPresets === undefined)
        delete cleaned.isolate.permissionPresets;
      else cleaned.isolate.permissionPresets = clone(owned.origin!.isolate.permissionPresets);
      if (!Object.keys(cleaned.isolate).length && !owned.origin!.isolate) delete cleaned.isolate;
      if (!owned.origin!.inject?.includes("permissionPresets"))
        cleaned.inject = cleaned.inject.filter((name: string) => name !== "permissionPresets");
      const baseline = owned.origin!;
      const live = liveIndex.get(installed.id);
      if (!live || live.name !== installed.name) throw new Error("Purge origin changed.");
      const fields = changedFields(live, mergeDelta(baseline, cleaned, live));
      if (Object.keys(fields).length) emit({ id: live.id, name: live.name, ...fields });
    } else if (!same(current, installed))
      throw new Error(
        `Guard bridge/facade was edited: ${owned.key}; preserve and resolve before removal.`,
      );
  }
  return lowerTree;
}
function ownId(scope: string, row: Row): string {
  return `workspace-guard-${row.id}-${hash(scope + ":" + row.id).slice(0, 8)}`;
}
function freshDefaults(plan: Planning, original: Row, replacement: Row): void {
  if (
    original.name === "@deepseek-ai/dsh-sandbox-policy" &&
    !plan.explicit.get(original.id)?.has("mode") &&
    (!original.config?.mode ||
      (js(original.config.mode) && /DSH_PERMISSION_MODE/.test(original.config.mode.__jsExpr)))
  )
    replacement.config = {
      ...replacement.config,
      mode: { __jsExpr: "process.env.DSH_PERMISSION_MODE ?? 'workspace-write'" },
    };
  if (
    original.name === "@deepseek-ai/dsh-user-approval" &&
    !plan.explicit.get(original.id)?.has("policy") &&
    (!original.config?.policy ||
      (js(original.config.policy) && /DSH_PERMISSION_MODE/.test(original.config.policy.__jsExpr)))
  )
    replacement.config = {
      ...replacement.config,
      policy: {
        __jsExpr:
          "(process.env.DSH_PERMISSION_MODE ?? 'workspace-write') === 'danger-full-access' ? 'never' : 'ask'",
      },
    };
  // Native permission presets infer their fresh default from the composed shell
  // and approval knobs. Explicit configuration/settings and existing logs win.
}
function homeConflicts(source: Row[], affected: Set<string>): void {
  const inspect = (entries: Row[]): void => {
    for (const row of entries) {
      if (
        affected.has(row.id) ||
        (row.disabled !== true &&
          (REPLACEMENTS[row.name] ||
            (typeof row.name === "string" && row.name.startsWith(PACKAGE_NAME + "/"))))
      )
        throw new Error(
          `Later home/launcher overlay conflicts with paired configuration: ${row.id ?? row.name}.`,
        );
      if (Array.isArray(row.insert)) inspect(row.insert);
      if (row.group && Array.isArray(row.config)) inspect(row.config);
      if (Array.isArray(row.config?.plugins)) inspect(row.config.plugins);
    }
  };
  inspect(source);
}
/** The bridge must bind one available root authority without changing Purge eligibility. */
function requireRootPermissionAuthority(
  tree: Row[],
  permissionName = "@deepseek-ai/dsh-permission-presets",
): void {
  type Eligibility = "enabled" | "disabled" | "dynamic";
  type Realm = "root" | "scoped" | "dynamic";
  const rootAuthorities: string[] = [],
    ambiguous: string[] = [];
  const visit = (
    entries: Row[],
    parentState: Eligibility = "enabled",
    parentRealm: Realm = "root",
  ): void => {
    for (const row of entries) {
      const state: Eligibility =
        parentState === "disabled" || row.disabled === true
          ? "disabled"
          : parentState === "dynamic" || (row.disabled !== undefined && row.disabled !== false)
            ? "dynamic"
            : "enabled";
      let realm = parentRealm;
      if (js(row.isolate)) realm = "dynamic";
      else if (row.isolate && Object.hasOwn(row.isolate, "permissionPresets")) {
        const selection = row.isolate.permissionPresets;
        realm = !selection
          ? "root"
          : selection === true || typeof selection === "string"
            ? "scoped"
            : "dynamic";
      }
      if (row.name === permissionName && state !== "disabled") {
        if (state === "enabled" && realm === "root") rootAuthorities.push(row.id ?? "<anonymous>");
        else if (realm !== "scoped") ambiguous.push(row.id ?? "<anonymous>");
      }
      if (row.group && Array.isArray(row.config)) visit(row.config, state, realm);
    }
  };
  visit(tree);
  if (rootAuthorities.length !== 1 || ambiguous.length)
    throw new Error(
      "Unsupported composition: activation requires exactly one statically enabled root permission authority; disabled, scoped-away or dynamically eligible authority cannot be bridged without changing Purge behavior.",
    );
}
function verifyEffectiveServices(receipt: GuardReceipt, index: Map<string, Row>): void {
  for (const owned of receipt.owned) {
    if (owned.kind === "service") {
      const expected = owned.installed.insert[0],
        current = index.get(expected.id);
      const normalized = current && { ...current };
      if (normalized?.disabled === false) delete normalized.disabled;
      if (!same(normalized, expected))
        throw new Error(
          `Effective Guard bridge/facade was edited: ${owned.key}; preserve and resolve before removal.`,
        );
    } else if (owned.kind === "purge") {
      const current = index.get(owned.installed.id);
      if (
        !current ||
        current.name !== owned.installed.name ||
        current.isolate?.permissionPresets !== LABEL ||
        !Array.isArray(current.inject) ||
        !current.inject.every((item: unknown) => typeof item === "string") ||
        !current.inject.includes("permissionPresets")
      )
        throw new Error(
          "Effective Purge permission isolation/dependency changed; preserve and resolve before removal.",
        );
    }
  }
}
function verifyActive(plan: Planning, receipt: GuardReceipt, lowerTree: Row[]): void {
  const current = composition([...plan.bundles, plan.profileRows, ...plan.later]).tree,
    index = indexRows(current);
  verifyEffectiveServices(receipt, index);
  requireRootPermissionAuthority(current, `${PACKAGE_NAME}/permission`);
  const origins = new Map(
    receipt.owned
      .filter((item) => item.kind === "replacement")
      .map((item) => [item.origin!.id, item]),
  );
  const guards = new Set(
    receipt.owned
      .filter((item) => item.kind === "replacement" || item.kind === "service")
      .map((item) => item.installed.insert[0].id),
  );
  const affected = new Set<string>([
    ...origins.keys(),
    ...guards,
    ...receipt.owned
      .filter((item) => item.kind === "preset" || item.kind === "purge")
      .map((item) => item.installed.id),
  ]);
  for (const source of plan.later) homeConflicts(source, affected);
  const lower = indexRows(lowerTree);
  requireRootPermissionAuthority(lowerTree);
  for (const [id, item] of origins) {
    const native = index.get(id),
      guard = index.get(item.installed.insert[0].id);
    if (
      !native ||
      native.name !== item.origin!.name ||
      native.disabled !== true ||
      !guard ||
      guard.name !== item.installed.insert[0].name
    )
      throw new Error(`Active native pair is missing or conflicted: ${id}.`);
    const before = { ...item.origin },
      now = { ...native };
    delete before.disabled;
    delete now.disabled;
    if (!same(before, now))
      throw new Error(
        `Native source changed after activation: ${id}; review and reactivate after removal.`,
      );
  }
  for (const row of index.values()) {
    if (row.disabled !== true && REPLACEMENTS[row.name] && !origins.has(row.id))
      throw new Error(`New unpaired native provider after activation: ${row.id}.`);
    if (
      row.disabled !== true &&
      typeof row.name === "string" &&
      row.name.startsWith(PACKAGE_NAME + "/") &&
      !guards.has(row.id)
    )
      throw new Error(`Additional guard provider after activation: ${row.id}.`);
  }
  for (const owned of receipt.owned.filter((item) => item.kind === "preset")) {
    const preset = index.get(owned.installed.id),
      native = lower.get(owned.installed.id);
    if (!preset || !native || !same(native.config, owned.origin!.config))
      throw new Error(
        `Underlying preset changed after activation: ${owned.installed.id}; review after removal.`,
      );
    const pairKey = (path: string[], id: string) => JSON.stringify([...path, id]);
    const pairs = new Map(owned.pairs!.map((item) => [pairKey(item.path, item.original.id), item]));
    const guards = new Map(
      owned.pairs!.map((item) => [pairKey(item.path, item.replacement.id), item]),
    );
    const inspect = (entries: Row[], path: string[]): void => {
      for (const row of entries) {
        const pair = pairs.get(pairKey(path, row.id));
        const guard = guards.get(pairKey(path, row.id));
        if (REPLACEMENTS[row.name] && row.disabled !== true)
          throw new Error(`New unpaired native preset row: ${owned.installed.id}/${row.id}.`);
        if (pair) {
          const baseline = { ...pair.original },
            now = { ...row };
          delete baseline.disabled;
          delete now.disabled;
          if (!same(baseline, now))
            throw new Error(`Native preset source changed after activation: ${row.id}.`);
        }
        if (typeof row.name === "string" && row.name.startsWith(PACKAGE_NAME + "/") && !guard)
          throw new Error(`Additional guard preset row: ${row.id}.`);
        if (row.group && Array.isArray(row.config)) inspect(row.config, [...path, row.id]);
      }
    };
    inspect(preset.config.plugins, []);
  }
}
export function previewConfiguration(
  input: PreviewInput,
  action: "activate" | "deactivate" | "rollback",
): GuardPlan {
  return previewPlanned(input, action, planning(input));
}
function previewPlanned(
  input: PreviewInput,
  action: ConfigurationAction,
  plan: Planning,
): GuardPlan {
  const doc = plan.doc,
    profile = resolve(input.profile),
    receipt = input.receipt;
  if (receipt && (receipt.version !== 2 || receipt.profile !== profile))
    throw new Error(
      "Receipt version/profile mismatch. Legacy releases require explicit separate migration; no files changed.",
    );
  if (action !== "activate" && !receipt)
    throw new Error("No ownership receipt exists for this profile.");
  if (action === "activate" && receipt?.status === "active") {
    if (
      receipt.owned.some(
        (item) =>
          (item.kind === "replacement" || item.kind === "service") &&
          !item.installed.insert?.[0]?.name?.startsWith(PACKAGE_NAME + "/"),
      )
    )
      throw new Error(
        `The active receipt belongs to a different package name. Remove the earlier development bundle through DSH before installing ${PACKAGE_NAME}; existing configuration was preserved.`,
      );
    const probe = doc.clone();
    const lowerTree = restoreOwned(probe, receipt, plan)!;
    verifyActive(plan, receipt, lowerTree);
    return {
      patch: input.patch,
      changed: false,
      receipt,
      summary: ["Already active; native pairs and ownership remain in place."],
    };
  }
  restoreOwned(doc, receipt, plan);
  if (action !== "activate")
    return {
      patch: String(doc),
      changed: String(doc) !== input.patch,
      receipt: {
        version: 2,
        profile,
        status: action === "rollback" ? "rolled-back" : "inactive",
        owned: [],
      },
      summary: [
        "Remove owned pairs and facade, restore native providers, preserve later unrelated edits. No safety disables remain.",
      ],
    };
  const tree = composition([...plan.bundles, doc.toJS({ maxAliasCount: 100 })]).tree,
    index = indexRows(tree),
    owned: Owned[] = [];
  requireRootPermissionAuthority(tree);
  const add = (kind: Owned["kind"], key: string, installed: Row, extra: Partial<Owned> = {}) => {
    append(doc, installed, key);
    owned.push({ kind, key, installed: clone(installed), ...extra });
  };
  const replacedIds = new Set<string>(),
    touched = new Set<string>();
  const pairRoot = (list: Row[], group?: string): void => {
    for (const original of list) {
      if (!original.id || typeof original.id !== "string") {
        if (REPLACEMENTS[original.name])
          throw new Error(`Native row requires a stable id: ${original.name}`);
        continue;
      }
      if (REPLACEMENTS[original.name]) {
        const replacement = {
          ...clone(original),
          id: ownId(group ?? "root", original),
          name: `${PACKAGE_NAME}/${REPLACEMENTS[original.name]}`,
        };
        freshDefaults(plan, original, replacement);
        if (index.has(replacement.id))
          throw new Error(`Replacement id already exists: ${replacement.id}`);
        add("disable", `native:${original.id}`, {
          id: original.id,
          name: original.name,
          disabled: true,
        });
        add(
          "replacement",
          `pair:${original.id}`,
          { ...(group ? { id: group } : {}), insert: [replacement] },
          { origin: clone(original) },
        );
        replacedIds.add(original.id);
        touched.add(original.id);
      }
      if (original.group && Array.isArray(original.config)) pairRoot(original.config, original.id);
      if (
        original.name === "@deepseek-ai/dsh-agent-preset" &&
        Array.isArray(original.config?.plugins)
      ) {
        const config = clone(original.config),
          pairs: Pair[] = [];
        const visit = (plugins: Row[], path: string[]): void => {
          for (let position = 0; position < plugins.length; position++) {
            const native = plugins[position];
            if (REPLACEMENTS[native.name]) {
              if (!native.id) throw new Error(`Preset native row requires an id: ${original.id}.`);
              const before = clone(native),
                replacement = {
                  ...clone(native),
                  id: ownId(original.id + "/" + path.join("/"), native),
                  name: `${PACKAGE_NAME}/${REPLACEMENTS[native.name]}`,
                };
              native.disabled = true;
              plugins.splice(++position, 0, replacement);
              pairs.push({ path: [...path], original: before, replacement: clone(replacement) });
            }
            if (native.group && Array.isArray(native.config))
              visit(native.config, [...path, native.id]);
          }
        };
        visit(config.plugins, []);
        if (pairs.length) {
          add(
            "preset",
            `preset:${original.id}`,
            { id: original.id, name: original.name, config },
            { origin: clone(original), pairs },
          );
          touched.add(original.id);
        }
      }
    }
  };
  pairRoot(tree);
  for (const required of [
    "@deepseek-ai/dsh-sandbox-local",
    "@deepseek-ai/dsh-sandbox-policy",
    "@deepseek-ai/dsh-user-approval",
    "@deepseek-ai/dsh-permission-presets",
    "@deepseek-ai/dsh-fs-sandbox",
    "@deepseek-ai/dsh-tools",
  ])
    if (![...index.values()].some((row) => row.name === required && replacedIds.has(row.id)))
      throw new Error(`Required native provider is absent: ${required}.`);
  const purge = index.get("dsh-purge");
  if (
    !purge ||
    !["dsh-purge-community", "dsh-purge"].includes(purge.name) ||
    !Array.isArray(purge.inject) ||
    !purge.inject.every((value: any) => typeof value === "string")
  )
    throw new Error("Recognized Purge row with static inject list is required.");
  if (purge.isolate?.permissionPresets && purge.isolate.permissionPresets !== LABEL)
    throw new Error("Purge already selects another permission scope.");
  add("service", "bridge", {
    insert: [
      { id: "workspace-guard-permission-bridge", name: `${PACKAGE_NAME}/permission-bridge` },
    ],
  });
  add("service", "facade", {
    insert: [
      {
        id: "workspace-guard-purge-permission",
        name: `${PACKAGE_NAME}/purge-permission`,
        isolate: { permissionPresets: LABEL },
      },
    ],
  });
  add(
    "purge",
    "purge",
    {
      id: purge.id,
      name: purge.name,
      inject: [...new Set([...purge.inject, "permissionPresets"])],
      isolate: { ...purge.isolate, permissionPresets: LABEL },
    },
    { origin: clone(purge) },
  );
  touched.add(purge.id);
  for (const item of owned)
    if (item.kind === "replacement" || item.kind === "service")
      touched.add(item.installed.insert[0].id);
  for (const source of plan.later) homeConflicts(source, touched);
  const finalIndex = indexRows(
    composition([...plan.bundles, doc.toJS({ maxAliasCount: 100 }), ...plan.later]).tree,
  );
  for (const id of replacedIds)
    if (finalIndex.get(id)?.disabled !== true)
      throw new Error(`Native disable did not apply: ${id}.`);
  return {
    patch: String(doc),
    changed: String(doc) !== input.patch,
    receipt: { version: 2, profile, status: "active", owned },
    summary: [
      `Install ${replacedIds.size} native row pairs and ${owned.filter((row) => row.kind === "preset").length} preserved preset configurations.`,
      "Native tools, scopes, platform conditions and user configuration remain available; only Purge automatic Full Access promotion is suppressed.",
    ],
  };
}
async function optional(path: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (error: any) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
async function noLink(path: string): Promise<void> {
  if ((await fs.lstat(path)).isSymbolicLink())
    throw new Error(`Refusing symbolic-link write target: ${path}`);
}
function recoverReceipt(
  text: string,
  patch: string,
): { receipt?: GuardReceipt; needsFinalization: boolean } {
  let receipt: GuardReceipt | undefined = text ? JSON.parse(text) : undefined;
  const needsFinalization = !!receipt?.transaction;
  if (receipt?.transaction) {
    const current = hash(patch);
    if (current === receipt.transaction.after) {
      receipt = { ...receipt };
      delete receipt.transaction;
    } else if (current === receipt.transaction.before) receipt = receipt.transaction.previous;
    else
      throw new Error(
        "Interrupted transaction has an externally changed third state; manual recovery required.",
      );
  }
  return { receipt, needsFinalization };
}
async function loadProfile(
  options: ProfileOptions,
  validateVersions = true,
  lifecycle?: LifecyclePhase,
) {
  const profile = resolve(options.profile),
    patchPath = join(profile, "cordis.patch.yml"),
    stateDir = join(profile, ".workspace-guard"),
    receiptPath = join(stateDir, "receipt.json");
  const watched = new Map<string, string>(),
    read = async (path: string, missing = false) => {
      const text = missing ? await optional(path) : await fs.readFile(path, "utf8");
      watched.set(path, text);
      return text;
    };
  const manifestPath = join(profile, "package.json"),
    manifest = JSON.parse(await read(manifestPath)),
    bundles = manifest.dsh?.profile?.bundles;
  if (
    !Array.isArray(bundles) ||
    !bundles.every((name: any) => typeof name === "string") ||
    new Set(bundles).size !== bundles.length
  )
    throw new Error("Invalid selected bundle list.");
  const selected = bundles.includes(PACKAGE_NAME);
  // Offline removal may be needed after the host already deselected/uninstalled
  // the bundle. previewConfiguration still requires its matching ownership receipt.
  if (!selected && !lifecycle && validateVersions)
    throw new Error(
      "Select the installed guard bundle explicitly first; no packages are installed by this helper.",
    );
  const resolvers = [createRequire(manifestPath)];
  if (options.hostModules)
    resolvers.unshift(createRequire(join(resolve(options.hostModules), "..", "package.json")));
  const bundleLayers: string[] = [];
  for (const name of bundles) {
    // Removal must work after the package itself has gone. Its only bundle row
    // is this lifecycle entry; keep it for evaluating explicit disable patches.
    if (!validateVersions && name === PACKAGE_NAME) {
      bundleLayers.push(overlaySource([{ insert: [{ id: "workspace-guard-status", name }] }]));
      continue;
    }
    let manifestFile: string | undefined;
    for (const resolver of resolvers) {
      for (const search of resolver.resolve.paths(name) ?? []) {
        const candidate = join(search, name, "package.json");
        try {
          await fs.access(candidate);
          manifestFile = candidate;
          break;
        } catch {}
      }
      if (manifestFile) break;
    }
    if (!manifestFile)
      throw new Error(
        `Cannot resolve selected bundle: ${name}; supply --host-modules if host packages are separate.`,
      );
    const pkg = JSON.parse(await read(manifestFile));
    if (validateVersions) validateBundleVersion(name, pkg);
    const files =
      typeof pkg.dsh?.bundle?.patch === "string" ? [pkg.dsh.bundle.patch] : pkg.dsh?.bundle?.patch;
    if (!Array.isArray(files) || !files.every((file: any) => typeof file === "string"))
      throw new Error(`Invalid bundle declaration: ${name}`);
    for (const file of files) bundleLayers.push(await read(resolve(manifestFile, "..", file)));
  }
  const patch = await read(patchPath),
    homePatch = await read(
      join(resolve(options.home ?? join(profile, "..", "..")), "cordis.patch.yml"),
      true,
    );
  const receiptText = await read(receiptPath, true);
  const recovery = recoverReceipt(receiptText, patch);
  return {
    input: {
      profile,
      patch,
      homePatch,
      bundleLayers,
      receipt: recovery.receipt,
      overlays: options.overlays,
    },
    needsFinalization: recovery.needsFinalization,
    selected,
    watched,
    patchPath,
    stateDir,
    receiptPath,
  };
}
async function atomicWrite(path: string, value: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let file;
  try {
    file = await fs.open(temporary, "wx", 0o600);
    await file.writeFile(value, "utf8");
    await file.sync();
    await file.close();
    file = undefined;
    await fs.rename(temporary, path);
  } finally {
    await file?.close();
    await fs.rm(temporary, { force: true });
  }
}
export async function inspectConfiguration(
  options: ProfileOptions,
  action: "activate" | "deactivate" | "rollback" = "activate",
): Promise<GuardPlan> {
  return previewConfiguration((await loadProfile(options, action === "activate")).input, action);
}
export async function doctorConfiguration(
  options: ProfileOptions,
): Promise<{ status: string; summary: string[] }> {
  const loaded = await loadProfile(options);
  previewConfiguration(loaded.input, "activate");
  return {
    status: loaded.input.receipt?.status ?? "not-configured",
    summary: [
      "Native paired configuration and supported bundle versions checked. Running-host use is unverified.",
    ],
  };
}
export async function applyConfiguration(
  options: ProfileOptions,
  action: "activate" | "deactivate" | "rollback",
  acknowledgement: { apply: boolean; hostStopped: boolean },
): Promise<GuardPlan> {
  if (!acknowledgement.apply || !acknowledgement.hostStopped)
    throw new Error(
      "Writing requires both --apply and --host-stopped; every host using this profile must be idle and stopped.",
    );
  return (await transactConfiguration(options, action))!;
}
type LoadedProfile = Awaited<ReturnType<typeof loadProfile>>;
type ConfigurationAction = "activate" | "deactivate" | "rollback";
function lifecycleAction(
  loaded: LoadedProfile,
  phase: LifecyclePhase,
  plan: Planning,
): ConfigurationAction | undefined {
  // A failed initialization loses its disposer even while the bundle remains
  // selected. Restore an existing installation before relinquishing ownership.
  if (phase === "failed-load")
    return loaded.input.receipt?.status === "active" ? "deactivate" : undefined;
  const tree = composition([...plan.bundles, plan.profileRows, ...plan.later]).tree;
  let enabled = false,
    disabled = false,
    found = false;
  const visit = (entries: Row[], parentEnabled = true, parentDisabled = false): void => {
    for (const row of entries) {
      const off = parentDisabled || row.disabled === true,
        on = parentEnabled && (row.disabled === undefined || row.disabled === false);
      if (row.id === "workspace-guard-status" && row.name === PACKAGE_NAME) {
        found = true;
        enabled = on;
        disabled = off;
      }
      if (row.group && Array.isArray(row.config)) visit(row.config, on, off);
    }
  };
  visit(tree);
  if (phase === "load") {
    if (loaded.selected && found && !enabled && !disabled)
      throw new Error(
        "Unsupported dynamic lifecycle state: workspace-guard-status must be statically enabled or disabled before automatic configuration can run.",
      );
    return loaded.selected && enabled ? "activate" : undefined;
  }
  return loaded.input.receipt?.status === "active" && (!loaded.selected || disabled)
    ? "deactivate"
    : undefined;
}
/** The installed lifecycle is authorization; manual CLI callers still need acknowledgements. */
export async function synchronizeInstalledConfiguration(
  options: ProfileOptions,
  phase: LifecyclePhase,
): Promise<GuardPlan | undefined> {
  if (phase !== "load") {
    const profile = resolve(options.profile),
      recovery = recoverReceipt(
        await optional(join(profile, ".workspace-guard", "receipt.json")),
        await optional(join(profile, "cordis.patch.yml")),
      );
    if (recovery.receipt?.status !== "active" && !recovery.needsFinalization) return undefined;
  }
  return transactConfiguration(
    options,
    (loaded, plan) => lifecycleAction(loaded, phase, plan),
    phase,
  );
}
async function transactConfiguration(
  options: ProfileOptions,
  select:
    | ConfigurationAction
    | ((loaded: LoadedProfile, plan: Planning) => ConfigurationAction | undefined),
  lifecycle?: LifecyclePhase,
): Promise<GuardPlan | undefined> {
  const prepare = async () => {
    const loaded = await loadProfile(
        options,
        lifecycle ? lifecycle === "load" : select === "activate",
        lifecycle,
      ),
      parsed = planning(loaded.input),
      action = typeof select === "function" ? select(loaded, parsed) : select;
    const plan = action ? previewPlanned(loaded.input, action, parsed) : undefined;
    return {
      loaded,
      plan,
      receiptChanged:
        loaded.needsFinalization || (!!plan && !same(plan.receipt, loaded.input.receipt)),
    };
  };
  const initial = await prepare();
  // A repeated host load must not touch the patch, receipt or lock directory.
  if (!initial.plan?.changed && !initial.receiptChanged) return initial.plan;
  const profile = resolve(options.profile),
    stateDir = join(profile, ".workspace-guard");
  const canonical = await fs.realpath(profile),
    normalized = (value: string) => (process.platform === "win32" ? value.toLowerCase() : value);
  if (normalized(canonical) !== normalized(profile))
    throw new Error(
      "Profile path contains a redirected ancestor; use its reviewed canonical directory.",
    );
  await noLink(profile);
  await noLink(join(profile, "cordis.patch.yml"));
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  await noLink(stateDir);
  return withConfigurationLock(
    stateDir,
    async () => {
      const { loaded, plan, receiptChanged } = await prepare();
      if (!plan?.changed && !receiptChanged) return plan;
      for (const [path, content] of loaded.watched)
        if ((await optional(path)) !== content)
          throw new Error(`Configuration changed during planning: ${path}.`);
      if (!plan?.changed) {
        // A verified interrupted transaction needs a durable receipt commit even
        // when the profile patch is already correct. Diagnostics never enter here.
        const receipt = plan?.receipt ?? loaded.input.receipt;
        if (receipt) await atomicWrite(loaded.receiptPath, JSON.stringify(receipt, null, 2) + "\n");
        else await fs.unlink(loaded.receiptPath);
        return plan;
      }
      const pending = {
        ...plan.receipt,
        transaction: {
          before: hash(loaded.input.patch),
          after: hash(plan.patch),
          previous: loaded.input.receipt,
        },
      };
      await atomicWrite(loaded.receiptPath, JSON.stringify(pending, null, 2) + "\n");
      if ((await fs.readFile(loaded.patchPath, "utf8")) !== loaded.input.patch)
        throw new Error("Patch changed before replacement; journal retained without overwrite.");
      await noLink(loaded.patchPath);
      await atomicWrite(loaded.patchPath, plan.patch);
      await atomicWrite(loaded.receiptPath, JSON.stringify(plan.receipt, null, 2) + "\n");
      return plan;
    },
    atomicWrite,
  );
}
