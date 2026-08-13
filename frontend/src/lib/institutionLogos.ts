import type { CryptoWallet } from '../types/api';

export const cryptoPlatformLogos: Record<CryptoWallet['platform'], string> = {
  metamask: '/logos/metamask.png',
  phantom: '/logos/phantom.png',
  crypto_com: '/logos/crypto-com.png',
  binance: '/logos/binance.svg',
  bybit: '/logos/bybit.png',
  coinbase: '/logos/coinbase.svg',
  kraken: '/logos/kraken.png',
  meria: '/logos/meria.png',
};

// Free-text fields (bank/broker name, account institution) can't be matched against an enum —
// matched by keyword instead, accent/punctuation-insensitive so "Caisse d'Épargne" and "Caisse
// Epargne" (no accent, seen on real investment_accounts.platform data) both resolve.
const KEYWORD_LOGOS: { keyword: string; logo: string }[] = [
  { keyword: 'revolut', logo: '/logos/revolut.svg' },
  { keyword: 'caisse', logo: '/logos/caisse-epargne.png' },
  { keyword: 'boursorama', logo: '/logos/boursorama.png' },
  { keyword: 'trade republic', logo: '/logos/trade-republic.png' },
  { keyword: 'metamask', logo: '/logos/metamask.png' },
  { keyword: 'phantom', logo: '/logos/phantom.png' },
  { keyword: 'crypto com', logo: '/logos/crypto-com.png' },
  { keyword: 'binance', logo: '/logos/binance.svg' },
  { keyword: 'bybit', logo: '/logos/bybit.png' },
  { keyword: 'coinbase', logo: '/logos/coinbase.svg' },
  { keyword: 'kraken', logo: '/logos/kraken.png' },
  { keyword: 'meria', logo: '/logos/meria.png' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolves a known institution/platform logo from one or more free-text fields (account name,
 * institution, broker platform...), trying each candidate in order. Returns null rather than
 * guessing when nothing matches — callers fall back to the initials Avatar, same as today. */
export function getInstitutionLogo(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalize(candidate);
    const match = KEYWORD_LOGOS.find((entry) => normalized.includes(entry.keyword));
    if (match) return match.logo;
  }
  return null;
}
