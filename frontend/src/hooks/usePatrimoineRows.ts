import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { usdCentsToEurCents } from '../lib/constants';
import { dayKey, forwardFill, lastNDays } from './useNetWorthHistory';
import type { AssetKind } from '../components/charts/chartTheme';
import type { CollectibleWithHistory, CryptoWallet, RealEstateAsset } from '../types/api';

const accountTypeLabels: Record<'checking' | 'savings' | 'investment', string> = {
  checking: 'Compte courant',
  savings: "Compte d'épargne",
  investment: "Compte d'investissement",
};

const realEstateTypeLabels: Record<RealEstateAsset['type'], string> = {
  physical: 'Immobilier physique',
  scpi: 'SCPI',
  crowdfunding: 'Crowdfunding',
};

const cryptoPlatformLabels: Record<CryptoWallet['platform'], string> = {
  metamask: 'MetaMask',
  phantom: 'Phantom',
  crypto_com: 'Crypto.com',
  binance: 'Binance',
  bybit: 'Bybit',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  meria: 'Meria',
};

export interface PatrimoineRow {
  id: string;
  kind: AssetKind;
  name: string;
  subtitle: string | null;
  typeLabel: string;
  value: number;
  isLiability: boolean;
  sharePercent: number;
  allTimeGain: number | null;
  allTimeGainPct: number | null;
  ytdVariation: number | null;
  ytdVariationPct: number | null;
  sparkline: number[];
  linkTo: string | null;
}

const WINDOW_DAYS = 370;
const SPARKLINE_DAYS = 30;

function daysSinceJan1(): number {
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86_400_000));
}

/** Turns a full-window series into a {ytdVariation, ytdVariationPct, sparkline}
 * triple, anchored on the grid position closest to Jan 1st of this year.
 * Also exposes the raw start/latest points (rather than the nulled-out
 * per-row figures) so the caller can sum them across rows into an aggregate
 * variation even when some individual rows have no usable start point. */
function deriveVariation(series: number[], grid: string[]) {
  const jan1Index = Math.max(0, grid.length - daysSinceJan1());
  const rawStart = series[jan1Index] ?? 0;
  const rawLatest = series[series.length - 1] ?? 0;
  const sparkline = series.slice(-SPARKLINE_DAYS);
  if (rawStart <= 0) return { ytdVariation: null, ytdVariationPct: null, sparkline, rawStart, rawLatest };
  const ytdVariation = rawLatest - rawStart;
  return { ytdVariation, ytdVariationPct: (ytdVariation / rawStart) * 100, sparkline, rawStart, rawLatest };
}

/** Composes one row per real holding across every asset feature (comptes,
 * investissements, crypto, immobilier, une ligne agrégée "Collection" pour
 * les collectibles, et les crédits côté passifs) for the unified Patrimoine
 * table and the Dashboard "Ma performance" carousel. Gain/variation figures
 * are only ever derived from real stored fields or real history points —
 * left null (rendered blank) rather than invented when the data isn't
 * there, same convention as the rest of this app. */
export function usePatrimoineRows() {
  const grid = lastNDays(WINDOW_DAYS);

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.accounts.list });
  const investments = useQuery({ queryKey: ['investments'], queryFn: api.investments.list });
  const cryptoWallets = useQuery({ queryKey: ['crypto', 'wallets'], queryFn: api.crypto.list });
  const realEstate = useQuery({ queryKey: ['real-estate'], queryFn: api.realEstate.list });
  const credits = useQuery({ queryKey: ['credits'], queryFn: api.credits.list });
  const collectibleItems = useQuery({ queryKey: ['collectibles', 'list'], queryFn: () => api.collectibles.list() });
  const collectiblePerformance = useQuery({
    queryKey: ['collectibles', 'performance'],
    queryFn: () => api.collectibles.performance(),
  });

  const accountHistories = useQueries({
    queries: (accounts.data ?? []).map((a) => ({
      queryKey: ['accounts', a.id, 'balance-history', WINDOW_DAYS],
      queryFn: () => api.accounts.balanceHistory(a.id, WINDOW_DAYS),
      enabled: accounts.data !== undefined,
    })),
  });

  const investmentEntries = useQueries({
    queries: (investments.data ?? []).map((acc) => ({
      queryKey: ['investments', acc.id, 'entries'],
      queryFn: () => api.investments.entries(acc.id),
      enabled: investments.data !== undefined,
    })),
  });

  const cryptoHistories = useQueries({
    queries: (cryptoWallets.data ?? []).map((w) => ({
      queryKey: ['crypto', 'wallets', w.id, 'history'],
      queryFn: () => api.crypto.history(w.id),
      enabled: cryptoWallets.data !== undefined,
    })),
  });

  const realEstateHistories = useQueries({
    queries: (realEstate.data ?? []).map((r) => ({
      queryKey: ['real-estate', r.id, 'history'],
      queryFn: () => api.realEstate.history(r.id),
      enabled: realEstate.data !== undefined,
    })),
  });

  const collectibleDetails = useQueries({
    queries: (collectibleItems.data ?? []).map((item) => ({
      queryKey: ['collectibles', item.id],
      queryFn: (): Promise<CollectibleWithHistory> => api.collectibles.getById(item.id),
      enabled: collectibleItems.data !== undefined,
    })),
  });

  const isLoading =
    accounts.isLoading ||
    investments.isLoading ||
    cryptoWallets.isLoading ||
    realEstate.isLoading ||
    credits.isLoading ||
    collectibleItems.isLoading ||
    collectiblePerformance.isLoading ||
    accountHistories.some((q) => q.isLoading) ||
    investmentEntries.some((q) => q.isLoading) ||
    cryptoHistories.some((q) => q.isLoading) ||
    realEstateHistories.some((q) => q.isLoading) ||
    collectibleDetails.some((q) => q.isLoading);

  const rows: PatrimoineRow[] = [];
  const assetVariationParts: { rawStart: number; rawLatest: number }[] = [];

  (accounts.data ?? []).forEach((account, i) => {
    const history = accountHistories[i]?.data ?? [];
    const series = grid.map((_, di) => history[di]?.balance ?? 0);
    const { ytdVariation, ytdVariationPct, sparkline, rawStart, rawLatest } = deriveVariation(series, grid);
    assetVariationParts.push({ rawStart, rawLatest });
    rows.push({
      id: account.id,
      kind: 'account',
      name: account.name,
      subtitle: account.institution,
      typeLabel: accountTypeLabels[account.type],
      value: account.balance,
      isLiability: false,
      sharePercent: 0,
      allTimeGain: null,
      allTimeGainPct: null,
      ytdVariation,
      ytdVariationPct,
      sparkline,
      linkTo: `/accounts/${account.id}`,
    });
  });

  (investments.data ?? []).forEach((acc, i) => {
    const entries = investmentEntries[i]?.data ?? [];
    // Dividends and broker fees aren't cost basis (not money out of the user's pocket, resp.
    // already reflected in the account's manually-entered value) — excluded here too,
    // consistent with InvestmentDetailPage/PositionsCard.
    const totalInvested = entries
      .filter((e) => e.entryType === 'contribution')
      .reduce((sum, e) => sum + e.amountInvested, 0);
    const points = entries.map((e) => ({ date: dayKey(e.date), value: e.portfolioValue }));
    const series = forwardFill(points, grid);
    const { ytdVariation, ytdVariationPct, sparkline, rawStart, rawLatest } = deriveVariation(series, grid);
    assetVariationParts.push({ rawStart, rawLatest });
    const allTimeGain = totalInvested > 0 ? acc.currentValue - totalInvested : null;
    rows.push({
      id: acc.id,
      kind: 'investment',
      name: acc.name,
      subtitle: acc.platform,
      typeLabel: 'Investissement',
      value: acc.currentValue,
      isLiability: false,
      sharePercent: 0,
      allTimeGain,
      allTimeGainPct: allTimeGain !== null && totalInvested > 0 ? (allTimeGain / totalInvested) * 100 : null,
      ytdVariation,
      ytdVariationPct,
      sparkline,
      linkTo: `/investments/${acc.id}`,
    });
  });

  (cryptoWallets.data ?? []).forEach((wallet, i) => {
    const snapshots = cryptoHistories[i]?.data ?? [];
    const points = snapshots.map((s) => ({ date: dayKey(s.fetchedAt), value: usdCentsToEurCents(s.totalValueUsd) }));
    const series = forwardFill(points, grid);
    const { ytdVariation, ytdVariationPct, sparkline, rawStart, rawLatest } = deriveVariation(series, grid);
    assetVariationParts.push({ rawStart, rawLatest });
    const latest = [...snapshots].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
    rows.push({
      id: wallet.id,
      kind: 'crypto',
      name: wallet.name,
      subtitle: cryptoPlatformLabels[wallet.platform],
      typeLabel: 'Crypto',
      value: latest ? usdCentsToEurCents(latest.totalValueUsd) : 0,
      isLiability: false,
      sharePercent: 0,
      allTimeGain: null,
      allTimeGainPct: null,
      ytdVariation,
      ytdVariationPct,
      sparkline,
      linkTo: `/crypto/${wallet.id}`,
    });
  });

  (realEstate.data ?? []).forEach((asset, i) => {
    const history = realEstateHistories[i]?.data ?? [];
    const points = [
      { date: dayKey(asset.purchaseDate), value: asset.purchasePrice },
      ...history.map((h) => ({ date: dayKey(h.date), value: h.value })),
      { date: dayKey(new Date().toISOString()), value: asset.currentValue },
    ];
    const series = forwardFill(points, grid);
    const { ytdVariation, ytdVariationPct, sparkline, rawStart, rawLatest } = deriveVariation(series, grid);
    assetVariationParts.push({ rawStart, rawLatest });
    const allTimeGain = asset.purchasePrice > 0 ? asset.currentValue - asset.purchasePrice : null;
    rows.push({
      id: asset.id,
      kind: 'real_estate',
      name: asset.name,
      subtitle:
        asset.type === 'physical'
          ? [asset.location, asset.surfaceM2 ? `${asset.surfaceM2} m²` : null].filter(Boolean).join(' · ') || null
          : asset.platform,
      typeLabel: realEstateTypeLabels[asset.type],
      value: asset.currentValue,
      isLiability: false,
      sharePercent: 0,
      allTimeGain,
      allTimeGainPct: allTimeGain !== null && asset.purchasePrice > 0 ? (allTimeGain / asset.purchasePrice) * 100 : null,
      ytdVariation,
      ytdVariationPct,
      sparkline,
      linkTo: '/real-estate',
    });
  });

  if ((collectibleItems.data?.length ?? 0) > 0) {
    const collectiblesByItem = collectibleDetails.map((q) =>
      forwardFill(
        (q.data?.history ?? [])
          .filter((s) => s.marketPriceEur !== null)
          .map((s) => ({ date: dayKey(s.fetchedAt), value: s.marketPriceEur! })),
        grid,
      ),
    );
    const series = grid.map((_, di) => collectiblesByItem.reduce((sum, s) => sum + (s[di] ?? 0), 0));
    const { ytdVariation, ytdVariationPct, sparkline, rawStart, rawLatest } = deriveVariation(series, grid);
    assetVariationParts.push({ rawStart, rawLatest });
    const totals = collectiblePerformance.data?.totals;
    const allTimeGain = totals && totals.totalInvested > 0 ? totals.totalCurrentValue - totals.totalInvested : null;
    rows.push({
      id: 'collectibles',
      kind: 'collectibles',
      name: 'Collection',
      subtitle: `${collectibleItems.data?.length ?? 0} objet(s)`,
      typeLabel: 'Collectibles',
      value: totals?.totalCurrentValue ?? 0,
      isLiability: false,
      sharePercent: 0,
      allTimeGain,
      allTimeGainPct: totals?.totalGainLossPct ?? null,
      ytdVariation,
      ytdVariationPct,
      sparkline,
      linkTo: '/collectibles',
    });
  }

  (credits.data ?? []).forEach((credit) => {
    rows.push({
      id: credit.id,
      kind: 'credit',
      name: credit.name,
      subtitle: credit.institution,
      typeLabel: 'Crédit',
      value: credit.remainingAmount,
      isLiability: true,
      sharePercent: 0,
      allTimeGain: null,
      allTimeGainPct: null,
      ytdVariation: null,
      ytdVariationPct: null,
      sparkline: [],
      linkTo: '/credits',
    });
  });

  const assetsTotal = rows.filter((r) => !r.isLiability).reduce((sum, r) => sum + r.value, 0);
  const liabilitiesTotal = rows.filter((r) => r.isLiability).reduce((sum, r) => sum + r.value, 0);
  rows.forEach((r) => {
    const denom = r.isLiability ? liabilitiesTotal : assetsTotal;
    r.sharePercent = denom > 0 ? (r.value / denom) * 100 : 0;
  });

  // Additive across rows sharing the same day-grid/Jan-1 anchor: sum(latest_i) -
  // sum(start_i) == total variation, even for rows whose own start was 0 (no
  // history yet — they just contribute their full latest value as "new").
  const startSum = assetVariationParts.reduce((sum, p) => sum + p.rawStart, 0);
  const latestSum = assetVariationParts.reduce((sum, p) => sum + p.rawLatest, 0);
  const assetsYtdVariation = startSum > 0 || latestSum > 0 ? latestSum - startSum : null;
  const assetsYtdVariationPct =
    assetsYtdVariation !== null && startSum > 0 ? (assetsYtdVariation / startSum) * 100 : null;

  return {
    rows,
    assetsTotal,
    liabilitiesTotal,
    assetsYtdVariation,
    assetsYtdVariationPct,
    isLoading,
  };
}
