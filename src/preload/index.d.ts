import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from '../shared/ipc-types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
