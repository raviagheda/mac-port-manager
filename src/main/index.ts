import { join } from 'node:path';
import { app, dialog } from 'electron';
import { DEFAULT_SETTINGS, type Settings } from '@shared/types';
import { registerIpcHandlers } from './ipc';
import { ScanLoop } from './scanLoop';
import { Killer } from './services/killer';
import { createTrayController } from './tray';

const settings: Settings = { ...DEFAULT_SETTINGS };

app.setName('PortPilot');

// LSUIElement handles this for packaged builds; dock.hide() covers dev mode
// where the Info.plist key isn't in effect yet.
if (process.platform === 'darwin') {
  app.dock?.hide();
}

function bootstrap(): void {
  const preloadPath = join(__dirname, '../preload/index.js');
  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? null;
  const rendererFile = rendererUrl ? null : join(__dirname, '../renderer/index.html');

  const killer = new Killer();

  const scanLoop = new ScanLoop(settings, (patch) => {
    trayController.popover.webContents.send('ports:update', patch);
    const activeCount = scanLoop.getSnapshot().filter((e) => e.category === 'dev').length;
    if (settings.showBadgeCount) trayController.setBadgeCount(activeCount);
  });

  killer.onUpdate((result) => {
    trayController.popover.webContents.send('kill:update', result);
  });

  const trayController = createTrayController(preloadPath, rendererUrl, rendererFile, {
    onShow: () => {
      scanLoop.setPollingActive(true);
      void scanLoop.runCycle();
    },
    onHide: () => {
      scanLoop.setPollingActive(false);
    },
    onKillAllDevPorts: () => {
      const killable = scanLoop.getSnapshot().filter((e) => !e.protected);
      if (killable.length === 0) return;

      const list = killable.map((e) => `:${e.port} — ${e.project?.name ?? e.process?.comm ?? e.command}`).join('\n');
      const response = dialog.showMessageBoxSync(trayController.popover, {
        type: 'warning',
        buttons: ['Cancel', 'Kill All'],
        defaultId: 0,
        cancelId: 0,
        message: `Kill ${killable.length} dev port${killable.length === 1 ? '' : 's'}?`,
        detail: list
      });

      if (response === 1) {
        for (const entry of killable) {
          killer.request(
            entry.pid,
            entry.port,
            { pid: entry.pid, user: entry.process?.user ?? '', cwd: entry.process?.cwd ?? null, execPath: entry.process?.execPath ?? null },
            settings
          );
        }
      }
    },
    onPreferences: () => {
      // Preferences window is deferred to a later milestone.
    }
  });

  registerIpcHandlers({
    scanLoop,
    killer,
    getSettings: () => settings,
    hidePopover: () => trayController.hidePopover()
  });

  scanLoop.setPollingActive(false);
  scanLoop.start();
  void scanLoop.runCycle();
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  // Menu bar app: never quit just because the popover isn't showing.
});
