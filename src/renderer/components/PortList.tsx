import { AnimatePresence } from 'framer-motion';
import type { PortEntry } from '@shared/types';
import { usePortStore } from '../store/usePortStore';
import PortRow from './PortRow';
import EmptyState from './EmptyState';

interface PortListProps {
  entries: PortEntry[];
}

export default function PortList({ entries }: PortListProps): JSX.Element {
  const selectedId = usePortStore((s) => s.selectedId);
  const expandedId = usePortStore((s) => s.expandedId);
  const killStates = usePortStore((s) => s.killStates);

  if (entries.length === 0) {
    return <EmptyState />;
  }

  return (
    <div role="list" className="flex-1 overflow-y-auto px-1.5 py-1.5 flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <PortRow
            key={entry.id}
            entry={entry}
            isSelected={entry.id === selectedId}
            isExpanded={entry.id === expandedId}
            killState={killStates[entry.pid]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
