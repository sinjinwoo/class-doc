// Serves the self-hosted rhwp-studio build (resources/rhwp-studio/, produced
// by scripts/build-rhwp-studio.mjs) over http://127.0.0.1 so the
// template-editor iframe works offline. HTTP rather than file:// or a custom
// protocol because @rhwp/editor's SDK rejects non-HTTP(S) studio origins.
//
// Started lazily on the first `studio:getUrl` request and kept for the app's
// lifetime.
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { startStaticServer } from '../localServer'

// Fixed so rhwp-studio's own localStorage settings (zoom, view options)
// survive restarts; startStaticServer() falls back to a random port if taken.
const PREFERRED_STUDIO_PORT = 47811

// app.getAppPath() is the project root in dev and .../resources/app.asar when
// packaged — Electron's fs transparently redirects reads under app.asar to
// app.asar.unpacked/ for the `asarUnpack: resources/**` entries.
function getStudioDir(): string {
  return join(app.getAppPath(), 'resources', 'rhwp-studio')
}

let urlPromise: Promise<string> | null = null

export function getStudioUrl(): Promise<string> {
  if (!urlPromise) {
    const studioDir = getStudioDir()
    urlPromise = existsSync(join(studioDir, 'index.html'))
      ? startStaticServer(studioDir, PREFERRED_STUDIO_PORT)
      : Promise.reject(
          new Error(
            `편집기 파일(rhwp-studio)이 없습니다: ${studioDir} — 개발 환경이라면 'npm run studio:build'를 먼저 실행하세요.`
          )
        )
    // Let a later call retry (e.g. after `npm run studio:build` in dev).
    urlPromise.catch(() => {
      urlPromise = null
    })
  }
  return urlPromise
}
