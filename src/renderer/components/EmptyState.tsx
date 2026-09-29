import { Sparkles } from 'lucide-react';
import { usePortStore } from '../store/usePortStore';

interface EmptyStateProps {
  hiddenCount: number;
}

export default function EmptyState({ hiddenCount }: EmptyStateProps): JSX.Element {
  const setScope = usePortStore((s) => s.setScope);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-fg/40 px-6 text-center">
      <Sparkles size={22} className="text-fg/25" aria-hidden="true" />
      <p className="text-[13px]">No dev ports listening. Go build something ✨</p>
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setScope('all')} className="text-[11px] text-fg/45 hover:text-fg/70 underline">
          {hiddenCount} app &amp; system port{hiddenCount === 1 ? '' : 's'} hidden — show all
        </button>
      )}
    </div>
  );
}
