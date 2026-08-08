import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { CreateSavingsGoalInput, UpdateSavingsGoalInput } from './savings.schema.js';

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
    const goal = await this.getById(userId, id);
    const newAmount = goal.currentAmount + amount;

    const [updated] = await this.db
      .update(schema.savingsGoals)
      .set({ currentAmount: newAmount })
      .where(eq(schema.savingsGoals.id, id))
      .returning();
    if (!updated) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update savings goal');

    await this.db.insert(schema.savingsDeposits).values({ goalId: id, amount });

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
