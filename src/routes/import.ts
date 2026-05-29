import { Router, type Router as RouterT } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parseImportRow } from '../services/csv-import.js';

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

export const importRouter: RouterT = Router();
importRouter.use(requireAuth);

const previewSchema = z.object({
  delimiter: z.string().max(2).default(','),
});

importRouter.post('/preview', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'NO_FILE', 'CSV file is required');
    const { delimiter } = previewSchema.parse(req.body ?? {});
    const records = parse(req.file.buffer, {
      delimiter,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }) as string[][];
    const header = records[0] ?? [];
    const rows = records.slice(1, 21);
    res.json({ header, rows, totalRows: records.length - 1 });
  } catch (err) {
    next(err);
  }
});

const commitSchema = z.object({
  delimiter: z.string().max(2).default(','),
  accountId: z.string(),
  defaultCategoryId: z.string(),
  mapping: z.object({
    date: z.number().int(),
    amount: z.number().int(),
    note: z.number().int().optional(),
    type: z.number().int().optional(),
  }),
  amountSign: z.enum(['positive_income', 'sign_based']).default('sign_based'),
});

importRouter.post('/commit', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'NO_FILE', 'CSV file is required');
    const body = commitSchema.parse(JSON.parse(req.body.config));
    const records = parse(req.file.buffer, {
      delimiter: body.delimiter,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }) as string[][];
    const dataRows = records.slice(1);

    const account = await prisma.account.findFirst({
      where: { id: body.accountId, userId: req.userId! },
    });
    if (!account) throw new HttpError(400, 'INVALID_ACCOUNT', 'Account not found');
    const category = await prisma.category.findFirst({
      where: { id: body.defaultCategoryId, userId: req.userId! },
    });
    if (!category) throw new HttpError(400, 'INVALID_CATEGORY', 'Category not found');

    let inserted = 0;
    const errors: { row: number; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]!;
        const parsed = parseImportRow(row, body.mapping, body.amountSign);
        if (!parsed.ok) {
          errors.push({ row: i + 2, reason: parsed.reason });
          continue;
        }
        try {
          await tx.transaction.create({
            data: {
              userId: req.userId!,
              accountId: body.accountId,
              categoryId: body.defaultCategoryId,
              amount: parsed.amount,
              type: parsed.type,
              date: parsed.date,
              note: parsed.note,
            },
          });
          inserted++;
        } catch (e) {
          errors.push({ row: i + 2, reason: (e as Error).message });
        }
      }
    });

    res.json({ inserted, errors });
  } catch (err) {
    next(err);
  }
});

