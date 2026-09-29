import { describe, expect, it } from 'vitest';
import { parseEtime, parseFdPaths, parsePsLine } from '../processInfo';

// Lines below were captured live via `ps -o pid=,ppid=,user=,etime=,%cpu=,rss=,comm=,args= -p <pid>`
// and `lsof -a -p <pid> -d cwd,txt -Fn` on a real macOS machine.

describe('parsePsLine', () => {
  it('parses a real python http.server line', () => {
    const line = '  482     1 ravi 00:01   0.5  28080 python3 python3 -m http.server 8199';
    expect(parsePsLine(line)).toEqual({
      pid: 482,
      ppid: 1,
      user: 'ravi',
      etime: '00:01',
      cpuPercent: 0.5,
      memoryKb: 28080,
      comm: 'python3',
      args: 'python3 -m http.server 8199'
    });
  });

  it('parses a real long-running mongod line with a multi-day etime and truncated comm path', () => {
    const line =
      '  938     1 ravi 11-02:54:08   0.1  30560 /opt/homebrew/op /opt/homebrew/opt/mongodb-community/bin/mongod --config /opt/homebrew/etc/mongod.conf';
    const result = parsePsLine(line);
    expect(result).toMatchObject({
      pid: 938,
      ppid: 1,
      user: 'ravi',
      etime: '11-02:54:08',
      cpuPercent: 0.1,
      memoryKb: 30560,
      comm: '/opt/homebrew/op'
    });
    expect(result?.args).toContain('mongod --config');
  });

  it('returns null for an unparseable line', () => {
    expect(parsePsLine('')).toBeNull();
    expect(parsePsLine('not a ps line')).toBeNull();
  });

  it('documented limitation: a comm value containing a space misattributes the split', () => {
    // "Google Chrome Helper" as comm has no unambiguous delimiter from args.
    const line = '  100     1 ravi 00:05   1.0  12345 Google Chrome Helper --type=renderer';
    const result = parsePsLine(line);
    // comm is taken as the first token only ("Google"), not the full name —
    // this is the known, accepted limitation, not a bug to "fix" here.
    expect(result?.comm).toBe('Google');
    expect(result?.args).toBe('Chrome Helper --type=renderer');
  });
});

describe('parseEtime', () => {
  it('parses mm:ss', () => {
    expect(parseEtime('00:45')).toBe(45);
    expect(parseEtime('00:01')).toBe(1);
  });

  it('parses hh:mm:ss', () => {
    expect(parseEtime('02:30:00')).toBe(9000);
  });

  it('parses dd-hh:mm:ss', () => {
    expect(parseEtime('11-02:54:08')).toBe(11 * 86400 + 2 * 3600 + 54 * 60 + 8);
    expect(parseEtime('3-04:05:06')).toBe(3 * 86400 + 4 * 3600 + 5 * 60 + 6);
  });

  it('returns 0 for unparseable input', () => {
    expect(parseEtime('garbage')).toBe(0);
  });
});

describe('parseFdPaths', () => {
  it('parses cwd and the main executable, ignoring later dylib txt entries', () => {
    const raw =
      'p24978\nfcwd\nn/opt/homebrew/var/db/redis\nftxt\nn/opt/homebrew/Cellar/redis/7.2.5/bin/redis-server\n' +
      'ftxt\nn/opt/homebrew/Cellar/openssl@3/3.6.4/lib/libssl.3.dylib\nftxt\nn/usr/lib/dyld\n';
    expect(parseFdPaths(raw)).toEqual({
      cwd: '/opt/homebrew/var/db/redis',
      execPath: '/opt/homebrew/Cellar/redis/7.2.5/bin/redis-server'
    });
  });

  it('parses an app-bundle executable with spaces in its path', () => {
    const raw = 'p25003\nfcwd\nn/\nftxt\nn/Applications/Antigravity IDE.app/Contents/MacOS/Electron\n';
    expect(parseFdPaths(raw)).toEqual({ cwd: '/', execPath: '/Applications/Antigravity IDE.app/Contents/MacOS/Electron' });
  });

  it('returns nulls for empty or permission-denied output', () => {
    expect(parseFdPaths('')).toEqual({ cwd: null, execPath: null });
    expect(parseFdPaths('p1\n')).toEqual({ cwd: null, execPath: null });
  });
});
