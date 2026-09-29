import { clipboard, ipcMain, shell } from 'electron';
import { clipboardWriteTextSchema, openLocalhostSchema } from './schemas';

export function registerWindowHandlers(hidePopover: () => void): void {
  ipcMain.on('window:hide', () => {
    hidePopover();
  });

  ipcMain.handle('shell:open-url', async (_event, rawPayload: unknown) => {
    const parsed = openLocalhostSchema.safeParse(rawPayload);
    if (!parsed.success) throw new Error('invalid-payload');
    await shell.openExternal(`http://localhost:${parsed.data.port}`);
  });

  ipcMain.handle('clipboard:write-text', (_event, rawPayload: unknown) => {
    const parsed = clipboardWriteTextSchema.safeParse(rawPayload);
    if (!parsed.success) throw new Error('invalid-payload');
    clipboard.writeText(parsed.data.text);
  });
}
