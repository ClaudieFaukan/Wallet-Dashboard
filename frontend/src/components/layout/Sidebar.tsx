import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bitcoin,
  LayoutDashboard,
  Landmark,
  LogOut,
  PiggyBank,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
  Wallet2,
} from 'lucide-react';
import { useAuthStore, getEmailFromToken } from '../../store/authStore';
import { useLogout } from '../../features/auth/hooks/useAuth';

const navItems = [
  { to: '/', label: 'Synthèse', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Patrimoine', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budget', label: 'Budget', icon: PiggyBank },
  { to: '/savings', label: 'Épargne', icon: Wallet2 },
  { to: '/investments', label: 'Investir', icon: TrendingUp },
  { to: '/crypto', label: 'Crypto', icon: Bitcoin },
  { to: '/collectibles', label: 'Collectibles', icon: Sparkles },
  { to: '/credits', label: 'Crédits', icon: Landmark },
];

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-r-lg py-2 pl-[10px] pr-3 -ml-px border-l-2 text-sm font-medium transition-colors ${
    isActive
      ? 'border-accent-gold bg-bg-elevated text-text-primary'
      : 'border-transparent text-text-muted hover:bg-bg-surface hover:text-text-secondary'
  }`;

export function Sidebar() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const email = getEmailFromToken(accessToken);
  const initial = email ? email[0]!.toUpperCase() : '?';
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  }

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col bg-bg-sidebar">
      <div className="px-6 py-6">
        <p className="text-sm font-semibold tracking-tight text-text-primary">finance</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClassName}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-0.5 px-3 pb-3">
        <NavLink to="/settings" className={navLinkClassName}>
          <Settings size={18} />
          Paramètres
        </NavLink>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-sm font-semibold text-text-primary">
          {initial}
        </div>
        {email && <p className="min-w-0 flex-1 truncate text-xs text-text-secondary">{email}</p>}
        <button
          type="button"
          title="Se déconnecter"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
