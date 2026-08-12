import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const savingsGoalTypeEnum = pgEnum('savings_goal_type', ['emergency_fund', 'custom']);

export const savingsGoals = pgTable('savings_goals', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  currentAmount: integer('current_amount').notNull().default(0),
  // Bank account number detected on a PDF statement import — lets a future
  // import of the same livret auto-suggest this goal as the target again.
  accountNumber: text('account_number'),
  deadline: date('deadline'),
  color: text('color'),
  icon: text('icon'),
  type: savingsGoalTypeEnum('type').notNull().default('custom'),
  ...timestamps,
});

export const savingsMilestones = pgTable('savings_milestones', {
  id: id(),
  goalId: uuid('goal_id')
    .notNull()
    .references(() => savingsGoals.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  reachedAt: timestamp('reached_at', { withTimezone: true }),
  ...timestamps,
});

// Individual deposit events, so the frontend can render a mini timeline per
// goal — savingsGoals.currentAmount only ever stores the running total.
export const savingsDeposits = pgTable('savings_deposits', {
  id: id(),
  goalId: uuid('goal_id')
    .notNull()
    .references(() => savingsGoals.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  ...timestamps,
});
