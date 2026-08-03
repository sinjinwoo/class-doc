import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { mapGroupField, type GroupFieldRow } from '../db/mappers'
import { CONVENTIONAL_DISPLAY_KEYS, CONVENTIONAL_IDENTITY_KEYS } from '../db/identityHash'
import type { GroupField } from '../../shared/domain'

export function listGroupFields(db: Database.Database, groupId: number): GroupField[] {
  const rows = db
    .prepare(
      `SELECT id, group_id, field_key, display_order, is_display, is_identity, created_at
       FROM group_field
       WHERE group_id = ?
       ORDER BY display_order IS NULL, display_order, id`
    )
    .all(groupId) as GroupFieldRow[]
  return rows.map(mapGroupField)
}

/**
 * Enforces "at most 1 is_display per group" server-side. The DB's partial
 * unique index (`idx_group_field_one_display`) only rejects a naive
 * double-INSERT/UPDATE that tries to set a *second* row's is_display=1 while
 * a first one already has it — it does not by itself turn "set field B as
 * display" into "unset field A, set field B" as a single operation. This
 * always clears every field in the group first, then sets the target field,
 * inside one transaction, so an intermediate state with 0 or 2 display
 * fields is never persisted or observable by a concurrent read.
 */
export function setGroupFieldDisplay(db: Database.Database, groupId: number, groupFieldId: number): void {
  const txn = db.transaction(() => {
    db.prepare('UPDATE group_field SET is_display = 0 WHERE group_id = ?').run(groupId)
    const result = db
      .prepare('UPDATE group_field SET is_display = 1 WHERE id = ? AND group_id = ?')
      .run(groupFieldId, groupId)
    if (result.changes === 0) {
      throw new Error('그룹에서 해당 필드를 찾을 수 없습니다.')
    }
  })
  txn()
}

export interface GroupFieldUpsertInput {
  fieldKey: string
  displayOrder?: number | null
}

/**
 * Inserts a group_field row for `fieldKey` if it doesn't exist yet for this
 * group, otherwise patches display_order in place (only when explicitly
 * provided — `undefined` means "leave unchanged"). `is_display`/`is_identity`
 * are deliberately NOT settable here: there is no more manual UI for either
 * (teacher feedback: the concept was confusing and unnecessary) — both are
 * always re-derived by `autoAssignFieldRoles` after any field-set change, so
 * a single code path owns each invariant ("at most 1 display field per
 * group", conventional-name-based identity set).
 *
 * Returns the group_field id (existing or newly created).
 */
export function upsertGroupField(
  db: Database.Database,
  groupId: number,
  input: GroupFieldUpsertInput
): number {
  const fieldKey = input.fieldKey.trim()
  const existing = db
    .prepare('SELECT id FROM group_field WHERE group_id = ? AND field_key = ?')
    .get(groupId, fieldKey) as { id: number } | undefined

  if (existing) {
    if (input.displayOrder !== undefined) {
      db.prepare('UPDATE group_field SET display_order = ? WHERE id = ?').run(
        input.displayOrder,
        existing.id
      )
    }
    return existing.id
  }

  const result = db
    .prepare(
      `INSERT INTO group_field (group_id, field_key, display_order, is_display, is_identity)
       VALUES (?, ?, ?, 0, 0)`
    )
    .run(groupId, fieldKey, input.displayOrder ?? null)
  return Number(result.lastInsertRowid)
}

/**
 * Re-derives is_display/is_identity for every group_field in a group from
 * conventional roster column names, replacing the manual "표시 필드"/"식별
 * 필드" pickers this app used to expose. Called after any operation that
 * changes a group's field set (CSV import, add/delete field, single-student
 * bootstrap) so both roles stay consistent with whatever fields currently
 * exist, with no teacher input required:
 * - identity: fields matching CONVENTIONAL_IDENTITY_KEYS (학년/반/번호) are
 *   marked is_identity=1; if none of those are present, every field is left
 *   is_identity=0, which `resolveIdentityFields`'s fallback already turns
 *   into "hash across every field" — the same safety net this app already
 *   relied on for groups that never set an identity field explicitly.
 * - display: if the group already has an is_display=1 field, it's left
 *   alone (deleting/renaming isn't possible without a fieldKey collision, so
 *   only a genuinely missing display field needs (re)picking). Otherwise
 *   prefers a field named 이름/성명, else the first field by display_order.
 */
export function autoAssignFieldRoles(db: Database.Database, groupId: number): void {
  const fields = listGroupFields(db, groupId)
  if (fields.length === 0) return

  const identityKeys = new Set<string>(CONVENTIONAL_IDENTITY_KEYS)
  const setIdentity = db.prepare('UPDATE group_field SET is_identity = ? WHERE id = ?')
  for (const field of fields) {
    setIdentity.run(identityKeys.has(field.fieldKey) ? 1 : 0, field.id)
  }

  if (!fields.some((f) => f.isDisplay)) {
    const preferred =
      fields.find((f) => (CONVENTIONAL_DISPLAY_KEYS as readonly string[]).includes(f.fieldKey)) ??
      fields[0]
    setGroupFieldDisplay(db, groupId, preferred.id)
  }
}

function getGroupField(db: Database.Database, groupFieldId: number): GroupField {
  const row = db
    .prepare(
      `SELECT id, group_id, field_key, display_order, is_display, is_identity, created_at
       FROM group_field WHERE id = ?`
    )
    .get(groupFieldId) as GroupFieldRow | undefined
  if (!row) {
    throw new Error('필드를 찾을 수 없습니다.')
  }
  return mapGroupField(row)
}

/**
 * Manual "필드 추가" path (GroupDetailPage), distinct from CSV import's bulk
 * header reconciliation — a teacher adding one field at a time to a group
 * that may already have students. Appended after the current max
 * display_order so it sorts after existing columns in StudentTable;
 * is_display/is_identity are re-derived by `autoAssignFieldRoles` afterward.
 */
export function createGroupField(db: Database.Database, groupId: number, fieldKey: string): GroupField {
  const trimmed = fieldKey.trim()
  if (trimmed.length === 0) {
    throw new Error('필드 이름을 입력해 주세요.')
  }
  const maxOrder = db
    .prepare('SELECT MAX(display_order) as maxOrder FROM group_field WHERE group_id = ?')
    .get(groupId) as { maxOrder: number | null }
  const id = upsertGroupField(db, groupId, {
    fieldKey: trimmed,
    displayOrder: (maxOrder.maxOrder ?? -1) + 1
  })
  autoAssignFieldRoles(db, groupId)
  return getGroupField(db, id)
}

/**
 * Deleting a group_field cascades to student_field_value (schema.md's
 * `ON DELETE CASCADE`) — every student in the group silently loses that
 * column's values. This is the intended "필드 삭제" behavior (per plan
 * feedback: field add/delete must work even after students exist), so no
 * extra guard against "does anyone still have a value here" is added.
 * Deleting the group's current display field re-derives a new one (if any
 * fields remain) via `autoAssignFieldRoles` instead of leaving the group
 * without one.
 */
export function deleteGroupField(db: Database.Database, groupId: number, groupFieldId: number): void {
  const result = db
    .prepare('DELETE FROM group_field WHERE id = ? AND group_id = ?')
    .run(groupFieldId, groupId)
  if (result.changes === 0) {
    throw new Error('그룹에서 해당 필드를 찾을 수 없습니다.')
  }
  autoAssignFieldRoles(db, groupId)
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('groupField:list', (_event, payload: { groupId: number }) => {
    return listGroupFields(getDb(), payload.groupId)
  })

  ipcMain.handle('groupField:create', (_event, payload: { groupId: number; fieldKey: string }) => {
    return createGroupField(getDb(), payload.groupId, payload.fieldKey)
  })

  ipcMain.handle('groupField:delete', (_event, payload: { groupId: number; groupFieldId: number }) => {
    deleteGroupField(getDb(), payload.groupId, payload.groupFieldId)
  })
}
