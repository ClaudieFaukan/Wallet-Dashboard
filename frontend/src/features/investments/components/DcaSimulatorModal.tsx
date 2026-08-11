import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { InvestmentAccount } from '../../../types/api';
import { DcaSimulator } from './DcaSimulator';

/** Lives on the Investir index page rather than a specific account's detail page — the
 * projection endpoint is still per-account (its V0 is that account's currentValue), so with
 * more than one account this just lets you pick which one to project, defaulting to the first. */
export function DcaSimulatorModal({
  accounts,
  open,
  onClose,
}: {
  accounts: InvestmentAccount[];
  open: boolean;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const selected = accounts.find((a) => a.id === accountId) ?? accounts[0];

  return (
    <Modal open={open} onClose={onClose} title="Simulateur DCA" size="lg">
      {accounts.length > 1 && (
        <Select
          label="Compte"
          value={selected?.id ?? ''}
          onChange={(e) => setAccountId(e.target.value)}
          className="mb-4"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
      {selected && <DcaSimulator accountId={selected.id} />}
    </Modal>
  );
}
