import { shell, type IpcMain } from 'electron'
import { getRootDir } from '../paths'
import { getUpdateStatus, openUpdatePage } from '../updateCheck'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('app:getUpdateStatus', () => getUpdateStatus())
  ipcMain.handle('app:openUpdatePage', () => openUpdatePage())
  // The class-doc/ data folder (DB, templates, outputs) in Explorer — for an
  // installed build it's under %LOCALAPPDATA%/Programs/class-doc/, which
  // teachers can't easily find on their own.
  ipcMain.handle('app:openDataFolder', async () => {
    const error = await shell.openPath(getRootDir())
    if (error) throw new Error(error)
  })
}
