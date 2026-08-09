import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { AccountDetailPage } from './features/accounts/AccountDetailPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { BudgetPage } from './features/budget/BudgetPage';
import { SavingsPage } from './features/savings/SavingsPage';
import { InvestmentsPage } from './features/investments/InvestmentsPage';
import { InvestmentDetailPage } from './features/investments/InvestmentDetailPage';
import { CryptoPage } from './features/crypto/CryptoPage';
import { WalletDetailPage } from './features/crypto/WalletDetailPage';
import { CollectiblesPage } from './features/collectibles/CollectiblesPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="savings" element={<SavingsPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="investments/:id" element={<InvestmentDetailPage />} />
          <Route path="crypto" element={<CryptoPage />} />
          <Route path="crypto/:id" element={<WalletDetailPage />} />
          <Route path="collectibles" element={<CollectiblesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
