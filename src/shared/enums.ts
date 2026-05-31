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

export const ASSISTANT_PROPOSAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'EXECUTED',
  'FAILED',
] as const;
export type AssistantProposalStatus = (typeof ASSISTANT_PROPOSAL_STATUSES)[number];

export const ASSISTANT_PROPOSAL_SOURCES = [
  'WEB_GUIDED',
  'WEB_AI',
  'CLAW_WHATSAPP',
  'RECEIPT_WORKER',
  'MCP',
] as const;
export type AssistantProposalSource = (typeof ASSISTANT_PROPOSAL_SOURCES)[number];

export const CLAW_MODES = ['NONE', 'PICO', 'NANO', 'OPEN'] as const;
export type ClawMode = (typeof CLAW_MODES)[number];

export const ASSISTANT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type AssistantRiskLevel = (typeof ASSISTANT_RISK_LEVELS)[number];

export const ASSISTANT_ACTION_TYPES = [
  'CREATE_TRANSACTION',
  'CREATE_SETUP',
  'CREATE_TRANSFER',
  'CREATE_BUDGET',
  'CREATE_GOAL',
  'CREATE_RECURRING_RULE',
  'BULK_CATEGORY_CHANGE',
  'RECEIPT_TRANSACTION',
] as const;
export type AssistantActionType = (typeof ASSISTANT_ACTION_TYPES)[number];
