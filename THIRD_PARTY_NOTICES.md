# Third-party notices

This project bundles selected official DeepSeek Harness modules, copyright (c) 2026 DeepSeek, under the MIT License. The fixed source release is **0.2.1-rc.5**. These modules are generated from exact build dependencies, not maintained as hand-copied source files.

- @deepseek-ai/dsh-sandbox-local
- @deepseek-ai/dsh-fs-sandbox
- @deepseek-ai/dsh-user-approval
- @deepseek-ai/dsh-sandbox-policy
- @deepseek-ai/dsh-permission-presets
- @deepseek-ai/dsh-sandbox
- @deepseek-ai/dsh-tools
- @deepseek-ai/dsh-tool-bash
- @deepseek-ai/dsh-tool-pwsh
- @deepseek-ai/dsh-tool-fs
- @deepseek-ai/dsh-plugin-manager (the `./tools` entry only)

`build/upstream-lock.json` records official registry tarballs, SHA-512 integrity values, archive/source/license SHA-256 values, and exact input entry paths. Every build verifies these input hashes. `lib/provenance.json` records the released inputs and generated output hashes; `lib/build-manifest.json` records the bundled module graph and checked transformations. The only upstream behavior transformations preserve Purge 1.6.67 patch #22 (larger file-read limits) and #48 (shell delete/move wording). Other framework services and native runners remain external host dependencies. Runtime code is prebuilt; installing this package does not build or alter host packages.

The generated runtime also bundles the standalone JavaScript libraries `diff`, `yaml`, and `zod`. Their versions and full license notices, together with those of the official modules, are included in `lib/THIRD_PARTY_LICENSES.txt`.

Two identity-sensitive native exports remain shared with the host: `dsh-tools.TOOL_RUNTIME_SCHEDULER` and `dsh-sandbox.SandboxUnavailableError`. Checked build transforms replace only their declarations with imports from the host; `lib/host-identities.json` records the exact source/output hashes. This preserves the unmodified agent loop's scheduler access and PTC's error classification. The host's permission/escalation functions are not imported through these identity bridges.

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
