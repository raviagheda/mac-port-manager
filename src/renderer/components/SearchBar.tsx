import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { usePortStore } from '../store/usePortStore';

export default function SearchBar(): JSX.Element {
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
    </div>
  );
}
