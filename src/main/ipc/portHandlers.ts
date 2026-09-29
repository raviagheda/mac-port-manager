import { ipcMain } from 'electron';
import type { ScanLoop } from '../scanLoop';

export function registerPortHandlers(scanLoop: ScanLoop): void {
  ipcMain.handle('ports:get-snapshot', () => {
    return scanLoop.getSnapshot();
  });
}
