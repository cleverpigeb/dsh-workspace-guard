// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";
import { entries, selectedModules, selectedPackages, standalonePackages } from "./build/upstream.mjs";
import { preservePurge } from "./build/preserve-purge.mjs";
import { hostIdentities, hostIdentityImports } from "./build/host-identities.mjs";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    "permission-bridge": "src/permission-bridge.ts",
    "purge-permission": "src/purge-permission.ts",
    ...Object.fromEntries(Object.keys(entries).map(name => [name, `src/entries/${name}.ts`])),
  },
  outDir: "lib",
  platform: "node",
  format: "esm",
  target: "node22",
  dts: false,
  sourcemap: false,
  banner: `/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */`,
  outExtensions: () => ({ js: ".js" }),
  deps: {
    neverBundle: true,
    alwaysBundle: id => selectedModules.includes(id) || hostIdentityImports.includes(id) || standalonePackages.some(name => id === name || id.startsWith(`${name}/`)),
    onlyBundle: [...selectedPackages, ...standalonePackages],
    onlyImport: Object.keys(manifest.peerDependencies),
  },
  plugins: [preservePurge(), hostIdentities()],
});
