// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { withFileLock } from "@deepseek-ai/dsh-atomic-write";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const WAIT_MS = 2000;
type Writer = (path: string, value: string) => Promise<void>;

async function optionalRecord(path: string): Promise<string | undefined> {
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Not a regular lock file: ${path}`);
    return await fs.readFile(path, "utf8");
  } catch (error: any) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}
function legacyPid(record: string | undefined): number | undefined {
  if (!record?.startsWith("{")) return undefined;
  try {
    const value = JSON.parse(record);
    if (
      Object.keys(value).length === 2 &&
      Number.isInteger(value.pid) &&
      value.pid > 0 &&
      value.pid <= 2147483647 &&
      typeof value.createdAt === "string" &&
      Number.isFinite(Date.parse(value.createdAt))
    )
      return value.pid;
  } catch {}
  return undefined;
}
function exited(pid: number): boolean {
  if (pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error: any) {
    return error.code === "ESRCH";
  }
}

/** Keep the original lock pathname, including while converting a dead v0.2.1 holder. */
export async function withConfigurationLock<T>(
  stateDir: string,
  operation: () => Promise<T>,
  write: Writer,
): Promise<T> {
  const filename = join(stateDir, "configuration"),
    lockPath = `${filename}.lock`;
  const migrate = async (): Promise<boolean> => {
    const observed = await optionalRecord(lockPath),
      pid = legacyPid(observed);
    if (pid === undefined || !exited(pid)) return false;
    return withFileLock(
      join(stateDir, "configuration-migration"),
      async () => {
        if ((await optionalRecord(lockPath)) !== observed || !exited(pid)) return false;
        // The native acquirer cannot take a JSON record. The migration mutex keeps
        // a second converter from replacing a subsequently acquired native lock.
        await write(lockPath, `${pid}\n`);
        return true;
      },
      { waitMs: WAIT_MS },
    );
  };
  await migrate();
  for (let attempt = 0; ; attempt++) {
    let enteredOperation = false;
    try {
      return await withFileLock(
        filename,
        async () => {
          enteredOperation = true;
          return operation();
        },
        { waitMs: WAIT_MS },
      );
    } catch (error) {
      // An old writer may have created JSON after the initial inspection.
      // Never retry a callback (even when its error resembles a lock timeout).
      if (
        enteredOperation ||
        attempt !== 0 ||
        !(error instanceof Error) ||
        !error.message.startsWith("atomic-write: timed out waiting for the writer lock at ") ||
        !(await migrate())
      )
        throw error;
    }
  }
}

type LockFile = {
  name: string;
  sha256: string;
  size: number;
  mtimeMs: number;
  ino: number;
  dev: number;
  record: string;
};
export type LockRecovery = {
  profile: string;
  snapshotSha256: string;
  files: LockFile[];
  removed: string[];
  summary: string[];
};
const ownedLock = /^configuration(?:-migration)?\.lock(?:\.takeover-[a-f0-9]{16})?$/;
const normalized = (path: string) => (process.platform === "win32" ? path.toLowerCase() : path);

async function canonicalDirectory(path: string): Promise<void> {
  if (
    normalized(await fs.realpath(path)) !== normalized(path) ||
    (await fs.lstat(path)).isSymbolicLink()
  )
    throw new Error(
      `Lock recovery requires a canonical directory without redirected ancestors: ${path}`,
    );
}
async function snapshotLocks(
  profile: string,
): Promise<{ files: LockFile[]; snapshotSha256: string }> {
  await canonicalDirectory(profile);
  const stateDir = join(profile, ".workspace-guard");
  let names: string[];
  try {
    await canonicalDirectory(stateDir);
    names = (await fs.readdir(stateDir)).filter((name) => ownedLock.test(name)).sort();
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
    names = [];
  }
  const files: LockFile[] = [];
  for (const name of names) {
    const path = join(stateDir, name),
      before = await fs.lstat(path);
    if (!before.isFile() || before.isSymbolicLink())
      throw new Error(`Not a regular lock file: ${path}`);
    const bytes = await fs.readFile(path),
      after = await fs.lstat(path);
    if (
      before.ino !== after.ino ||
      before.dev !== after.dev ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      !after.isFile() ||
      after.isSymbolicLink()
    )
      throw new Error(`Lock changed during inspection: ${path}`);
    files.push({
      name,
      sha256: digest(bytes),
      size: after.size,
      mtimeMs: after.mtimeMs,
      ino: after.ino,
      dev: after.dev,
      record: bytes.toString("utf8"),
    });
  }
  return { files, snapshotSha256: digest(JSON.stringify({ profile, files })) };
}

/** Explicit offline maintenance, including native PID reuse and abandoned takeover claims. */
export async function recoverConfigurationLocks(
  options: { profile: string },
  acknowledgement: { apply?: boolean; hostStopped?: boolean; expectedSnapshot?: string } = {},
): Promise<LockRecovery> {
  const profile = resolve(options.profile),
    initial = await snapshotLocks(profile);
  const result: LockRecovery = {
    profile,
    ...initial,
    removed: [],
    summary: [
      "Lock recovery requires exclusive offline maintenance: stop every host and other writer using this profile; do not start them or another recovery command until it finishes.",
      "Only listed Guard locks and native takeover claims are eligible; patch, receipt and unrelated files remain untouched.",
    ],
  };
  if (!acknowledgement.apply) return result;
  if (!acknowledgement.hostStopped || !acknowledgement.expectedSnapshot)
    throw new Error(
      "Lock recovery writes require --apply --host-stopped --expected-snapshot from a reviewed preview.",
    );
  if (acknowledgement.expectedSnapshot !== initial.snapshotSha256)
    throw new Error(
      "Lock recovery snapshot changed; preview and review the current records again.",
    );
  const remaining = [...initial.files];
  const order = [...remaining].sort(
    (a, b) => Number(b.name.includes(".takeover-")) - Number(a.name.includes(".takeover-")),
  );
  for (const file of order) {
    const current = await snapshotLocks(profile);
    if (JSON.stringify(current.files) !== JSON.stringify(remaining))
      throw new Error(
        "Lock recovery detected concurrent changes; stopped without deleting further records.",
      );
    await fs.unlink(join(profile, ".workspace-guard", file.name));
    remaining.splice(
      remaining.findIndex((item) => item.name === file.name),
      1,
    );
    result.removed.push(file.name);
  }
  return result;
}
