// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const packageName = "@cleverpig/dsh-workspace-guard";
const repository = "cleverpigeb/dsh-workspace-guard";
const hash = (algorithm, bytes, encoding = "hex") => createHash(algorithm).update(bytes).digest(encoding);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Read regular tar members without extraction or third-party install-time dependencies.
// Reject links, extensions, duplicates, unexpected roots and unsafe paths.
export function readArchive(bytes, allowedRoots) {
  const tar = gunzipSync(bytes, { maxOutputLength: 512 * 1024 * 1024 });
  const files = new Map();
  const members = new Map(), parents = new Set();
  const roots = allowedRoots && new Set(allowedRoots);
  let offset = 0;
  const field = (header, start, length) => header.subarray(start, start + length).toString("utf8").split("\0")[0];
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      assert(tar.subarray(offset).every(byte => byte === 0), "Unexpected data after tar end marker");
      return files;
    }
    const octal = value => { assert(/^[0-7]+$/.test(value.trim()), "Invalid tar numeric field"); return Number.parseInt(value.trim(), 8); };
    const checksum = octal(field(header, 148, 8));
    assert(header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0) === checksum, "Invalid tar header checksum");
    const name = [field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join("/");
    const path = name.replace(/\/$/, "");
    assert(path && !path.includes("\\") && !path.includes(":") && !path.startsWith("/") && !path.split("/").some(part => !part || part === "." || part === ".."), `Unsafe archive path: ${name}`);
    const type = field(header, 156, 1);
    assert(type === "" || type === "0" || type === "5", `Unsupported archive member: ${name}`);
    assert(type === "5" || !name.endsWith("/"), `Regular archive member has trailing slash: ${name}`);
    const parts = path.split("/");
    assert(!roots || roots.has(parts[0]), `Unexpected archive root: ${path}`);
    assert(!members.has(path), `Duplicate archive member: ${path}`);
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/");
      assert(members.get(parent) !== "file", `Archive member has a regular-file ancestor: ${path}`);
      parents.add(parent);
    }
    assert(type === "5" || !parents.has(path), `Archive file conflicts with directory: ${path}`);
    members.set(path, type === "5" ? "directory" : "file");
    const size = octal(field(header, 124, 12));
    assert(Number.isSafeInteger(size) && offset + 512 + size <= tar.length, "Truncated tar member");
    if (type === "5") assert(size === 0, "Directory has unexpected content");
    else {
      files.set(path, tar.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error("Missing tar end marker");
}

export function verifyArtifacts({ root, assets, tag }) {
  assert(/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag), "A stable vX.Y.Z tag is required");
  const version = tag.slice(1);
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert(manifest.name === packageName && manifest.version === version, "Tag does not match scoped package metadata");
  assert(manifest.repository?.url === `git+https://github.com/${repository}.git`, "Unexpected package repository");
  const base = `cleverpig-dsh-workspace-guard-${version}`;
  const npmName = `${base}.tgz`, sourceName = `${base}-source.tar.gz`;
  const sums = new Map();
  for (const line of readFileSync(resolve(assets, "SHA256SUMS"), "utf8").trim().split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64}) [ *]([^/\\]+)$/.exec(line);
    assert(match && !sums.has(match[2]), "Invalid or duplicate SHA256SUMS entry");
    sums.set(match[2], match[1].toLowerCase());
  }
  const npmBytes = readFileSync(resolve(assets, npmName));
  const sourceBytes = readFileSync(resolve(assets, sourceName));
  for (const [name, bytes] of [[npmName, npmBytes], [sourceName, sourceBytes]]) {
    assert(sums.get(name) === hash("sha256", bytes), `Release checksum mismatch: ${name}`);
  }
  const packaged = readArchive(npmBytes, ["package"]);
  const archivedManifest = JSON.parse(packaged.get("package/package.json")?.toString("utf8") ?? "null");
  assert(archivedManifest?.name === packageName && archivedManifest.version === version, "npm archive package identity mismatch");
  const equalCheckout = (path, bytes) => {
    assert(bytes && bytes.equals(readFileSync(resolve(root, path))), `Tagged checkout mismatch: ${path}`);
  };
  for (const [path, bytes] of packaged) {
    assert(path.startsWith("package/"), `Unexpected npm archive root: ${path}`);
    equalCheckout(path.slice("package/".length), bytes);
  }
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  assert(tracked.status === 0, "Cannot read tagged Git file list");
  const projectFiles = tracked.stdout.split("\0").filter(path => path && path !== ".gitignore" && path !== ".gitattributes");
  const projectFileSet = new Set(projectFiles);
  const requiredFiles = ["cordis.patch.yml", "icon.svg", "package.json", "LICENSE", "THIRD_PARTY_NOTICES.md"];
  for (const path of requiredFiles) assert(projectFileSet.has(path), `Tagged required file is missing: ${path}`);
  const runtimeFiles = projectFiles.filter(path => path.startsWith("lib/") || path.startsWith("locale/") || requiredFiles.includes(path));
  assert(runtimeFiles.some(path => path === "lib/index.js"), "Tagged runtime is missing");
  for (const path of runtimeFiles) equalCheckout(path, packaged.get(`package/${path}`));
  const source = readArchive(sourceBytes, ["project", "upstream", "source-manifest.json"]);
  const sourceManifest = JSON.parse(source.get("source-manifest.json")?.toString("utf8") ?? "null");
  assert(sourceManifest?.project?.name === packageName && sourceManifest.project.version === version, "Source archive identity mismatch");
  assert(Array.isArray(sourceManifest.files) && sourceManifest.files.length === projectFiles.length, "Source project file count mismatch");
  const seen = new Set();
  for (const entry of sourceManifest.files) {
    assert(projectFileSet.has(entry.file) && !seen.has(entry.file), "Unexpected or duplicate source manifest file");
    seen.add(entry.file);
    const bytes = source.get(`project/${entry.file}`);
    equalCheckout(entry.file, bytes);
    assert(hash("sha256", bytes) === entry.sha256, `Source manifest checksum mismatch: ${entry.file}`);
  }
  const upstream = JSON.parse(readFileSync(resolve(root, "build/source-lock.json"), "utf8"));
  assert(upstream.length === 4 && JSON.stringify(sourceManifest.upstream) === JSON.stringify(upstream), "Source upstream manifest mismatch");
  for (const entry of upstream) {
    const bytes = source.get(`upstream/${entry.file}`);
    assert(bytes && bytes.length === entry.bytes && hash("sha256", bytes) === entry.sha256, `Upstream source checksum mismatch: ${entry.file}`);
  }
  assert(source.size === projectFiles.length + upstream.length + 1, "Unexpected files in source archive");
  return { name: packageName, version, tarball: resolve(assets, npmName), integrity: `sha512-${hash("sha512", npmBytes, "base64")}` };
}

export async function registryState(release, request = fetch) {
  const response = await request(`https://registry.npmjs.org/${encodeURIComponent(release.name)}/${release.version}`, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return "unpublished";
  assert(response.ok, `npm registry lookup failed: HTTP ${response.status}`);
  const published = await response.json();
  assert(published.name === release.name && published.version === release.version && published.dist?.integrity === release.integrity, "Already-published npm version has different bytes; refusing to overwrite");
  return "identical";
}

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--verify-only"), "Usage: node build/publish-release.mjs [--verify-only]");
  assert(process.env.RELEASE_ASSETS_DIR && process.env.RELEASE_TAG, "RELEASE_ASSETS_DIR and RELEASE_TAG are required");
  const release = verifyArtifacts({ root, assets: process.env.RELEASE_ASSETS_DIR, tag: process.env.RELEASE_TAG });
  console.log(`Verified ${release.name}@${release.version} and its source companion against the tagged checkout`);
  if (process.argv[2] === "--verify-only") return;
  assert(process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY === repository, "Publishing is restricted to the owning GitHub Actions repository");
  const git = argv => {
    const result = spawnSync("git", argv, { cwd: root, encoding: "utf8" });
    assert(result.status === 0, "Cannot verify release tag checkout");
    return result.stdout.trim();
  };
  assert(git(["rev-parse", "HEAD"]) === git(["rev-parse", `refs/tags/${process.env.RELEASE_TAG}^{commit}`]), "Checkout does not match release tag");
  const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" });
  const npm = npmVersion.stdout?.trim().split(".").map(Number);
  assert(npmVersion.status === 0 && npm?.length === 3 && (npm[0] > 11 || (npm[0] === 11 && (npm[1] > 5 || (npm[1] === 5 && npm[2] >= 1)))), "npm >=11.5.1 is required");
  assert(Number(process.versions.node.split(".")[0]) >= 24, "Node.js >=24 is required");
  if (await registryState(release) === "identical") {
    console.log("Identical tarball already published; successful retry without republishing");
    return;
  }
  const published = spawnSync("npm", ["publish", release.tarball, "--access", "public", "--ignore-scripts", "--registry", "https://registry.npmjs.org"], { cwd: root, stdio: "inherit", timeout: 180_000 });
  assert(!published.error && published.status === 0, `npm publish failed: ${published.error?.message ?? published.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
