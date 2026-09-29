import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { usePortStore, type PortScope } from '../store/usePortStore';

const SCOPE_OPTIONS: { value: PortScope; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'all', label: 'All' }
];

interface SearchBarProps {
  devCount: number;
  allCount: number;
}

export default function SearchBar({ devCount, allCount }: SearchBarProps): JSX.Element {
  const scope = usePortStore((s) => s.scope);
  const setScope = usePortStore((s) => s.setScope);
  const searchQuery = usePortStore((s) => s.searchQuery);
  const setSearchQuery = usePortStore((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/[0.08]">
      <Search size={14} className="text-fg/40 shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        data-role="search-input"
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search ports, processes, projects… (⌘F)"
        aria-label="Search ports"
        className="w-full bg-transparent text-[13px] text-fg/90 placeholder:text-fg/35 outline-none"
      />
      <div role="radiogroup" aria-label="Port scope" className="flex shrink-0 rounded-md bg-fg/[0.06] p-0.5 text-[11px]">
        {SCOPE_OPTIONS.map((option) => {
          const active = scope === option.value;
          const count = option.value === 'dev' ? devCount : allCount;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setScope(option.value)}
              className={`px-2 py-0.5 rounded ${active ? 'bg-fg/[0.12] text-fg/90' : 'text-fg/45 hover:text-fg/70'}`}
            >
              {option.label} <span className="tabular-nums text-fg/40">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
