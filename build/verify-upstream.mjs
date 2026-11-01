import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { selectedModules, packageName, upstreamVersion } from "./upstream.mjs";

const require = createRequire(import.meta.url);
const lockPath = new URL("./upstream-lock.json", import.meta.url);
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
function tarFiles(bytes) {
  const archive = gunzipSync(bytes), files = new Map();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/s, "");
    if (!name) break;
    const prefix = header.subarray(345, 500).toString().replace(/\0.*$/s, "");
    const size = Number.parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, "").trim(), 8);
    if (!Number.isFinite(size)) throw new Error(`Unsupported tar header: ${name}`);
    files.set(prefix ? `${prefix}/${name}` : name, archive.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function refresh() {
  const records = await Promise.all(selectedModules.map(async specifier => {
    const name = packageName(specifier);
    const manifestPath = require.resolve(`${name}/package.json`);
    const entryPath = require.resolve(specifier);
    const file = relative(dirname(manifestPath), entryPath).replaceAll("\\", "/");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version !== upstreamVersion) throw new Error(`Unexpected installed ${name}: ${manifest.version}`);
    const metadata = JSON.parse((await fetchBytes(`https://registry.npmjs.org/${name}/${upstreamVersion}`)).toString());
    const archive = await fetchBytes(metadata.dist.tarball);
    const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
    if (integrity !== metadata.dist.integrity) throw new Error(`Registry integrity mismatch: ${name}`);
    const files = tarFiles(archive);
    const source = files.get(`package/${file}`), license = files.get("package/LICENSE");
    if (!source || !license) throw new Error(`Official source/license missing: ${name}`);
    if (sha256(source) !== sha256(readFileSync(entryPath))) throw new Error(`Installed source differs from official archive: ${name}`);
    return { name, version: upstreamVersion, specifier, file, license: manifest.license,
      tarball: metadata.dist.tarball, integrity, archiveSha256: sha256(archive),
      sourceSha256: sha256(source), licenseSha256: sha256(license) };
  }));
  writeFileSync(lockPath, JSON.stringify(records, null, 2) + "\n");
  return records;
}
export function verifyUpstream() {
  const records = JSON.parse(readFileSync(lockPath, "utf8"));
  if (records.map(item => item.specifier).join() !== selectedModules.join()) throw new Error("Upstream module list changed; refresh official provenance first");
  for (const record of records) {
    const manifestPath = require.resolve(`${record.name}/package.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version !== record.version || sha256(readFileSync(require.resolve(record.specifier))) !== record.sourceSha256)
      throw new Error(`Upstream source mismatch: ${record.specifier}; install the locked official dependency`);
    if (sha256(readFileSync(join(dirname(manifestPath), "LICENSE"))) !== record.licenseSha256)
      throw new Error(`Upstream license mismatch: ${record.name}`);
  }
  return records;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const records = process.argv.includes("--refresh") ? await refresh() : verifyUpstream();
  console.log(`Verified ${records.length} official module inputs at ${upstreamVersion}.`);
}
