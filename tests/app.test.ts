import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// We exercise route construction without hitting Prisma by mocking the prisma module.
// This proves the app boots, routes are wired, and middleware ordering works.

import { vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    user: { count: vi.fn(async () => 0) },
  },
}));

// Provide a minimal SESSION_SECRET for config validation
process.env.SESSION_SECRET ||= 'test-secret-must-be-at-least-32-bytes-long-okay';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

let app: import('express').Express;

beforeAll(async () => {
  const mod = await import('../src/index.js');
  app = mod.createApp();
});

describe('app factory & health', () => {
  it('GET /api/health returns ok (liveness)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/ready returns ready when DB ping resolves', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('unknown route returns NOT_FOUND envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/auth/me returns 401 when not signed in (CSRF not required for GET)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHENTICATED');
  });

  it('POST without CSRF cookie+header is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/token/new')
      .send({ name: 'test' });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('CSRF');
  });
});
