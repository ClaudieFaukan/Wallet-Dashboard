import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const createCreditSchema = z.object({
  name: z.string().min(1),
  institution: z.string().min(1),
  initialAmount: z.number().int().positive(),
  remainingAmount: z.number().int().nonnegative(),
  monthlyPayment: z.number().int().positive(),
  // Fraction, not a percentage (0.035 = 3.5%) — same convention as investments' annualRate.
  interestRate: z.number().min(0).max(1),
  startDate: isoDate,
  endDate: isoDate,
  earlyRepaymentFeeRate: z.number().min(0).max(1).default(0),
  currency: z.string().length(3).default('EUR'),
});
export type CreateCreditInput = z.infer<typeof createCreditSchema>;

export const updateCreditSchema = createCreditSchema.partial();
export type UpdateCreditInput = z.infer<typeof updateCreditSchema>;

export const recordPaymentSchema = z.object({
  date: isoDate,
  amount: z.number().int().positive(),
  principalPart: z.number().int().nonnegative(),
  interestPart: z.number().int().nonnegative(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const simulationQuerySchema = z.object({
  earlyRepaymentDate: isoDate,
});
export type SimulationQuery = z.infer<typeof simulationQuerySchema>;
