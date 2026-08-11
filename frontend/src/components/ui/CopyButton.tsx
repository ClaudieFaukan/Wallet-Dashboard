import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useToast } from './Toast';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copié');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
      aria-label="Copier"
    >
      {copied ? <Check size={13} className="text-accent-2" /> : <Copy size={13} />}
    </button>
  );
}
