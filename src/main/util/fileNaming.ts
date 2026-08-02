// Shared filesystem-name helpers for template.ts (registered template files)
// and generation.ts (generated output files) — both need "sanitize illegal
// characters" + "dedupe collisions with (1)/(2) suffixes", per the plan's
// filename-convention notes (arcjotectire.md / docs/schema.md §4).
import { existsSync } from 'fs'
import { basename, extname, join } from 'path'

// Windows-illegal path characters, plus the ones POSIX allows but are still a
// bad idea in a cross-platform "portable app" filename.
const ILLEGAL_CHARS = /[\\/:*?"<>|]/g

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(ILLEGAL_CHARS, '_').trim()
  return cleaned.length > 0 ? cleaned : '_'
}

/**
 * Appends `(1)`, `(2)`, ... before the extension until `dir/candidate`
 * doesn't already exist on disk *and* isn't already reserved by `reserved`
 * (used within a single generation run so two students who'd otherwise
 * produce the same filename don't overwrite each other before either file
 * has actually been written to disk yet). If provided, the final chosen name
 * is added to `reserved`.
 */
export function dedupeFileName(dir: string, fileName: string, reserved?: Set<string>): string {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = fileName
  let counter = 1
  while (existsSync(join(dir, candidate)) || (reserved?.has(candidate) ?? false)) {
    candidate = `${stem}(${counter})${ext}`
    counter += 1
  }
  reserved?.add(candidate)
  return candidate
}
