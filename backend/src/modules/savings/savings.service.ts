import { and, asc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateSavingsGoalInput,
  UpdateDepositInput,
  UpdateSavingsGoalInput,
} from './savings.schema.js';

// Milestones aren't enumerated in base.md beyond "vérification automatique des
// jalons à chaque dépôt" — percentage checkpoints of the target are a
// reasonable, common goal-tracking pattern, chosen here as the concrete rule.
const MILESTONE_PERCENTAGES = [25, 50, 75, 100];

type SavingsGoal = typeof schema.savingsGoals.$inferSelect;

export class SavingsService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async list(userId: string) {
    return this.db.select().from(schema.savingsGoals).where(eq(schema.savingsGoals.userId, userId));
  }

  async create(userId: string, input: CreateSavingsGoalInput) {
    const [goal] = await this.db
      .insert(schema.savingsGoals)
      .values({ userId, currentAmount: 0, ...input })
      .returning();
    return goal;
  }

  async getById(userId: string, id: string): Promise<SavingsGoal> {
    const [goal] = await this.db
      .select()
      .from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, userId)));
    if (!goal) throw new AppError(404, 'SAVINGS_GOAL_NOT_FOUND', 'Savings goal not found');
    return goal;
  }

  async update(userId: string, id: string, input: UpdateSavingsGoalInput) {
    await this.getById(userId, id);
    const [goal] = await this.db
      .update(schema.savingsGoals)
      .set(input)
      .where(eq(schema.savingsGoals.id, id))
      .returning();
    return goal;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.id, id));
  }

  async deposit(userId: string, id: string, amount: number) {
    await this.getById(userId, id);
    await this.db.insert(schema.savingsDeposits).values({ goalId: id, amount });
    const updated = await this.recomputeCurrentAmount(id);

    const reachedMilestones = await this.checkMilestones(updated);
    return { goal: updated, reachedMilestones };
  }

  async listDeposits(userId: string, id: string) {
    await this.getById(userId, id);
    return this.db
      .select()
      .from(schema.savingsDeposits)
      .where(eq(schema.savingsDeposits.goalId, id))
      .orderBy(asc(schema.savingsDeposits.date));
  }

  async updateDeposit(userId: string, goalId: string, depositId: string, input: UpdateDepositInput) {
    await this.getDepositOrThrow(userId, goalId, depositId);
    const [deposit] = await this.db
      .update(schema.savingsDeposits)
      .set({
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
      })
      .where(eq(schema.savingsDeposits.id, depositId))
      .returning();
    if (!deposit) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update savings deposit');

    const updatedGoal = await this.recomputeCurrentAmount(goalId);
    await this.checkMilestones(updatedGoal);
    return deposit;
  }

  async deleteDeposit(userId: string, goalId: string, depositId: string): Promise<void> {
    await this.getDepositOrThrow(userId, goalId, depositId);
    await this.db.delete(schema.savingsDeposits).where(eq(schema.savingsDeposits.id, depositId));
    await this.recomputeCurrentAmount(goalId);
  }

  private async getDepositOrThrow(userId: string, goalId: string, depositId: string) {
    await this.getById(userId, goalId);
    const [deposit] = await this.db
      .select()
      .from(schema.savingsDeposits)
      .where(and(eq(schema.savingsDeposits.id, depositId), eq(schema.savingsDeposits.goalId, goalId)));
    if (!deposit) throw new AppError(404, 'SAVINGS_DEPOSIT_NOT_FOUND', 'Savings deposit not found');
    return deposit;
  }

  // currentAmount always mirrors sum(deposits.amount) for the goal — recomputed from
  // scratch after every add/edit/delete rather than tracked as a running delta, so it
  // can never drift (mirrors InvestmentsService.recomputeCurrentValue's approach).
  private async recomputeCurrentAmount(goalId: string): Promise<SavingsGoal> {
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${schema.savingsDeposits.amount}), 0)::int` })
      .from(schema.savingsDeposits)
      .where(eq(schema.savingsDeposits.goalId, goalId));

    const [updated] = await this.db
      .update(schema.savingsGoals)
      .set({ currentAmount: row?.total ?? 0 })
      .where(eq(schema.savingsGoals.id, goalId))
      .returning();
    if (!updated) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update savings goal');
    return updated;
  }

  async getMilestones(userId: string, id: string) {
    const goal = await this.getById(userId, id);
    const reached = await this.db
      .select()
      .from(schema.savingsMilestones)
      .where(eq(schema.savingsMilestones.goalId, id))
      .orderBy(schema.savingsMilestones.targetAmount);

    // Mirrors checkMilestones()'s own early-out — a target of 0 never crosses a percentage.
    if (goal.targetAmount <= 0) return { reached, next: [] };

    const reachedNames = new Set(reached.map((m) => m.name));
    const next = MILESTONE_PERCENTAGES.filter((p) => !reachedNames.has(`${p}%`)).map((p) => {
      const amount = Math.round((goal.targetAmount * p) / 100);
      return {
        percentage: p,
        amount,
        progress: Math.min(goal.currentAmount / amount, 1),
        missingAmount: Math.max(amount - goal.currentAmount, 0),
      };
    });

    return { reached, next };
  }

  private async checkMilestones(goal: SavingsGoal) {
    if (goal.targetAmount <= 0) return [];

    const currentPercent = (goal.currentAmount / goal.targetAmount) * 100;
    const crossedPercentages = MILESTONE_PERCENTAGES.filter((p) => currentPercent >= p);
    if (crossedPercentages.length === 0) return [];

    const existing = await this.db
      .select({ name: schema.savingsMilestones.name })
      .from(schema.savingsMilestones)
      .where(eq(schema.savingsMilestones.goalId, goal.id));
    const existingNames = new Set(existing.map((m) => m.name));

    const newMilestones = crossedPercentages
      .map((p) => ({
        goalId: goal.id,
        name: `${p}%`,
        targetAmount: Math.round((goal.targetAmount * p) / 100),
        reachedAt: new Date(),
      }))
      .filter((m) => !existingNames.has(m.name));

    if (newMilestones.length === 0) return [];

    return this.db.insert(schema.savingsMilestones).values(newMilestones).returning();
  }
}
