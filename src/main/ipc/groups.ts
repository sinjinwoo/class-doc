import type { IpcMain } from 'electron'
import { getDb } from '../db'
import { mapStudentGroup, type StudentGroupRow } from '../db/mappers'
import type {
  GroupCreateRequest,
  GroupDeleteRequest,
  GroupListRequest,
  GroupUpdateRequest
} from '../../shared/ipc-types'

const SELECT_GROUP =
  'SELECT id, teacher_id, name, created_at, updated_at FROM student_group WHERE id = ?'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('group:list', (_event, payload: GroupListRequest) => {
    const rows = getDb()
      .prepare(
        `SELECT id, teacher_id, name, created_at, updated_at
         FROM student_group
         WHERE teacher_id = ?
         ORDER BY name`
      )
      .all(payload.teacherId) as StudentGroupRow[]
    return rows.map(mapStudentGroup)
  })

  ipcMain.handle('group:create', (_event, payload: GroupCreateRequest) => {
    const db = getDb()
    const name = payload.name.trim()
    if (!name) {
      throw new Error('그룹 이름을 입력해주세요.')
    }
    const result = db
      .prepare('INSERT INTO student_group (teacher_id, name) VALUES (?, ?)')
      .run(payload.teacherId, name)
    const row = db.prepare(SELECT_GROUP).get(result.lastInsertRowid) as StudentGroupRow
    return mapStudentGroup(row)
  })

  ipcMain.handle('group:update', (_event, payload: GroupUpdateRequest) => {
    const db = getDb()
    const name = payload.name.trim()
    if (!name) {
      throw new Error('그룹 이름을 입력해주세요.')
    }
    const result = db
      .prepare(
        `UPDATE student_group
         SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`
      )
      .run(name, payload.id)
    if (result.changes === 0) {
      throw new Error('그룹을 찾을 수 없습니다.')
    }
    const row = db.prepare(SELECT_GROUP).get(payload.id) as StudentGroupRow
    return mapStudentGroup(row)
  })

  ipcMain.handle('group:delete', (_event, payload: GroupDeleteRequest) => {
    getDb().prepare('DELETE FROM student_group WHERE id = ?').run(payload.id)
  })
}
