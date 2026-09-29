export type PortCategory = 'dev' | 'database' | 'docker' | 'app' | 'service' | 'system' | 'unknown';

export interface ProcessInfo {
  pid: number;
  ppid: number;
  user: string;
  etimeSeconds: number;
  cpuPercent: number;
  memoryKb: number;
  comm: string;
  args: string;
  cwd: string | null;
  /** Full path of the main executable (first `txt` fd from lsof). */
  execPath: string | null;
}

export interface ProjectInfo {
  name: string;
  root: string | null;
  /** Framework detection (Next.js, Vite, etc.) is deferred to a later milestone. */
  framework: string | null;
  kind: 'node' | 'unknown';
}

export interface PortEntry {
  id: string;
  port: number;
  protocol: 'tcp';
  addresses: string[];
  isWildcard: boolean;
  pid: number;
  command: string;
  state: 'LISTEN';
  category: PortCategory;
  process?: ProcessInfo;
  project?: ProjectInfo;
  protected: boolean;
  lastSeenAt: number;
}

export interface PortListPatch {
  added: PortEntry[];
  updated: PortEntry[];
  removed: string[];
}

export type KillStage =
  | 'terminating'
  | 'terminated'
  | 'awaiting-confirmation'
  | 'killed'
  | 'failed'
  | 'protected';

export interface KillResult {
  pid: number;
  port?: number;
  success: boolean;
  stage: KillStage;
  method?: 'SIGTERM' | 'SIGKILL';
  error?: string;
}

/** Stub — full history log/persistence is deferred to a later milestone. */
export interface HistoryEvent {
  id: string;
  type: 'opened' | 'closed' | 'killed';
  port: number;
  pid: number;
  command: string;
  projectName?: string;
  timestamp: number;
}

/** Minimal/stub — Preferences UI is deferred to a later milestone. */
export interface Settings {
  pollIntervalActiveMs: number;
  pollIntervalBackgroundMs: number;
  autoEscalateToSigkill: boolean;
  killGracePeriodMs: number;
  showBadgeCount: boolean;
  launchAtLogin: boolean;
  globalHotkey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  pollIntervalActiveMs: 2000,
  pollIntervalBackgroundMs: 10000,
  autoEscalateToSigkill: false,
  killGracePeriodMs: 3000,
  showBadgeCount: true,
  launchAtLogin: false,
  globalHotkey: 'Alt+Cmd+P'
};

export interface PortPilotBridge {
  ports: {
    getSnapshot(): Promise<PortEntry[]>;
    onUpdate(cb: (patch: PortListPatch) => void): () => void;
  };
  kill: {
    request(pid: number, port?: number): Promise<KillResult>;
    confirmForce(pid: number): Promise<KillResult>;
    onUpdate(cb: (result: KillResult) => void): () => void;
  };
  window: {
    hide(): void;
    onWillShow(cb: () => void): () => void;
  };
  shell: {
    openLocalhost(port: number): Promise<void>;
  };
  clipboard: {
    writeText(text: string): Promise<void>;
  };
}
