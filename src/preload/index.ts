import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  GENERATION_PROGRESS_CHANNEL,
  type Api,
  type GenerationProgressEvent
} from '../shared/ipc-types'

// Thin `ipcRenderer.invoke(...)` wrappers, one per main-process handler
// registered in src/main/ipc/*.ts. Kept in the same order as
// src/shared/ipc-types.ts's `Api` interface so the two stay easy to diff.
const api: Api = {
  teacherGet: () => ipcRenderer.invoke('teacher:get'),
  teacherCreate: (payload) => ipcRenderer.invoke('teacher:create', payload),
  teacherUpdate: (payload) => ipcRenderer.invoke('teacher:update', payload),

  groupList: (payload) => ipcRenderer.invoke('group:list', payload),
  groupCreate: (payload) => ipcRenderer.invoke('group:create', payload),
  groupUpdate: (payload) => ipcRenderer.invoke('group:update', payload),
  groupDelete: (payload) => ipcRenderer.invoke('group:delete', payload),

  groupFieldList: (payload) => ipcRenderer.invoke('groupField:list', payload),
  groupFieldCreate: (payload) => ipcRenderer.invoke('groupField:create', payload),
  groupFieldDelete: (payload) => ipcRenderer.invoke('groupField:delete', payload),

  studentListWithValues: (payload) => ipcRenderer.invoke('student:listWithValues', payload),
  studentCreateOrUpdate: (payload) => ipcRenderer.invoke('student:createOrUpdate', payload),
  studentDelete: (payload) => ipcRenderer.invoke('student:delete', payload),
  studentImportCsv: (payload) => ipcRenderer.invoke('student:importCsv', payload),
  studentParseSpreadsheet: (payload) => ipcRenderer.invoke('student:parseSpreadsheet', payload),

  templateList: () => ipcRenderer.invoke('template:list'),
  templatePickFile: () => ipcRenderer.invoke('template:pickFile'),
  templateReadFile: (payload) => ipcRenderer.invoke('template:readFile', payload),
  templateSave: (payload) => ipcRenderer.invoke('template:save', payload),
  templateDelete: (payload) => ipcRenderer.invoke('template:delete', payload),
  templateRenderPreview: (payload) => ipcRenderer.invoke('template:renderPreview', payload),

  templateFieldList: (payload) => ipcRenderer.invoke('templateField:list', payload),
  templateFieldUpdateMapping: (payload) =>
    ipcRenderer.invoke('templateField:updateMapping', payload),

  generationPrepare: (payload) => ipcRenderer.invoke('generation:prepare', payload),
  generationRenderPreviewPage: (payload) =>
    ipcRenderer.invoke('generation:renderPreviewPage', payload),
  generationCommit: (payload) => ipcRenderer.invoke('generation:commit', payload),
  generationDiscardPreview: (payload) => ipcRenderer.invoke('generation:discardPreview', payload),
  generationPickOutputDir: () => ipcRenderer.invoke('generation:pickOutputDir'),
  onGenerationProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: GenerationProgressEvent): void =>
      callback(progress)
    ipcRenderer.on(GENERATION_PROGRESS_CHANNEL, listener)
    return () => ipcRenderer.removeListener(GENERATION_PROGRESS_CHANNEL, listener)
  },

  studioGetUrl: () => ipcRenderer.invoke('studio:getUrl'),

  appGetUpdateStatus: () => ipcRenderer.invoke('app:getUpdateStatus'),
  appOpenUpdatePage: () => ipcRenderer.invoke('app:openUpdatePage'),
  appOpenDataFolder: () => ipcRenderer.invoke('app:openDataFolder')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
