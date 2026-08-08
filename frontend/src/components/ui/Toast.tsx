import { create } from 'zustand';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, variant: ToastItem['variant']) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const push = useToastStore((s) => s.push);
  return {
    success: (message: string) => push(message, 'success'),
    error: (message: string) => push(message, 'error'),
  };
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.variant === 'success'
              ? 'border-accent-2/30 bg-bg-surface text-accent-2'
              : 'border-accent-3/30 bg-bg-surface text-accent-3'
          }`}
        >
          {toast.variant === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span className="text-text-primary">{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
