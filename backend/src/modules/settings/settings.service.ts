import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { decrypt, encrypt } from '../../shared/utils/encryption.js';
import { getEthBalanceWei } from '../../integrations/etherscan/etherscan.client.js';
import { getUserBalance } from '../../integrations/cryptocom/cryptocom.client.js';
import { search as searchPokemonPriceTracker } from '../../integrations/collectibles/pokemonpricetracker.provider.js';
import { search as searchPoketrace } from '../../integrations/collectibles/poketrace.provider.js';
import { getQuote } from '../../integrations/alphavantage/alphavantage.client.js';
import { getAccountBalances } from '../../integrations/binance/binance.client.js';
import { getWalletBalanceUsd } from '../../integrations/bybit/bybit.client.js';
import { getWallets as getMeriaWallets } from '../../integrations/meria/meria.client.js';
import { getMarketData } from '../../integrations/coingecko/coingecko.client.js';
import { SETTINGS_FIELDS, type SettingsField } from './settings.constants.js';
import type { TestSettingInput, UpdateSettingsInput } from './settings.schema.js';

// IBM is Alpha Vantage's own documented example symbol for GLOBAL_QUOTE — always listed, safe test pick.
const ALPHA_VANTAGE_TEST_SYMBOL = 'IBM';

// Any Ethereum address works for a balance-check test call — Vitalik Buterin's
// public address is reused here (same one already verified live against
// Etherscan V2 while building the crypto module, see project memory).
const ETHERSCAN_TEST_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

export class SettingsService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getValue(userId: string, field: SettingsField): Promise<string | null> {
    const key = SETTINGS_FIELDS[field];
    const [row] = await this.db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.userId, userId), eq(schema.appSettings.key, key)));
    return row ? decrypt(row.valueEncrypted) : null;
  }

  async getStatus(userId: string) {
    const rows = await this.db
      .select({ key: schema.appSettings.key })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.userId, userId));
    const present = new Set(rows.map((r) => r.key));
    const has = (field: SettingsField) => present.has(SETTINGS_FIELDS[field]);

    return {
      etherscanConfigured: has('etherscanApiKey'),
      cryptoComConfigured: has('cryptoComApiKey') && has('cryptoComApiSecret'),
      pokemonPriceTrackerConfigured: has('pokemonPriceTrackerApiKey'),
      poketraceConfigured: has('poketraceApiKey'),
      revolutConfigured: has('revolutClientId') && has('revolutClientSecret'),
      alphaVantageConfigured: has('alphaVantageApiKey'),
      binanceConfigured: has('binanceApiKey') && has('binanceApiSecret'),
      bybitConfigured: has('bybitApiKey') && has('bybitApiSecret'),
      meriaConfigured: has('meriaApiKey'),
      coingeckoConfigured: has('coingeckoApiKey'),
    };
  }

  async update(userId: string, input: UpdateSettingsInput): Promise<void> {
    for (const [field, value] of Object.entries(input) as [SettingsField, string | undefined][]) {
      if (value === undefined) continue;
      const key = SETTINGS_FIELDS[field];

      if (value === '') {
        await this.db
          .delete(schema.appSettings)
          .where(and(eq(schema.appSettings.userId, userId), eq(schema.appSettings.key, key)));
        continue;
      }

      const valueEncrypted = encrypt(value);
      await this.db
        .insert(schema.appSettings)
        .values({ userId, key, valueEncrypted })
        .onConflictDoUpdate({
          target: [schema.appSettings.userId, schema.appSettings.key],
          set: { valueEncrypted, updatedAt: new Date() },
        });
    }
  }

  async test(input: TestSettingInput): Promise<{ success: boolean; message: string }> {
    try {
      switch (input.section) {
        case 'etherscan': {
          await getEthBalanceWei(ETHERSCAN_TEST_ADDRESS, input.etherscanApiKey);
          return { success: true, message: 'Clé Etherscan valide.' };
        }
        case 'cryptoCom': {
          const balance = await getUserBalance(input.cryptoComApiKey, input.cryptoComApiSecret);
          return {
            success: true,
            message: `Connexion Crypto.com réussie (solde ${balance.total_cash_balance} ${balance.instrument_name}).`,
          };
        }
        case 'pokemonPriceTracker': {
          const result = await searchPokemonPriceTracker(
            'cards',
            'pikachu',
            input.pokemonPriceTrackerApiKey,
          );
          return result
            ? { success: true, message: 'Clé PokemonPriceTracker valide.' }
            : {
                success: false,
                message: 'Clé acceptée mais aucun résultat retourné — vérifie ton quota.',
              };
        }
        case 'poketrace': {
          const result = await searchPoketrace('card', 'pikachu', input.poketraceApiKey);
          return result
            ? { success: true, message: 'Clé Poketrace valide.' }
            : {
                success: false,
                message: 'Clé acceptée mais aucun résultat retourné — vérifie ton quota.',
              };
        }
        case 'revolut': {
          // Revolut auth is a full OAuth2 PKCE redirect flow (see revolut.client.ts) — it
          // can't be exercised from a single background request. We only confirm the pair
          // was saved; real validation happens when the user actually connects the account.
          return {
            success: true,
            message:
              'Identifiants enregistrés — la validation complète se fait en connectant le compte depuis Comptes.',
          };
        }
        case 'alphaVantage': {
          const quote = await getQuote(ALPHA_VANTAGE_TEST_SYMBOL, input.alphaVantageApiKey);
          return {
            success: true,
            message: `Clé Alpha Vantage valide (${ALPHA_VANTAGE_TEST_SYMBOL} : ${quote.price}).`,
          };
        }
        case 'binance': {
          const balances = await getAccountBalances(input.binanceApiKey, input.binanceApiSecret);
          return {
            success: true,
            message: `Connexion Binance réussie (${balances.length} actif${balances.length > 1 ? 's' : ''}).`,
          };
        }
        case 'bybit': {
          const balances = await getWalletBalanceUsd(input.bybitApiKey, input.bybitApiSecret);
          return {
            success: true,
            message: `Connexion Bybit réussie (${balances.length} actif${balances.length > 1 ? 's' : ''}).`,
          };
        }
        case 'meria': {
          const wallets = await getMeriaWallets(input.meriaApiKey);
          return {
            success: true,
            message: `Connexion Meria réussie (${wallets.length} actif${wallets.length > 1 ? 's' : ''}).`,
          };
        }
        case 'coingecko': {
          // Bitcoin is always listed — safe, minimal call to confirm the key is accepted
          // (CoinGecko returns 401/403 rather than an empty result for an invalid Demo key).
          const marketData = await getMarketData(['bitcoin'], input.coingeckoApiKey);
          return marketData.has('bitcoin')
            ? { success: true, message: 'Clé CoinGecko valide.' }
            : { success: false, message: 'Clé acceptée mais aucun résultat retourné — vérifie ton quota.' };
        }
      }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Échec du test.' };
    }
  }

  /** Dev-only convenience for wiping accumulated test data between manual test
   * passes. Deletes accounts/transactions, budget, savings, investments,
   * real estate and credits (each cascades its child rows). Keeps the user,
   * settings, categories, crypto wallets and collectibles untouched. */
  async resetDevData(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
      await tx.delete(schema.budgetPeriods).where(eq(schema.budgetPeriods.userId, userId));
      await tx.delete(schema.savingsGoals).where(eq(schema.savingsGoals.userId, userId));
      await tx.delete(schema.investmentAccounts).where(eq(schema.investmentAccounts.userId, userId));
      await tx
        .delete(schema.investmentMilestones)
        .where(eq(schema.investmentMilestones.userId, userId));
      await tx.delete(schema.investmentGoals).where(eq(schema.investmentGoals.userId, userId));
      await tx.delete(schema.realEstateAssets).where(eq(schema.realEstateAssets.userId, userId));
      await tx.delete(schema.credits).where(eq(schema.credits.userId, userId));
    });
  }
}
