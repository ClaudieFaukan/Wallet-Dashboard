import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { CryptoChain, CryptoPlatform } from '../../../types/api';
import { useCreateWallet } from '../hooks/useCrypto';

const PLATFORM_LABELS: Record<CryptoPlatform, string> = {
  metamask: 'MetaMask (Ethereum)',
  phantom: 'Phantom (Solana)',
  crypto_com: 'Crypto.com',
  binance: 'Binance',
  bybit: 'Bybit',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
};

// On-chain wallets are identified by a real public address; exchange platforms authenticate via
// the API keys saved in Settings instead, so `address` there is just a free-text account label.
const ON_CHAIN_PLATFORMS = new Set<CryptoPlatform>(['metamask', 'phantom']);

const PLATFORM_CHAIN: Record<CryptoPlatform, CryptoChain> = {
  metamask: 'ethereum',
  phantom: 'solana',
  crypto_com: 'ethereum',
  binance: 'ethereum',
  bybit: 'ethereum',
  coinbase: 'ethereum',
  kraken: 'ethereum',
};

export function CreateWalletDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<CryptoPlatform>('metamask');
  const [address, setAddress] = useState('');
  const create = useCreateWallet();
  const toast = useToast();
  const isOnChain = ON_CHAIN_PLATFORMS.has(platform);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, platform, chain: PLATFORM_CHAIN[platform], address: address || platform },
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
        <Select
          label="Plateforme"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as CryptoPlatform)}
        >
          {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {isOnChain ? (
          <Input
            label="Adresse publique"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        ) : (
          <Input
            label="Identifiant du compte (optionnel)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="ex. Compte principal"
          />
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
