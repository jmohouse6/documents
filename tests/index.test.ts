import { describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';

const baseUrl = 'http://localhost';
const testApiKey = 'test-api-key';

describe('Documents service', () => {
  it('GET /api/health returns ok', async () => {
    const response = await SELF.fetch(new URL('/api/health', baseUrl));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok', service: 'documents' });
  });

  it('POST /api/render without X-API-Key returns 401 AUTH_REQUIRED', async () => {
    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pay_app', id: 'no-auth', data: {} }),
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'AUTH_REQUIRED' });
  });

  it('POST /api/render with wrong X-API-Key returns 403 FORBIDDEN', async () => {
    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'wrong-key' },
      body: JSON.stringify({ type: 'pay_app', id: 'bad-auth', data: {} }),
    });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'FORBIDDEN' });
  });

  it('POST /api/render creates a pay_app PDF and GET streams it back', async () => {
    const payload = {
      type: 'pay_app',
      id: 'pa-test-001',
      data: {
        pay_app: {
          id: 'pa-test-001',
          contract_id: 'c-001',
          application_number: 1,
          period_start: '2026-07-01',
          period_end: '2026-07-31',
          total_completed_stored_cents: 100000,
          retainage_withheld_cents: 10000,
          previous_payments_cents: 0,
          current_payment_due_cents: 90000,
        },
        contract: {
          name: 'Moorhouse HQ repaint',
          gc_name: 'GC Builders',
        },
        lines: [
          {
            line_number: 1,
            description: 'Surface prep',
            cost_code: '01-100',
            scheduled_value_cents: 50000,
            work_completed_this_period_cents: 25000,
            stored_materials_cents: 0,
            work_completed_to_date_cents: 25000,
          },
          {
            line_number: 2,
            description: 'Prime coat',
            cost_code: '01-200',
            scheduled_value_cents: 50000,
            work_completed_this_period_cents: 25000,
            stored_materials_cents: 0,
            work_completed_to_date_cents: 25000,
          },
        ],
      },
    };

    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': testApiKey },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; url: string };
    expect(body.id).toBe('pa-test-001');
    expect(body.url).toContain('/api/documents/pa-test-001');

    const stored = await env.PDF_BUCKET.get('pdfs/pay_app/pa-test-001.pdf');
    expect(stored).toBeDefined();
    expect(stored?.httpMetadata?.contentType).toBe('application/pdf');
    expect(stored?.size).toBeGreaterThan(0);
    await stored?.arrayBuffer();

    const get = await SELF.fetch(new URL('/api/documents/pa-test-001', baseUrl));
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('application/pdf');
    await get.arrayBuffer();
  });

  it('POST /api/render creates a waiver PDF', async () => {
    const payload = {
      type: 'waiver',
      id: 'w-test-001',
      data: {
        waiver: {
          id: 'w-test-001',
          waiver_type: 'conditional_progress',
          amount_cents: 90000,
          through_date: '2026-07-31',
          status: 'draft',
          created_at: '2026-07-31T00:00:00Z',
        },
        pay_app: {
          application_number: 1,
        },
        contract: {
          name: 'Moorhouse HQ repaint',
          gc_name: 'GC Builders',
        },
      },
    };

    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': testApiKey },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; url: string };
    expect(body.id).toBe('w-test-001');

    const stored = await env.PDF_BUCKET.get('pdfs/waiver/w-test-001.pdf');
    expect(stored).toBeDefined();
    expect(stored?.size).toBeGreaterThan(0);
    await stored?.arrayBuffer();

    const get = await SELF.fetch(new URL('/api/documents/w-test-001', baseUrl));
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('application/pdf');
    await get.arrayBuffer();
  });

  it('POST /api/render creates a signed waiver PDF', async () => {
    const payload = {
      type: 'waiver',
      id: 'w-test-signed',
      data: {
        waiver: {
          id: 'w-test-signed',
          waiver_type: 'unconditional_progress',
          amount_cents: 90000,
          through_date: '2026-07-31',
          status: 'signed',
          created_at: '2026-07-31T00:00:00Z',
          signer_name: 'Alice Smith',
          signer_email: 'alice@example.com',
          signed_at: '2026-07-31T00:00:00Z',
          signed_document_url: 'https://example.com/signed.pdf',
        },
        pay_app: {
          application_number: 1,
        },
        contract: {
          name: 'Moorhouse HQ repaint',
          gc_name: 'GC Builders',
        },
      },
    };

    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': testApiKey },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; url: string };
    expect(body.id).toBe('w-test-signed');

    const stored = await env.PDF_BUCKET.get('pdfs/waiver/w-test-signed.pdf');
    expect(stored).toBeDefined();
    expect(stored?.size).toBeGreaterThan(0);
    await stored?.arrayBuffer();

    const get = await SELF.fetch(new URL('/api/documents/w-test-signed', baseUrl));
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('application/pdf');
    await get.arrayBuffer();
  });

  it('GET /api/documents/:id returns 404 for missing document', async () => {
    const response = await SELF.fetch(new URL('/api/documents/missing-id', baseUrl));
    expect(response.status).toBe(404);
  });

  it('POST /api/render returns 400 for invalid type', async () => {
    const response = await SELF.fetch(new URL('/api/render', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': testApiKey },
      body: JSON.stringify({ type: 'unknown', id: 'x', data: {} }),
    });
    expect(response.status).toBe(400);
  });
});
