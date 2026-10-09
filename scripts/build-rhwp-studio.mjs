// Builds a self-hosted copy of rhwp-studio (the @rhwp/editor iframe UI) into
// resources/rhwp-studio/, so the template editor works fully offline.
//
// The studio version is pinned to the installed @rhwp/core version: the repo
// is cloned at tag v<version>, and its `pkg/` (normally `wasm-pack build`
// output, which would need a Rust toolchain) is filled from
// node_modules/@rhwp/core instead — the npm package is that same wasm-pack
// `--target web` build, published from the same tag.
//
// Output is not committed (see .gitignore); `npm run build` runs this first.
// Skips work when resources/rhwp-studio/ already matches the installed
// version. Pass --force to rebuild anyway.
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreDir = join(root, 'node_modules', '@rhwp', 'core')
const outDir = join(root, 'resources', 'rhwp-studio')
const stampFile = join(outDir, '.rhwp-studio-version')
const force = process.argv.includes('--force')

const version = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf-8')).version
// Bump when this script's own patches/post-processing change, so existing
// outputs of the same studio version get rebuilt instead of skipped.
const BUILD_REVISION = 2
const stamp = `${version}+r${BUILD_REVISION}`

if (!force && existsSync(stampFile) && readFileSync(stampFile, 'utf-8').trim() === stamp) {
  console.log(`[rhwp-studio] v${stamp} already built — skipping (use --force to rebuild)`)
  process.exit(0)
}

// Plain JS (runs before any TS build step), so no return type annotation.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function run(cmd, args, cwd, env = {}) {
  console.log(`[rhwp-studio] $ ${cmd} ${args.join(' ')}`)
  // npm is a .cmd shim on Windows and can't be spawned without a shell; the
  // shell form takes one command string (args here never contain spaces).
  const useShell = process.platform === 'win32' && cmd === 'npm'
  const baseEnv = { ...process.env }
  if (cmd === 'npm') {
    // When this script itself runs under `npm run`, the parent npm exports
    // this project's config as npm_config_* env vars (incl. its allowScripts
    // list), which a nested `npm ci` in rhwp-studio rejects with
    // EALLOWSCRIPTS. Give the nested npm a clean npm environment.
    for (const key of Object.keys(baseEnv)) {
      if (/^npm_/i.test(key)) delete baseEnv[key]
    }
  }
  const result = spawnSync(useShell ? [cmd, ...args].join(' ') : cmd, useShell ? [] : args, {
    cwd,
    stdio: 'inherit',
    env: { ...baseEnv, ...env },
    shell: useShell
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

const workDir = join(root, 'node_modules', '.cache', 'rhwp-studio-build', `v${version}`)
const repoDir = join(workDir, 'rhwp')
const studioDir = join(repoDir, 'rhwp-studio')

if (!existsSync(join(studioDir, 'package.json'))) {
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })
  // Sparse + blobless: the full repo is ~42k files, some with paths beyond
  // Windows' 260-char limit (hence core.longpaths). Only rhwp-studio/ and
  // the favicon are needed.
  run(
    'git',
    [
      '-c',
      'core.longpaths=true',
      'clone',
      '--depth',
      '1',
      '--branch',
      `v${version}`,
      '--filter=blob:none',
      '--sparse',
      'https://github.com/edwardkim/rhwp.git',
      'rhwp'
    ],
    workDir
  )
  run(
    'git',
    ['-c', 'core.longpaths=true', 'sparse-checkout', 'set', 'rhwp-studio', 'assets/logo'],
    repoDir
  )
}

// Upstream bug (v0.8.7): the 필드 입력 menu advertises Ctrl+K+E
// (command 'insert:field'), but the Ctrl+K chord table only maps h/b/n, so the
// shortcut does nothing. Add 'e' (and 'ㄷ', the same key under the Korean IME,
// matching upstream's own pattern for the other entries). Idempotent — the
// work dir is reused across builds — and fails loudly if upstream changes the
// code so this patch stops applying, rather than silently shipping without it.
const keyboardFile = join(studioDir, 'src', 'engine', 'input-handler-keyboard.ts')
const keyboardSrc = readFileSync(keyboardFile, 'utf-8')
if (!keyboardSrc.includes("e: 'insert:field'")) {
  const anchor = 'const chordMapK: Record<string, string> = {'
  if (!keyboardSrc.includes(anchor)) {
    throw new Error(`[rhwp-studio] Ctrl+K,E patch anchor not found in ${keyboardFile}`)
  }
  writeFileSync(
    keyboardFile,
    keyboardSrc.replace(
      anchor,
      `${anchor}\n  e: 'insert:field', // class-doc patch: menu shows Ctrl+K+E but it was unmapped\n  ㄷ: 'insert:field', // 한글 IME 상태`
    )
  )
}

const pkgDir = join(repoDir, 'pkg')
mkdirSync(pkgDir, { recursive: true })
for (const file of ['rhwp.js', 'rhwp.d.ts', 'rhwp_bg.wasm', 'rhwp_bg.wasm.d.ts']) {
  cpSync(join(coreDir, file), join(pkgDir, file))
}
cpSync(join(repoDir, 'assets', 'logo', 'favicon.ico'), join(studioDir, 'public', 'favicon.ico'))

// The work dir is per studio version and its package-lock never changes, so
// install once. (Re-running `npm ci` on Windows also fails intermittently
// when it can't delete the previous node_modules due to file locks.)
if (!existsSync(join(studioDir, 'node_modules', '.package-lock.json'))) {
  run('npm', ['ci', '--no-audit', '--no-fund'], studioDir)
}

const distDir = join(studioDir, 'dist')
rmSync(distDir, { recursive: true, force: true })
// Invoked via node directly (not npx) so no shell ever rewrites `--base=/`
// (Git Bash's MSYS path conversion turns it into `/Program Files/Git/`).
run(
  process.execPath,
  [join(studioDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--base=/'],
  studioDir,
  {
    // Both are rhwp-studio's own self-hosting switches (see its vite.config.ts):
    // drop the hwpctrl plugin chunk, and never fetch CDN web fonts.
    RHWP_WITHOUT_HWPCTRL: '1',
    RHWP_DISABLE_EXTERNAL_WEBFONTS: '1'
  }
)

// Strip what an embedded, app-served copy doesn't need:
// - PWA service worker/manifest: Electron gains nothing from it, and a cached
//   worker could keep serving a stale studio after an app update.
// - samples/ and the stale public/ copy of the WASM glue (the real WASM is
//   bundled under assets/ via the @wasm/rhwp.js import).
for (const name of readdirSync(distDir)) {
  if (
    [
      'sw.js',
      'registerSW.js',
      'manifest.webmanifest',
      'samples',
      'rhwp.js',
      'rhwp_bg.wasm'
    ].includes(name) ||
    name.startsWith('workbox-') ||
    name.endsWith('.d.ts')
  ) {
    rmSync(join(distDir, name), { recursive: true, force: true })
  }
}
const indexPath = join(distDir, 'index.html')
const html = readFileSync(indexPath, 'utf-8')
  .replace(/<link rel="manifest"[^>]*>/, '')
  .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
writeFileSync(indexPath, html)

rmSync(outDir, { recursive: true, force: true })
cpSync(distDir, outDir, { recursive: true })
writeFileSync(stampFile, stamp + '\n')
console.log(`[rhwp-studio] v${stamp} built into ${outDir}`)
