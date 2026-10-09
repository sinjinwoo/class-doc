// Automatic updates via electron-updater (GitHub Releases provider, configured
// by electron-builder.yml's `publish` block → app-update.yml in the packaged
// app). In a packaged build the new version is downloaded in the background
// and installed when the app quits, or right away from the sidebar's
// "업데이트 준비됨 · 재시작" button. No user/student data is sent — only release
// metadata and the installer itself are fetched.
//
// Fallback ("manual"): in dev (`npm run dev` / `npx electron .`, where
// electron-updater has no app-update.yml) or when the automatic path fails
// (offline, a school network blocking GitHub downloads, …), fall back to the
// old notify-only check — one GET of the latest release, and the sidebar
// offers to open its page in the browser. Every failure is silent: no badge.
//
// Data safety: an update runs the old version's uninstaller first, which
// build/installer.nsh restricts so the class-doc/ data folder is kept.
//
// Release tags must be `v<package.json version>` and each release must carry
// latest.yml + the .blockmap next to the setup.exe (.github/workflows/release.yml).
import { app, BrowserWindow, net, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import {
  APP_UPDATE_STATUS_CHANNEL,
  type AppUpdateState,
  type AppUpdateStatus
} from '../shared/ipc-types'

const LATEST_RELEASE_API = 'https://api.github.com/repos/sinjinwoo/class-doc/releases/latest'
const RELEASES_PAGE_PREFIX = 'https://github.com/sinjinwoo/class-doc/releases/'
const REQUEST_TIMEOUT_MS = 8000

let status: AppUpdateStatus = { currentVersion: app.getVersion(), state: { kind: 'none' } }
let started = false

function setState(state: AppUpdateState): void {
  status = { currentVersion: app.getVersion(), state }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(APP_UPDATE_STATUS_CHANNEL, status)
  }
}

/** Numeric x.y.z comparison; anything non-numeric (e.g. a prerelease suffix) counts as 0. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => parseInt(part, 10) || 0)
  const pb = b.split('.').map((part) => parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Notify-only fallback: newer release → "업데이트 가능" linking to its page. */
async function checkManually(): Promise<void> {
  try {
    const response = await net.fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return
    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown }
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') return
    const latestVersion = release.tag_name.replace(/^v/i, '')
    // Only ever open this repo's own release pages, whatever the API returned.
    if (
      compareVersions(latestVersion, app.getVersion()) > 0 &&
      release.html_url.startsWith(RELEASES_PAGE_PREFIX)
    ) {
      setState({ kind: 'manual', version: latestVersion, url: release.html_url })
    }
  } catch {
    // Offline etc. — just no badge.
  }
}

/** Starts the update flow once per app run (call after the main window exists). */
export function startUpdateFlow(): void {
  if (started) return
  started = true

  if (!app.isPackaged) {
    void checkManually()
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    setState({ kind: 'downloading', version: info.version, percent: 0 })
  })
  autoUpdater.on('download-progress', (progress) => {
    if (status.state.kind !== 'downloading') return
    const percent = Math.floor(progress.percent)
    if (percent !== status.state.percent) {
      setState({ kind: 'downloading', version: status.state.version, percent })
    }
  })
  autoUpdater.on('update-downloaded', (info) => {
    setState({ kind: 'ready', version: info.version })
  })
  autoUpdater.on('error', () => {
    // Keep a finished download; otherwise fall back to the notify-only path.
    if (status.state.kind === 'ready') return
    setState({ kind: 'none' })
    void checkManually()
  })

  // Failures are also reported through the 'error' event above.
  autoUpdater.checkForUpdates().catch(() => {})
}

export function getUpdateStatus(): AppUpdateStatus {
  return status
}

export async function openUpdatePage(): Promise<void> {
  if (status.state.kind === 'manual') await shell.openExternal(status.state.url)
}

/** Restarts into the downloaded update (installer runs silently, then relaunches the app). */
export function installUpdate(): void {
  if (status.state.kind === 'ready') autoUpdater.quitAndInstall(true, true)
}
