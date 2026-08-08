import { date, integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';
import { categories } from './transactions.js';

export const budgetPeriods = pgTable(
  'budget_periods',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: date('month').notNull(),
    totalIncome: integer('total_income').notNull().default(0),
    totalPlanned: integer('total_planned').notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex('budget_periods_user_month_idx').on(table.userId, table.month)],
);

export const budgetLines = pgTable('budget_lines', {
  id: id(),
  budgetPeriodId: uuid('budget_period_id')
    .notNull()
    .references(() => budgetPeriods.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  plannedAmount: integer('planned_amount').notNull().default(0),
  actualAmount: integer('actual_amount').notNull().default(0),
  ...timestamps,
});
