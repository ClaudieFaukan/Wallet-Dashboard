import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import type { SettingsService } from '../settings/settings.service.js';
import {
  getErc20Balance,
  getErc20ContractsTouched,
  getEthBalanceWei,
  getEthPriceUsd,
  weiToEth,
} from '../../integrations/etherscan/etherscan.client.js';
import {
  getSolBalanceLamports,
  getSolPriceUsd,
  getSplTokenAccounts,
  lamportsToSol,
} from '../../integrations/solana/solana.client.js';
import { getMarketDataBySymbol, getTokenPricesUsd } from '../../integrations/coingecko/coingecko.client.js';
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

    switch (wallet.platform) {
      case 'phantom':
        return this.syncSolana(wallet);
      case 'metamask': {
        const apiKey = await this.settingsService.getValue(userId, 'etherscanApiKey');
        if (!apiKey) {
          throw new AppError(
            501,
            'ETHERSCAN_NOT_CONFIGURED',
            'Etherscan sync is not configured yet',
          );
        }
        return this.syncEthereum(wallet, apiKey);
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
        return this.syncMeria(wallet, apiKey);
      }
    }
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
    const result = await this.getTokensForWallet(userId, wallet);
    return { tokens: await this.enrichTokenMeta(result.tokens), note: result.note };
  }

  private async getTokensForWallet(
    userId: string,
    wallet: CryptoWallet,
  ): Promise<{ tokens: WalletToken[]; note: string | null }> {
    switch (wallet.platform) {
      case 'metamask': {
        const apiKey = await this.settingsService.getValue(userId, 'etherscanApiKey');
        if (!apiKey) {
          throw new AppError(501, 'ETHERSCAN_NOT_CONFIGURED', 'Etherscan sync is not configured yet');
        }
        return { tokens: await this.getEthereumTokens(wallet.address, apiKey), note: null };
      }
      case 'phantom':
        return { tokens: await this.getSolanaTokens(wallet.address), note: null };
      case 'crypto_com': {
        const keys = await this.requireExchangeKeys(
          userId,
          'cryptoComApiKey',
          'cryptoComApiSecret',
          'CRYPTO_COM',
        );
        return { tokens: await this.getCryptoComTokens(keys.apiKey, keys.apiSecret), note: null };
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
        return { tokens: await this.getMeriaTokens(apiKey), note: null };
      }
    }
  }

  /** Fills in logo/name for tokens whose platform-specific source didn't provide one (Binance,
   * Bybit, on-chain ERC20s), via a single batched CoinGecko lookup keyed by ticker symbol.
   * Symbols CoinGecko doesn't recognize (e.g. truncated Solana mint addresses used as a
   * placeholder when no name is known) are simply left as-is — no logo, initials fallback. */
  private async enrichTokenMeta(tokens: WalletToken[]): Promise<WalletToken[]> {
    const missing = tokens.filter((t) => t.logoUrl === null).map((t) => t.symbol);
    if (missing.length === 0) return tokens;

    const marketData = await getMarketDataBySymbol(missing);
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

  private async getEthereumTokens(address: string, apiKey: string): Promise<WalletToken[]> {
    const contracts = await getErc20ContractsTouched(address, apiKey);
    if (contracts.length === 0) return [];

    const prices = await getTokenPricesUsd(
      'ethereum',
      contracts.map((c) => c.contractAddress),
    );

    const tokens = await Promise.all(
      contracts.map(async (c): Promise<WalletToken | null> => {
        const raw = await getErc20Balance(address, c.contractAddress, apiKey);
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

    return tokens.filter((t): t is WalletToken => t !== null);
  }

  private async getSolanaTokens(address: string): Promise<WalletToken[]> {
    const accounts = await getSplTokenAccounts(env.SOLANA_RPC_URL, address);
    if (accounts.length === 0) return [];

    const prices = await getTokenPricesUsd(
      'solana',
      accounts.map((a) => a.mint),
    );

    return accounts.map((a) => {
      const price = prices[a.mint.toLowerCase()];
      return {
        symbol: `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`,
        name: null,
        logoUrl: null,
        amount: a.amount,
        priceUsd: price?.usd ?? null,
        valueUsdCents: price?.usd != null ? Math.round(a.amount * price.usd * 100) : null,
        change24hPct: price?.usd24hChange ?? null,
      };
    });
  }

  private async syncEthereum(wallet: CryptoWallet, apiKey: string) {
    const wei = await getEthBalanceWei(wallet.address, apiKey);
    const ethBalance = weiToEth(wei);
    const priceUsd = await getEthPriceUsd();
    const totalValueUsd = Math.round(ethBalance * priceUsd * 100);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({
        walletId: wallet.id,
        totalValueUsd,
        rawData: { wei: wei.toString(), ethBalance, priceUsd },
      })
      .returning();

    return snapshot;
  }

  // Priced via CoinGecko rather than a Crypto.com field: `position_balances` entries beyond
  // `instrument_name`/`quantity` are unconfirmed against a real non-empty response (see the
  // root-cause note in cryptocom.client.ts), so we only trust the two field names we're sure of.
  private async getCryptoComTokens(apiKey: string, apiSecret: string): Promise<WalletToken[]> {
    const balance = await getUserBalance(apiKey, apiSecret);
    if (balance.position_balances.length === 0) return [];

    const prices = await getMarketDataBySymbol(balance.position_balances.map((p) => p.instrument_name));

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
    const totalValueUsd = tokens.reduce((sum, t) => sum + (t.valueUsdCents ?? 0), 0);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({ walletId: wallet.id, totalValueUsd, rawData: { tokens } })
      .returning();
    return snapshot;
  }

  private async syncBybit(wallet: CryptoWallet, apiKey: string, apiSecret: string) {
    const tokens = await this.getBybitTokens(apiKey, apiSecret);
    const totalValueUsd = tokens.reduce((sum, t) => sum + (t.valueUsdCents ?? 0), 0);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({ walletId: wallet.id, totalValueUsd, rawData: { tokens } })
      .returning();
    return snapshot;
  }

  private async syncSolana(wallet: CryptoWallet) {
    const lamports = await getSolBalanceLamports(env.SOLANA_RPC_URL, wallet.address);
    const solBalance = lamportsToSol(lamports);
    const priceUsd = await getSolPriceUsd();
    const totalValueUsd = Math.round(solBalance * priceUsd * 100);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({
        walletId: wallet.id,
        totalValueUsd,
        rawData: { lamports, solBalance, priceUsd },
      })
      .returning();

    return snapshot;
  }

  // Meria (mymeria.fr) is a custodial platform like Binance/Bybit — it only reports currency
  // codes + balances, no price, so pricing/name/logo comes from CoinGecko in one batched call.
  private async getMeriaTokens(apiKey: string): Promise<WalletToken[]> {
    const wallets = await getMeriaWallets(apiKey);
    if (wallets.length === 0) return [];

    const marketData = await getMarketDataBySymbol(wallets.map((w) => w.currencyCode));

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

  private async syncMeria(wallet: CryptoWallet, apiKey: string) {
    const tokens = await this.getMeriaTokens(apiKey);
    const totalValueUsd = tokens.reduce((sum, t) => sum + (t.valueUsdCents ?? 0), 0);

    const [snapshot] = await this.db
      .insert(schema.cryptoSnapshots)
      .values({ walletId: wallet.id, totalValueUsd, rawData: { tokens } })
      .returning();
    return snapshot;
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
