import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import {
  getEthBalanceWei,
  getEthPriceUsd,
  weiToEth,
} from '../../integrations/etherscan/etherscan.client.js';
import {
  getSolBalanceLamports,
  getSolPriceUsd,
  lamportsToSol,
} from '../../integrations/solana/solana.client.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { CreateWalletInput, UpdateWalletInput } from './crypto.schema.js';

type CryptoWallet = typeof schema.cryptoWallets.$inferSelect;

export class CryptoService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

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
      case 'metamask':
        if (!env.ETHERSCAN_API_KEY) {
          throw new AppError(
            501,
            'ETHERSCAN_NOT_CONFIGURED',
            'Etherscan sync is not configured yet',
          );
        }
        return this.syncEthereum(wallet, env.ETHERSCAN_API_KEY);
      case 'crypto_com':
        throw new AppError(
          501,
          'CRYPTO_COM_NOT_CONFIGURED',
          'Crypto.com sync is not configured yet',
        );
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
}
