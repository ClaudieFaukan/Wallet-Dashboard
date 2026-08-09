export interface DefaultCategorySeed {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

/** Created automatically for every new user at registration (`is_default:
 * true`) — see docs/feat1.md FEAT-01. Not user-deletable; custom categories
 * created afterwards are. */
export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Logement', type: 'expense', color: '#6366f1', icon: 'home' },
  { name: 'Alimentation', type: 'expense', color: '#22c55e', icon: 'shopping-cart' },
  { name: 'Restauration', type: 'expense', color: '#f59e0b', icon: 'utensils' },
  { name: 'Transport', type: 'expense', color: '#0ea5e9', icon: 'car' },
  { name: 'Abonnements', type: 'expense', color: '#a855f7', icon: 'repeat' },
  { name: 'Santé', type: 'expense', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Loisirs', type: 'expense', color: '#ec4899', icon: 'gamepad-2' },
  { name: 'Vêtements', type: 'expense', color: '#14b8a6', icon: 'shirt' },
  { name: 'Épargne', type: 'expense', color: '#c9a84c', icon: 'piggy-bank' },
  { name: 'Revenus', type: 'income', color: '#22c55e', icon: 'wallet' },
  { name: 'Autres', type: 'expense', color: '#52526e', icon: 'ellipsis' },
];
