import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePortsBridge } from './hooks/usePortsBridge';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { usePortStore } from './store/usePortStore';
import { filterPorts } from './lib/search';
import SearchBar from './components/SearchBar';
import PortList from './components/PortList';
import Toast from './components/Toast';

export default function App(): JSX.Element {
  usePortsBridge();

  const ports = usePortStore((s) => s.ports);
  const order = usePortStore((s) => s.order);
  const searchQuery = usePortStore((s) => s.searchQuery);

  const allEntries = useMemo(() => order.map((id) => ports[id]).filter((e) => e !== undefined), [ports, order]);
  const visibleEntries = useMemo(() => filterPorts(allEntries, searchQuery), [allEntries, searchQuery]);

  useKeyboardNav(visibleEntries);

  const [showKey, setShowKey] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    return window.portpilot.window.onWillShow(() => {
      setShowKey((k) => k + 1);
    });
  }, []);

  const devPortCount = allEntries.filter((e) => e.category === 'dev').length;

  return (
    <motion.div
      key={showKey}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative h-full w-full flex flex-col bg-glass/[0.72] backdrop-blur-2xl border border-border/[0.08] rounded-2xl overflow-hidden"
    >
      <SearchBar />
      <PortList entries={visibleEntries} />
      <Toast />

      <div className="flex items-center justify-between px-3 py-2 border-t border-border/[0.08] text-[11px] text-fg/45">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {devPortCount} dev port{devPortCount === 1 ? '' : 's'} active
        </span>
        <span>⌘Q to quit</span>
      </div>
    </motion.div>
  );
}
