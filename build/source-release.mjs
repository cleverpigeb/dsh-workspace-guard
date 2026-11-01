// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { selectedPackages, standalonePackages } from "./upstream.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const inputs = JSON.parse(readFileSync(new URL("./source-lock.json", import.meta.url), "utf8"));
for (const name of [...selectedPackages, ...standalonePackages]) {
  const source = inputs.flatMap(input => input.packages).find(input => input.name === name);
  if (source?.version !== manifest.devDependencies[name]) throw new Error(`Source revision needs review for ${name}`);
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output")) {
  throw new Error("Usage: node build/source-release.mjs [--output <directory>]");
}
const output = resolve(root, args[1] ?? ".local/artifacts");
const cache = join(root, ".local/licensing/upstream");
mkdirSync(output, { recursive: true });
mkdirSync(cache, { recursive: true });
const archiveName = manifest.name.replace(/^@/, "").replaceAll("/", "-");
const destination = join(output, `${archiveName}-${manifest.version}-source.tar.gz`);
if (existsSync(destination)) throw new Error(`Source archive already exists: ${destination}`);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: root, encoding: "utf8", timeout: 120_000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
const files = run("git", ["ls-files", "-z"]).split("\0").filter(Boolean).sort();
for (const required of ["src/index.ts", "build/source-release.mjs", "build/source-lock.json", "pnpm-lock.yaml", "LICENSE"]) {
  if (!files.includes(required)) throw new Error(`Stage maintained release files first; missing Git entry: ${required}`);
}
const stage = mkdtempSync(join(output, ".source-stage-"));
const stagePath = realpathSync(stage);
const outputPath = realpathSync(output);
if (!stagePath.startsWith(outputPath + sep)) throw new Error("Unexpected source staging directory");
try {
  const project = files.map(file => {
    const publishingWorkflow = file === ".github/workflows/publish.yml";
    if ((!publishingWorkflow && file.split("/").some(part => part === ".." || part.startsWith("."))) || /(^|\/)(AGENTS|CLAUDE|GEMINI)(\.|$)/i.test(file)) {
      if (file === ".gitignore" || file === ".gitattributes") return null;
      throw new Error(`Unexpected local/agent file in release source: ${file}`);
    }
    const from = join(root, file), to = join(stage, "project", file);
    if (!lstatSync(from).isFile() || lstatSync(from).isSymbolicLink()) throw new Error(`Source must be a regular file: ${file}`);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    return { file, sha256: sha256(readFileSync(to)) };
  }).filter(Boolean);
  mkdirSync(join(stage, "upstream"));
  for (const input of inputs) {
    if (!/^[a-z0-9._-]+\.tar\.gz$/i.test(input.file)) throw new Error(`Invalid source archive name: ${input.file}`);
    const cached = join(cache, input.file);
    let bytes;
    if (existsSync(cached)) {
      if (lstatSync(cached).isSymbolicLink()) throw new Error(`Source cache is a link: ${cached}`);
      bytes = readFileSync(cached);
    } else {
      const response = await fetch(input.url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Source download failed: ${input.url} (${response.status})`);
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 128 * 1024 * 1024) throw new Error(`Source archive exceeds size limit: ${input.file}`);
        chunks.push(chunk);
      }
      bytes = Buffer.concat(chunks);
    }
    if (bytes.length !== input.bytes || sha256(bytes) !== input.sha256) throw new Error(`Source integrity mismatch: ${input.file}`);
    if (!existsSync(cached)) writeFileSync(cached, bytes, { flag: "wx" });
    writeFileSync(join(stage, "upstream", input.file), bytes);
  }
  writeFileSync(join(stage, "source-manifest.json"), JSON.stringify({
    project: { name: manifest.name, version: manifest.version, license: manifest.license },
    files: project,
    upstream: inputs,
    verification: "Archive integrity and release-source paths checked; upstream rebuild equivalence and complete combined-host source obligations are not established by this archive.",
  }, null, 2) + "\n");
  const archive = join(stage, "source.tar.gz");
  run("tar", ["-czf", archive, "-C", stage, "project", "upstream", "source-manifest.json"]);
  const bytes = readFileSync(archive);
  renameSync(archive, destination);
  console.log(JSON.stringify({ file: destination, bytes: bytes.length, sha256: sha256(bytes), projectFiles: project.length, upstreamArchives: inputs.length }, null, 2));
} finally {
  // Only this invocation's directory is removed; archive members are never extracted.
  if (!lstatSync(stage).isSymbolicLink() && realpathSync(stage) === stagePath && stagePath.startsWith(outputPath + sep)) {
    rmSync(stage, { recursive: true });
  }
}
