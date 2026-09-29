import { contextBridge, ipcRenderer } from 'electron';
import type { KillResult, PortEntry, PortListPatch, PortPilotBridge } from '@shared/types';

const bridge: PortPilotBridge = {
  ports: {
    getSnapshot: () => ipcRenderer.invoke('ports:get-snapshot') as Promise<PortEntry[]>,
    onUpdate: (cb) => {
      const listener = (_event: Electron.IpcRendererEvent, patch: PortListPatch): void => cb(patch);
      ipcRenderer.on('ports:update', listener);
      return () => ipcRenderer.removeListener('ports:update', listener);
    }
  },
  kill: {
    request: (pid, port) => ipcRenderer.invoke('kill:request', { pid, port }) as Promise<KillResult>,
    confirmForce: (pid) => ipcRenderer.invoke('kill:confirm-force', { pid }) as Promise<KillResult>,
    onUpdate: (cb) => {
      const listener = (_event: Electron.IpcRendererEvent, result: KillResult): void => cb(result);
      ipcRenderer.on('kill:update', listener);
      return () => ipcRenderer.removeListener('kill:update', listener);
    }
  },
  window: {
    hide: () => ipcRenderer.send('window:hide'),
    onWillShow: (cb) => {
      const listener = (): void => cb();
      ipcRenderer.on('popover:will-show', listener);
      return () => ipcRenderer.removeListener('popover:will-show', listener);
    }
  },
  shell: {
    openLocalhost: (port) => ipcRenderer.invoke('shell:open-url', { port }) as Promise<void>
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke('clipboard:write-text', { text }) as Promise<void>
  }
};

contextBridge.exposeInMainWorld('portpilot', bridge);
