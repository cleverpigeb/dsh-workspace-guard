# Compatibility coverage

Current source baseline is DSH 0.2.2-rc.4 on Windows x64. Purge 1.6.67 supplies the historical patch IDs, with current definitions checked against 1.7.20. Installed dependency minima are listed in INSTALLATION.md. OPS 0.4.4 was one consumer used in isolated acceptance; its version is not an activation requirement. This matrix distinguishes restored source behavior from executed acceptance. See ACCEPTANCE.md for actual results.

| Route | Purge change or dependency | Repair |
| --- | --- | --- |
| OPS Bash and native process consumers | Sandbox confinement passthrough (#15) | Generated native sandbox-local provider uses the host Windows runner |
| Filesystem mutations | Native fence bypass (#16) | Generated native filesystem provider |
| Approval requests | Auto-grant/default/decision changes (#5, #9–12) | Native broker and formal permission configuration |
| Shared permission expansion | Unconditional grant / ignored rejection (#13–14, #35) | Single generated native sandbox helper |
| Policy and permission selector | Altered policy/default (#7–8, #51, #61) and Purge fresh-session hook | Native policy/presets; Purge-specific facade suppresses automatic promotion |
| Official Bash/PowerShell | Static helper import; permission guidance (#33) | Native consumer entries bundled with the restored helper; preserve #48 |
| Official file tools | Static helper import/schema (#36) | Native consumer entry; preserve reading limits #22 |
| Tool dispatch, run_code and nested calls | Purge #62 changes the host tool pipeline’s approval decision | Both native and PTC executors use the same clean pipeline. The PTC executor also uses the restored escalation helper. |
| Plugin-manager tools | Static helper import | Only the tools subentry is bundled; manager service remains native |
| OPS native workers | Native worker policy envelopes, separate from ctx.fs | Native behavior retained; requires its own functional checks |
| Persistent terminals, jobs, subagents, modes | Native service consumers and lifecycle | No plugin blacklist or additional lifecycle protocol |
| Purge Apply/reapply/restart | Host files can be patched again | Independent prebuilt entries stay selected through formal configuration |
| Other Purge features | Unrelated prompts/hooks/reviewer changes | Existing host implementations/configuration retained |

Patch IDs refer to Purge definitions. On the current host, Purge 1.7.20’s #62 target matches the official tool pipeline. The tools service still comes from DSH and shares its registry and error identities with the executors.

Preserved features include #22 reading capacity, #48 delete/move guidance, and #59 Auto Review disabling. The generated policy retains the #93 change to branding in its three mode descriptions. Existing third-party approval answerers remain unchanged.

Native limitations remain native. Availability of a tool is not evidence of its enforcement; an unverified route is reported rather than automatically disabled. A confirmed unresolved Purge regression is a release limitation.
