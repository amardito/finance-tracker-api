import { beforeAll, describe, expect, it } from 'vitest';
import type { SetupTemplate } from '../src/services/setup-templates.js';

describe('setup templates', () => {
  let templates: SetupTemplate[];

  beforeAll(async () => {
    process.env.SESSION_SECRET ||= 'test-secret-must-be-at-least-32-bytes-long-okay';
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    const mod = await import('../src/services/setup-templates.js');
    templates = mod.listSetupTemplates();
  });

  it('ships the six approved v1 templates', () => {
    expect(templates.map((template) => template.id)).toEqual([
      'minimal_personal_cashflow',
      'full_time_worker',
      'full_time_freelance_programmer',
      'freelancer',
      'fresh_fish_seller',
      'generic_small_business',
    ]);
  });

  it('each template defines accounts, income and expense categories, tags, recurring suggestions, and insights', () => {
    for (const template of templates) {
      expect(template.accounts.length).toBeGreaterThan(0);
      expect(template.categories.some((category) => category.type === 'INCOME')).toBe(true);
      expect(template.categories.some((category) => category.type === 'EXPENSE')).toBe(true);
      expect(template.tags.length).toBeGreaterThan(0);
      expect(Array.isArray(template.recurringRules)).toBe(true);
      expect(template.insightPriorities.length).toBeGreaterThan(0);
      expect(template.name.id.length).toBeGreaterThan(0);
      expect(template.name.en.length).toBeGreaterThan(0);
    }
  });

  it('fish seller template covers stock, procurement, gas, ice, packaging, and sales', () => {
    const fish = templates.find((template) => template.id === 'fresh_fish_seller');
    expect(fish).toBeDefined();
    const keys = fish!.categories.map((category) => category.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'fish_sales',
        'fish_stock_purchase',
        'procurement_replenishment',
        'gas_transport',
        'ice_cooling',
        'packaging',
      ]),
    );
  });

  it('programmer template covers salary, freelance, MRR, server, hosting/domain, and software tools', () => {
    const programmer = templates.find((template) => template.id === 'full_time_freelance_programmer');
    expect(programmer).toBeDefined();
    const keys = programmer!.categories.map((category) => category.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'salary',
        'freelance_project',
        'mrr',
        'server_subscription',
        'hosting_domain',
        'software_tools',
      ]),
    );
  });
});
