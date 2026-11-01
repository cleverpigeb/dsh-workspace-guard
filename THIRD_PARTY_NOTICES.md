# Third-Party Notices and Licensing

## Project License (`GPL-3.0-or-later`)

**DSH Workspace Guard (`dsh-workspace-guard`)**
Copyright (C) 2026 DSH Workspace Guard contributors
`SPDX-License-Identifier: GPL-3.0-or-later`

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either **version 3 of the License, or (at your option) any later version**.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License in [LICENSE](LICENSE) for the complete, unmodified GNU GPL version 3 text.

---

## Bundled Upstream Components and Provenance

The generated runtime in `lib/` bundles selected official DeepSeek Harness modules (`0.2.1-rc.5`) and standalone JavaScript libraries (`diff@9.0.0`, `yaml@2.9.0`, and `zod@4.4.3`) under GPL-3.0-compatible permissive licenses (`MIT`, `BSD-3-Clause`, and `ISC`). These modules are generated from locked build dependencies rather than maintained as hand-copied source files:

| Component | Version | License | Copyright Holder | Role in `dsh-workspace-guard` |
| --- | --- | --- | --- | --- |
| `@deepseek-ai/dsh-sandbox-local` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored local sandbox provider (`./sandbox`) |
| `@deepseek-ai/dsh-sandbox-policy` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored sandbox policy provider (`./policy`) |
| `@deepseek-ai/dsh-user-approval` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored interactive approval broker (`./approval`) |
| `@deepseek-ai/dsh-permission-presets` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored permission presets service (`./permission`) |
| `@deepseek-ai/dsh-fs-sandbox` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored sandboxed filesystem service (`./fs`) |
| `@deepseek-ai/dsh-sandbox` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Shared permission-expansion helper in the bundled graph |
| `@deepseek-ai/dsh-tools` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored `ToolRuntime` and `run_code` consumer (`./tools`) |
| `@deepseek-ai/dsh-tool-bash` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored Bash tool consumer (`./tool-bash`) |
| `@deepseek-ai/dsh-tool-pwsh` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored PowerShell tool consumer (`./tool-pwsh`) |
| `@deepseek-ai/dsh-tool-fs` | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored filesystem tool consumer (`./tool-fs`) |
| `@deepseek-ai/dsh-plugin-manager` (`./tools` only) | `0.2.1-rc.5` | `MIT` | Copyright (c) 2026 DeepSeek | Restored plugin-manager tools subentry (`./plugin-tools`) |
| `diff` | `9.0.0` | `BSD-3-Clause` | Copyright (c) 2009-2015, Kevin Decker `<kpdecker@gmail.com>` | Bundled runtime dependency for unified diff generation |
| `yaml` | `2.9.0` | `ISC` | Copyright Eemeli Aro `<eemeli@gmail.com>` | Bundled YAML AST parser/serializer for `cordis.patch.yml` |
| `zod` | `4.4.3` | `MIT` | Copyright (c) 2025 Colin McDonnell | Bundled schema validation dependency for tool entries |

### Build Records and Source Distribution

- `build/upstream-lock.json` records official npm registry tarballs, SHA-512 integrity digests, archive/source/license SHA-256 hashes, and exact input entry paths for all 11 official `@deepseek-ai/*` modules. Every release build (`pnpm run build:release`) verifies these hashes before bundling.
- `build/source-lock.json` and `build/source-release.mjs` (`pnpm run source:release`) record and package the tracked project files together with pinned upstream source archives (`deepseek-harness`, `jsdiff`, `yaml`, and `zod`) and `lib/build-lock.yaml` (restorable as `pnpm-lock.yaml`). Archive hashes are verified; upstream byte-equivalent rebuilding and complete combined-host source obligations are not established by the archive.
- `lib/provenance.json` records the project metadata, verified upstream inputs, lockfile SHA-256, preserved Purge patch IDs (`22` and `48`), and generated output hashes.
- `lib/build-manifest.json` records the bundled module graph and checked build transformations that preserve Purge `1.6.67` patch `#22` (larger file-read limits in `@deepseek-ai/dsh-tool-fs`) and patch `#48` (simplified delete/move prompt guidance in `@deepseek-ai/dsh-tool-bash` and `@deepseek-ai/dsh-tool-pwsh`).
- `lib/host-identities.json` records the two identity-sensitive native exports that remain imported from the host at runtime: `dsh-tools.TOOL_RUNTIME_SCHEDULER` and `dsh-sandbox.SandboxUnavailableError`. This preserves the unmodified host `AgentLoop` scheduler symbol and PTC `instanceof` error classification without importing the host's patched permission or escalation functions.
- `lib/THIRD_PARTY_LICENSES.txt` contains the per-package generated license notices shipped alongside the prebuilt runtime in `lib/`.

### Source Access and Redistribution

The npm package includes the project's TypeScript and build scripts. Before rebuilding those contents, copy `lib/build-lock.yaml` to `pnpm-lock.yaml`, install the frozen dependencies, and use `pnpm build:release`.

For each distributed prebuilt release, recipients must also have access to the corresponding source under GPL terms. Maintainers should publish the matching source companion alongside the release and place clear download directions beside the package. This archive does not require a compiler during plugin installation.

Run `pnpm source:release` from the Git checkout after adding maintained release files to Git's index, with Git and `tar` available on PATH. It reads the current working-tree contents of tracked files and creates `.local/artifacts/dsh-workspace-guard-0.2.0-source.tar.gz`. Use `pnpm source:release --output <directory>` for another destination; existing archives are not overwritten. The archive contains `project/`, four unextracted upstream archives under `upstream/`, and a checksum manifest. Local tests, receipts, and agent working files remain untracked and outside the project source archive.

Pinned upstream download URLs, revisions, versions, and SHA-256 values are in [build/source-lock.json](build/source-lock.json). DSH's release tag and package versions match `0.2.1-rc.5`, but its npm metadata supplies no `gitHead`; byte-equivalent rebuilding has not been verified. The source companion does not by itself establish completeness for every combined-host distribution. Assess the corresponding-source requirements of the actual distribution, including required host components, before publishing it.

---

## Upstream Copyright Notices and License Texts

### 1. Official DeepSeek Harness Modules (`0.2.1-rc.5`) — MIT License

Applies to:
- `@deepseek-ai/dsh-sandbox-local@0.2.1-rc.5`
- `@deepseek-ai/dsh-sandbox-policy@0.2.1-rc.5`
- `@deepseek-ai/dsh-user-approval@0.2.1-rc.5`
- `@deepseek-ai/dsh-permission-presets@0.2.1-rc.5`
- `@deepseek-ai/dsh-fs-sandbox@0.2.1-rc.5`
- `@deepseek-ai/dsh-sandbox@0.2.1-rc.5`
- `@deepseek-ai/dsh-tools@0.2.1-rc.5`
- `@deepseek-ai/dsh-tool-bash@0.2.1-rc.5`
- `@deepseek-ai/dsh-tool-pwsh@0.2.1-rc.5`
- `@deepseek-ai/dsh-tool-fs@0.2.1-rc.5`
- `@deepseek-ai/dsh-plugin-manager@0.2.1-rc.5` (`./tools` entry only)

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 2. `diff@9.0.0` (`kpdecker/jsdiff`) — BSD 3-Clause License (`BSD-3-Clause`)

Applies to:
- `diff@9.0.0`

```text
BSD 3-Clause License

Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 3. `yaml@2.9.0` (`eemeli/yaml`) — ISC License (`ISC`)

Applies to:
- `yaml@2.9.0`

```text
Copyright Eemeli Aro <eemeli@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

### 4. `zod@4.4.3` (`colinhacks/zod`) — MIT License

Applies to:
- `zod@4.4.3`

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
