// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { isMap, isSeq, parseDocument, type Document, type YAMLMap, type YAMLSeq } from "yaml";
import { validateBundleVersion } from "./compatibility.js";

export const PACKAGE_NAME = "dsh-workspace-guard";
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
function laterLayers(input: PreviewInput): string[] {
  return [input.homePatch ?? "[]", overlaySource(input.overlays)];
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
/** Mirror the formal boot loader's replacement, insertion and name-guard rules. */
export function composeLayers(layers: string[]): Row[] {
  const tree: Row[] = [],
    index = new Map<string, Row>();
  for (const source of layers)
    for (const patch of rows(source)) {
      const { id, name, insert, ...fields } = patch;
      if (insert) {
        if (!Array.isArray(insert)) throw new Error("insert must be an array.");
        const parent = id ? index.get(id) : undefined;
        if (id && (!parent || !parent.group))
          throw new Error(`Insert target is missing or not a group: ${id}`);
        const added = clone(insert);
        (parent ? (parent.config ??= []) : tree).push(...added);
        indexRows(added, index);
      } else {
        const target = index.get(id);
        if (target && (!name || target.name === name)) Object.assign(target, clone(fields));
      }
    }
  return tree;
}
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
function restoreOwned(doc: Document, receipt: GuardReceipt | undefined, layers: string[]): void {
  if (!receipt || receipt.status !== "active") return;
  const saved = receipt.owned.map((owned) => ({ owned, node: marked(doc, owned) }));
  for (const { node } of saved) {
    const list = (doc.contents as YAMLSeq).items;
    list.splice(list.indexOf(node), 1);
  }
  for (const { owned, node } of saved) {
    const current = node.toJSON() as Row,
      installed = owned.installed,
      liveIndex = indexRows(composeLayers([...layers, String(doc)]));
    if (owned.kind === "disable") {
      identity(current, installed);
      if (current.disabled !== true)
        throw new Error(`Owned native disable changed: ${installed.id}.`);
      const extras = { ...current };
      delete extras.disabled;
      if (Object.keys(extras).some((key) => key !== "id" && key !== "name")) append(doc, extras);
    } else if (owned.kind === "replacement") {
      if (current.id !== installed.id || !Array.isArray(current.insert))
        throw new Error(`Owned insertion changed: ${owned.key}.`);
      const expected = installed.insert[0],
        replacement = current.insert.find((row: Row) => row.id === expected.id);
      if (!replacement) throw new Error(`Owned replacement removed: ${expected.id}.`);
      identity(replacement, expected);
      const live = liveIndex.get(owned.origin!.id);
      if (!live || live.name !== owned.origin!.name)
        throw new Error(`Native origin changed: ${owned.origin!.id}.`);
      const updated = mergeDelta(expected, replacement, live, owned.origin);
      updated.id = live.id;
      updated.name = live.name;
      const fields = changedFields(live, updated);
      if (Object.keys(fields).length) append(doc, { id: live.id, name: live.name, ...fields });
      const unrelated = current.insert.filter((row: Row) => row !== replacement);
      if (unrelated.length) append(doc, { ...current, insert: unrelated });
    } else if (owned.kind === "preset") {
      identity(current, installed);
      const live = liveIndex.get(installed.id);
      if (!live || live.name !== installed.name)
        throw new Error(`Preset origin changed: ${installed.id}.`);
      const merged = mergeDelta(
          owned.origin!.config,
          undoPreset(current.config, owned.pairs!),
          live.config,
        ),
        extra = changedFields(installed, current);
      delete extra.config;
      if (!same(merged, live.config) || Object.keys(extra).length)
        append(doc, { id: live.id, name: live.name, ...extra, config: merged });
    } else if (owned.kind === "purge") {
      identity(current, installed);
      if (current.isolate?.permissionPresets !== LABEL)
        throw new Error("Owned Purge isolation changed.");
      const cleaned = clone(current);
      if (owned.origin!.isolate?.permissionPresets === undefined)
        delete cleaned.isolate.permissionPresets;
      else cleaned.isolate.permissionPresets = clone(owned.origin!.isolate.permissionPresets);
      if (!Object.keys(cleaned.isolate).length && !owned.origin!.isolate) delete cleaned.isolate;
      if (!owned.origin!.inject?.includes("permissionPresets"))
        cleaned.inject = cleaned.inject.filter((name: string) => name !== "permissionPresets");
      const baseline = {
        id: installed.id,
        name: installed.name,
        inject: owned.origin!.inject,
        ...(owned.origin!.isolate ? { isolate: owned.origin!.isolate } : {}),
      };
      const live = liveIndex.get(installed.id);
      if (!live || live.name !== installed.name) throw new Error("Purge origin changed.");
      const fields = changedFields(live, mergeDelta(baseline, cleaned, live));
      if (Object.keys(fields).length) append(doc, { id: live.id, name: live.name, ...fields });
    } else if (!same(current, installed))
      throw new Error(
        `Guard bridge/facade was edited: ${owned.key}; preserve and resolve before removal.`,
      );
  }
}
function ownId(scope: string, row: Row): string {
  return `workspace-guard-${row.id}-${hash(scope + ":" + row.id).slice(0, 8)}`;
}
function explicitConfig(input: PreviewInput, id: string, key: string): boolean {
  return [input.patch, ...laterLayers(input)].some((source) =>
    rows(source).some((row) => row.id === id && row.config && key in row.config),
  );
}
function freshDefaults(input: PreviewInput, original: Row, replacement: Row): void {
  if (
    original.name === "@deepseek-ai/dsh-sandbox-policy" &&
    !explicitConfig(input, original.id, "mode") &&
    (!original.config?.mode ||
      (js(original.config.mode) && /DSH_PERMISSION_MODE/.test(original.config.mode.__jsExpr)))
  )
    replacement.config = {
      ...replacement.config,
      mode: { __jsExpr: "process.env.DSH_PERMISSION_MODE ?? 'workspace-write'" },
    };
  if (
    original.name === "@deepseek-ai/dsh-user-approval" &&
    !explicitConfig(input, original.id, "policy") &&
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
function homeConflicts(source: string, affected: Set<string>): void {
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
  inspect(rows(source));
}
/** The bridge must bind one available root authority without changing Purge eligibility. */
function requireRootPermissionAuthority(tree: Row[]): void {
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
      if (row.name === "@deepseek-ai/dsh-permission-presets" && state !== "disabled") {
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
function verifyActive(input: PreviewInput, receipt: GuardReceipt): void {
  const current = composeLayers([...input.bundleLayers, input.patch, ...laterLayers(input)]),
    index = indexRows(current);
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
  for (const source of laterLayers(input)) homeConflicts(source, affected);
  const lowerDoc = document(input.patch);
  for (const item of receipt.owned) {
    const node = marked(lowerDoc, item),
      list = (lowerDoc.contents as YAMLSeq).items;
    list.splice(list.indexOf(node), 1);
  }
  const lower = indexRows(composeLayers([...input.bundleLayers, String(lowerDoc)]));
  requireRootPermissionAuthority(composeLayers([...input.bundleLayers, String(lowerDoc)]));
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
    const inspect = (entries: Row[], path: string[]): void => {
      for (const row of entries) {
        const pair = owned.pairs!.find(
          (item) => same(item.path, path) && item.original.id === row.id,
        );
        const guard = owned.pairs!.find(
          (item) => same(item.path, path) && item.replacement.id === row.id,
        );
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
  const doc = document(input.patch),
    profile = resolve(input.profile),
    receipt = input.receipt;
  if (receipt && (receipt.version !== 2 || receipt.profile !== profile))
    throw new Error(
      "Receipt version/profile mismatch. Legacy releases require explicit separate migration; no files changed.",
    );
  if (action !== "activate" && !receipt)
    throw new Error("No ownership receipt exists for this profile.");
  if (action === "activate" && receipt?.status === "active") {
    const probe = document(input.patch);
    restoreOwned(probe, receipt, input.bundleLayers);
    verifyActive(input, receipt);
    return {
      patch: input.patch,
      changed: false,
      receipt,
      summary: ["Already active; native pairs and ownership remain in place."],
    };
  }
  restoreOwned(doc, receipt, input.bundleLayers);
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
  const tree = composeLayers([...input.bundleLayers, String(doc)]),
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
        freshDefaults(input, original, replacement);
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
  for (const source of laterLayers(input)) homeConflicts(source, touched);
  const finalIndex = indexRows(
    composeLayers([...input.bundleLayers, String(doc), ...laterLayers(input)]),
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
function recoverReceipt(text: string, patch: string): GuardReceipt | undefined {
  let receipt: GuardReceipt | undefined = text ? JSON.parse(text) : undefined;
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
  return receipt;
}
async function loadProfile(
  options: ProfileOptions,
  validateVersions = true,
  lifecycle?: "load" | "dispose",
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
  const receipt = recoverReceipt(receiptText, patch);
  return {
    input: { profile, patch, homePatch, bundleLayers, receipt, overlays: options.overlays },
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
  phase: "load" | "dispose",
): ConfigurationAction | undefined {
  const tree = composeLayers([
    ...loaded.input.bundleLayers,
    loaded.input.patch,
    ...laterLayers(loaded.input),
  ]);
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
  phase: "load" | "dispose",
): Promise<GuardPlan | undefined> {
  if (phase === "dispose") {
    const profile = resolve(options.profile),
      receipt = recoverReceipt(
        await optional(join(profile, ".workspace-guard", "receipt.json")),
        await optional(join(profile, "cordis.patch.yml")),
      );
    if (receipt?.status !== "active") return undefined;
  }
  return transactConfiguration(options, (loaded) => lifecycleAction(loaded, phase), phase);
}
async function transactConfiguration(
  options: ProfileOptions,
  select: ConfigurationAction | ((loaded: LoadedProfile) => ConfigurationAction | undefined),
  lifecycle?: "load" | "dispose",
): Promise<GuardPlan | undefined> {
  const prepare = async () => {
    const loaded = await loadProfile(
        options,
        lifecycle ? lifecycle === "load" : select === "activate",
        lifecycle,
      ),
      action = typeof select === "function" ? select(loaded) : select;
    return { loaded, plan: action ? previewConfiguration(loaded.input, action) : undefined };
  };
  const initial = await prepare();
  // A repeated host load must not touch the patch, receipt or lock directory.
  if (!initial.plan?.changed) return initial.plan;
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
  const lockPath = join(stateDir, "configuration.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    const { loaded, plan } = await prepare();
    if (!plan?.changed) return plan;
    for (const [path, content] of loaded.watched)
      if ((await optional(path)) !== content)
        throw new Error(`Configuration changed during planning: ${path}.`);
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
  } finally {
    if (lock) {
      await lock.close();
      await fs.rm(lockPath, { force: true });
    }
  }
}
