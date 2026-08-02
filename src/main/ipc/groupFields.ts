import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { mapGroupField, type GroupFieldRow } from '../db/mappers'
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

export function setGroupFieldIdentity(
  db: Database.Database,
  groupId: number,
  groupFieldId: number,
  isIdentity: boolean
): void {
  const result = db
    .prepare('UPDATE group_field SET is_identity = ? WHERE id = ? AND group_id = ?')
    .run(isIdentity ? 1 : 0, groupFieldId, groupId)
  if (result.changes === 0) {
    throw new Error('그룹에서 해당 필드를 찾을 수 없습니다.')
  }
}

export interface GroupFieldUpsertInput {
  fieldKey: string
  displayOrder?: number | null
  isIdentity?: boolean
}

/**
 * Inserts a group_field row for `fieldKey` if it doesn't exist yet for this
 * group, otherwise patches display_order/is_identity in place (only the
 * properties explicitly provided — `undefined` means "leave unchanged").
 * `is_display` is deliberately NOT settable here: it always goes through
 * `setGroupFieldDisplay` so the "at most 1 per group" invariant has exactly
 * one code path responsible for it.
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
    if (input.displayOrder !== undefined || input.isIdentity !== undefined) {
      db.prepare(
        `UPDATE group_field
         SET display_order = COALESCE(?, display_order),
             is_identity = COALESCE(?, is_identity)
         WHERE id = ?`
      ).run(
        input.displayOrder === undefined ? null : input.displayOrder,
        input.isIdentity === undefined ? null : input.isIdentity ? 1 : 0,
        existing.id
      )
    }
    return existing.id
  }

  const result = db
    .prepare(
      `INSERT INTO group_field (group_id, field_key, display_order, is_display, is_identity)
       VALUES (?, ?, ?, 0, ?)`
    )
    .run(groupId, fieldKey, input.displayOrder ?? null, input.isIdentity ? 1 : 0)
  return Number(result.lastInsertRowid)
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
 * that may already have students. New fields default to
 * is_display=0/is_identity=0 (an existing display/identity field is left
 * alone; `upsertGroupField` never touches is_display, and this call omits
 * isIdentity so it defaults false too) and get appended after the current
 * max display_order so they sort after existing columns in StudentTable.
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
  return getGroupField(db, id)
}

/**
 * Deleting a group_field cascades to student_field_value (schema.md's
 * `ON DELETE CASCADE`) — every student in the group silently loses that
 * column's values. This is the intended "필드 삭제" behavior (per plan
 * feedback: field add/delete must work even after students exist), so no
 * extra guard against "does anyone still have a value here" is added.
 * Deleting the group's current display field is allowed at the DB layer
 * (schema.md §4/§7: "at least 1 display field" is UI-enforced only) —
 * GroupDetailPage already renders a warning `Alert` when
 * `hasDisplayField` is false, so that case is surfaced to the teacher
 * post-delete rather than blocked here.
 */
export function deleteGroupField(db: Database.Database, groupId: number, groupFieldId: number): void {
  const result = db
    .prepare('DELETE FROM group_field WHERE id = ? AND group_id = ?')
    .run(groupFieldId, groupId)
  if (result.changes === 0) {
    throw new Error('그룹에서 해당 필드를 찾을 수 없습니다.')
  }
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

  ipcMain.handle('groupField:setDisplay', (_event, payload: { groupId: number; groupFieldId: number }) => {
    setGroupFieldDisplay(getDb(), payload.groupId, payload.groupFieldId)
  })

  ipcMain.handle(
    'groupField:setIdentity',
    (_event, payload: { groupId: number; groupFieldId: number; isIdentity: boolean }) => {
      setGroupFieldIdentity(getDb(), payload.groupId, payload.groupFieldId, payload.isIdentity)
    }
  )
}
