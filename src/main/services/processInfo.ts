import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessInfo } from '@shared/types';

const execFileAsync = promisify(execFile);

export interface RawProcessInfo {
  pid: number;
  ppid: number;
  user: string;
  etime: string;
  cpuPercent: number;
  memoryKb: number;
  comm: string;
  args: string;
}

const PS_LINE = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/;

/**
 * Parses one line of `ps -o pid=,ppid=,user=,etime=,%cpu=,rss=,comm=,args=`.
 *
 * `comm` is captured as a single whitespace-delimited token, with
 * everything after it treated as `args`. This holds for the vast majority
 * of processes (macOS's `comm` field never legitimately contains a space —
 * it's length-capped, not free text), with one known exception: some GUI
 * helper processes report a `comm` value that itself contains a space
 * (e.g. "Google Chrome Helper"). `ps -o comm=,args=` provides no
 * unambiguous delimiter between those two variable-width fields, so that
 * case is a documented, accepted limitation rather than something this
 * parser attempts to special-case.
 */
export function parsePsLine(line: string): RawProcessInfo | null {
  const match = line.match(PS_LINE);
  if (!match) return null;
  const [, pid, ppid, user, etime, cpu, rss, comm, args] = match;
  return {
    pid: Number.parseInt(pid!, 10),
    ppid: Number.parseInt(ppid!, 10),
    user: user!,
    etime: etime!,
    cpuPercent: Number.parseFloat(cpu!),
    memoryKb: Number.parseInt(rss!, 10),
    comm: comm!,
    args: args!
  };
}

/**
 * Parses macOS `ps` etime formats: `mm:ss`, `hh:mm:ss`, or `dd-hh:mm:ss`.
 */
export function parseEtime(etime: string): number {
  const match = etime.match(/^(?:(\d+)-)?(\d+):(\d+)(?::(\d+))?$/);
  if (!match) return 0;
  const [, days, a, b, c] = match;

  if (c !== undefined) {
    // dd-hh:mm:ss or hh:mm:ss
    const hours = Number.parseInt(a!, 10);
    const minutes = Number.parseInt(b!, 10);
    const seconds = Number.parseInt(c, 10);
    const dayCount = days !== undefined ? Number.parseInt(days, 10) : 0;
    return dayCount * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  // mm:ss
  const minutes = Number.parseInt(a!, 10);
  const seconds = Number.parseInt(b!, 10);
  return minutes * 60 + seconds;
}

/**
 * Parses `lsof -a -p <pid> -d cwd -Fn` output, e.g.:
 *   p97894
 *   fcwd
 *   n/Users/ravi/Documents/Lab/Projects/port-manager
 * Returns null on empty/permission-denied output rather than throwing —
 * root-owned PIDs will legitimately fail this lookup for a non-root caller.
 */
export function parseCwdOutput(raw: string): string | null {
  const lines = raw.split('\n');
  let sawCwdFd = false;
  for (const line of lines) {
    if (line === 'fcwd') {
      sawCwdFd = true;
      continue;
    }
    if (sawCwdFd && line.startsWith('n')) {
      return line.slice(1);
    }
  }
  return null;
}

export async function getProcessInfo(pid: number): Promise<ProcessInfo | null> {
  const psPromise = execFileAsync('ps', [
    '-o',
    'pid=,ppid=,user=,etime=,%cpu=,rss=,comm=,args=',
    '-p',
    String(pid)
  ]).catch(() => null);

  const cwdPromise = execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).catch(() => null);

  const [psResult, cwdResult] = await Promise.all([psPromise, cwdPromise]);
  if (psResult === null) return null;

  const line = psResult.stdout.split('\n').find((l) => l.trim().length > 0);
  if (!line) return null;

  const raw = parsePsLine(line);
  if (!raw) return null;

  const cwd = cwdResult !== null ? parseCwdOutput(cwdResult.stdout) : null;

  return {
    pid: raw.pid,
    ppid: raw.ppid,
    user: raw.user,
    etimeSeconds: parseEtime(raw.etime),
    cpuPercent: raw.cpuPercent,
    memoryKb: raw.memoryKb,
    comm: raw.comm,
    args: raw.args,
    cwd
  };
}
