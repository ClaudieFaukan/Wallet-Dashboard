import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { CryptoChain, CryptoPlatform } from '../../../types/api';
import { useCreateWallet } from '../hooks/useCrypto';

const platformsByChain: Record<CryptoChain, CryptoPlatform[]> = {
  ethereum: ['metamask'],
  solana: ['phantom'],
};

export function CreateWalletDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [chain, setChain] = useState<CryptoChain>('ethereum');
  const [address, setAddress] = useState('');
  const create = useCreateWallet();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const platform = platformsByChain[chain][0]!;
    create.mutate(
      { name, chain, address, platform },
      {
        onSuccess: () => {
          toast.success('Wallet ajouté');
          setName('');
          setAddress('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouveau wallet">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Chaîne" value={chain} onChange={(e) => setChain(e.target.value as CryptoChain)}>
          <option value="ethereum">Ethereum (MetaMask)</option>
          <option value="solana">Solana (Phantom)</option>
        </Select>
        <Input
          label="Adresse publique"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
