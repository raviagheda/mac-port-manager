import { useEffect, useRef } from 'react';
import { usePortStore } from '../store/usePortStore';
import { useToastStore } from '../store/useToastStore';

function labelFor(pid: number): string {
  const entry = Object.values(usePortStore.getState().ports).find((p) => p.pid === pid);
  if (!entry) return `PID ${pid}`;
  const name = entry.project?.name ?? entry.process?.comm ?? entry.command;
  return `${name} on :${entry.port}`;
}

export function usePortsBridge(): void {
  const setSnapshot = usePortStore((s) => s.setSnapshot);
  const applyPatch = usePortStore((s) => s.applyPatch);
  const applyKillUpdate = usePortStore((s) => s.applyKillUpdate);
  const pushToast = useToastStore((s) => s.push);

  // Kill labels must be resolved before the store removes the entry, so we
  // capture them synchronously inside the kill:update listener itself.
  const pendingLabels = useRef(new Map<number, string>());

  useEffect(() => {
    window.portpilot.ports.getSnapshot().then(setSnapshot).catch(() => {});

    const unsubscribePorts = window.portpilot.ports.onUpdate(applyPatch);

    const unsubscribeKill = window.portpilot.kill.onUpdate((result) => {
      if (result.stage === 'terminating') {
        pendingLabels.current.set(result.pid, labelFor(result.pid));
      }

      if (result.stage === 'terminated' || result.stage === 'killed') {
        const label = pendingLabels.current.get(result.pid) ?? `PID ${result.pid}`;
        pendingLabels.current.delete(result.pid);
        pushToast(`Killed ${label}`);
      } else if (result.stage === 'failed') {
        pushToast(`Couldn't kill PID ${result.pid}${result.error ? `: ${result.error}` : ''}`);
      } else if (result.stage === 'protected') {
        pushToast(`PID ${result.pid} is protected and can't be killed`);
      }

      applyKillUpdate(result);
    });

    return () => {
      unsubscribePorts();
      unsubscribeKill();
    };
  }, [setSnapshot, applyPatch, applyKillUpdate, pushToast]);
}
