import type { IpcMain } from 'electron'
import { getDb } from '../db'
import { mapTeacher, type TeacherRow } from '../db/mappers'
import type { TeacherCreateRequest, TeacherUpdateRequest } from '../../shared/ipc-types'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('teacher:get', () => {
    const row = getDb()
      .prepare('SELECT id, name, created_at FROM teacher ORDER BY id LIMIT 1')
      .get() as TeacherRow | undefined
    return row ? mapTeacher(row) : null
  })

  ipcMain.handle('teacher:create', (_event, payload: TeacherCreateRequest) => {
    const db = getDb()
    // Single local profile — see docs/schema.md's assumption notes (§7):
    // nothing in the schema itself prevents multiple teacher rows, but this
    // app's UI/flow only ever registers one, so reject a second.
    const existing = db.prepare('SELECT id FROM teacher LIMIT 1').get()
    if (existing) {
      throw new Error('이미 등록된 교사 프로필이 있습니다.')
    }
    const name = payload.name.trim()
    if (!name) {
      throw new Error('이름을 입력해주세요.')
    }
    const result = db.prepare('INSERT INTO teacher (name) VALUES (?)').run(name)
    const row = db
      .prepare('SELECT id, name, created_at FROM teacher WHERE id = ?')
      .get(result.lastInsertRowid) as TeacherRow
    return mapTeacher(row)
  })

  ipcMain.handle('teacher:update', (_event, payload: TeacherUpdateRequest) => {
    const db = getDb()
    const name = payload.name.trim()
    if (!name) {
      throw new Error('이름을 입력해주세요.')
    }
    const result = db.prepare('UPDATE teacher SET name = ? WHERE id = ?').run(name, payload.id)
    if (result.changes === 0) {
      throw new Error('교사 프로필을 찾을 수 없습니다.')
    }
    const row = db.prepare('SELECT id, name, created_at FROM teacher WHERE id = ?').get(payload.id) as TeacherRow
    return mapTeacher(row)
  })
}
