import { motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import type { KillResult, PortEntry } from '@shared/types';
import { formatBytes, formatUptime } from '../lib/format';
import { usePortStore } from '../store/usePortStore';

const CATEGORY_STYLES: Record<PortEntry['category'], string> = {
  dev: 'bg-accent/15 text-accent',
  database: 'bg-warning/15 text-warning',
  docker: 'bg-[#38bdf8]/15 text-[#38bdf8]',
  system: 'bg-fg/10 text-fg/50',
  unknown: 'bg-fg/10 text-fg/50'
};

interface PortRowProps {
  entry: PortEntry;
  isSelected: boolean;
  isExpanded: boolean;
  killState?: KillResult;
}

export default function PortRow({ entry, isSelected, isExpanded, killState }: PortRowProps): JSX.Element {
  const setSelected = usePortStore((s) => s.setSelected);
  const setExpanded = usePortStore((s) => s.setExpanded);

  // entry.command (from lsof) is a clean short name; process.comm (from ps)
  // is truncated to 16 chars by macOS and often lands mid-path for
  // homebrew/system binaries, so it's only a fallback.
  const displayName = entry.command || entry.process?.comm || 'unknown';
  const title = entry.project?.name ?? displayName;
  const subtitle = `${displayName} • PID ${entry.pid} • ${formatUptime(entry.process?.etimeSeconds)}`;

  const isTerminating = killState?.stage === 'terminating';
  const isAwaitingConfirmation = killState?.stage === 'awaiting-confirmation';

  const handleKill = (): void => {
    if (entry.protected) return;
    if (isAwaitingConfirmation) {
      void window.portpilot.kill.confirmForce(entry.pid);
    } else {
      void window.portpilot.kill.request(entry.pid, entry.port);
    }
  };

  const handleOpen = (): void => {
    void window.portpilot.shell.openLocalhost(entry.port);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`group rounded-row px-3 py-2 cursor-default ${isSelected ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'}`}
      onClick={() => setSelected(entry.id)}
      role="listitem"
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <span className={`font-mono text-[12px] px-1.5 py-0.5 rounded ${CATEGORY_STYLES[entry.category]}`}>{entry.port}</span>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onDoubleClick={() => setExpanded(isExpanded ? null : entry.id)}
        >
          <div className={`text-[13px] leading-tight truncate ${isTerminating ? 'line-through text-fg/40' : 'text-fg/90'}`}>
            {title}
          </div>
          <div className="text-[11px] leading-tight text-fg/45 truncate">{subtitle}</div>
        </button>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={handleOpen}
            className="text-[11px] px-2 py-1 rounded bg-fg/[0.06] text-fg/70 hover:bg-fg/[0.1]"
          >
            Open
          </button>
          {entry.protected ? (
            <span className="text-fg/30 px-1.5" title="Protected process">
              <Lock size={13} />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleKill}
              className="text-[11px] px-2 py-1 rounded bg-kill/15 text-kill hover:bg-kill/25 flex items-center gap-1"
            >
              <X size={12} />
              {isAwaitingConfirmation ? 'Force kill?' : 'Kill'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 pl-1 text-[11px] text-fg/50 space-y-1 font-mono">
          <div className="truncate">{entry.process?.args ?? entry.command}</div>
          <div>cwd: {entry.process?.cwd ?? '—'}</div>
          <div>
            cpu {entry.process?.cpuPercent ?? 0}% · mem {formatBytes(entry.process?.memoryKb)} · ppid{' '}
            {entry.process?.ppid ?? '—'}
          </div>
          <div>addr: {entry.addresses.join(', ')}</div>
        </div>
      )}
    </motion.div>
  );
}
