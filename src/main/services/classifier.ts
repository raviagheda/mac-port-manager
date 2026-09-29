import type { PortCategory } from '@shared/types';

export interface ClassifyInput {
  comm: string;
  execPath: string | null;
  cwd: string | null;
  ppid: number | null;
  isProtected: boolean;
  hasProject: boolean;
  homeDir: string;
}

const DATABASE_COMMANDS = new Set(['postgres', 'postgres.bin', 'mysqld', 'mariadbd', 'redis-server', 'mongod', 'memcached']);

const SYSTEM_PATH_PREFIXES = ['/System/', '/usr/libexec/', '/usr/sbin/', '/sbin/', '/Library/Apple/'];

function isInside(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir.endsWith('/') ? dir : `${dir}/`);
}

/**
 * Decides whether a listener is something the user is developing (`dev`)
 * or background noise. Signals, in order of reliability:
 *
 * - The executable path: binaries inside a `.app` bundle are GUI apps and
 *   their helpers (IDE language servers, Spotify, Figma…), unless the bundle
 *   is nested in a `.framework` (framework Python builds); binaries under
 *   /System or /usr/libexec are macOS itself (ControlCenter's AirPlay
 *   receiver on 5000/7000, rapportd).
 * - Launchd parentage + cwd: a process re-parented to launchd (ppid 1) whose
 *   cwd is outside the home directory is a managed daemon, e.g. a
 *   `brew services` nginx running from /opt/homebrew. A dev server that was
 *   merely backgrounded still keeps its project cwd under $HOME.
 *
 * Anything else — launched from a shell or IDE terminal, or running inside a
 * detected project — is treated as dev.
 */
export function classifyPort(input: ClassifyInput): PortCategory {
  const lowerComm = input.comm.toLowerCase();
  const execPath = input.execPath ?? '';

  if (DATABASE_COMMANDS.has(lowerComm)) return 'database';
  if (lowerComm.includes('docker') || execPath.includes('/Docker.app/')) return 'docker';
  if (input.isProtected || SYSTEM_PATH_PREFIXES.some((prefix) => execPath.startsWith(prefix))) return 'system';
  // Framework interpreters (Homebrew/CLT python3) exec a stub `Python.app`
  // nested inside `Python.framework`; that's a CLI runtime, not a GUI app.
  if (execPath.includes('.app/Contents/') && !execPath.includes('.framework/')) return 'app';
  if (input.hasProject) return 'dev';

  const cwd = input.cwd ?? '';
  const cwdInHome = cwd.length > 0 && cwd !== input.homeDir && isInside(cwd, input.homeDir);
  if (input.ppid === 1 && !cwdInHome) return 'service';

  return 'dev';
}
