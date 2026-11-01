#!/usr/bin/env node
import {
  applyConfiguration,
  doctorConfiguration,
  inspectConfiguration,
  type ProfileOptions,
} from "./configuration.js";

const HELP = `dsh-workspace-guard <doctor|plan|activate|deactivate|rollback> --profile <directory>
  [--home <DSH home>] [--host-modules <host node_modules>] [--apply --host-stopped]
All commands preview by default. No package installation is performed.
--host-stopped acknowledges every DSH host using this profile is stopped.
deactivate and rollback restore native providers and preserve later unrelated edits.
Launcher --patch/flag overlays are outside this offline check; do not use conflicting overrides.`;

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }
  const command = args.shift();
  if (!["doctor", "plan", "activate", "deactivate", "rollback"].includes(command!))
    throw new Error("Unknown command. Use --help.");
  const values: Record<string, string> = {},
    flags = new Set<string>();
  while (args.length) {
    const key = args.shift()!;
    if (["--apply", "--host-stopped"].includes(key)) {
      if (flags.has(key)) throw new Error(`Duplicate option ${key}`);
      flags.add(key);
      continue;
    }
    if (!["--profile", "--home", "--host-modules"].includes(key) || values[key] !== undefined)
      throw new Error(`Unknown or duplicate option: ${key}`);
    const value = args.shift();
    if (!value || value.startsWith("--")) throw new Error(`Missing value: ${key}`);
    values[key] = value;
  }
  if (!values["--profile"])
    throw new Error("--profile is required; there is no implicit desktop target.");
  if (["doctor", "plan"].includes(command!) && flags.size)
    throw new Error("doctor and plan are read-only; omit write acknowledgements.");
  const options: ProfileOptions = {
    profile: values["--profile"],
    home: values["--home"],
    hostModules: values["--host-modules"],
  };
  if (command === "doctor") {
    console.log(
      JSON.stringify({ command, applied: false, ...(await doctorConfiguration(options)) }, null, 2),
    );
    return;
  }
  const action = command === "deactivate" || command === "rollback" ? command : "activate";
  const plan = flags.has("--apply")
    ? await applyConfiguration(options, action, {
        apply: true,
        hostStopped: flags.has("--host-stopped"),
      })
    : await inspectConfiguration(options, action);
  console.log(
    JSON.stringify(
      {
        command,
        applied: flags.has("--apply"),
        changed: plan.changed,
        status: plan.receipt.status,
        summary: plan.summary,
        evidence:
          "Offline file composition only; running-host activation and functional acceptance remain unverified.",
        ...(command === "plan" ? { proposedPatch: plan.patch } : {}),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
