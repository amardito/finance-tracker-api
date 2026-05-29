import DecimalPkg from 'decimal.js';
const Decimal: any = DecimalPkg;
type D = InstanceType<typeof Decimal>;
import { prisma } from '../lib/prisma.js';

export async function computeAccountBalance(userId: string, accountId: string): Promise<D> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { openingBalance: true },
  });
  if (!account) return new Decimal(0);
  const txs = await prisma.transaction.findMany({
    where: { userId, accountId, deletedAt: null },
    select: { amount: true, type: true },
  });
  let bal = new Decimal(account.openingBalance.toString());
  for (const t of txs) {
    const amt = new Decimal(t.amount.toString());
    bal = t.type === 'INCOME' ? bal.plus(amt) : bal.minus(amt);
  }
  return bal;
}

export async function computeNetWorth(userId: string): Promise<D> {
  const accounts = await prisma.account.findMany({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  let total = new Decimal(0);
  for (const a of accounts) {
    total = total.plus(await computeAccountBalance(userId, a.id));
  }
  return total;
}
