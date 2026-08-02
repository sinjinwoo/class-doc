// Opens the app's single SQLite file and migrates it via `PRAGMA user_version`.
//
// Deliberately not `CREATE TABLE IF NOT EXISTS` scattered around: schema.sql
// contains triggers and a partial unique index that don't compose cleanly with
// that pattern (e.g. re-running `CREATE TRIGGER` unconditionally throws if it
// already exists, and there's no `CREATE TRIGGER IF NOT EXISTS` equivalent for
// some SQLite versions' trigger semantics worth relying on). Instead: version 0
// means "empty database", so run the whole schema once inside a transaction and
// bump user_version to 1. Future schema changes get their own `if (version < N)`
// branch appended below — never rewritten in place, so upgrading a real user's
// existing database always replays only the deltas it hasn't seen yet.
import Database from 'better-sqlite3'
import { join } from 'path'
import { getDataDir } from '../paths'
import schemaSql from './schema.sql?raw'

const CURRENT_SCHEMA_VERSION = 2

// v3 (docs/schema.md §4 "설계 질문: 매핑을 (템플릿, 그룹) 쌍마다 저장해야
// 하는가"): per-(template, group) mapping override table. `schema.sql` (the
// byte-identical executable copy of docs/schema.md §3's DDL) already contains
// this table's `CREATE TABLE`/`CREATE INDEX` statements inline — that file is
// meant to always reflect the *complete current* schema, so a brand-new
// database (version 0) gets it for free via the `version < 1` branch below.
// This version-2 branch exists for the *other* case this same statement text
// must also handle: a real user's existing database that already migrated to
// version 1 (before this table existed) and needs to pick up only this delta
// on next launch. Both branches are evaluated against the *same* `version`
// value read once at the top of `migrate()` (not re-read in between), so a
// truly fresh database satisfies both `version < 1` and `version < 2` and
// runs both blocks in the same call — meaning this block must tolerate the
// table already having been created a moment earlier by `schema.sql`. Hence
// `IF NOT EXISTS` here specifically (unlike the rest of schema.sql, which
// deliberately avoids that pattern per the file-level comment above — that
// reasoning is about triggers/partial-unique-indexes not composing with
// blind re-runs of the *whole* schema, which doesn't apply to this one
// self-contained table+index pair).
const TEMPLATE_FIELD_OVERRIDE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS template_field_override (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    template_field_id  INTEGER NOT NULL,
    group_id           INTEGER NOT NULL,
    binding            TEXT NOT NULL CHECK (length(trim(binding)) > 0),
    required           INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)),
    default_value      TEXT,
    FOREIGN KEY (template_field_id) REFERENCES template_field(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES student_group(id) ON DELETE CASCADE,
    UNIQUE (template_field_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_template_field_override_group_id ON template_field_override(group_id);
`

let dbInstance: Database.Database | undefined

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number

  if (version < 1) {
    db.transaction(() => {
      db.exec(schemaSql)
      db.pragma('user_version = 1')
    })()
  }

  if (version < 2) {
    db.transaction(() => {
      db.exec(TEMPLATE_FIELD_OVERRIDE_MIGRATION_SQL)
      db.pragma('user_version = 2')
    })()
  }
}

function openDb(): Database.Database {
  const dbPath = join(getDataDir(), 'class-doc.sqlite')
  const db = new Database(dbPath)

  // better-sqlite3 requires this on every connection, not just once ever —
  // SQLite's foreign_keys pragma is a per-connection setting, not persisted in
  // the database file itself (docs/schema.md is explicit about this).
  db.pragma('foreign_keys = ON')

  migrate(db)

  return db
}

/** Returns the process-wide DB connection, opening (and migrating) it on first use. */
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = openDb()
  }
  return dbInstance
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = undefined
  }
}

// Re-exported for readability at call sites that just want a schema-version
// constant to log/report without reaching into the migration internals.
export { CURRENT_SCHEMA_VERSION }
