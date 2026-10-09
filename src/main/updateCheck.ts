// Notify-only update check: asks GitHub for the latest published release of
// this repo and compares its tag (vX.Y.Z) with app.getVersion(). Nothing is
// downloaded or installed — the renderer just shows "업데이트 가능" and opens
// the release page in the browser on click. No user/student data is sent;
// the only request is an unauthenticated GET of public release metadata.
//
// Failures (offline, rate limit, no releases yet → 404) are silent: the app
// just shows no update badge. Release tags must be `v<package.json version>`
// for the comparison to work (GitHub Actions publishes them).
import { app, net, shell } from 'electron'
import type { AppUpdateStatus } from '../shared/ipc-types'

const LATEST_RELEASE_API = 'https://api.github.com/repos/sinjinwoo/class-doc/releases/latest'
const RELEASES_PAGE_PREFIX = 'https://github.com/sinjinwoo/class-doc/releases/'
const REQUEST_TIMEOUT_MS = 8000

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

let statusPromise: Promise<AppUpdateStatus> | null = null

async function fetchStatus(): Promise<AppUpdateStatus> {
  const currentVersion = app.getVersion()
  try {
    const response = await net.fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return { currentVersion, update: null }
    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown }
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') {
      return { currentVersion, update: null }
    }
    const latestVersion = release.tag_name.replace(/^v/i, '')
    // Only ever open this repo's own release pages, whatever the API returned.
    if (
      compareVersions(latestVersion, currentVersion) <= 0 ||
      !release.html_url.startsWith(RELEASES_PAGE_PREFIX)
    ) {
      return { currentVersion, update: null }
    }
    return { currentVersion, update: { version: latestVersion, url: release.html_url } }
  } catch {
    return { currentVersion, update: null }
  }
}

/** Checked once per app run; later calls reuse the first result. */
export function getUpdateStatus(): Promise<AppUpdateStatus> {
  if (!statusPromise) statusPromise = fetchStatus()
  return statusPromise
}

export async function openUpdatePage(): Promise<void> {
  const { update } = await getUpdateStatus()
  if (update) await shell.openExternal(update.url)
}
