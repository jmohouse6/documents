export interface Env {
  PDF_BUCKET: R2Bucket;
  PUBLIC_BASE_URL?: string;
  API_KEY?: string;
}

export interface RenderRequest {
  type: 'pay_app' | 'waiver';
  id: string;
  data: unknown;
}

export interface RenderResponse {
  id: string;
  url: string;
}

export interface PayAppData {
  pay_app: {
    id: string;
    contract_id: string;
    application_number: number;
    period_start: string;
    period_end: string;
    total_completed_stored_cents: number;
    retainage_withheld_cents: number;
    previous_payments_cents: number;
    current_payment_due_cents: number;
  };
  contract: {
    name: string;
    gc_name: string | null;
  };
  lines: Array<{
    line_number: number;
    description: string;
    cost_code: string | null;
    scheduled_value_cents: number;
    work_completed_this_period_cents: number;
    stored_materials_cents: number;
    work_completed_to_date_cents: number;
  }>;
}

export interface WaiverData {
  waiver: {
    id: string;
    waiver_type: string;
    amount_cents: number | null;
    through_date: string | null;
    status: string;
    created_at: string;
    signer_name?: string;
    signer_email?: string;
    signed_at?: string;
    signed_document_url?: string;
  };
  pay_app: {
    application_number: number;
  } | null;
  contract: {
    name: string;
    gc_name: string | null;
  };
}

export function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '$—';
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US');
  } catch {
    return iso;
  }
}

export function asPayAppData(data: unknown): PayAppData {
  const d = data as PayAppData;
  if (!d || typeof d !== 'object') {
    throw new Error('Invalid pay_app data');
  }
  return d;
}

export function asWaiverData(data: unknown): WaiverData {
  const d = data as WaiverData;
  if (!d || typeof d !== 'object') {
    throw new Error('Invalid waiver data');
  }
  return d;
}
