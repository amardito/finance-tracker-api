import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { advance } from '../services/recurrence.js';

const MAX_BACKFILL = 100;

export async function runRecurringRule(ruleId: string): Promise<number> {
  let created = 0;
  await prisma.$transaction(async (tx) => {
    const rule = await tx.recurringRule.findUnique({ where: { id: ruleId } });
    if (!rule) return;
    if (rule.pausedAt) return;
    const now = new Date();
    let next = rule.nextRunAt;
    let last = rule.lastRunAt;
    for (let i = 0; i < MAX_BACKFILL; i++) {
      if (next > now) break;
      if (rule.endDate && next > rule.endDate) break;
      try {
        await tx.transaction.create({
          data: {
            userId: rule.userId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            amount: rule.amount,
            type: rule.type,
            date: next,
            note: rule.note,
            recurringRuleId: rule.id,
            scheduledFor: next,
          },
        });
        created++;
      } catch (e) {
        // Unique constraint -> already created; just advance
        const err = e as { code?: string };
        if (err?.code !== 'P2002') throw e;
      }
      last = next;
      next = advance(next, rule.cadence, rule.interval);
    }
    await tx.recurringRule.update({
      where: { id: rule.id },
      data: { nextRunAt: next, lastRunAt: last },
    });
  });
  return created;
}

export async function runDueRecurring(): Promise<number> {
  const due = await prisma.recurringRule.findMany({
    where: {
      pausedAt: null,
      nextRunAt: { lte: new Date() },
    },
    select: { id: true },
  });
  let total = 0;
  for (const r of due) total += await runRecurringRule(r.id);
  return total;
}

export function startRecurringCron(): void {
  // Hourly
  cron.schedule('0 * * * *', async () => {
    try {
      const n = await runDueRecurring();
      if (n > 0) logger.info({ created: n }, 'Recurring transactions created');
    } catch (err) {
      logger.error({ err }, 'Recurring cron failed');
    }
  });
  logger.info('Recurring cron scheduled (hourly)');
}
