# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

From `README.md` (Korean): a document generator/editor for teachers that makes
Korean HWP mail-merge functionality easier to use through a UI, including
features like class/roster generation.

## Commands

```
npm install         # install deps (postinstall runs electron-builder install-app-deps)
npm run dev          # studio:build (if needed) + electron-vite dev, HMR renderer
npm run studio:build # build self-hosted rhwp-studio into resources/rhwp-studio/ (skips if up to date; --force to rebuild)
npm run typecheck    # tsc --noEmit for both main/preload (node) and renderer (web) configs
npm run lint         # eslint --cache .
npm run format       # prettier --write .
npm run build        # typecheck + studio:build + electron-vite build (main/preload/renderer, out/)
npm run build:win    # build + electron-builder --win (NSIS)
```

There is no test suite yet.

## User flow

The app's primary workflow, in order — this drives both the DB schema
(`docs/schema.md`) and the screens under `src/renderer/src/pages/`:

1. **Teacher profile & groups** — a teacher registers their own name (no
   password/auth — this is a single local profile, not a login system) and
   creates one or more **groups** they manage, each with a group name. A
   group is a teacher-defined named collection of students — it is *not*
   guaranteed to be exactly one 학년/반 (grade/class), since grade/class/
   number are recorded per student, not per group.
2. **Student roster via CSV, or one at a time** — the teacher uploads/
   re-uploads a CSV per group to populate or update its student roster.
   CSV columns are **not a fixed schema** — the app detects whatever
   fields are present from the CSV header row and stores them per group
   (the same "detect fields, map meaning later" philosophy already used
   for HWPX 누름틀 — see `template`/`template_field` below). A typical
   roster has `이름`(name)/`학년`(grade)/`반`(class)/`번호`(student
   number)/`보호자 이름`(guardian name), but a group's actual field set
   is whatever that group's CSV defines, and can vary group to group.
   Re-uploading must update existing students by a natural key, not
   duplicate them. Students can also be added/edited individually
   (without a CSV) — same underlying per-group dynamic fields, filled in
   through a form instead of bulk import.
3. **Template registration** — the teacher opens/edits an HWPX document via
   the `@rhwp/editor` iframe and manually inserts 누름틀(fields) using its
   own "필드 입력" menu (see `.claude/skills/rhwp/SKILL.md` — the host app
   has no API to insert fields itself). The resulting file is saved to a
   fixed folder next to the app executable, `class-doc/template/`
   (portable-app style storage, not per-OS AppData). The app reads that
   folder and lists templates in a template-library screen; on save,
   `@rhwp/core.getFieldList()` extracts the template's field names for
   storage/mapping.
4. **Field-to-meaning mapping & generation** — from the template list, the
   teacher picks a template, then picks a group, then maps each 누름틀
   field to a piece of student data (이름/학년/반/번호/보호자이름) or a
   static value — this is the one custom screen the app builds (rhwp only
   knows field *names*, not their meaning). Bulk document generation then
   runs headlessly per student via `@rhwp/core`.

## Architecture

Electron + React + TypeScript, scaffolded with `@quick-start/create-electron`
(the official electron-vite template scaffolder — note this is a different
package from the similarly-named `create-electron-vite`). Process split:

- `src/main/` — Electron main process (Node). Owns app lifecycle, window
  creation, and storage bootstrap (`index.ts`).
  - `paths.ts` — resolves the portable-app storage layout (see "Storage
    layout" below).
  - `db/` — `schema.sql` (executable copy of `docs/schema.md` §3's DDL —
    that doc is the source of truth, keep them in sync), `index.ts` (opens
    the single `better-sqlite3` connection, sets `PRAGMA foreign_keys = ON`
    on every connection, migrates via `PRAGMA user_version`), `mappers.ts`
    (snake_case DB rows ↔ camelCase `shared/domain.ts` types),
    `identityHash.ts` (the CSV-upsert identity hash algorithm from
    schema.md §4).
  - `rhwp/hwpCore.ts` — headless `@rhwp/core` WASM init (dynamic `import()`
    since `@rhwp/core` is ESM-only and the main bundle is CJS), shared by
    template field-list extraction and document generation.
  - `ipc/` — one file per domain (`teacher`, `groups`, `groupFields`,
    `students`, `templates`, `templateFields`, `generation`), each
    exporting `register(ipcMain)`, all wired from `ipc/index.ts`. All
    request validation lives here (renderer is the untrusted-ish
    boundary); generation progress streams via
    `webContents.send('generation:progress', ...)`.
    `generation.ts` is a two-phase prepare/commit flow (teacher feedback:
    preview the merged result before writing anything) — `generation:prepare`
    builds the merged/list document and caches it in-memory (keyed by a
    `previewId`, no `generation_run`/`document_history` rows yet),
    `generation:renderPreviewPage` renders its pages via the same
    `HwpDocument.renderPageSvg()` path as the template-library preview,
    `generation:commit` picks the output folder, writes the file, and
    records the DB rows, and `generation:discardPreview` (or the renderer
    unmounting mid-preview) just drops the cached entry with no side effects.
  - `util/fileNaming.ts` — filename sanitize/dedupe shared by template
    saves and generated-output writes.
  - `util/hwpxMerge.ts` — zip/XML-level merge of N per-student HWPX exports
    (same template, only field values differing) into a single multi-section
    file. `generation.ts`'s `runIndividual()` now collects every selected
    student's exported bytes in memory and writes exactly one merged output
    file per run (a class of 30 → one 30-page document), instead of the
    original one-file-per-student behavior. See `docs/hwpx-merge-plan.md`
    for the rejected alternatives (`@rhwp/core`'s clipboard API is isolated
    per `HwpDocument` instance; `insertTableRow()` doesn't duplicate field
    controls into the new row) and this approach's still-open caveats (not
    yet re-verified against a template containing tables/images; per-section
    page numbering may reset).
- `src/preload/` — the only bridge between main and renderer
  (`contextBridge`/`index.ts` + `index.d.ts`). `window.api` is fully typed
  against `src/shared/ipc-types.ts`'s `Api` interface — one thin
  `ipcRenderer.invoke(...)` wrapper per IPC channel, plus
  `onGenerationProgress(callback)` for the progress event stream.
- `src/shared/` — types/interfaces needed by both main and renderer:
  `domain.ts` (entities mirroring `docs/schema.md`, moved here from
  `src/renderer/src/types/` once main-process IPC handlers needed the same
  shapes) and `ipc-types.ts` (every IPC request/response/event DTO plus the
  `Api` interface — the single source of truth for preload's
  implementation and typing).
- `src/renderer/` — the React UI. `src/renderer/src/editor/` embeds
  `@rhwp/editor` for the template-editing screen; `src/renderer/src/pages/`
  holds the app's screens (teacher/group management, student roster,
  template library + editor, field mapping + generation).

`@rhwp/core` runs headlessly in the main process (see `src/main/rhwp/hwpCore.ts`)
for field read/write/export; its WASM init requires raw bytes via
`fs.readFileSync`/`require.resolve`, not a `file://` URL fetch, and it's
loaded via a dynamic `import()` (not a static one) because the package is
ESM-only while the main process's build output is CJS. Before touching this
integration further, read `.claude/skills/rhwp/SKILL.md` — it documents
verified constraints from actually testing these packages, including:
`@rhwp/editor` has no host-callable API to insert merge fields (only its
own internal "필드 입력" UI menu can do that — a human always inserts
fields, never the host app).

**`rhwp-studio` (the `@rhwp/editor` iframe UI) is self-hosted — the
template editor works offline.** The `@rhwp/editor` npm package only ships
the `postMessage` transport wrapper; the UI itself is `rhwp-studio` from the
`edwardkim/rhwp` repo. `scripts/build-rhwp-studio.mjs` (`npm run
studio:build`, run automatically by `dev`/`build`) clones that repo at tag
`v<installed @rhwp/core version>` (sparse, `core.longpaths` — some paths
exceed Windows' 260-char limit), fills its `pkg/` from
`node_modules/@rhwp/core` instead of running `wasm-pack` (no Rust toolchain
needed — the npm package *is* that same `--target web` build), builds with
rhwp-studio's own self-hosting switches (`RHWP_WITHOUT_HWPCTRL=1`,
`RHWP_DISABLE_EXTERNAL_WEBFONTS=1` — zero external requests, verified), and
strips the PWA service worker. It also patches one upstream bug before
building: the 필드 입력 menu advertises Ctrl+K,E but rhwp-studio's Ctrl+K
chord table (`chordMapK` in `src/engine/input-handler-keyboard.ts`) has no
`e` entry, so the script adds `e`/`ㄷ` → `insert:field` (and fails the build if
that code moves). Bump `BUILD_REVISION` in the script whenever its patches
or post-processing change, so already-built outputs get rebuilt. Output goes to `resources/rhwp-studio/`
(gitignored — GitHub Actions builds it; never commit it). Keep `@rhwp/core`
and `@rhwp/editor` on the same version: the studio tag follows `@rhwp/core`.

Both the studio and the **production renderer** are served from
`127.0.0.1` by `src/main/localServer.ts` (studio via
`src/main/rhwp/studioServer.ts` + the `studio:getUrl` IPC, preferred fixed
port 47811 so studio's own localStorage settings persist; renderer on a
random port from `index.ts`). The renderer must not use `loadFile()`:
rhwp-studio's embed runtime ignores any parent whose origin isn't http(s)
(`isUsableParentOrigin()` in `rhwp-studio/src/embed/protocol.ts`), so a
`file://` renderer left `createEditor()` silently retrying for ~5 minutes.
`npm run dev` was never affected (the renderer is `http://localhost` there),
which is why this only showed up in built output.

`better-sqlite3` is installed. This machine has no MSVC Build Tools (no
Windows SDK component), so `node-gyp rebuild` fails — but this turned out
not to matter: `better-sqlite3@13.x` ships a bundled N-API prebuild
(`node_modules/better-sqlite3/prebuilds/win32-x64.node`) that loads
automatically without any compile step, and it works identically under
plain Node and under Electron's own Node runtime (both verified directly —
requiring it and round-tripping a real `CREATE TABLE`/`INSERT`/`SELECT`
succeeded in each). **Do not run `npx electron-builder install-app-deps`
or otherwise force a native rebuild for this package** — it will fail on
the missing Windows SDK and isn't needed, since N-API's ABI stability is
exactly what makes the bundled prebuild usable as-is. If a future
dependency *isn't* N-API-based and needs an from-source compile, the
original remediation still applies: install MSVC Build Tools (with the
Windows SDK component this time) or check whether a slightly older
Electron minor has a published prebuild for this platform.

## Storage layout

Portable-app style storage (not per-OS AppData): `src/main/paths.ts`
resolves `<base>/class-doc/{data,template,output}`, auto-creating each
folder on first access.

- `base` is the folder next to the packaged executable in production
  (`dirname(app.getPath('exe'))`) — but falls back to the project root
  (`process.cwd()`) in dev, since "next to the exe" is meaningless under
  `npm run dev` (`app.getPath('exe')` would point inside
  `node_modules/electron/dist/`, scattering files there).
- `class-doc/data/class-doc.sqlite` — the single SQLite file (see
  `src/main/db/index.ts`).
- `class-doc/template/` — registered HWPX templates, written by
  `template:save`'s IPC handler after `@rhwp/editor.exportHwpx()` — the
  app controls this path directly (no OS "Save As" dialog needed), so
  saving into this folder is fully automatic from the teacher's
  perspective.
- `class-doc/output/` — generated per-student/per-batch HWPX output from
  `generation:run`. Kept as a sibling of `template/`, not inside it, so
  generated documents never get mistaken for registered templates.
- **Installed (NSIS) builds keep data inside the install dir**
  (`%LOCALAPPDATA%\Programs\class-doc\class-doc\`). electron-builder's
  default uninstaller — which an update also runs, for the *old* version —
  deletes `$INSTDIR` recursively, which would wipe all teacher data.
  `build/installer.nsh` overrides `customRemoveFiles` to delete everything
  except the `class-doc` folder (verified: install → update → uninstall keeps
  the DB). Don't remove that file. `electron-builder.yml`'s `files` also
  excludes the dev `class-doc/` folder (real student data on a dev machine),
  `temp/`, `docs/`, etc. from the package.

## Updates & releases

- **Auto-update** (`src/main/updateCheck.ts`, from v0.1.2): in a packaged
  build electron-updater (GitHub provider via `electron-builder.yml`
  `publish` → `app-update.yml`) downloads a newer release in the
  background and installs it on quit, or immediately from the sidebar's
  "업데이트 준비됨 · 재시작" (`quitAndInstall(true, true)`). State is pushed
  to the renderer on `app:updateStatus`. In dev, or if electron-updater
  errors (offline, school network blocking GitHub downloads), it falls back
  to the old notify-only check: one GET of the latest release → "업데이트
  가능" opening the release page. Builds are unsigned, so electron-updater
  doesn't verify a publisher signature. Updates run the old version's
  uninstaller, so `build/installer.nsh` is what keeps teacher data — see
  Storage layout. These are the app's only external requests; the guide's
  개인정보 안내 text promises exactly that, so keep the two in sync.
- `.github/workflows/release.yml` runs on `v*` tag push (windows-latest):
  verifies the tag equals `v` + package.json version, `npm ci
  --ignore-scripts`, `npm run build`, `electron-builder --win --publish
  never`, then uploads `dist/class-doc-*-setup.exe` plus `latest.yml` and the
  `.blockmap` (required by electron-updater) to the GitHub Release.

## Environment gotchas (this machine)

- **npm's install-scripts allowlist**: `electron`, `esbuild`,
  `electron-winstaller`, and (as of this app installing it) `better-sqlite3`
  all ship required postinstall/install scripts (e.g. downloading the
  actual Electron binary, or `better-sqlite3`'s `node-gyp rebuild`). npm
  blocks these by default; they're allowlisted in `package.json`'s
  `allowScripts` field. If `npm install` reports scripts blocked again
  (e.g. after adding a new native/binary-fetching dependency), run
  `npm install-scripts approve <pkg>` then `npm rebuild <pkg>` — a bare
  `npm install` alone will *not* re-run scripts once npm considers the
  tree "up to date". Note that approving+rebuilding doesn't guarantee the
  script *succeeds* (see `better-sqlite3`'s MSVC/Windows SDK gap above) —
  it only unblocks npm from attempting it; whether the result is actually
  needed depends on whether the package has a working fallback (N-API
  prebuild, in `better-sqlite3`'s case).
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
