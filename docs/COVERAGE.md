# Compatibility coverage

Target: DSH 0.2.1-rc.5, Purge 1.6.67, OPS 0.4.4, Windows x64. This matrix distinguishes restored source behavior from executed acceptance. See ACCEPTANCE.md for actual results.

| Route | Purge change or dependency | Repair |
| --- | --- | --- |
| OPS Bash and native process consumers | Sandbox confinement passthrough (#15) | Generated native sandbox-local provider uses the host Windows runner |
| Filesystem mutations | Native fence bypass (#16) | Generated native filesystem provider |
| Approval requests | Auto-grant/default/decision changes (#5, #9–12) | Native broker and formal permission configuration |
| Shared permission expansion | Unconditional grant / ignored rejection (#13–14, #35) | Single generated native sandbox helper |
| Policy and permission selector | Altered policy/default (#7–8, #51, #61) and Purge fresh-session hook | Native policy/presets; Purge-specific facade suppresses automatic promotion |
| Official Bash/PowerShell | Static helper import; permission guidance (#33) | Native consumer entries bundled with the restored helper; preserve #48 |
| Official file tools | Static helper import/schema (#36) | Native consumer entry; preserve reading limits #22 |
| run_code and nested programmatic calls | Runtime closure captures static helper; #60/#62 patch definitions | Native ToolRuntime entry and helper in the same build graph |
| Plugin-manager tools | Static helper import | Only the tools subentry is bundled; manager service remains native |
| OPS native workers | Native worker policy envelopes, separate from ctx.fs | Native behavior retained; requires its own functional checks |
| Persistent terminals, jobs, subagents, modes | Native service consumers and lifecycle | No plugin blacklist or additional lifecycle protocol |
| Purge Apply/reapply/restart | Host files can be patched again | Independent prebuilt entries stay selected through formal configuration |
| Other Purge features | Unrelated prompts/hooks/reviewer changes | Existing host implementations/configuration retained |

Patch IDs identify definitions in Purge, not proof that every target matched. In particular, source inspection of the current native ToolRuntime serviceAsk found its denial handling intact despite the #62 definition. The repair does not misreport that path as an observed bypass.

Preserved features include #22 reading capacity, #48 delete/move guidance, and #59 Auto Review disabling. Existing third-party approval answerers remain unchanged.

Native limitations remain native. Availability of a tool is not evidence of its enforcement; an unverified route is reported rather than automatically disabled. A confirmed unresolved Purge regression is a release limitation.
