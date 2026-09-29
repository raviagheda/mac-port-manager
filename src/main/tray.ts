import { join } from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';

export interface TrayController {
  tray: Tray;
  popover: BrowserWindow;
  showPopover(): void;
  hidePopover(): void;
  togglePopover(): void;
  setBadgeCount(count: number): void;
}

export interface TrayCallbacks {
  onShow(): void;
  onHide(): void;
  onKillAllDevPorts(): void;
  onPreferences(): void;
}

const POPOVER_WIDTH = 420;
const POPOVER_HEIGHT = 560;
const RE_SHOW_GUARD_MS = 150;

function resolveIconPath(filename: string): string {
  // In dev, resources/ sits at the project root; electron-vite copies it
  // next to the built main bundle for packaged builds.
  return app.isPackaged ? join(process.resourcesPath, filename) : join(__dirname, '../../resources', filename);
}

function positionPopoverUnderTray(popover: BrowserWindow, tray: Tray): void {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPOVER_WIDTH / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - POPOVER_WIDTH - 8));

  popover.setBounds({ x, y, width: POPOVER_WIDTH, height: POPOVER_HEIGHT });
}

export function createTrayController(preloadPath: string, rendererUrl: string | null, rendererFile: string | null, callbacks: TrayCallbacks): TrayController {
  const icon = nativeImage.createFromPath(resolveIconPath('trayIconTemplate.png'));
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('PortPilot');

  const popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: true,
    transparent: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    roundedCorners: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (rendererUrl) {
    void popover.loadURL(rendererUrl);
  } else if (rendererFile) {
    void popover.loadFile(rendererFile);
  }

  let lastHideAt = 0;

  const showPopover = (): void => {
    positionPopoverUnderTray(popover, tray);
    popover.webContents.send('popover:will-show');
    popover.show();
    popover.focus();
    callbacks.onShow();
  };

  const hidePopover = (): void => {
    if (!popover.isVisible()) return;
    popover.hide();
    lastHideAt = Date.now();
    callbacks.onHide();
  };

  const togglePopover = (): void => {
    if (popover.isVisible()) {
      hidePopover();
    } else {
      showPopover();
    }
  };

  const buildContextMenu = (): Menu =>
    Menu.buildFromTemplate([
      { label: 'Preferences…', enabled: false, click: () => callbacks.onPreferences() },
      { type: 'separator' },
      { label: 'Kill All Dev Ports', click: () => callbacks.onKillAllDevPorts() },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Cmd+Q', click: () => app.quit() }
    ]);

  tray.on('click', () => {
    // Guard against the click that follows an auto-hide-on-blur immediately
    // re-showing the popover it just closed.
    if (Date.now() - lastHideAt < RE_SHOW_GUARD_MS) return;
    togglePopover();
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(buildContextMenu());
  });

  popover.on('blur', () => {
    hidePopover();
  });

  return {
    tray,
    popover,
    showPopover,
    hidePopover,
    togglePopover,
    setBadgeCount: (count: number) => {
      tray.setTitle(count > 0 ? String(count) : '');
    }
  };
}
