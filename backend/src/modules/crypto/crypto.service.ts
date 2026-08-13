import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import type { SettingsService } from '../settings/settings.service.js';
import {
  type Erc20ContractInfo,
  getErc20Balance,
  getErc20ContractsTouched,
  getEthBalanceWei,
  weiToEth,
} from '../../integrations/etherscan/etherscan.client.js';
import {
  type SplTokenBalance,
  getSolBalanceLamports,
  getSplTokenAccounts,
  lamportsToSol,
} from '../../integrations/solana/solana.client.js';
import {
  type CoinMarketData,
  type TokenPrice,
  getCoinsByContractAddress,
  getMarketDataBySymbol,
  getTokenPricesUsd,
} from '../../integrations/coingecko/coingecko.client.js';
import { getAccountBalances, getAssetPriceUsd } from '../../integrations/binance/binance.client.js';
import { getWalletBalanceUsd } from '../../integrations/bybit/bybit.client.js';
import { getUserBalance } from '../../integrations/cryptocom/cryptocom.client.js';
import { getWallets as getMeriaWallets } from '../../integrations/meria/meria.client.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateCostEntryInput,
  CreateWalletInput,
  UpdateCostEntryInput,
  UpdateWalletInput,
} from './crypto.schema.js';

export interface WalletToken {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  amount: number;
  priceUsd: number | null;
  valueUsdCents: number | null;
  change24hPct: number | null;
}

type CryptoWallet = typeof schema.cryptoWallets.$inferSelect;

export class CryptoService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
  ) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(schema.cryptoWallets)
      .where(eq(schema.cryptoWallets.userId, userId));
  }

  async create(userId: string, input: CreateWalletInput) {
    const [wallet] = await this.db
      .insert(schema.cryptoWallets)
      .values({ userId, ...input })
      .returning();
    return wallet;
  }

  async getById(userId: string, id: string): Promise<CryptoWallet> {
    const [wallet] = await this.db
      .select()
      .from(schema.cryptoWallets)
      .where(and(eq(schema.cryptoWallets.id, id), eq(schema.cryptoWallets.userId, userId)));
    if (!wallet) throw new AppError(404, 'WALLET_NOT_FOUND', 'Crypto wallet not found');
    return wallet;
  }

  async update(userId: string, id: string, input: UpdateWalletInput) {
    await this.getById(userId, id);
    const [wallet] = await this.db
      .update(schema.cryptoWallets)
      .set(input)
      .where(eq(schema.cryptoWallets.id, id))
      .returning();
    return wallet;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.cryptoWallets).where(eq(schema.cryptoWallets.id, id));
  }

  async sync(userId: string, id: string) {
    const wallet = await this.getById(userId, id);
    const coingeckoApiKey = await this.getCoingeckoApiKey(userId);

    switch (wallet.platform) {
      case 'phantom':
        return this.syncSolana(wallet, coingeckoApiKey);
      case 'metamask': {
        const apiKey = await this.settingsService.getValue(userId, 'etherscanApiKey');
        if (!apiKey) {
          throw new AppError(
            501,
            'ETHERSCAN_NOT_CONFIGURED',
            'Etherscan sync is not configured yet',
          );
        }
        return this.syncEthereum(wallet, apiKey, coingeckoApiKey);
      }
      case 'crypto_com': {
        const keys = await this.requireExchangeKeys(
          userId,
          'cryptoComApiKey',
          'cryptoComApiSecret',
          'CRYPTO_COM',
        );
        return this.syncCryptoCom(wallet, keys.apiKey, keys.apiSecret);
      }
      case 'binance': {
        const keys = await this.requireExchangeKeys(userId, 'binanceApiKey', 'binanceApiSecret', 'BINANCE');
        return this.syncBinance(wallet, keys.apiKey, keys.apiSecret);
      }
      case 'bybit': {
        const keys = await this.requireExchangeKeys(userId, 'bybitApiKey', 'bybitApiSecret', 'BYBIT');
        return this.syncBybit(wallet, keys.apiKey, keys.apiSecret);
      }
      case 'coinbase':
        throw new AppError(501, 'COINBASE_NOT_CONFIGURED', 'Coinbase sync is not configured yet');
      case 'kraken':
        throw new AppError(501, 'KRAKEN_NOT_CONFIGURED', 'Kraken sync is not configured yet');
      case 'meria': {
        const apiKey = await this.settingsService.getValue(userId, 'meriaApiKey');
        if (!apiKey) {
          throw new AppError(501, 'MERIA_NOT_CONFIGURED', 'Meria sync is not configured yet');
        }
        return this.syncMeria(wallet, apiKey, coingeckoApiKey);
      }
    }
  }

  private async getCoingeckoApiKey(userId: string): Promise<string | undefined> {
    return (await this.settingsService.getValue(userId, 'coingeckoApiKey')) ?? undefined;
  }

  async history(userId: string, id: string) {
    await this.getById(userId, id);
    return this.db
      .select()
      .from(schema.cryptoSnapshots)
      .where(eq(schema.cryptoSnapshots.walletId, id))
      .orderBy(desc(schema.cryptoSnapshots.fetchedAt));
  }

  async getTokens(userId: string, id: string): Promise<{ tokens: WalletToken[]; note: string | null }> {
    const wallet = await this.getById(userId, id);
    const coingeckoApiKey = await this.getCoingeckoApiKey(userId);
    const result = await this.getTokensForWallet(userId, wallet, coingeckoApiKey);
    const tokens = await this.enrichTokenMeta(result.tokens, coingeckoApiKey);

    if (this.pricingLooksReliable(tokens)) {
      return { tokens, note: result.note };
    }

    // Every token came back with no price at all — almost always CoinGecko's free tier
    // rate limit collapsing pricing for the whole request, not a wallet that genuinely holds
    // only unpriced tokens (verified live: reproducible during a rate-limited window). Showing
    // that as a blank list looks like the wallet lost its holdings. Fall back to the last
    // successful sync's stored snapshot (real prices, just not live) instead of nothing.
    const fallback = await this.getLastSnapshotTokens(id);
    if (fallback) {
      return {
        tokens: fallback.tokens,
        note: `Données de la dernière synchronisation (${fallback.fetchedAt.toLocaleString('fr-FR')}) — l'API de prix CoinGecko a atteint sa limite de requêtes, impossible de récupérer les cours en direct pour le moment. Réessayez dans quelques minutes, ou ajoutez une clé API CoinGecko dans Réglages pour augmenter cette limite.`,
      };
    }

    return {
      tokens,
      note: "Impossible de récupérer les cours pour le moment : l'API de prix CoinGecko a atteint sa limite de requêtes. Réessayez dans quelques minutes, ou ajoutez une clé API CoinGecko dans Réglages pour augmenter cette limite.",
    };
  }

  /** True unless every token resolved with no price at all — the signal used to detect that
   * CoinGecko pricing collapsed for the whole request (see getTokens/writeSnapshot) rather
   * than treating a handful of individually-unpriced illiquid tokens as a failure. */
  private pricingLooksReliable(tokens: WalletToken[]): boolean {
    return tokens.length === 0 || tokens.some((t) => t.priceUsd !== null);
  }

  private async getLastSnapshotTokens(
    walletId: string,
  ): Promise<{ tokens: WalletToken[]; fetchedAt: Date } | null> {
    const [snapshot] = await this.db
      .select()
      .from(schema.cryptoSnapshots)
      .where(eq(schema.cryptoSnapshots.walletId, walletId))
      .orderBy(desc(schema.cryptoSnapshots.fetchedAt))
      .limit(1);
    if (!snapshot) return null;
    const rawData = snapshot.rawData as { tokens?: WalletToken[] } | null;
    if (!rawData?.tokens) return null;
    return { tokens: rawData.tokens, fetchedAt: snapshot.fetchedAt };
  }

  /** Inserts a sync snapshot — unless pricing has collapsed for every token, in which case
   * writing the total anyway would silently overwrite a correct previous total with ~0 (every
   * valueUsdCents is null, so the sum is 0), which looks like the wallet's balance vanished.
   * Refuses instead, with a message specific enough that the user can act on it (retry later,
   * or upgrade the CoinGecko plan) rather than a generic failure. */
  private async writeSnapshot(walletId: string, tokens: WalletToken[]) {
    if (!this.pricingLooksReliable(tokens)) {
      throw new AppError(
        503,
        'COINGECKO_RATE_LIMITED',
        "Synchronisation impossible : l'API de prix CoinGecko a atteint sa limite de requêtes et ne renvoie plus aucun cours pour le moment. Le dernier montant connu reste affiché — réessayez dans quelques minutes, ou ajoutez une clé API CoinGecko dans Réglages pour augmenter cette limite.",
      );
    }
    const totalValueUsd = tokens.reduce((sum, t) => sum + (t.valueUsdCents ?? 0), 0);
    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({ walletId, totalValueUsd, rawData: { tokens } })
      .returning();
    return snapshot;
  }

  private async getTokensForWallet(
    userId: string,
    wallet: CryptoWallet,
    coingeckoApiKey?: string,
  ): Promise<{ tokens: WalletToken[]; note: string | null }> {
    switch (wallet.platform) {
      case 'metamask': {
        const apiKey = await this.settingsService.getValue(userId, 'etherscanApiKey');
        if (!apiKey) {
          throw new AppError(501, 'ETHERSCAN_NOT_CONFIGURED', 'Etherscan sync is not configured yet');
        }
        return this.getEthereumTokens(wallet.address, apiKey, coingeckoApiKey);
      }
      case 'phantom':
        return this.getSolanaTokens(wallet.address, coingeckoApiKey);
      case 'crypto_com': {
        const keys = await this.requireExchangeKeys(
          userId,
          'cryptoComApiKey',
          'cryptoComApiSecret',
          'CRYPTO_COM',
        );
        return {
          tokens: await this.getCryptoComTokens(keys.apiKey, keys.apiSecret, coingeckoApiKey),
          note: null,
        };
      }
      case 'binance': {
        const keys = await this.requireExchangeKeys(userId, 'binanceApiKey', 'binanceApiSecret', 'BINANCE');
        return { tokens: await this.getBinanceTokens(keys.apiKey, keys.apiSecret), note: null };
      }
      case 'bybit': {
        const keys = await this.requireExchangeKeys(userId, 'bybitApiKey', 'bybitApiSecret', 'BYBIT');
        return { tokens: await this.getBybitTokens(keys.apiKey, keys.apiSecret), note: null };
      }
      case 'coinbase':
        return { tokens: [], note: "Détail des tokens indisponible pour Coinbase pour l'instant." };
      case 'kraken':
        return { tokens: [], note: "Détail des tokens indisponible pour Kraken pour l'instant." };
      case 'meria': {
        const apiKey = await this.settingsService.getValue(userId, 'meriaApiKey');
        if (!apiKey) {
          throw new AppError(501, 'MERIA_NOT_CONFIGURED', 'Meria sync is not configured yet');
        }
        return { tokens: await this.getMeriaTokens(apiKey, coingeckoApiKey), note: null };
      }
    }
  }

  /** Fills in logo/name for tokens whose platform-specific source didn't provide one (Binance,
   * Bybit, on-chain ERC20s), via a single batched CoinGecko lookup keyed by ticker symbol.
   * Symbols CoinGecko doesn't recognize (e.g. truncated Solana mint addresses used as a
   * placeholder when no name is known) are simply left as-is — no logo, initials fallback. */
  private async enrichTokenMeta(
    tokens: WalletToken[],
    coingeckoApiKey?: string,
  ): Promise<WalletToken[]> {
    const missing = tokens.filter((t) => t.logoUrl === null).map((t) => t.symbol);
    if (missing.length === 0) return tokens;

    // Purely cosmetic enrichment (logo/name) — a CoinGecko failure here (rate limit is common,
    // this fires on every wallet with unresolved symbols, e.g. every SPL mint prefix on a
    // Phantom wallet) must not 500 the whole token list over a missing logo.
    const marketData = await getMarketDataBySymbol(missing, coingeckoApiKey).catch(
      () => new Map<string, CoinMarketData>(),
    );
    if (marketData.size === 0) return tokens;

    return tokens.map((t) => {
      const data = marketData.get(t.symbol.toUpperCase());
      if (!data) return t;
      return { ...t, name: t.name ?? data.name, logoUrl: data.logoUrl };
    });
  }

  /** Resolves an exchange's API key/secret pair from Settings, or throws 501 if either is missing. */
  private async requireExchangeKeys(
    userId: string,
    keyField: 'binanceApiKey' | 'bybitApiKey' | 'cryptoComApiKey',
    secretField: 'binanceApiSecret' | 'bybitApiSecret' | 'cryptoComApiSecret',
    exchangeName: string,
  ): Promise<{ apiKey: string; apiSecret: string }> {
    const [apiKey, apiSecret] = await Promise.all([
      this.settingsService.getValue(userId, keyField),
      this.settingsService.getValue(userId, secretField),
    ]);
    if (!apiKey || !apiSecret) {
      throw new AppError(
        501,
        `${exchangeName}_NOT_CONFIGURED`,
        `${exchangeName} sync is not configured yet`,
      );
    }
    return { apiKey, apiSecret };
  }

  /** Native coin (ETH/SOL) isn't an ERC20/SPL entry — Etherscan/Solana RPC only expose it via
   * a separate "account balance" call, so it has to be folded in here explicitly or it silently
   * never appears in "Tokens détenus" for wallets holding only the native coin (no other tokens). */
  private buildNativeToken(
    symbol: string,
    amount: number,
    marketData: Map<string, CoinMarketData>,
  ): WalletToken {
    const data = marketData.get(symbol);
    return {
      symbol,
      name: data?.name ?? null,
      logoUrl: data?.logoUrl ?? null,
      amount,
      priceUsd: data?.priceUsd ?? null,
      valueUsdCents: data?.priceUsd != null ? Math.round(amount * data.priceUsd * 100) : null,
      change24hPct: data?.change24hPct ?? null,
    };
  }

  private async getEthereumTokens(
    address: string,
    apiKey: string,
    coingeckoApiKey?: string,
  ): Promise<{ tokens: WalletToken[]; note: string | null }> {
    // Native balance is fetched in addition to the ERC20 list (added after that list was
    // already working) — a failure here (bad address, Etherscan hiccup) must not 500 the whole
    // token list, so it's caught and simply omits the native row rather than propagating.
    // The ERC20 contract list itself is guarded the same way (Etherscan's free tier does rate-
    // limit): a failure there degrades to an empty list + explanatory note instead of a 500,
    // rather than losing the native row too on a call that's otherwise unrelated to it.
    const [wei, contractsResult] = await Promise.all([
      getEthBalanceWei(address, apiKey).catch(() => 0n),
      getErc20ContractsTouched(address, apiKey)
        .then((contracts) => ({ contracts, failed: false as const }))
        .catch(() => ({ contracts: [] as Erc20ContractInfo[], failed: true as const })),
    ]);
    const nativeAmount = weiToEth(wei);
    const contracts = contractsResult.contracts;

    const [nativeMarketData, prices] = await Promise.all([
      nativeAmount > 0
        ? getMarketDataBySymbol(['ETH'], coingeckoApiKey).catch(() => new Map<string, CoinMarketData>())
        : Promise.resolve(new Map<string, CoinMarketData>()),
      contracts.length > 0
        ? getTokenPricesUsd(
            'ethereum',
            contracts.map((c) => c.contractAddress),
            coingeckoApiKey,
          )
        : Promise.resolve<Record<string, TokenPrice>>({}),
    ]);

    const erc20Tokens = await Promise.all(
      contracts.map(async (c): Promise<WalletToken | null> => {
        // Same reasoning as the contract-list/native-balance calls above: one contract's
        // balance call failing (Etherscan rate limit on that single request) must not take
        // down every other already-resolved token — skip just this one instead of rejecting
        // the whole Promise.all.
        let raw: bigint;
        try {
          raw = await getErc20Balance(address, c.contractAddress, apiKey);
        } catch {
          return null;
        }
        const amount = Number(raw) / 10 ** c.tokenDecimal;
        if (amount <= 0) return null;
        const price = prices[c.contractAddress.toLowerCase()];
        return {
          symbol: c.tokenSymbol,
          name: c.tokenName,
          logoUrl: null,
          amount,
          priceUsd: price?.usd ?? null,
          valueUsdCents: price?.usd != null ? Math.round(amount * price.usd * 100) : null,
          change24hPct: price?.usd24hChange ?? null,
        };
      }),
    );

    const tokens = erc20Tokens.filter((t): t is WalletToken => t !== null);
    if (nativeAmount > 0) tokens.unshift(this.buildNativeToken('ETH', nativeAmount, nativeMarketData));
    return {
      tokens,
      note: contractsResult.failed
        ? "Impossible de récupérer la liste des tokens ERC20 pour le moment (Etherscan indisponible ou limité) — réessayez plus tard."
        : null,
    };
  }

  private async getSolanaTokens(
    address: string,
    coingeckoApiKey?: string,
  ): Promise<{ tokens: WalletToken[]; note: string | null }> {
    // Same reasoning as getEthereumTokens: don't let a native-balance failure (invalid address,
    // RPC hiccup) take down the SPL token list, and don't let the SPL list itself (Solana's
    // public RPC is easily rate-limited, verified live: repeated calls return 429/error on
    // getTokenAccountsByOwner) take down the whole response either — degrade to a note instead.
    const [lamports, accountsResult] = await Promise.all([
      getSolBalanceLamports(env.SOLANA_RPC_URL, address).catch(() => 0),
      getSplTokenAccounts(env.SOLANA_RPC_URL, address)
        .then((accounts) => ({ accounts, failed: false as const }))
        .catch(() => ({ accounts: [] as SplTokenBalance[], failed: true as const })),
    ]);
    const nativeAmount = lamportsToSol(lamports);
    const accounts = accountsResult.accounts;

    const [nativeMarketData, coinsByMint] = await Promise.all([
      nativeAmount > 0
        ? getMarketDataBySymbol(['SOL'], coingeckoApiKey).catch(() => new Map<string, CoinMarketData>())
        : Promise.resolve(new Map<string, CoinMarketData>()),
      accounts.length > 0
        ? getCoinsByContractAddress(
            'solana',
            accounts.map((a) => a.mint),
            coingeckoApiKey,
          )
        : Promise.resolve<Record<string, CoinMarketData>>({}),
    ]);

    // "No CoinGecko price" is only trustworthy as a spam signal when CoinGecko itself is
    // actually reachable right now — verified live: during a rate-limited window every price
    // lookup fails the same way (empty map, caught above), which would otherwise make the spam
    // filter wipe out real holdings (SOL, USDT, staked SOL...) right along with the junk. SOL's
    // own price acts as a canary: if a native balance exists but its price didn't resolve,
    // CoinGecko is currently unavailable, so filtering is skipped entirely for this response
    // (falls back to showing every token, unfiltered, same as before spam filtering existed).
    const pricingAvailable = nativeAmount === 0 || nativeMarketData.has('SOL');

    const splTokens = accounts
      .map((a): WalletToken => {
        // Resolved by mint address, not by ticker — SPL token accounts only ever expose the
        // mint, never a name, so a ticker-based lookup would have nothing real to match against.
        // Verified live: without this, USDT and Phantom Staked SOL both displayed as their raw
        // truncated mint address instead of a real name (see coingecko.client.ts doc comment).
        const coin = coinsByMint[a.mint.toLowerCase()];
        return {
          symbol: coin?.symbol ?? `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`,
          name: coin?.name ?? null,
          logoUrl: coin?.logoUrl ?? null,
          amount: a.amount,
          priceUsd: coin?.priceUsd ?? null,
          valueUsdCents: coin?.priceUsd != null ? Math.round(a.amount * coin.priceUsd * 100) : null,
          change24hPct: coin?.change24hPct ?? null,
        };
      })
      // Solana wallets accumulate spam/airdropped token accounts (scam projects sending 1 unit
      // of a worthless token to random addresses to advertise) that Phantom's own UI filters
      // out — verified live against a real wallet: 16 of 19 SPL accounts held were this kind of
      // spam, none priced by CoinGecko. A token with neither a resolved price nor a resolved
      // name is dropped rather than shown as if it were a real holding.
      .filter((t) => !pricingAvailable || t.priceUsd !== null || t.name !== null);

    if (nativeAmount > 0) splTokens.unshift(this.buildNativeToken('SOL', nativeAmount, nativeMarketData));
    return {
      tokens: splTokens,
      note: accountsResult.failed
        ? "Impossible de récupérer la liste des tokens SPL pour le moment (RPC Solana indisponible ou limité) — réessayez plus tard."
        : null,
    };
  }

  private async syncEthereum(wallet: CryptoWallet, apiKey: string, coingeckoApiKey?: string) {
    // Previously only counted the native ETH balance, silently ignoring any ERC20 tokens held —
    // undercounted the real wallet value (and therefore the patrimoine total) for any wallet
    // holding tokens beyond native ETH. Reuses getEthereumTokens (same source as "Tokens
    // détenus") so the stored total and the displayed token list always agree.
    const { tokens } = await this.getEthereumTokens(wallet.address, apiKey, coingeckoApiKey);
    return this.writeSnapshot(wallet.id, tokens);
  }

  // Priced via CoinGecko rather than a Crypto.com field: `position_balances` entries beyond
  // `instrument_name`/`quantity` are unconfirmed against a real non-empty response (see the
  // root-cause note in cryptocom.client.ts), so we only trust the two field names we're sure of.
  private async getCryptoComTokens(
    apiKey: string,
    apiSecret: string,
    coingeckoApiKey?: string,
  ): Promise<WalletToken[]> {
    const balance = await getUserBalance(apiKey, apiSecret);
    if (balance.position_balances.length === 0) return [];

    const prices = await getMarketDataBySymbol(
      balance.position_balances.map((p) => p.instrument_name),
      coingeckoApiKey,
    );

    return balance.position_balances
      .map((p): WalletToken | null => {
        const amount = Number(p.quantity);
        if (amount <= 0) return null;
        const price = prices.get(p.instrument_name.toUpperCase());
        return {
          symbol: p.instrument_name,
          name: price?.name ?? null,
          logoUrl: price?.logoUrl ?? null,
          amount,
          priceUsd: price?.priceUsd ?? null,
          valueUsdCents: price?.priceUsd != null ? Math.round(amount * price.priceUsd * 100) : null,
          change24hPct: price?.change24hPct ?? null,
        };
      })
      .filter((t): t is WalletToken => t !== null);
  }

  private async syncCryptoCom(wallet: CryptoWallet, apiKey: string, apiSecret: string) {
    const balance = await getUserBalance(apiKey, apiSecret);
    const totalValueUsd = Math.round(Number(balance.total_cash_balance) * 100);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({ walletId: wallet.id, totalValueUsd, rawData: { balance } })
      .returning();
    return snapshot;
  }

  private async getBinanceTokens(apiKey: string, apiSecret: string): Promise<WalletToken[]> {
    const balances = await getAccountBalances(apiKey, apiSecret);
    const tokens = await Promise.all(
      balances.map(async (b): Promise<WalletToken> => {
        const amount = Number(b.free) + Number(b.locked);
        const priceUsd = await getAssetPriceUsd(b.asset);
        return {
          symbol: b.asset,
          name: null,
          logoUrl: null,
          amount,
          priceUsd,
          valueUsdCents: priceUsd != null ? Math.round(amount * priceUsd * 100) : null,
          change24hPct: null,
        };
      }),
    );
    return tokens;
  }

  private async getBybitTokens(apiKey: string, apiSecret: string): Promise<WalletToken[]> {
    const balances = await getWalletBalanceUsd(apiKey, apiSecret);
    return balances.map((b) => ({
      symbol: b.coin,
      name: null,
      logoUrl: null,
      amount: b.amount,
      priceUsd: b.amount > 0 ? b.valueUsd / b.amount : null,
      valueUsdCents: Math.round(b.valueUsd * 100),
      change24hPct: null,
    }));
  }

  private async syncBinance(wallet: CryptoWallet, apiKey: string, apiSecret: string) {
    const tokens = await this.getBinanceTokens(apiKey, apiSecret);
    return this.writeSnapshot(wallet.id, tokens);
  }

  private async syncBybit(wallet: CryptoWallet, apiKey: string, apiSecret: string) {
    const tokens = await this.getBybitTokens(apiKey, apiSecret);
    return this.writeSnapshot(wallet.id, tokens);
  }

  private async syncSolana(wallet: CryptoWallet, coingeckoApiKey?: string) {
    // Same reasoning as syncEthereum: reuse getSolanaTokens (native SOL + spam-filtered SPL
    // tokens) rather than pricing native SOL alone, so the stored total matches what "Tokens
    // détenus" actually shows instead of undercounting SPL holdings.
    const { tokens } = await this.getSolanaTokens(wallet.address, coingeckoApiKey);
    return this.writeSnapshot(wallet.id, tokens);
  }

  // Meria (mymeria.fr) is a custodial platform like Binance/Bybit — it only reports currency
  // codes + balances, no price, so pricing/name/logo comes from CoinGecko in one batched call.
  private async getMeriaTokens(apiKey: string, coingeckoApiKey?: string): Promise<WalletToken[]> {
    const wallets = await getMeriaWallets(apiKey);
    if (wallets.length === 0) return [];

    const marketData = await getMarketDataBySymbol(
      wallets.map((w) => w.currencyCode),
      coingeckoApiKey,
    );

    return wallets.map((w): WalletToken => {
      const data = marketData.get(w.currencyCode.toUpperCase());
      return {
        symbol: w.currencyCode,
        name: data?.name ?? null,
        logoUrl: data?.logoUrl ?? null,
        amount: w.balance,
        priceUsd: data?.priceUsd ?? null,
        valueUsdCents: data?.priceUsd != null ? Math.round(w.balance * data.priceUsd * 100) : null,
        change24hPct: data?.change24hPct ?? null,
      };
    });
  }

  private async syncMeria(wallet: CryptoWallet, apiKey: string, coingeckoApiKey?: string) {
    const tokens = await this.getMeriaTokens(apiKey, coingeckoApiKey);
    return this.writeSnapshot(wallet.id, tokens);
  }

  async listCostEntries(userId: string, walletId: string) {
    await this.getById(userId, walletId);
    return this.db
      .select()
      .from(schema.cryptoCostEntries)
      .where(eq(schema.cryptoCostEntries.walletId, walletId))
      .orderBy(desc(schema.cryptoCostEntries.purchasedAt));
  }

  async addCostEntry(userId: string, walletId: string, input: CreateCostEntryInput) {
    await this.getById(userId, walletId);
    const [entry] = await this.db
      .insert(schema.cryptoCostEntries)
      .values({ walletId, ...input, purchasedAt: new Date(input.purchasedAt) })
      .returning();
    return entry;
  }

  async updateCostEntry(
    userId: string,
    walletId: string,
    entryId: string,
    input: UpdateCostEntryInput,
  ) {
    await this.getCostEntryOrThrow(userId, walletId, entryId);
    const { purchasedAt, ...rest } = input;
    const [entry] = await this.db
      .update(schema.cryptoCostEntries)
      .set({ ...rest, ...(purchasedAt ? { purchasedAt: new Date(purchasedAt) } : {}) })
      .where(eq(schema.cryptoCostEntries.id, entryId))
      .returning();
    return entry;
  }

  async deleteCostEntry(userId: string, walletId: string, entryId: string): Promise<void> {
    await this.getCostEntryOrThrow(userId, walletId, entryId);
    await this.db.delete(schema.cryptoCostEntries).where(eq(schema.cryptoCostEntries.id, entryId));
  }

  private async getCostEntryOrThrow(userId: string, walletId: string, entryId: string) {
    await this.getById(userId, walletId);
    const [entry] = await this.db
      .select()
      .from(schema.cryptoCostEntries)
      .where(
        and(eq(schema.cryptoCostEntries.id, entryId), eq(schema.cryptoCostEntries.walletId, walletId)),
      );
    if (!entry) throw new AppError(404, 'COST_ENTRY_NOT_FOUND', 'Cost entry not found');
    return entry;
  }
}
