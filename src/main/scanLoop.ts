import type { PortCategory, PortEntry, PortListPatch, Settings } from '@shared/types';
import { getProcessInfo } from './services/processInfo';
import { detectProject } from './services/projectDetector';
import { isProtectedProcess } from './services/killer';
import { scanListeningPorts, type RawPortEntry } from './services/portScanner';

const DATABASE_COMMANDS = new Set(['postgres', 'postgres.bin', 'mysqld', 'redis-server', 'mongod']);

function categorize(isProtected: boolean, comm: string): PortCategory {
  const lowerComm = comm.toLowerCase();
  if (DATABASE_COMMANDS.has(comm) || DATABASE_COMMANDS.has(lowerComm)) return 'database';
  if (lowerComm.includes('docker')) return 'docker';
  if (isProtected) return 'system';
  return 'dev';
}

async function buildPortEntry(raw: RawPortEntry): Promise<PortEntry> {
  const process_ = await getProcessInfo(raw.pid);
  const project = process_?.cwd ? await detectProject(process_.cwd) : null;

  const protectedFlag = isProtectedProcess({
    pid: raw.pid,
    user: process_?.user ?? '',
    cwd: process_?.cwd ?? null,
    execPath: null
  });

  // Prefer lsof's command field over ps's `comm`: macOS truncates `ps -o
  // comm=` to 16 characters, which frequently yields a chopped absolute
  // path (e.g. "/opt/homebrew/op") for homebrew/system processes, whereas
  // lsof's `c` field reliably reports the clean short process name.
  const comm = raw.command || process_?.comm || '';

  return {
    id: raw.id,
    port: raw.port,
    protocol: 'tcp',
    addresses: raw.addresses,
    isWildcard: raw.isWildcard,
    pid: raw.pid,
    command: raw.command,
    state: 'LISTEN',
    category: categorize(protectedFlag, comm),
    process: process_ ?? undefined,
    project: project ?? undefined,
    protected: protectedFlag,
    lastSeenAt: Date.now()
  };
}

const CHURN_FIELDS = ['cpuPercent', 'memoryKb', 'etimeSeconds'] as const;

function hasChanged(prev: PortEntry, next: PortEntry): boolean {
  if (prev.protected !== next.protected) return true;
  if (prev.project?.name !== next.project?.name) return true;
  if (prev.category !== next.category) return true;
  if (prev.addresses.length !== next.addresses.length) return true;

  const prevProcess = prev.process;
  const nextProcess = next.process;
  if (!prevProcess || !nextProcess) return prevProcess !== nextProcess;

  return CHURN_FIELDS.some((field) => prevProcess[field] !== nextProcess[field]);
}

export function diffSnapshots(prev: Map<string, PortEntry>, next: Map<string, PortEntry>): PortListPatch {
  const added: PortEntry[] = [];
  const updated: PortEntry[] = [];
  const removed: string[] = [];

  for (const [id, entry] of next) {
    const existing = prev.get(id);
    if (!existing) {
      added.push(entry);
    } else if (hasChanged(existing, entry)) {
      updated.push(entry);
    }
  }

  for (const id of prev.keys()) {
    if (!next.has(id)) removed.push(id);
  }

  return { added, updated, removed };
}

function isPatchEmpty(patch: PortListPatch): boolean {
  return patch.added.length === 0 && patch.updated.length === 0 && patch.removed.length === 0;
}

export class ScanLoop {
  private snapshot = new Map<string, PortEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private running = false;
  private onPatch: (patch: PortListPatch) => void;
  private settings: Settings;

  constructor(settings: Settings, onPatch: (patch: PortListPatch) => void) {
    this.settings = settings;
    this.onPatch = onPatch;
  }

  getSnapshot(): PortEntry[] {
    return [...this.snapshot.values()].sort((a, b) => a.port - b.port);
  }

  start(): void {
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setPollingActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.timer) clearInterval(this.timer);
    const intervalMs = this.active ? this.settings.pollIntervalActiveMs : this.settings.pollIntervalBackgroundMs;
    this.timer = setInterval(() => {
      void this.runCycle();
    }, intervalMs);
  }

  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rawEntries = await scanListeningPorts();
      const entries = await Promise.all(rawEntries.map((raw) => buildPortEntry(raw)));

      const next = new Map(entries.map((entry) => [entry.id, entry]));
      const patch = diffSnapshots(this.snapshot, next);
      this.snapshot = next;

      if (!isPatchEmpty(patch)) {
        this.onPatch(patch);
      }
    } finally {
      this.running = false;
    }
  }
}
