import { NavLink } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bitcoin,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
  Wallet2,
} from 'lucide-react';
import { useAuthStore, getEmailFromToken } from '../../store/authStore';
import { NetWorthFooter } from './NetWorthFooter';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Comptes', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budget', label: 'Budget', icon: PiggyBank },
  { to: '/savings', label: 'Épargne', icon: Wallet2 },
  { to: '/investments', label: 'Investissements', icon: TrendingUp },
  { to: '/crypto', label: 'Crypto', icon: Bitcoin },
  { to: '/collectibles', label: 'Collectibles', icon: Sparkles },
];

export function Sidebar() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const email = getEmailFromToken(accessToken);

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-border bg-bg-surface">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          W
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">Wallet Dashboard</p>
          {email && <p className="truncate text-xs text-text-muted">{email}</p>}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 px-3 pb-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
            }`
          }
        >
          <Settings size={17} />
          Réglages
        </NavLink>
      </div>

      <NetWorthFooter />
    </aside>
  );
}
