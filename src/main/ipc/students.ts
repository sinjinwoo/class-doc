import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { mapStudent, type StudentRow } from '../db/mappers'
import { computeIdentityHash, normalizeFieldValue, resolveIdentityFields } from '../db/identityHash'
import { autoAssignFieldRoles, listGroupFields, upsertGroupField } from './groupFields'
import type { StudentWithValues } from '../../shared/domain'
import type {
  StudentCreateOrUpdateRequest,
  StudentDeleteRequest,
  StudentImportCsvRequest,
  StudentImportCsvResult,
  StudentListWithValuesRequest
} from '../../shared/ipc-types'

/** Reused by generation.ts, which needs the same per-student value shape. */
export function listStudentsWithValues(db: Database.Database, groupId: number): StudentWithValues[] {
  const students = db
    .prepare(
      'SELECT id, group_id, identity_hash, created_at, updated_at FROM student WHERE group_id = ? ORDER BY id'
    )
    .all(groupId) as StudentRow[]

  const values = db
    .prepare(
      `SELECT sfv.student_id AS student_id, sfv.group_field_id AS group_field_id, sfv.value AS value
       FROM student_field_value sfv
       JOIN student s ON s.id = sfv.student_id
       WHERE s.group_id = ?`
    )
    .all(groupId) as Array<{ student_id: number; group_field_id: number; value: string | null }>

  const valuesByStudent = new Map<number, Record<number, string | null>>()
  for (const v of values) {
    const bucket = valuesByStudent.get(v.student_id) ?? {}
    bucket[v.group_field_id] = v.value
    valuesByStudent.set(v.student_id, bucket)
  }

  return students.map((row) => ({
    ...mapStudent(row),
    values: valuesByStudent.get(row.id) ?? {}
  }))
}

function upsertStudentRow(
  db: Database.Database,
  groupId: number,
  identityHash: string
): { studentId: number; created: boolean } {
  const existing = db
    .prepare('SELECT id FROM student WHERE group_id = ? AND identity_hash = ?')
    .get(groupId, identityHash) as { id: number } | undefined

  if (existing) {
    return { studentId: existing.id, created: false }
  }

  const result = db
    .prepare('INSERT INTO student (group_id, identity_hash) VALUES (?, ?)')
    .run(groupId, identityHash)
  return { studentId: Number(result.lastInsertRowid), created: true }
}

function upsertStudentFieldValues(
  db: Database.Database,
  studentId: number,
  entries: Array<{ groupFieldId: number; value: string | null }>
): void {
  const stmt = db.prepare(
    `INSERT INTO student_field_value (student_id, group_field_id, value)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id, group_field_id) DO UPDATE SET value = excluded.value`
  )
  for (const entry of entries) {
    stmt.run(studentId, entry.groupFieldId, entry.value)
  }
}

/**
 * Shared upsert core for both the single-student form path
 * (`student:createOrUpdate`) and CSV bulk import (`student:importCsv`) — both
 * ultimately do "ensure group_field definitions exist, compute identity_hash
 * from is_identity fields, upsert student + student_field_value rows" per
 * docs/schema.md §4's algorithm.
 */
function createOrUpdateStudent(db: Database.Database, payload: StudentCreateOrUpdateRequest): StudentWithValues {
  const { groupId } = payload

  const studentId = db.transaction(() => {
    let fields = listGroupFields(db, groupId)
    const existingKeys = new Set(fields.map((f) => f.fieldKey))
    const incomingKeys = Object.keys(payload.values)

    // Bootstrap case: a brand-new group has no group_field rows yet (see
    // docs/schema.md §4 — a group needs at least one group_field before a
    // student can be added, via either a CSV import or, here, the first
    // manually-entered student's own field keys). Any brand-new key gets
    // created with no role yet; `autoAssignFieldRoles` below derives
    // is_display/is_identity for the whole group afterward (from
    // conventional roster column names — there's no more manual "표시
    // 필드"/"식별 필드" picker to fall back on).
    let addedNewField = false
    incomingKeys.forEach((key, index) => {
      if (existingKeys.has(key)) return
      upsertGroupField(db, groupId, { fieldKey: key, displayOrder: fields.length + index })
      addedNewField = true
    })
    if (addedNewField) {
      autoAssignFieldRoles(db, groupId)
    }

    fields = listGroupFields(db, groupId)
    const fieldByKey = new Map(fields.map((f) => [f.fieldKey, f]))
    const identityFields = resolveIdentityFields(fields)

    const identityHash = computeIdentityHash(
      identityFields.map((f) => ({ fieldKey: f.fieldKey, value: payload.values[f.fieldKey] }))
    )

    let resolvedStudentId: number
    if (payload.studentId !== undefined) {
      const existingStudent = db
        .prepare('SELECT id FROM student WHERE id = ? AND group_id = ?')
        .get(payload.studentId, groupId)
      if (!existingStudent) {
        throw new Error('학생을 찾을 수 없습니다.')
      }
      db.prepare('UPDATE student SET identity_hash = ? WHERE id = ?').run(identityHash, payload.studentId)
      resolvedStudentId = payload.studentId
    } else {
      resolvedStudentId = upsertStudentRow(db, groupId, identityHash).studentId
    }

    const entries = Object.entries(payload.values)
      .map(([key, value]) => {
        const field = fieldByKey.get(key)
        if (!field) return null
        return { groupFieldId: field.id, value: normalizeFieldValue(value) }
      })
      .filter((e): e is { groupFieldId: number; value: string } => e !== null)

    upsertStudentFieldValues(db, resolvedStudentId, entries)

    return resolvedStudentId
  })()

  const student = listStudentsWithValues(db, groupId).find((s) => s.id === studentId)
  if (!student) {
    throw new Error('학생 저장 후 조회에 실패했습니다.')
  }
  return student
}

function importCsv(db: Database.Database, payload: StudentImportCsvRequest): StudentImportCsvResult {
  const { groupId, rows, fieldKeys } = payload

  const imported = db.transaction(() => {
    // 1. Reconcile this group's group_field definitions against the CSV's
    //    header set (docs/schema.md §4 upsert algorithm, step 1), then
    //    re-derive is_display/is_identity from conventional column names —
    //    there's no more manual "표시 필드"/"식별 필드" picker in the import
    //    wizard.
    fieldKeys.forEach((fieldKey, index) => {
      upsertGroupField(db, groupId, { fieldKey, displayOrder: index })
    })
    autoAssignFieldRoles(db, groupId)

    const fields = listGroupFields(db, groupId)
    const fieldByKey = new Map(fields.map((f) => [f.fieldKey, f]))
    const identityFields = resolveIdentityFields(fields)

    // 2. Per CSV row: compute identity_hash, upsert student, upsert values
    //    (docs/schema.md §4 upsert algorithm, step 2).
    for (const row of rows) {
      const identityHash = computeIdentityHash(
        identityFields.map((f) => ({ fieldKey: f.fieldKey, value: row[f.fieldKey] }))
      )
      const { studentId } = upsertStudentRow(db, groupId, identityHash)

      const entries = fieldKeys
        .map((fieldKey) => {
          const field = fieldByKey.get(fieldKey)
          if (!field) return null
          return { groupFieldId: field.id, value: normalizeFieldValue(row[fieldKey]) }
        })
        .filter((e): e is { groupFieldId: number; value: string } => e !== null)

      upsertStudentFieldValues(db, studentId, entries)
    }

    return rows.length
  })()

  return { imported }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('student:listWithValues', (_event, payload: StudentListWithValuesRequest) => {
    return listStudentsWithValues(getDb(), payload.groupId)
  })

  ipcMain.handle('student:createOrUpdate', (_event, payload: StudentCreateOrUpdateRequest) => {
    return createOrUpdateStudent(getDb(), payload)
  })

  ipcMain.handle('student:delete', (_event, payload: StudentDeleteRequest) => {
    getDb().prepare('DELETE FROM student WHERE id = ?').run(payload.studentId)
  })

  ipcMain.handle('student:importCsv', (_event, payload: StudentImportCsvRequest) => {
    return importCsv(getDb(), payload)
  })
}
