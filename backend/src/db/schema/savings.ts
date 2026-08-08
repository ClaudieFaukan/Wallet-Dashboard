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
