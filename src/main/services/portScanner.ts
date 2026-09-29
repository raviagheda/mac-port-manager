import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LsofListenRecord {
  pid: number;
  command: string;
  user: string;
  protocol: string;
  rawAddress: string;
  tcpState: string | undefined;
}

export interface RawPortEntry {
  id: string;
  pid: number;
  command: string;
  port: number;
  addresses: string[];
  isWildcard: boolean;
}

/**
 * Parses `lsof -nP -iTCP -sTCP:LISTEN -F pcnLPT` field-output.
 *
 * Format: each line is a one-letter field prefix followed by its value.
 * `p<pid>` opens a new process context (resets command/user, flushes any
 * pending file record). `c<command>`/`L<user>` set process-level fields
 * that apply to every file record until the next `p`. `f<fd>` opens a new
 * file record within the current process (flushing the previous one).
 * `P<protocol>`/`n<name>`/`T<key>=<value>` (repeatable) attach to the
 * current file record.
 */
export function parseLsofRecords(raw: string): LsofListenRecord[] {
  const records: LsofListenRecord[] = [];

  let pid: number | null = null;
  let command = '';
  let user = '';

  let pendingProtocol: string | null = null;
  let pendingName: string | null = null;
  let pendingTcpState: string | undefined;
  let hasPendingFile = false;

  const flushFile = (): void => {
    if (hasPendingFile && pid !== null && pendingProtocol !== null && pendingName !== null) {
      records.push({
        pid,
        command,
        user,
        protocol: pendingProtocol,
        rawAddress: pendingName,
        tcpState: pendingTcpState
      });
    }
    pendingProtocol = null;
    pendingName = null;
    pendingTcpState = undefined;
    hasPendingFile = false;
  };

  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    const prefix = line[0];
    const value = line.slice(1);

    switch (prefix) {
      case 'p':
        flushFile();
        pid = Number.parseInt(value, 10);
        command = '';
        user = '';
        break;
      case 'c':
        command = value;
        break;
      case 'L':
        user = value;
        break;
      case 'f':
        flushFile();
        hasPendingFile = true;
        break;
      case 'P':
        pendingProtocol = value;
        break;
      case 'n':
        pendingName = value;
        break;
      case 'T': {
        const eq = value.indexOf('=');
        if (eq !== -1) {
          const key = value.slice(0, eq);
          const val = value.slice(eq + 1);
          if (key === 'ST') pendingTcpState = val;
        }
        break;
      }
      default:
        break;
    }
  }
  flushFile();

  return records.filter((r) => r.protocol === 'TCP' && r.tcpState === 'LISTEN');
}

/**
 * Splits an lsof address string into host/port. Handles bracketed IPv6
 * (`[::1]:27017`) and plain host:port (`*:3000`, `127.0.0.1:3000`).
 * Bracket-checking must come first since IPv6 hosts themselves contain
 * colons.
 */
export function splitHostPort(raw: string): { host: string; port: number | null } {
  const ipv6Match = raw.match(/^\[(.*)\]:(\*|\d+)$/);
  if (ipv6Match) {
    const [, host, portStr] = ipv6Match;
    return { host: `[${host}]`, port: portStr === '*' ? null : Number.parseInt(portStr!, 10) };
  }
  const plainMatch = raw.match(/^(.*):(\*|\d+)$/);
  if (plainMatch) {
    const [, host, portStr] = plainMatch;
    return { host: host!, port: portStr === '*' ? null : Number.parseInt(portStr!, 10) };
  }
  return { host: raw, port: null };
}

function isWildcardHost(host: string): boolean {
  return host === '*' || host === '0.0.0.0' || host === '::' || host === '[::]';
}

/**
 * Groups raw lsof records into one PortEntry per (pid, port), deduping by
 * that key rather than by address. A single wildcard bind commonly appears
 * twice for the same fd pair (e.g. ControlCenter opening two sockets on the
 * same port), and a single service commonly binds both an IPv4 and an IPv6
 * socket on the same port (e.g. mongod, redis-server) — both cases must
 * collapse to one entry.
 */
export function toPortEntries(records: LsofListenRecord[]): RawPortEntry[] {
  const byKey = new Map<string, RawPortEntry>();

  for (const record of records) {
    const { host, port } = splitHostPort(record.rawAddress);
    if (port === null) continue;

    const key = `${record.pid}:${port}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.addresses.includes(record.rawAddress)) {
        existing.addresses.push(record.rawAddress);
      }
      existing.isWildcard = existing.isWildcard || isWildcardHost(host);
    } else {
      byKey.set(key, {
        id: key,
        pid: record.pid,
        command: record.command,
        port,
        addresses: [record.rawAddress],
        isWildcard: isWildcardHost(host)
      });
    }
  }

  return [...byKey.values()];
}

export async function scanListeningPorts(): Promise<RawPortEntry[]> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcnLPT']);
    return toPortEntries(parseLsofRecords(stdout));
  } catch (error) {
    // lsof exits non-zero when there are zero matching listeners — that's
    // not a real failure, just an empty result.
    const err = error as { code?: number; stdout?: string };
    if (typeof err.stdout === 'string') {
      return toPortEntries(parseLsofRecords(err.stdout));
    }
    return [];
  }
}
