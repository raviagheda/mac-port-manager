import type { KillResult, Settings } from '@shared/types';

export interface ProtectedCheckInput {
  pid: number;
  user: string;
  cwd: string | null;
  execPath: string | null;
}

/**
 * Never allow killing PID 1, the app's own PID, root-owned processes, or
 * anything living under /System or /usr/libexec.
 */
export function isProtectedProcess(info: ProtectedCheckInput): boolean {
  if (info.pid === 1) return true;
  if (info.pid === process.pid) return true;
  if (info.user === 'root') return true;
  const path = info.execPath ?? info.cwd ?? '';
  if (path.startsWith('/System/') || path.startsWith('/usr/libexec/')) return true;
  return false;
}

/** Signal-less liveness check: throws ESRCH if the process no longer exists. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface KillSession {
  pid: number;
  port?: number;
  pollTimer: ReturnType<typeof setInterval>;
  deadlineTimer: ReturnType<typeof setTimeout>;
}

const LIVENESS_POLL_MS = 200;

type UpdateListener = (result: KillResult) => void;

export class Killer {
  private sessions = new Map<number, KillSession>();
  private listeners = new Set<UpdateListener>();

  onUpdate(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(result: KillResult): void {
    for (const listener of this.listeners) listener(result);
  }

  request(pid: number, port: number | undefined, protectedInfo: ProtectedCheckInput, settings: Settings): KillResult {
    if (isProtectedProcess(protectedInfo)) {
      return { pid, port, success: false, stage: 'protected' };
    }
    if (!isAlive(pid)) {
      return { pid, port, success: false, stage: 'failed', error: 'process not found' };
    }

    this.cancelSession(pid);

    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      return { pid, port, success: false, stage: 'failed', error: (error as Error).message };
    }

    const pollTimer = setInterval(() => {
      if (!isAlive(pid)) {
        this.cancelSession(pid);
        this.emit({ pid, port, success: true, stage: 'terminated', method: 'SIGTERM' });
      }
    }, LIVENESS_POLL_MS);

    const deadlineTimer = setTimeout(() => {
      this.onGracePeriodExpired(pid, port, settings);
    }, settings.killGracePeriodMs);

    this.sessions.set(pid, { pid, port, pollTimer, deadlineTimer });

    return { pid, port, success: true, stage: 'terminating', method: 'SIGTERM' };
  }

  confirmForce(pid: number, port: number | undefined, protectedInfo: ProtectedCheckInput): KillResult {
    if (isProtectedProcess(protectedInfo)) {
      const result: KillResult = { pid, port, success: false, stage: 'protected' };
      this.emit(result);
      return result;
    }
    return this.sendSigkill(pid, port);
  }

  private onGracePeriodExpired(pid: number, port: number | undefined, settings: Settings): void {
    const session = this.sessions.get(pid);
    if (session) clearInterval(session.pollTimer);
    this.sessions.delete(pid);

    if (!isAlive(pid)) {
      this.emit({ pid, port, success: true, stage: 'terminated', method: 'SIGTERM' });
      return;
    }

    if (settings.autoEscalateToSigkill) {
      this.emit(this.sendSigkill(pid, port));
    } else {
      this.emit({ pid, port, success: false, stage: 'awaiting-confirmation', method: 'SIGTERM' });
    }
  }

  private sendSigkill(pid: number, port: number | undefined): KillResult {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      return { pid, port, success: false, stage: 'failed', error: (error as Error).message };
    }
    return { pid, port, success: true, stage: 'killed', method: 'SIGKILL' };
  }

  private cancelSession(pid: number): void {
    const existing = this.sessions.get(pid);
    if (existing) {
      clearInterval(existing.pollTimer);
      clearTimeout(existing.deadlineTimer);
      this.sessions.delete(pid);
    }
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      clearInterval(session.pollTimer);
      clearTimeout(session.deadlineTimer);
    }
    this.sessions.clear();
    this.listeners.clear();
  }
}
