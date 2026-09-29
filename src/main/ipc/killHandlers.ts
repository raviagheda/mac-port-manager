import { ipcMain } from 'electron';
import type { KillResult, Settings } from '@shared/types';
import type { Killer, ProtectedCheckInput } from '../services/killer';
import type { ScanLoop } from '../scanLoop';
import { killConfirmForceSchema, killRequestSchema } from './schemas';

function protectedInputFor(scanLoop: ScanLoop, pid: number): ProtectedCheckInput {
  const entry = scanLoop.getSnapshot().find((e) => e.pid === pid);
  return {
    pid,
    user: entry?.process?.user ?? '',
    cwd: entry?.process?.cwd ?? null,
    execPath: null
  };
}

export function registerKillHandlers(killer: Killer, scanLoop: ScanLoop, getSettings: () => Settings): void {
  ipcMain.handle('kill:request', (_event, rawPayload: unknown): KillResult => {
    const parsed = killRequestSchema.safeParse(rawPayload);
    if (!parsed.success) throw new Error('invalid-payload');
    const { pid, port } = parsed.data;
    return killer.request(pid, port, protectedInputFor(scanLoop, pid), getSettings());
  });

  ipcMain.handle('kill:confirm-force', (_event, rawPayload: unknown): KillResult => {
    const parsed = killConfirmForceSchema.safeParse(rawPayload);
    if (!parsed.success) throw new Error('invalid-payload');
    const { pid } = parsed.data;
    return killer.confirmForce(pid, undefined, protectedInputFor(scanLoop, pid));
  });
}
