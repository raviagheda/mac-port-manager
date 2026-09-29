import { useEffect } from 'react';
import type { PortEntry } from '@shared/types';
import { usePortStore } from '../store/usePortStore';

function isSearchInputFocused(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement && el.dataset.role === 'search-input';
}

export function useKeyboardNav(visiblePorts: PortEntry[]): void {
  const selectedId = usePortStore((s) => s.selectedId);
  const setSelected = usePortStore((s) => s.setSelected);
  const expandedId = usePortStore((s) => s.expandedId);
  const setExpanded = usePortStore((s) => s.setExpanded);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const inSearch = isSearchInputFocused();

      if (inSearch && !['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) {
        return;
      }

      const currentIndex = visiblePorts.findIndex((p) => p.id === selectedId);
      const selected = currentIndex >= 0 ? visiblePorts[currentIndex] : undefined;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const next = visiblePorts[Math.min(currentIndex + 1, visiblePorts.length - 1)];
          if (next) setSelected(next.id);
          else if (visiblePorts[0]) setSelected(visiblePorts[0].id);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const prev = visiblePorts[Math.max(currentIndex - 1, 0)];
          if (prev) setSelected(prev.id);
          break;
        }
        case 'Enter': {
          if (inSearch) break;
          if (selected) void window.portpilot.shell.openLocalhost(selected.port);
          break;
        }
        case 'Backspace': {
          if (inSearch) break;
          if ((event.metaKey || event.ctrlKey) && selected && !selected.protected) {
            event.preventDefault();
            void window.portpilot.kill.request(selected.pid, selected.port);
          }
          break;
        }
        case 'c':
        case 'C': {
          if (inSearch) break;
          if ((event.metaKey || event.ctrlKey) && selected) {
            void window.portpilot.clipboard.writeText(`http://localhost:${selected.port}`);
          }
          break;
        }
        case ' ': {
          if (inSearch) break;
          if (selected) {
            event.preventDefault();
            setExpanded(expandedId === selected.id ? null : selected.id);
          }
          break;
        }
        case 'Escape': {
          window.portpilot.window.hide();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visiblePorts, selectedId, setSelected, expandedId, setExpanded]);
}
