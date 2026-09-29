import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';

const AUTO_DISMISS_MS = 3000;

function ToastItem({ id, message }: { id: string; message: string }): JSX.Element {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="px-3 py-2 rounded-lg bg-black/80 text-white/90 text-[12px] shadow-lg backdrop-blur"
    >
      {message}
    </motion.div>
  );
}

export default function Toast(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-1.5 px-3 pointer-events-none z-10">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} id={t.id} message={t.message} />
        ))}
      </AnimatePresence>
    </div>
  );
}
