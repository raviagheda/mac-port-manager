import { Sparkles } from 'lucide-react';

export default function EmptyState(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-fg/40 px-6 text-center">
      <Sparkles size={22} className="text-fg/25" aria-hidden="true" />
      <p className="text-[13px]">No ports listening. Go build something ✨</p>
    </div>
  );
}
