# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

From `README.md` (Korean): a document generator/editor for teachers that makes
Korean HWP mail-merge functionality easier to use through a UI, including
features like class/roster generation.

## Commands

```
npm install         # install deps (postinstall runs electron-builder install-app-deps)
npm run dev          # launch the app (electron-vite dev, HMR renderer)
npm run typecheck    # tsc --noEmit for both main/preload (node) and renderer (web) configs
npm run lint         # eslint --cache .
npm run format       # prettier --write .
npm run build        # typecheck + electron-vite build (main/preload/renderer, out/)
npm run build:win    # build + electron-builder --win (NSIS)
```

There is no test suite yet.

## Architecture

Electron + React + TypeScript, scaffolded with `@quick-start/create-electron`
(the official electron-vite template scaffolder — note this is a different
package from the similarly-named `create-electron-vite`). Process split:

- `src/main/` — Electron main process (Node). Owns app lifecycle and window
  creation (`index.ts`). `ipc/`, `db/`, `rhwp/` are currently empty
  placeholders reserved for, respectively: per-domain `ipcMain` handlers,
  a future `better-sqlite3` connection/migrations, and a headless
  `@rhwp/core` `HwpDocument` wrapper.
- `src/preload/` — the only bridge between main and renderer
  (`contextBridge`/`index.ts` + `index.d.ts`). No IPC channels are defined
  yet; add them here as typed `window.api.*` calls when needed.
- `src/renderer/` — the React UI. `src/renderer/src/editor/` and
  `src/renderer/src/pages/` are empty placeholders for, respectively, a
  future `@rhwp/editor` iframe embed and the app's own screens (e.g. the
  field-to-meaning mapping screen).

`@rhwp/core` and `@rhwp/editor` are installed and version-pinned but **not
yet integrated** — no WASM init, no iframe embed, no IPC channel exists for
them. Before writing that integration, read `.claude/skills/rhwp/SKILL.md`
— it documents verified constraints from actually testing these packages,
including: `@rhwp/editor` has no host-callable API to insert merge fields
(only its own internal "필드 입력" UI menu can do that — a human always
inserts fields, never the host app); `@rhwp/core` runs headlessly in the
main process for field read/write/export; and its WASM init requires raw
bytes via `fs.readFileSync`, not a `file://` URL fetch.

`better-sqlite3` is intentionally **not installed yet** — it's a native
addon, and this machine has no MSVC build tools, so a from-source compile
would fail if no prebuilt binary matches the installed Electron version's
ABI. Before adding it: `npm install better-sqlite3 && npx electron-builder
install-app-deps` (wraps `@electron/rebuild`) — if that fails, either
install MSVC Build Tools or check whether a slightly older Electron minor
has a published prebuild for this platform.

## Environment gotchas (this machine)

- **npm's install-scripts allowlist**: `electron`, `esbuild`, and
  `electron-winstaller` all ship required postinstall/install scripts
  (e.g. downloading the actual Electron binary). npm blocks these by
  default; they're allowlisted in `package.json`'s `allowScripts` field.
  If `npm install` reports scripts blocked again (e.g. after adding a new
  native/binary-fetching dependency), run
  `npm install-scripts approve <pkg>` then `npm rebuild <pkg>` — a bare
  `npm install` alone will *not* re-run scripts once npm considers the
  tree "up to date".
- **Rollup native binary is blocked by a Windows Application Control
  policy on this machine**: `npm run build`/`npm run dev` fail with a
  misleading "npm has a bug related to optional dependencies" error from
  Rollup; the real cause, in the error's `[cause]`, is
  `An Application Control policy has blocked this file` when loading
  `@rollup/rollup-win32-x64-msvc`. Fixed via `package.json` `overrides`:
  `"rollup": "npm:@rollup/wasm-node@<version matching installed rollup>"`
  — this swaps in Rollup's pure-WASM build, which never touches the
  blocked native binary. If Vite's bundled Rollup version changes, update
  the pinned version in the override to match (check
  `node_modules/rollup/package.json`).
