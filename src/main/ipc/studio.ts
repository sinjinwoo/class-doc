import type { IpcMain } from 'electron'
import { getStudioUrl } from '../rhwp/studioServer'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('studio:getUrl', () => getStudioUrl())
}
