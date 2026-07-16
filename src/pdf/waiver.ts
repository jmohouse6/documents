import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { formatCents, formatDate, WaiverData } from '../types';

function drawText(page: PDFPage, font: PDFFont, size: number, x: number, y: number, text: string, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color });
  return y - size - 2;
}

function drawWrapped(page: PDFPage, font: PDFFont, size: number, x: number, y: number, maxWidth: number, text: string): number {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      y = drawText(page, font, size, x, y, line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    y = drawText(page, font, size, x, y, line);
  }
  return y;
}

export async function createWaiverPdf(data: WaiverData): Promise<Uint8Array> {
  const { waiver, pay_app, contract } = data;
  const pdf = await PDFDocument.create();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  let y = 760;

  const isFinal = waiver.waiver_type.includes('final');
  const isUnconditional = waiver.waiver_type.includes('unconditional');
  const title = isUnconditional ? 'Unconditional Waiver and Release' : 'Conditional Waiver and Release';
  const subtitle = isFinal ? 'Upon Final Payment' : 'Upon Progress Payment';

  y = drawText(page, helveticaBold, 18, 50, y, title);
  y = drawText(page, helveticaBold, 14, 50, y, subtitle);
  y -= 16;

  y = drawText(page, helveticaBold, 12, 50, y, 'Project / Contract');
  y = drawText(page, helvetica, 10, 50, y, contract.name || '—');
  y = drawText(page, helvetica, 10, 50, y, `General Contractor: ${contract.gc_name || '—'}`);
  y -= 12;

  y = drawText(page, helveticaBold, 12, 50, y, 'Waiver Details');
  y = drawText(page, helvetica, 10, 50, y, `Waiver Type: ${waiver.waiver_type}`);
  y = drawText(page, helvetica, 10, 50, y, `Amount: ${formatCents(waiver.amount_cents)}`);
  y = drawText(page, helvetica, 10, 50, y, `Through Date: ${formatDate(waiver.through_date)}`);
  y = drawText(page, helvetica, 10, 50, y, `Status: ${waiver.status}`);
  y = drawText(page, helvetica, 10, 50, y, `Pay Application: ${pay_app ? `#${pay_app.application_number}` : '—'}`);
  y -= 16;

  const body = isUnconditional
    ? 'The undersigned has been paid in full and unconditionally waives and releases any and all lien, stop notice, and payment bond rights through the date stated above, except for disputed claims for extra work and retention.'
    : 'The undersigned has been paid or has been assured of payment and conditionally waives and releases any and all lien, stop notice, and payment bond rights through the date stated above, conditioned upon receipt of the stated amount.';

  y = drawWrapped(page, helvetica, 10, 50, y, 512, body);
  y -= 16;

  y = drawText(page, helveticaBold, 12, 50, y, 'Signature');
  y -= 6;
  y = drawText(page, helvetica, 10, 50, y, '_________________________________    Date: _______________');
  y -= 24;

  y = drawText(page, helvetica, 8, 50, y, `Document ID: ${waiver.id}`);
  y = drawText(page, helvetica, 8, 50, y, `Generated: ${new Date().toLocaleDateString('en-US')}`);

  return pdf.save();
}
