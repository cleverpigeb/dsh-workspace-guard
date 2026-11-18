# Design

DSH Workspace Guard repairs Purge's changes to native DSH permission behavior. Installed DSH >=0.2.2-rc.2 and Purge >=1.1.70 are accepted without an upper version bound. The Windows x64 build uses official DSH 0.2.2-rc.4 inputs. The compatibility checks include Purge 1.7.20 and the older session-promotion hook. Other installed plugins use the restored native services; their versions are outside Guard's compatibility checks.

Official packages are pinned build inputs. Small entries select native providers and consumers; tsdown generates their implementations into the release. Selected modules share one clean sandbox helper. Cordis, session/event contracts, subprocess services and Windows ACL resources remain host dependencies. The plugin does not edit installed DSH, Purge or OPS source.

The original OPS failure occurs when Workspace mode selects OPS's restricted IPC Bash but Purge's sandbox passthrough starts it with an ordinary token. Restoring the native local sandbox provider restores the matching launcher.

Native filesystem checks, approvals, permission expansion, sandbox policy and permission presets are restored alongside the launcher. Consumers with static imports are included in the build so they bind the restored helper. DSH owns the tool registry. Guard supplies the two official executors and their shared approval pipeline. The PTC executor owns run_code and its nested calls.

Formal configuration selects replacement providers. Purge alone receives an isolated permission facade connected through a separate root-service bridge. It suppresses automatic Full Access promotion; the native root service continues to serve the selector. Existing session selections and manual Full Access retain native behavior.

Installing or enabling the bundle automatically applies that configuration through an owned, atomic transaction. DSH's profile watcher loads the unique replacement entries using its normal reload mechanism. Disabling or uninstalling reverses the owned changes; shutdown retains them. CLI commands serve optional inspection and offline recovery. Readiness after installation is an acceptance requirement.

If lifecycle initialization fails, it restores an existing active receipt before rethrowing the activation error. This prevents a later uninstall from depending on an effect that Cordis already disposed. Restoration uses the same transaction and ownership checks, without activation version checks; an unsuccessful restoration reports both errors and retains recovery evidence.

Checked build transformations preserve Purge’s increased reading limits (#22), shell delete/move guidance (#48) and branding change in file-policy text (#93). Auto Review (#59) and unrelated host plugins continue to use the installed implementations.

There is no additional tool admission system, blacklist, permission lease, subprocess wrapper, or custom mode-draining protocol. Tools, subagents, terminals and background work use native lifecycles. Lack of validation does not disable a route.

## Native limits

The approval service forwards and records decisions. File and escalation checks use permissions, paths and approval outcomes; they do not classify task subject matter. Existing external approval answerers are unchanged.

Windows enforcement remains native partial write restriction. Read/network isolation, malicious plugins in the same process, and stronger filesystem-race guarantees are not supplied. Native temporary-directory and resource behavior is preserved.

## Documentation ownership

The English and Chinese READMEs are maintained by Antigravity. Their automatic-installation update was reviewed for this release, with authorised factual corrections.
