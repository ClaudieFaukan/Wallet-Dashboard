import type { ReactNode } from 'react';

type ModalSize = 'sm' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'sm' }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative flex max-h-[85vh] w-full flex-col rounded-xl border border-border bg-bg-elevated p-5 ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 shrink-0 text-base font-semibold text-text-primary">{title}</h2>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
