import { assertNativeRuntimeCompatibility } from "./compatibility.js";

// ESM evaluation runs this once for the shared generated runtime module.
assertNativeRuntimeCompatibility();
