import { Hono } from 'hono';
import { createPayAppPdf } from './pdf/pay-app';
import { createWaiverPdf } from './pdf/waiver';
import { asPayAppData, asWaiverData, Env, RenderRequest, RenderResponse } from './types';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'documents' });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'documents' });
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function requireApiKey(c: { req: { header: (name: string) => string | undefined }; env: Env; json: (body: object, status?: number) => Response }) {
  const provided = c.req.header('X-API-Key');
  const expected = c.env.API_KEY;

  if (!provided) {
    return c.json({ error: 'AUTH_REQUIRED' }, 401);
  }

  if (!expected || !constantTimeEqual(provided, expected)) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }

  return null;
}

app.post('/api/render', async (c) => {
  const auth = requireApiKey(c);
  if (auth) return auth;

  const body = await c.req.json<RenderRequest>().catch(() => null);
  if (!body || !body.type || !body.id || body.data === undefined) {
    return c.json({ error: 'Bad request', message: 'type, id, and data are required' }, 400);
  }

  const { type, id, data } = body;
  let pdfBytes: Uint8Array;

  try {
    if (type === 'pay_app') {
      pdfBytes = await createPayAppPdf(asPayAppData(data));
    } else if (type === 'waiver') {
      pdfBytes = await createWaiverPdf(asWaiverData(data));
    } else {
      return c.json({ error: 'Bad request', message: `Unsupported type: ${type}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    return c.json({ error: 'PDF generation failed', message }, 500);
  }

  const key = `pdfs/${type}/${id}.pdf`;
  await c.env.PDF_BUCKET.put(key, pdfBytes, {
    httpMetadata: { contentType: 'application/pdf' },
  });

  const baseUrl = c.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
  const url = `${baseUrl}/api/documents/${id}`;
  const response: RenderResponse = { id, url };

  return c.json(response, 201);
});

app.get('/api/documents/:id', async (c) => {
  const id = c.req.param('id');
  const type = c.req.query('type');
  let key = `pdfs/${type || 'pay_app'}/${id}.pdf`;
  let object = await c.env.PDF_BUCKET.get(key);

  if (!object && !type) {
    // Try waiver as fallback if no type was specified.
    key = `pdfs/waiver/${id}.pdf`;
    object = await c.env.PDF_BUCKET.get(key);
  }

  if (!object) {
    return c.json({ error: 'Not found', message: `Document ${id} not found` }, 404);
  }

  const body = object.body;
  return c.body(body, 200, {
    'Content-Type': 'application/pdf',
    'Content-Length': String(object.size),
    'Content-Disposition': `inline; filename="${id}.pdf"`,
  });
});

export default app;
