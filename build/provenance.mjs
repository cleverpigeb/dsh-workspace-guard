// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { verifyUpstream, sha256 } from "./verify-upstream.mjs";
import { selectedPackages, standalonePackages } from "./upstream.mjs";
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const inputs = verifyUpstream();
const licenses = [...selectedPackages, ...standalonePackages].map(name => {
  const dir = dirname(require.resolve(`${name}/package.json`));
  const file = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map(file => join(dir, file)).find(existsSync);
  if (!file) throw new Error(`License missing for bundled package: ${name}`);
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  return `${name}@${manifest.version}\n${"=".repeat(72)}\n${readFileSync(file, "utf8")}\n`;
});
writeFileSync("lib/THIRD_PARTY_LICENSES.txt", licenses.join("\n"));
// npm-packlist excludes pnpm-lock.yaml even in an explicit files allowlist.
writeFileSync("lib/build-lock.yaml", readFileSync("pnpm-lock.yaml"));
const files = readdirSync("lib").filter(name => name !== "provenance.json").sort();
writeFileSync("lib/provenance.json", JSON.stringify({
  formatVersion: 1,
  project: { name: manifest.name, version: manifest.version, license: manifest.license },
  inputs,
  lockfileSha256: sha256(readFileSync("pnpm-lock.yaml")),
  packagedLockfile: { file: "lib/build-lock.yaml", restoreAs: "pnpm-lock.yaml" },
  preservedPurgePatches: [22, 48],
  outputs: files.map(file => ({ file, sha256: sha256(readFileSync(`lib/${file}`)) })),
}, null, 2) + "\n");
console.log(`Recorded provenance for ${inputs.length} inputs and ${files.length} output files.`);
