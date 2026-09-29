import type { Settings } from '@shared/types';
import type { Killer } from '../services/killer';
import type { ScanLoop } from '../scanLoop';
import { registerKillHandlers } from './killHandlers';
import { registerPortHandlers } from './portHandlers';
import { registerWindowHandlers } from './windowHandlers';

export interface IpcDeps {
  scanLoop: ScanLoop;
  killer: Killer;
  getSettings: () => Settings;
  hidePopover: () => void;
}

export function registerIpcHandlers(deps: IpcDeps): void {
  registerPortHandlers(deps.scanLoop);
  registerKillHandlers(deps.killer, deps.scanLoop, deps.getSettings);
  registerWindowHandlers(deps.hidePopover);
}
