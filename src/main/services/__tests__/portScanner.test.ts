import { describe, expect, it } from 'vitest';
import { parseLsofRecords, splitHostPort, toPortEntries } from '../portScanner';

// Fixtures below were captured live from `lsof -nP -iTCP -sTCP:LISTEN -F pcnLPT`
// on a real macOS machine, not hand-written, to ground the parser in the
// actual field-output format lsof produces.

const SINGLE_DEV_SERVER = `p482
cpython3.13
Lravi
f4
PTCP
n*:8199
TST=LISTEN
TQR=0
TQS=0
`;

// rapportd: two fds bound to the exact same wildcard address/port — must
// collapse to a single PortEntry.
const DUAL_FD_SAME_PORT = `p635
crapportd
Lravi
f12
PTCP
n*:57220
TST=LISTEN
TQR=0
TQS=0
f14
PTCP
n*:57220
TST=LISTEN
TQR=0
TQS=0
`;

// mongod: one IPv4 socket + one IPv6 socket on the same port — must also
// collapse to a single PortEntry, with both addresses recorded.
const IPV4_IPV6_PAIR = `p938
cmongod
Lravi
f9
PTCP
n127.0.0.1:27017
TST=LISTEN
TQR=0
TQS=0
f10
PTCP
n[::1]:27017
TST=LISTEN
TQR=0
TQS=0
`;

// ControlCenter: one process with two distinct ports, each duplicated
// across two fds — verifies grouping is per (pid, port), not just per pid.
const MULTI_PORT_SAME_PROCESS = `p655
cControlCenter
Lravi
f9
PTCP
n*:7000
TST=LISTEN
TQR=0
TQS=0
f10
PTCP
n*:7000
TST=LISTEN
TQR=0
TQS=0
f11
PTCP
n*:5000
TST=LISTEN
TQR=0
TQS=0
f12
PTCP
n*:5000
TST=LISTEN
TQR=0
TQS=0
`;

describe('parseLsofRecords + toPortEntries', () => {
  it('parses a single dev-server listener', () => {
    const entries = toPortEntries(parseLsofRecords(SINGLE_DEV_SERVER));
    expect(entries).toEqual([
      {
        id: '482:8199',
        pid: 482,
        command: 'python3.13',
        port: 8199,
        addresses: ['*:8199'],
        isWildcard: true
      }
    ]);
  });

  it('dedupes two fds bound to the same wildcard address/port', () => {
    const entries = toPortEntries(parseLsofRecords(DUAL_FD_SAME_PORT));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ pid: 635, port: 57220, addresses: ['*:57220'] });
  });

  it('dedupes an IPv4/IPv6 pair on the same port into one entry', () => {
    const entries = toPortEntries(parseLsofRecords(IPV4_IPV6_PAIR));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      pid: 938,
      port: 27017,
      addresses: ['127.0.0.1:27017', '[::1]:27017']
    });
  });

  it('groups by (pid, port) so a process with two distinct ports yields two entries', () => {
    const entries = toPortEntries(parseLsofRecords(MULTI_PORT_SAME_PROCESS));
    expect(entries).toHaveLength(2);
    const ports = entries.map((e) => e.port).sort((a, b) => a - b);
    expect(ports).toEqual([5000, 7000]);
    for (const entry of entries) {
      expect(entry.addresses).toHaveLength(1);
      expect(entry.pid).toBe(655);
      expect(entry.command).toBe('ControlCenter');
    }
  });

  it('does not leak command/user attribution across a process boundary', () => {
    const combined = SINGLE_DEV_SERVER + MULTI_PORT_SAME_PROCESS + IPV4_IPV6_PAIR;
    const entries = toPortEntries(parseLsofRecords(combined));
    const byPid = new Map(entries.map((e) => [`${e.pid}:${e.port}`, e]));

    expect(byPid.get('482:8199')?.command).toBe('python3.13');
    expect(byPid.get('655:7000')?.command).toBe('ControlCenter');
    expect(byPid.get('655:5000')?.command).toBe('ControlCenter');
    expect(byPid.get('938:27017')?.command).toBe('mongod');
    expect(entries).toHaveLength(4);
  });

  it('ignores non-LISTEN / non-TCP records', () => {
    const noise = `p1
cfoo
Lravi
f3
PUDP
n*:1234
TST=LISTEN
`;
    expect(toPortEntries(parseLsofRecords(noise))).toHaveLength(0);
  });
});

describe('splitHostPort', () => {
  it('splits a wildcard IPv4 address', () => {
    expect(splitHostPort('*:3000')).toEqual({ host: '*', port: 3000 });
  });

  it('splits a loopback IPv4 address', () => {
    expect(splitHostPort('127.0.0.1:27017')).toEqual({ host: '127.0.0.1', port: 27017 });
  });

  it('splits a bracketed IPv6 address', () => {
    expect(splitHostPort('[::1]:6379')).toEqual({ host: '[::1]', port: 6379 });
  });
});
