import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'investment']),
  institution: z.string().optional(),
  balance: z.number().int().default(0),
  currency: z.string().length(3).default('EUR'),
  color: z.string().optional(),
  icon: z.string().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const balanceHistoryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(3650).default(30),
});
export type BalanceHistoryQuery = z.infer<typeof balanceHistoryQuerySchema>;

// A PDF statement section can land in three different domain modules, not just
// `accounts`: a livret (LEP, Livret A...) is fundamentally a savings goal, and
// a PEA/brokerage cash pocket belongs with the rest of that broker's
// investment tracking rather than as a bare bank account. Each variant is
// either "use this existing entity" or "create a new one" — never both.
export const pdfImportTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('skip') }),
  z
    .object({
      type: z.literal('account'),
      accountId: z.string().uuid().optional(),
      createAccount: z
        .object({ name: z.string().min(1), type: z.enum(['checking', 'savings', 'investment']) })
        .optional(),
    })
    .refine((v) => Boolean(v.accountId) !== Boolean(v.createAccount), {
      message: 'Provide exactly one of accountId or createAccount',
    }),
  z
    .object({
      type: z.literal('savings_goal'),
      goalId: z.string().uuid().optional(),
      createGoal: z
        .object({ name: z.string().min(1), targetAmount: z.number().int().positive() })
        .optional(),
    })
    .refine((v) => Boolean(v.goalId) !== Boolean(v.createGoal), {
      message: 'Provide exactly one of goalId or createGoal',
    }),
  z
    .object({
      type: z.literal('investment_account'),
      investmentAccountId: z.string().uuid().optional(),
      createInvestmentAccount: z
        .object({ name: z.string().min(1), platform: z.string().optional() })
        .optional(),
    })
    .refine((v) => Boolean(v.investmentAccountId) !== Boolean(v.createInvestmentAccount), {
      message: 'Provide exactly one of investmentAccountId or createInvestmentAccount',
    }),
]);
export type PdfImportTarget = z.infer<typeof pdfImportTargetSchema>;

export const pdfImportMappingItemSchema = z.object({
  accountNumber: z.string().min(1),
  target: pdfImportTargetSchema,
});

export const pdfImportConfirmSchema = z.object({
  mapping: z.array(pdfImportMappingItemSchema).min(1),
});
export type PdfImportConfirmInput = z.infer<typeof pdfImportConfirmSchema>;
