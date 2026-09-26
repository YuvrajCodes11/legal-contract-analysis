/**
 * Test-only fixture builders. These generate real, valid PDF/DOCX binaries
 * in memory (via `pdf-lib` and `docx`) so `extractor.test.ts` exercises the
 * actual `pdf-parse` / `mammoth` parsing paths against real files, without
 * committing binary fixtures to the repo.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * A 3-page PDF with real, extractable text:
 *  - Page 1: RECITALS
 *  - Page 2: LIMITATION OF LIABILITY
 *  - Page 3: SIGNATURES
 */
export async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([612, 792]);
  page1.setFont(font);
  page1.drawText('RECITALS', { x: 50, y: 740, size: 14 });
  page1.drawText('This Agreement is made between Alpha Corp and Beta LLC.', { x: 50, y: 700, size: 11 });
  page1.drawText('The parties agree to the terms set forth below.', { x: 50, y: 680, size: 11 });

  const page2 = doc.addPage([612, 792]);
  page2.setFont(font);
  page2.drawText('LIMITATION OF LIABILITY', { x: 50, y: 740, size: 14 });
  page2.drawText('In no event shall either party be liable for indirect damages.', { x: 50, y: 700, size: 11 });
  page2.drawText('Total liability shall not exceed fees paid in the prior 12 months.', { x: 50, y: 680, size: 11 });

  const page3 = doc.addPage([612, 792]);
  page3.setFont(font);
  page3.drawText('SIGNATURES', { x: 50, y: 740, size: 14 });
  page3.drawText('IN WITNESS WHEREOF the parties have executed this Agreement.', { x: 50, y: 700, size: 11 });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** A 2-page PDF with no text layer at all — simulates an image scan with no OCR. */
export async function buildScannedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** A short but real DOCX with a heading and two paragraphs of body text. */
export async function buildSampleDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: 'MASTER SERVICES AGREEMENT', bold: true })] }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'This Agreement governs the relationship between Client and Provider.' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'CONFIDENTIALITY' }),
          new Paragraph({ text: 'Each party shall keep the other\u2019s Confidential Information secret.' }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** A structurally valid DOCX containing only an empty paragraph — no extractable text. */
export async function buildEmptyDocx(): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: [new Paragraph({ text: '' })] }] });
  return Packer.toBuffer(doc);
}
