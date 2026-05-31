import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/error.js';

export type LocalizedText = {
  id: string;
  en: string;
};

export type SetupTemplate = {
  id: string;
  version: number;
  localeDefault: 'id' | 'en';
  name: LocalizedText;
  description: LocalizedText;
  appliesTo: string[];
  accounts: Array<{
    key: string;
    name: LocalizedText;
    type: 'CASH' | 'CHECKING' | 'SAVINGS' | 'CREDIT';
    purpose?: string;
  }>;
  categories: Array<{
    key: string;
    name: LocalizedText;
    type: 'INCOME' | 'EXPENSE';
    color: string;
    icon?: string;
  }>;
  tags: Array<{ key: string; name: string; color: string }>;
  recurringRules: Array<{
    key: string;
    enabledByDefault: boolean;
    type: 'INCOME' | 'EXPENSE';
    cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    interval: number;
    accountKey?: string;
    categoryKey: string;
    note: LocalizedText;
  }>;
  defaults: {
    defaultCurrency: string;
    defaultSpendingAccountKey?: string;
    defaultIncomeAccountKey?: string;
    categoryFallbacks: { income: string; expense: string };
  };
  insightPriorities: string[];
  exampleCommands: LocalizedText[];
};

const personalBase = {
  tags: [{ key: 'personal', name: 'personal', color: '#94a3b8' }],
  defaults: {
    defaultCurrency: 'IDR',
    defaultSpendingAccountKey: 'cash',
    defaultIncomeAccountKey: 'bank',
    categoryFallbacks: { income: 'income', expense: 'other_expense' },
  },
};

export const setupTemplates: SetupTemplate[] = [
  {
    id: 'minimal_personal_cashflow',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Cashflow personal minimal', en: 'Minimal personal cashflow' },
    description: {
      id: 'Setup ringan untuk pemasukan, pengeluaran harian, dan tagihan.',
      en: 'Light setup for income, daily spending, and bills.',
    },
    appliesTo: ['personal'],
    accounts: [
      { key: 'cash', name: { id: 'Tunai', en: 'Cash' }, type: 'CASH', purpose: 'daily_spending' },
      { key: 'bank', name: { id: 'Bank utama', en: 'Main bank' }, type: 'CHECKING', purpose: 'daily_spending' },
    ],
    categories: [
      { key: 'income', name: { id: 'Pemasukan', en: 'Income' }, type: 'INCOME', color: '#10b981', icon: 'plus-circle' },
      { key: 'daily', name: { id: 'Harian', en: 'Daily spending' }, type: 'EXPENSE', color: '#f59e0b', icon: 'shopping-cart' },
      { key: 'bills', name: { id: 'Tagihan', en: 'Bills' }, type: 'EXPENSE', color: '#3b82f6', icon: 'receipt' },
      { key: 'other_expense', name: { id: 'Lainnya', en: 'Other expense' }, type: 'EXPENSE', color: '#64748b', icon: 'circle' },
    ],
    tags: personalBase.tags,
    recurringRules: [],
    defaults: personalBase.defaults,
    insightPriorities: ['daily_spending', 'monthly_cashflow', 'uncategorized'],
    exampleCommands: [{ id: 'makan 25000 tunai', en: 'lunch 25000 cash' }],
  },
  {
    id: 'full_time_worker',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Karyawan full-time', en: 'Full-time worker' },
    description: {
      id: 'Untuk gaji tetap, pengeluaran harian, tagihan, dan tabungan.',
      en: 'For fixed salary, daily spending, bills, and savings.',
    },
    appliesTo: ['personal', 'fixed_paycheck'],
    accounts: [
      { key: 'salary_bank', name: { id: 'Bank gaji', en: 'Salary bank' }, type: 'CHECKING', purpose: 'daily_spending' },
      { key: 'daily_wallet', name: { id: 'Dompet harian', en: 'Daily wallet' }, type: 'CASH', purpose: 'daily_spending' },
      { key: 'savings', name: { id: 'Tabungan', en: 'Savings' }, type: 'SAVINGS', purpose: 'savings' },
    ],
    categories: [
      { key: 'salary', name: { id: 'Gaji', en: 'Salary' }, type: 'INCOME', color: '#10b981', icon: 'briefcase' },
      { key: 'bonus', name: { id: 'Bonus', en: 'Bonus' }, type: 'INCOME', color: '#14b8a6', icon: 'gift' },
      { key: 'food_daily', name: { id: 'Makan & harian', en: 'Food & daily' }, type: 'EXPENSE', color: '#f59e0b', icon: 'utensils' },
      { key: 'transport', name: { id: 'Transport', en: 'Transport' }, type: 'EXPENSE', color: '#8b5cf6', icon: 'car' },
      { key: 'personal_bills', name: { id: 'Tagihan pribadi', en: 'Personal bills' }, type: 'EXPENSE', color: '#3b82f6', icon: 'receipt' },
    ],
    tags: [
      ...personalBase.tags,
      { key: 'work', name: 'work', color: '#60a5fa' },
    ],
    recurringRules: [
      { key: 'monthly_salary', enabledByDefault: false, type: 'INCOME', cadence: 'MONTHLY', interval: 1, accountKey: 'salary_bank', categoryKey: 'salary', note: { id: 'Gaji bulanan', en: 'Monthly salary' } },
    ],
    defaults: {
      defaultCurrency: 'IDR',
      defaultSpendingAccountKey: 'daily_wallet',
      defaultIncomeAccountKey: 'salary_bank',
      categoryFallbacks: { income: 'salary', expense: 'food_daily' },
    },
    insightPriorities: ['salary_cashflow', 'bill_pace', 'savings_rate'],
    exampleCommands: [{ id: 'gaji 8500000 masuk bank gaji', en: 'salary 8500000 to salary bank' }],
  },
  {
    id: 'full_time_freelance_programmer',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Karyawan + freelance programmer', en: 'Full-time + freelance programmer' },
    description: {
      id: 'Untuk gaji tetap, proyek freelance, MRR, dan biaya tools/server.',
      en: 'For salary, freelance projects, MRR, and tool/server expenses.',
    },
    appliesTo: ['personal', 'fixed_paycheck', 'freelancer', 'programmer'],
    accounts: [
      { key: 'salary_bank', name: { id: 'Bank gaji', en: 'Salary bank' }, type: 'CHECKING' },
      { key: 'freelance_bank', name: { id: 'Bank freelance', en: 'Freelance bank' }, type: 'CHECKING' },
      { key: 'daily_e_money', name: { id: 'E-money harian', en: 'Daily e-money' }, type: 'CASH' },
      { key: 'savings', name: { id: 'Tabungan', en: 'Savings' }, type: 'SAVINGS' },
    ],
    categories: [
      { key: 'salary', name: { id: 'Gaji', en: 'Salary' }, type: 'INCOME', color: '#10b981', icon: 'briefcase' },
      { key: 'freelance_project', name: { id: 'Proyek freelance', en: 'Freelance project' }, type: 'INCOME', color: '#14b8a6', icon: 'code' },
      { key: 'mrr', name: { id: 'MRR / produk', en: 'MRR / product revenue' }, type: 'INCOME', color: '#06b6d4', icon: 'repeat' },
      { key: 'server_subscription', name: { id: 'Server', en: 'Server subscription' }, type: 'EXPENSE', color: '#6366f1', icon: 'server' },
      { key: 'hosting_domain', name: { id: 'Hosting & domain', en: 'Hosting & domain' }, type: 'EXPENSE', color: '#8b5cf6', icon: 'globe' },
      { key: 'software_tools', name: { id: 'Software tools', en: 'Software tools' }, type: 'EXPENSE', color: '#3b82f6', icon: 'wrench' },
      { key: 'internet', name: { id: 'Internet', en: 'Internet' }, type: 'EXPENSE', color: '#0ea5e9', icon: 'wifi' },
      { key: 'daily', name: { id: 'Harian', en: 'Daily spending' }, type: 'EXPENSE', color: '#f59e0b', icon: 'shopping-cart' },
    ],
    tags: ['fulltime', 'freelance', 'mrr', 'project', 'client', 'software', 'server', 'personal'].map((name) => ({
      key: name,
      name,
      color: '#94a3b8',
    })),
    recurringRules: [
      { key: 'monthly_salary', enabledByDefault: false, type: 'INCOME', cadence: 'MONTHLY', interval: 1, accountKey: 'salary_bank', categoryKey: 'salary', note: { id: 'Gaji bulanan', en: 'Monthly salary' } },
      { key: 'server_monthly', enabledByDefault: false, type: 'EXPENSE', cadence: 'MONTHLY', interval: 1, accountKey: 'freelance_bank', categoryKey: 'server_subscription', note: { id: 'Langganan server', en: 'Server subscription' } },
    ],
    defaults: {
      defaultCurrency: 'IDR',
      defaultSpendingAccountKey: 'daily_e_money',
      defaultIncomeAccountKey: 'salary_bank',
      categoryFallbacks: { income: 'freelance_project', expense: 'daily' },
    },
    insightPriorities: ['salary_vs_freelance', 'mrr_trend', 'server_cost_ratio', 'savings_rate'],
    exampleCommands: [
      { id: 'freelance 1500000 client A logo project', en: 'freelance income 1500000 client A logo project' },
      { id: 'server 180000 bayar bank freelance', en: 'server subscription 180000 paid with freelance bank' },
    ],
  },
  {
    id: 'freelancer',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Freelancer', en: 'Freelancer' },
    description: {
      id: 'Untuk pemasukan proyek, retainer, payout platform, dan biaya kerja.',
      en: 'For project income, retainers, platform payouts, and work expenses.',
    },
    appliesTo: ['freelancer'],
    accounts: [
      { key: 'project_bank', name: { id: 'Bank proyek', en: 'Project bank' }, type: 'CHECKING' },
      { key: 'daily_wallet', name: { id: 'Dompet harian', en: 'Daily wallet' }, type: 'CASH' },
      { key: 'tax_savings', name: { id: 'Pajak & tabungan', en: 'Tax & savings' }, type: 'SAVINGS' },
    ],
    categories: [
      { key: 'project_payment', name: { id: 'Pembayaran proyek', en: 'Project payment' }, type: 'INCOME', color: '#10b981', icon: 'briefcase' },
      { key: 'retainer', name: { id: 'Retainer', en: 'Retainer' }, type: 'INCOME', color: '#14b8a6', icon: 'repeat' },
      { key: 'software_tools', name: { id: 'Software tools', en: 'Software tools' }, type: 'EXPENSE', color: '#3b82f6', icon: 'wrench' },
      { key: 'coworking', name: { id: 'Coworking', en: 'Coworking' }, type: 'EXPENSE', color: '#8b5cf6', icon: 'building' },
      { key: 'tax_admin', name: { id: 'Pajak & admin', en: 'Tax & admin' }, type: 'EXPENSE', color: '#ef4444', icon: 'file-text' },
    ],
    tags: ['client', 'project', 'retainer', 'tax', 'business', 'personal'].map((name) => ({
      key: name,
      name,
      color: '#94a3b8',
    })),
    recurringRules: [
      { key: 'retainer_monthly', enabledByDefault: false, type: 'INCOME', cadence: 'MONTHLY', interval: 1, accountKey: 'project_bank', categoryKey: 'retainer', note: { id: 'Retainer bulanan', en: 'Monthly retainer' } },
    ],
    defaults: {
      defaultCurrency: 'IDR',
      defaultSpendingAccountKey: 'daily_wallet',
      defaultIncomeAccountKey: 'project_bank',
      categoryFallbacks: { income: 'project_payment', expense: 'software_tools' },
    },
    insightPriorities: ['client_income_mix', 'tax_reserve', 'business_vs_personal'],
    exampleCommands: [{ id: 'proyek 3000000 client B masuk bank proyek', en: 'project 3000000 client B to project bank' }],
  },
  {
    id: 'fresh_fish_seller',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Penjual ikan segar', en: 'Fresh fish seller' },
    description: {
      id: 'Untuk penjualan ikan, pembelian stok, bensin, es, packaging, dan kas toko.',
      en: 'For fish sales, stock purchases, gas, ice, packaging, and shop cash.',
    },
    appliesTo: ['small_business', 'fish_seller'],
    accounts: [
      { key: 'shop_cash', name: { id: 'Kas toko', en: 'Shop cash' }, type: 'CASH', purpose: 'business_cash' },
      { key: 'business_bank', name: { id: 'Bank usaha', en: 'Business bank' }, type: 'CHECKING', purpose: 'business_bank' },
      { key: 'e_money_transfer', name: { id: 'E-money / transfer', en: 'E-money / transfer' }, type: 'CASH' },
      { key: 'owner_personal', name: { id: 'Pribadi owner', en: 'Owner personal' }, type: 'CASH' },
    ],
    categories: [
      { key: 'fish_sales', name: { id: 'Penjualan ikan', en: 'Fish sales' }, type: 'INCOME', color: '#10b981', icon: 'store' },
      { key: 'delivery_sales', name: { id: 'Penjualan delivery', en: 'Delivery sales' }, type: 'INCOME', color: '#14b8a6', icon: 'truck' },
      { key: 'wholesale_sales', name: { id: 'Penjualan grosir', en: 'Wholesale sales' }, type: 'INCOME', color: '#06b6d4', icon: 'boxes' },
      { key: 'fish_stock_purchase', name: { id: 'Beli stok ikan', en: 'Fish stock purchase' }, type: 'EXPENSE', color: '#0ea5e9', icon: 'shopping-basket' },
      { key: 'procurement_replenishment', name: { id: 'Belanja ulang / kulakan', en: 'Procurement / replenishment' }, type: 'EXPENSE', color: '#3b82f6', icon: 'refresh-cw' },
      { key: 'gas_transport', name: { id: 'Bensin / transport', en: 'Gas / transport' }, type: 'EXPENSE', color: '#8b5cf6', icon: 'car' },
      { key: 'ice_cooling', name: { id: 'Es / pendingin', en: 'Ice / cooling' }, type: 'EXPENSE', color: '#38bdf8', icon: 'snowflake' },
      { key: 'packaging', name: { id: 'Packaging', en: 'Packaging' }, type: 'EXPENSE', color: '#f59e0b', icon: 'package' },
      { key: 'shop_rent', name: { id: 'Sewa toko', en: 'Shop rent' }, type: 'EXPENSE', color: '#ef4444', icon: 'home' },
      { key: 'electricity', name: { id: 'Listrik', en: 'Electricity' }, type: 'EXPENSE', color: '#eab308', icon: 'zap' },
      { key: 'spoilage_loss', name: { id: 'Rusak / susut', en: 'Spoilage / loss' }, type: 'EXPENSE', color: '#64748b', icon: 'alert-triangle' },
    ],
    tags: ['stock', 'supplier', 'farmer', 'retail', 'shop', 'delivery', 'operational', 'personal_draw'].map((name) => ({
      key: name,
      name,
      color: '#94a3b8',
    })),
    recurringRules: [
      { key: 'shop_rent_monthly', enabledByDefault: false, type: 'EXPENSE', cadence: 'MONTHLY', interval: 1, accountKey: 'business_bank', categoryKey: 'shop_rent', note: { id: 'Sewa toko bulanan', en: 'Monthly shop rent' } },
    ],
    defaults: {
      defaultCurrency: 'IDR',
      defaultSpendingAccountKey: 'shop_cash',
      defaultIncomeAccountKey: 'shop_cash',
      categoryFallbacks: { income: 'fish_sales', expense: 'fish_stock_purchase' },
    },
    insightPriorities: ['daily_sales_vs_stock', 'operating_cost_trend', 'cash_on_hand', 'simple_profit'],
    exampleCommands: [
      { id: 'beli stok ikan 750000 dari supplier A cash', en: 'fish stock purchase 750000 from supplier A cash' },
      { id: 'jual ikan 1200000 hari ini masuk kas toko', en: 'fish sales 1200000 today to shop cash' },
    ],
  },
  {
    id: 'generic_small_business',
    version: 1,
    localeDefault: 'id',
    name: { id: 'Usaha kecil umum', en: 'Generic small business' },
    description: {
      id: 'Untuk penjualan, stok, operasional, staff, dan kas usaha.',
      en: 'For sales, stock, operations, staff, and business cash.',
    },
    appliesTo: ['small_business'],
    accounts: [
      { key: 'business_cash', name: { id: 'Kas usaha', en: 'Business cash' }, type: 'CASH' },
      { key: 'business_bank', name: { id: 'Bank usaha', en: 'Business bank' }, type: 'CHECKING' },
      { key: 'e_money_pos', name: { id: 'E-money / POS', en: 'E-money / POS' }, type: 'CASH' },
      { key: 'owner_personal', name: { id: 'Pribadi owner', en: 'Owner personal' }, type: 'CASH' },
    ],
    categories: [
      { key: 'sales', name: { id: 'Penjualan', en: 'Sales' }, type: 'INCOME', color: '#10b981', icon: 'store' },
      { key: 'services', name: { id: 'Jasa', en: 'Services' }, type: 'INCOME', color: '#14b8a6', icon: 'handshake' },
      { key: 'inventory_procurement', name: { id: 'Stok / kulakan', en: 'Inventory / procurement' }, type: 'EXPENSE', color: '#3b82f6', icon: 'boxes' },
      { key: 'packaging', name: { id: 'Packaging', en: 'Packaging' }, type: 'EXPENSE', color: '#f59e0b', icon: 'package' },
      { key: 'delivery', name: { id: 'Delivery', en: 'Delivery' }, type: 'EXPENSE', color: '#8b5cf6', icon: 'truck' },
      { key: 'rent', name: { id: 'Sewa', en: 'Rent' }, type: 'EXPENSE', color: '#ef4444', icon: 'home' },
      { key: 'utilities', name: { id: 'Utilitas', en: 'Utilities' }, type: 'EXPENSE', color: '#eab308', icon: 'zap' },
      { key: 'staff_helper', name: { id: 'Staff / helper', en: 'Staff / helper' }, type: 'EXPENSE', color: '#ec4899', icon: 'users' },
    ],
    tags: ['business', 'sales', 'stock', 'operational', 'owner_draw', 'online', 'offline'].map((name) => ({
      key: name,
      name,
      color: '#94a3b8',
    })),
    recurringRules: [
      { key: 'rent_monthly', enabledByDefault: false, type: 'EXPENSE', cadence: 'MONTHLY', interval: 1, accountKey: 'business_bank', categoryKey: 'rent', note: { id: 'Sewa bulanan', en: 'Monthly rent' } },
    ],
    defaults: {
      defaultCurrency: 'IDR',
      defaultSpendingAccountKey: 'business_cash',
      defaultIncomeAccountKey: 'business_cash',
      categoryFallbacks: { income: 'sales', expense: 'inventory_procurement' },
    },
    insightPriorities: ['sales_trend', 'operating_costs', 'cash_on_hand', 'owner_draw'],
    exampleCommands: [{ id: 'penjualan 500000 masuk kas usaha', en: 'sales 500000 to business cash' }],
  },
];

export function listSetupTemplates(): SetupTemplate[] {
  return setupTemplates;
}

export function getSetupTemplate(id: string): SetupTemplate | undefined {
  return setupTemplates.find((template) => template.id === id);
}

export async function applySetupTemplate(userId: string, templateId: string) {
  const template = getSetupTemplate(templateId);
  if (!template) throw new HttpError(404, 'NOT_FOUND', 'Setup template not found');

  const result = await prisma.$transaction(async (tx) => {
    const created = {
      accounts: 0,
      categories: 0,
      tags: 0,
      recurringRules: 0,
    };

    const accountIds = new Map<string, string>();
    for (const account of template.accounts) {
      const name = account.name.id;
      const existing = await tx.account.findFirst({ where: { userId, name } });
      const row =
        existing ??
        (await tx.account.create({
          data: {
            userId,
            name,
            type: account.type,
            openingBalance: '0',
            currency: template.defaults.defaultCurrency,
          },
        }));
      if (!existing) created.accounts++;
      accountIds.set(account.key, row.id);
    }

    const categoryIds = new Map<string, string>();
    for (const category of template.categories) {
      const name = category.name.id;
      const existing = await tx.category.findFirst({
        where: { userId, name, parentId: null },
      });
      const row =
        existing ??
        (await tx.category.create({
          data: {
            userId,
            name,
            type: category.type,
            color: category.color,
            icon: category.icon,
          },
        }));
      if (!existing) created.categories++;
      categoryIds.set(category.key, row.id);
    }

    for (const tag of template.tags) {
      const existing = await tx.tag.findFirst({ where: { userId, name: tag.name } });
      if (!existing) {
        await tx.tag.create({
          data: { userId, name: tag.name, color: tag.color },
        });
        created.tags++;
      }
    }

    for (const rule of template.recurringRules) {
      if (!rule.enabledByDefault) continue;
      const accountId = rule.accountKey ? accountIds.get(rule.accountKey) : undefined;
      const categoryId = categoryIds.get(rule.categoryKey);
      if (!accountId || !categoryId) continue;
      const note = rule.note.id;
      const existing = await tx.recurringRule.findFirst({
        where: {
          userId,
          accountId,
          categoryId,
          cadence: rule.cadence,
          note,
        },
      });
      if (!existing) {
        await tx.recurringRule.create({
          data: {
            userId,
            accountId,
            categoryId,
            amount: '0',
            type: rule.type,
            cadence: rule.cadence,
            interval: rule.interval,
            note,
            startDate: new Date(),
            nextRunAt: new Date(),
          },
        });
        created.recurringRules++;
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: 'setup.apply_template',
        entity: 'SetupTemplate',
        entityId: template.id,
        payload: { templateId: template.id, version: template.version, created },
      },
    });

    return created;
  });

  return { templateId: template.id, version: template.version, created: result };
}
