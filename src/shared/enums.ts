export const ACCOUNT_TYPES = ['CASH', 'CHECKING', 'SAVINGS', 'CREDIT'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const BUDGET_PERIODS = ['WEEKLY', 'MONTHLY'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const CADENCES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type Cadence = (typeof CADENCES)[number];

export const GOAL_STATUSES = ['ACTIVE', 'DONE', 'ARCHIVED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
