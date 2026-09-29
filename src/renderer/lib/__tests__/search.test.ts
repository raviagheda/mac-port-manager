import { describe, expect, it } from 'vitest';
import type { PortEntry } from '@shared/types';
import { filterPorts, parseQuery } from '../search';

function makeEntry(overrides: Partial<PortEntry>): PortEntry {
  return {
    id: '1:3000',
    port: 3000,
    protocol: 'tcp',
    addresses: ['*:3000'],
    isWildcard: true,
    pid: 1,
    command: 'node',
    state: 'LISTEN',
    category: 'dev',
    protected: false,
    lastSeenAt: Date.now(),
    ...overrides
  };
}

describe('parseQuery', () => {
  it('parses exact port syntax', () => {
    expect(parseQuery(':3000')).toEqual({ type: 'exact-port', port: 3000 });
  });

  it('parses port-above syntax', () => {
    expect(parseQuery('>5000')).toEqual({ type: 'port-above', port: 5000 });
  });

  it('parses keyword aliases', () => {
    expect(parseQuery('docker')).toEqual({ type: 'keyword', keyword: 'docker' });
  });

  it('falls back to fuzzy for anything else', () => {
    expect(parseQuery('nextjs')).toEqual({ type: 'fuzzy', text: 'nextjs' });
  });
});

describe('filterPorts', () => {
  const entries = [
    makeEntry({ id: 'a', port: 3000, command: 'node', project: { name: 'web-app', root: null, framework: null, kind: 'node' } }),
    makeEntry({ id: 'b', port: 5432, command: 'postgres', category: 'database' }),
    makeEntry({ id: 'c', port: 9000, command: 'docker-proxy', category: 'docker' })
  ];

  it('filters by exact port', () => {
    expect(filterPorts(entries, ':3000').map((e) => e.id)).toEqual(['a']);
  });

  it('filters by port above threshold', () => {
    expect(filterPorts(entries, '>4000').map((e) => e.id).sort()).toEqual(['b', 'c']);
  });

  it('filters by db keyword', () => {
    expect(filterPorts(entries, 'db').map((e) => e.id)).toEqual(['b']);
  });

  it('fuzzy matches project name', () => {
    expect(filterPorts(entries, 'wap').map((e) => e.id)).toEqual(['a']);
  });
});
