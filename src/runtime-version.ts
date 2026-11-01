// SPDX-FileCopyrightText: 2026 DSH Workspace Guard contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { assertNativeRuntimeCompatibility } from "./compatibility.js";

// ESM evaluation runs this once for the shared generated runtime module.
assertNativeRuntimeCompatibility();
