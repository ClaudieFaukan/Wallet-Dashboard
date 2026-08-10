import { useEffect } from 'react';
import { create } from 'zustand';
import confetti from 'canvas-confetti';
import { formatDate } from '../../lib/format';

interface CelebrationItem {
  id: number;
  labels: string[];
  date: string;
}

interface CelebrationState {
  active: CelebrationItem | null;
  celebrate: (labels: string[]) => void;
}

let nextId = 0;

const useCelebrationStore = create<CelebrationState>((set) => ({
  active: null,
  celebrate: (labels) => {
    const id = nextId++;
    set({ active: { id, labels, date: new Date().toISOString() } });
    setTimeout(() => set((s) => (s.active?.id === id ? { active: null } : s)), 3000);
  },
}));

/** Call with the label(s) of the milestone(s) just crossed (e.g. "20 000 €" or "75%") — triggers
 * confetti + a full-screen celebration for 3s. Safe to call with several at once (a single big
 * deposit/entry can cross more than one threshold). */
export function useMilestoneCelebration() {
  return useCelebrationStore((s) => s.celebrate);
}

export function MilestoneCelebrationOverlay() {
  const active = useCelebrationStore((s) => s.active);

  useEffect(() => {
    if (!active) return;
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.4 } });
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-base/70">
      <div className="rounded-2xl border border-accent-gold/30 bg-bg-surface px-10 py-8 text-center shadow-2xl">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-semibold text-text-primary">
          Jalon atteint — {active.labels.join(', ')} !
        </p>
        <p className="mt-1 text-xs text-text-muted">{formatDate(active.date)}</p>
      </div>
    </div>
  );
}
