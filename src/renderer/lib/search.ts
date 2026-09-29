import type { PortEntry } from '@shared/types';

export type QueryFilter =
  | { type: 'exact-port'; port: number }
  | { type: 'port-above'; port: number }
  | { type: 'keyword'; keyword: 'node' | 'docker' | 'db' }
  | { type: 'fuzzy'; text: string }
  | { type: 'none' };

export function parseQuery(query: string): QueryFilter {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { type: 'none' };

  const exactMatch = trimmed.match(/^:(\d{1,5})$/);
  if (exactMatch) return { type: 'exact-port', port: Number.parseInt(exactMatch[1]!, 10) };

  const aboveMatch = trimmed.match(/^>(\d{1,5})$/);
  if (aboveMatch) return { type: 'port-above', port: Number.parseInt(aboveMatch[1]!, 10) };

  const lower = trimmed.toLowerCase();
  if (lower === 'node' || lower === 'docker' || lower === 'db') {
    return { type: 'keyword', keyword: lower };
  }

  return { type: 'fuzzy', text: lower };
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (needle[i] === haystack[j]) i++;
  }
  return i === needle.length;
}

function matchesKeyword(entry: PortEntry, keyword: 'node' | 'docker' | 'db'): boolean {
  const comm = (entry.command || entry.process?.comm || '').toLowerCase();
  if (keyword === 'node') return entry.project?.kind === 'node' || comm === 'node' || comm.includes('node');
  if (keyword === 'docker') return entry.category === 'docker' || comm.includes('docker');
  return entry.category === 'database';
}

function haystackFor(entry: PortEntry): string {
  const comm = entry.process?.comm ?? entry.command;
  return `${entry.port} ${comm} ${entry.project?.name ?? ''} ${entry.command} ${entry.pid}`.toLowerCase();
}

export function filterPorts(ports: PortEntry[], query: string): PortEntry[] {
  const filter = parseQuery(query);

  switch (filter.type) {
    case 'none':
      return ports;
    case 'exact-port':
      return ports.filter((p) => p.port === filter.port);
    case 'port-above':
      return ports.filter((p) => p.port > filter.port);
    case 'keyword':
      return ports.filter((p) => matchesKeyword(p, filter.keyword));
    case 'fuzzy':
      return ports.filter((p) => isSubsequence(filter.text, haystackFor(p)));
    default:
      return ports;
  }
}
