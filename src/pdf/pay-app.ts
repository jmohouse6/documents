import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { formatCents, formatDate, PayAppData } from '../types';

function drawText(page: PDFPage, font: PDFFont, size: number, x: number, y: number, text: string, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color });
  return y - size - 2;
}

export async function createPayAppPdf(data: PayAppData): Promise<Uint8Array> {
  const { pay_app, contract, lines } = data;
  const pdf = await PDFDocument.create();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]); // US Letter
  const { width } = page.getSize();
  let y = 760;

  y = drawText(page, helveticaBold, 18, 50, y, 'Application and Certificate for Payment', rgb(0, 0, 0));
  y -= 6;
  y = drawText(page, helvetica, 10, 50, y, `AIA G702 / G703 Style — Progress Billing`, rgb(0.3, 0.3, 0.3));
  y -= 20;

  y = drawText(page, helveticaBold, 12, 50, y, 'Project / Contract');
  y = drawText(page, helvetica, 10, 50, y, contract.name || '—');
  y = drawText(page, helvetica, 10, 50, y, `General Contractor: ${contract.gc_name || '—'}`);
  y -= 12;

  y = drawText(page, helveticaBold, 12, 50, y, 'Pay Application');
  y = drawText(page, helvetica, 10, 50, y, `Application No.: ${pay_app.application_number}`);
  y = drawText(page, helvetica, 10, 50, y, `Period: ${formatDate(pay_app.period_start)} — ${formatDate(pay_app.period_end)}`);
  y -= 16;

  // G702 summary
  y = drawText(page, helveticaBold, 12, 50, y, 'G702 Summary');
  y -= 4;
  y = drawText(page, helvetica, 10, 50, y, `Total Completed & Stored to Date: ${formatCents(pay_app.total_completed_stored_cents)}`);
  y = drawText(page, helvetica, 10, 50, y, `Less Retainage:                 ${formatCents(pay_app.retainage_withheld_cents)}`);
  y = drawText(page, helvetica, 10, 50, y, `Less Previous Payments:         ${formatCents(pay_app.previous_payments_cents)}`);
  y = drawText(page, helveticaBold, 10, 50, y, `Current Payment Due:              ${formatCents(pay_app.current_payment_due_cents)}`);
  y -= 16;

  // G703 continuation sheet
  y = drawText(page, helveticaBold, 12, 50, y, 'G703 Continuation Sheet');
  y -= 8;

  const colX = [50, 80, 180, 280, 360, 450, 530];
  const headers = ['Line', 'Description', 'Cost Code', 'Scheduled', 'This Period', 'Stored', 'To Date'];
  y = drawText(page, helveticaBold, 9, 50, y, headers.join('   '));
  y -= 2;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  y -= 12;

  for (const line of lines || []) {
    const row = [
      String(line.line_number).padStart(4, ' '),
      (line.description || '').slice(0, 24).padEnd(24, ' '),
      (line.cost_code || '').slice(0, 10).padEnd(10, ' '),
      formatCents(line.scheduled_value_cents).padStart(10, ' '),
      formatCents(line.work_completed_this_period_cents).padStart(11, ' '),
      formatCents(line.stored_materials_cents).padStart(8, ' '),
      formatCents(line.work_completed_to_date_cents).padStart(9, ' '),
    ];
    y = drawText(page, helvetica, 8, 50, y, row.join('  '));
    if (y < 60) {
      pdf.addPage([612, 792]);
      y = 760;
    }
  }

  y -= 10;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0, 0, 0) });

  return pdf.save();
}
