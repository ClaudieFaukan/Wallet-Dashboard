import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import { parseDurationMs } from '../../shared/utils/duration.js';
import { env } from '../../config/env.js';
import { DEFAULT_CATEGORIES } from '../../db/seeds/categories.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const BCRYPT_COST = 12;
const REMEMBER_ME_EXPIRES_IN = '30d';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  rememberMe: boolean;
}

export class AuthService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const [existing] = await this.db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (existing) {
      throw new AppError(403, 'REGISTRATION_CLOSED', 'A user already exists on this instance');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const [user] = await this.db
      .insert(schema.users)
      .values({ email: input.email, passwordHash, name: input.name })
      .returning();
    if (!user) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user');

    await this.createDefaultSavingsGoals(user.id);
    await this.createDefaultCategories(user.id);

    return this.issueTokens(user.id, user.email, false, user.isDemo);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, input.email));
    if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    return this.issueTokens(user.id, user.email, input.rememberMe, user.isDemo);
  }

  async refresh(rawToken: string | undefined): Promise<AuthTokens> {
    if (!rawToken) throw new AppError(401, 'UNAUTHORIZED', 'Missing refresh token');

    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, tokenHash),
          isNull(schema.refreshTokens.revokedAt),
          gt(schema.refreshTokens.expiresAt, now),
        ),
      );
    if (!row) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');

    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: now })
      .where(eq(schema.refreshTokens.id, row.id));

    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, row.userId));
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');

    return this.issueTokens(user.id, user.email, row.rememberMe, user.isDemo);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)),
      );
  }

  /**
   * Base.md: "Objectifs préconfigurés à la création du compte", target = avg
   * monthly expense over the last 3 months × 6 or × 12. A brand-new user has
   * no transaction history yet, so both targets are necessarily 0 for now —
   * there is no recompute endpoint yet to refresh them once transactions exist.
   */
  private async createDefaultSavingsGoals(userId: string): Promise<void> {
    await this.db.insert(schema.savingsGoals).values([
      {
        userId,
        name: 'Épargne de précaution 6 mois',
        type: 'emergency_fund',
        targetAmount: 0,
        currentAmount: 0,
      },
      {
        userId,
        name: 'Épargne de précaution 1 an',
        type: 'emergency_fund',
        targetAmount: 0,
        currentAmount: 0,
      },
    ]);
  }

  /** FEAT-01 (docs/feat1.md): default expense/income categories seeded at
   * registration, `isDefault: true` so they can't be deleted later. */
  private async createDefaultCategories(userId: string): Promise<void> {
    await this.db.insert(schema.categories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        userId,
        name: c.name,
        type: c.type,
        color: c.color,
        icon: c.icon,
        isDefault: true,
      })),
    );
  }

  private async issueTokens(
    userId: string,
    email: string,
    rememberMe = false,
    isDemo = false,
  ): Promise<AuthTokens> {
    const accessToken = jwt.sign({ sub: userId, email, isDemo }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresAt = new Date(
      Date.now() + parseDurationMs(rememberMe ? REMEMBER_ME_EXPIRES_IN : env.REFRESH_TOKEN_EXPIRES_IN),
    );

    await this.db.insert(schema.refreshTokens).values({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      rememberMe,
    });

    return { accessToken, refreshToken, refreshTokenExpiresAt, rememberMe };
  }
}
