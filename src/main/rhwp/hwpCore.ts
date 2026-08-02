// Headless @rhwp/core WASM init, shared by field-list extraction (templates.ts)
// and document generation (generation.ts).
//
// @rhwp/core ships as a pure ESM package (`"type": "module"`, see
// node_modules/@rhwp/core/package.json) but this project's main-process build
// output is CommonJS (verified by inspecting `out/main/index.js` during this
// task's Phase 0 spike — it starts with `"use strict"; const electron =
// require("electron")`, not `import`). A static `import ... from '@rhwp/core'`
// would get compiled down to a bare `require('@rhwp/core')` call, which throws
// `ERR_REQUIRE_ESM` for an ESM-only package. A *dynamic* `import()` does not
// have this problem: Rollup/esbuild preserve dynamic `import()` of an external
// module as-is even when the surrounding output format is CJS (confirmed by
// inspecting the built bundle — `await import("@rhwp/core")` appears verbatim,
// not rewritten to `require`), and Node's CJS module loader has natively
// supported `await import(esmPackage)` for years regardless of bundler
// involvement. This exact load-path was run end-to-end inside
// `./node_modules/.bin/electron.cmd` during this task's Phase 0 spike — module
// load, `init()`, `HwpDocument.createEmpty()`, `insertClickHereField()`,
// `setFieldValueByName()`, `exportHwpx()`, reload, and the documented
// string-exception shape all verified working, not just assumed from the
// README (see rhwp-api-notes.md's own warning that the README lags reality).
import { readFileSync } from 'fs'

type RhwpCoreModule = typeof import('@rhwp/core')
export type HwpDocument = InstanceType<RhwpCoreModule['HwpDocument']>

let corePromise: Promise<RhwpCoreModule> | undefined

async function loadCoreModule(): Promise<RhwpCoreModule> {
  if (!corePromise) {
    // Module-level memoized promise (not a re-init per call) — WASM init is
    // relatively expensive and @rhwp/core's `init()` is not meant to be
    // called more than once per process.
    corePromise = (async () => {
      const core = await import('@rhwp/core')

      // Per rhwp-api-notes.md: calling `init()` with no arguments makes it
      // resolve `new URL('rhwp_bg.wasm', import.meta.url)` and `fetch()` it —
      // Node's `fetch` does not support the `file://` protocol, so that path
      // always fails headlessly. Always read the wasm bytes directly instead.
      //
      // `require.resolve` (not a relative path from this file) is used so the
      // lookup goes through normal Node module resolution against
      // `node_modules/@rhwp/core/`, which — combined with `asarUnpack:
      // ['@rhwp/core/**']` in electron-builder.yml — resolves correctly both
      // unpacked in dev and inside a packaged app. See that file for the full
      // asar reasoning: in short, `fs.readFileSync` generally *can* read
      // regular files transparently from inside an asar archive, but dynamic
      // `import()` going through Node's newer ESM loader (as this function
      // does, for `@rhwp/core` itself) has had asar-support gaps in past
      // Electron versions, and there is no packaged-build test in this task's
      // scope to confirm current behavior — so both the module and its wasm
      // asset are unpacked to avoid relying on unverified asar/ESM interplay.
      const wasmPath = require.resolve('@rhwp/core/rhwp_bg.wasm')
      const wasmBytes = readFileSync(wasmPath)

      await core.default({ module_or_path: wasmBytes })
      return core
    })()
  }
  return corePromise
}

/** Ensures WASM init has run, then loads `bytes` as a new headless document. */
export async function loadHwpDocument(bytes: Uint8Array): Promise<HwpDocument> {
  const core = await loadCoreModule()
  return new core.HwpDocument(bytes)
}

/**
 * @rhwp/core's HwpDocument methods (e.g. `setFieldValueByName`) throw plain
 * strings/JsValues on failure, not `Error` objects — `e.message` is
 * `undefined`. Verified both in rhwp-api-notes.md and this task's Phase 0
 * spike (`String(e) === "필드 오류: 필드 이름 '...' 없음"`). Always route
 * caught exceptions from HwpDocument calls through this helper.
 */
export function describeHwpError(e: unknown): string {
  return typeof e === 'string' ? e : String(e)
}
