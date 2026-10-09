import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDataDir, getTemplateDir, getOutputDir } from './paths'
import { getDb } from './db'
import { registerIpcHandlers } from './ipc'
import { startStaticServer } from './localServer'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    // Packaged Windows builds already get the exe's embedded icon
    // (build/icon.ico); setting it explicitly also covers `npm run dev` and
    // `npx electron .`, which would otherwise show Electron's default icon.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development; in production, serve the built
  // renderer over http://127.0.0.1 rather than loadFile(): rhwp-studio's embed
  // runtime only accepts http(s) parent origins (isUsableParentOrigin() in
  // rhwp-studio/src/embed/protocol.ts) and silently ignores a file:// parent,
  // which left the template editor's createEditor() hanging.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    startStaticServer(join(__dirname, '../renderer')).then((url) => mainWindow.loadURL(url))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Storage layout (<base>/class-doc/{data,template,output}) + DB migration
  // must both be ready before any renderer/IPC code can touch them.
  getDataDir()
  getTemplateDir()
  getOutputDir()
  getDb()

  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
