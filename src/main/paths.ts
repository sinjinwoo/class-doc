// Resolves the portable-app storage layout: <base>/class-doc/{data,template,output}.
//
// `base` is the folder next to the packaged executable in production (portable-app
// style — not per-OS AppData), but falls back to the project root (process.cwd())
// in dev, since "next to the exe" would otherwise scatter files inside
// node_modules/electron/dist/ (where the dev Electron binary lives).
//
// `getOutputDir()` is not explicitly named in the Phase 1 plan text (which only
// calls out {data,template}), but the generation pipeline (Phase 2, generation.ts)
// needs *somewhere* on disk to write generated .hwpx files, and the plan's own
// validation section is explicit that generated output must NOT land inside
// class-doc/template/ (that folder is for registered templates only). Adding a
// third sibling folder here — rather than inventing an ad hoc path inside
// generation.ts — keeps all storage-layout decisions in one place.
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

function resolveBaseDir(): string {
  return app.isPackaged ? dirname(app.getPath('exe')) : process.cwd()
}

function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getRootDir(): string {
  return ensureDir(join(resolveBaseDir(), 'class-doc'))
}

export function getDataDir(): string {
  return ensureDir(join(getRootDir(), 'data'))
}

export function getTemplateDir(): string {
  return ensureDir(join(getRootDir(), 'template'))
}

export function getOutputDir(): string {
  return ensureDir(join(getRootDir(), 'output'))
}
