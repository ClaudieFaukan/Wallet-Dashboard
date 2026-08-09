import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { CryptoWallet } from '../../../types/api';
import { useUpdateWallet } from '../hooks/useCrypto';

export function EditWalletDrawer({
  wallet,
  open,
  onClose,
}: {
  wallet: CryptoWallet | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={wallet ? `Éditer — ${wallet.name}` : 'Éditer'}>
      {wallet && <EditWalletForm key={wallet.id} wallet={wallet} onClose={onClose} />}
    </Drawer>
  );
}

function EditWalletForm({ wallet, onClose }: { wallet: CryptoWallet; onClose: () => void }) {
  const [name, setName] = useState(wallet.name);
  const [address, setAddress] = useState(wallet.address);

  const update = useUpdateWallet();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: wallet.id, input: { name, address } },
      {
        onSuccess: () => {
          toast.success('Wallet mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Adresse publique" value={address} onChange={(e) => setAddress(e.target.value)} required />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
