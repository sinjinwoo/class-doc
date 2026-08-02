import { ipcMain } from 'electron'
import { register as registerTeacher } from './teacher'
import { register as registerGroups } from './groups'
import { register as registerGroupFields } from './groupFields'
import { register as registerStudents } from './students'
import { register as registerTemplates } from './templates'
import { register as registerTemplateFields } from './templateFields'
import { register as registerGeneration } from './generation'

export function registerIpcHandlers(): void {
  registerTeacher(ipcMain)
  registerGroups(ipcMain)
  registerGroupFields(ipcMain)
  registerStudents(ipcMain)
  registerTemplates(ipcMain)
  registerTemplateFields(ipcMain)
  registerGeneration(ipcMain)
}
