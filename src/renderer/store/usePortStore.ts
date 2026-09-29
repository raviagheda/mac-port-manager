import { create } from 'zustand';
import type { KillResult, PortEntry, PortListPatch } from '@shared/types';

interface PortStoreState {
  ports: Record<string, PortEntry>;
  order: string[];
  selectedId: string | null;
  expandedId: string | null;
  searchQuery: string;
  killStates: Record<number, KillResult>;
  setSnapshot(ports: PortEntry[]): void;
  applyPatch(patch: PortListPatch): void;
  setSearchQuery(query: string): void;
  setSelected(id: string | null): void;
  setExpanded(id: string | null): void;
  applyKillUpdate(result: KillResult): void;
}

function recomputeOrder(ports: Record<string, PortEntry>): string[] {
  return Object.values(ports)
    .sort((a, b) => a.port - b.port)
    .map((p) => p.id);
}

export const usePortStore = create<PortStoreState>((set, get) => ({
  ports: {},
  order: [],
  selectedId: null,
  expandedId: null,
  searchQuery: '',
  killStates: {},

  setSnapshot: (entries) => {
    const ports = Object.fromEntries(entries.map((e) => [e.id, e]));
    set({ ports, order: recomputeOrder(ports) });
  },

  applyPatch: (patch) => {
    const ports = { ...get().ports };
    for (const entry of patch.added) ports[entry.id] = entry;
    for (const entry of patch.updated) ports[entry.id] = entry;
    for (const id of patch.removed) delete ports[id];
    set({ ports, order: recomputeOrder(ports) });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelected: (id) => set({ selectedId: id }),
  setExpanded: (id) => set({ expandedId: id }),

  applyKillUpdate: (result) => {
    set({ killStates: { ...get().killStates, [result.pid]: result } });

    if (result.stage === 'terminated' || result.stage === 'killed') {
      const ports = { ...get().ports };
      const removedId = Object.values(ports).find((p) => p.pid === result.pid)?.id;
      if (removedId) {
        delete ports[removedId];
        set({ ports, order: recomputeOrder(ports) });
      }
    }
  }
}));
