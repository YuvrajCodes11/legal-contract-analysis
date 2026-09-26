import { describe, it, expect } from 'vitest';
import {
  extractDocument,
  detectFormat,
  cleanExtractedText,
  countAlphanumericChars,
} from '../extractor';
import { verifyQuote } from '../quote-verifier';
import type { ExtractedDocument } from '@/types';
import {
  buildSamplePdf,
  buildScannedPdf,
  buildSampleDocx,
  buildEmptyDocx,
} from './fixtures';

// ---------------------------------------------------------------------------
// detectFormat
// ---------------------------------------------------------------------------

describe('detectFormat', () => {
  it('accepts a .pdf extension with no MIME type supplied', () => {
    const result = detectFormat('contract.pdf');
    expect(result).toEqual({ ok: true, format: 'pdf' });
  });

  it('accepts a .docx extension with no MIME type supplied', () => {
    const result = detectFormat('contract.docx');
    expect(result).toEqual({ ok: true, format: 'docx' });
  });

  it('accepts a .pdf extension paired with the correct MIME type', () => {
    const result = detectFormat('contract.pdf', 'application/pdf');
    expect(result).toEqual({ ok: true, format: 'pdf' });
  });

  it('accepts a .docx extension paired with the correct MIME type, including a charset parameter', () => {
    const result = detectFormat(
      'contract.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=binary',
    );
    expect(result.ok).toBe(true);
  });

  it('is case-insensitive on the extension', () => {
    const result = detectFormat('Contract.PDF');
    expect(result).toEqual({ ok: true, format: 'pdf' });
  });

  it('rejects an unsupported extension with no MIME type', () => {
    const result = detectFormat('notes.txt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Unsupported file extension ".txt"');
    }
  });

  it('rejects a file with no extension at all', () => {
    const result = detectFormat('README');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('(none)');
    }
  });

  it('rejects a recognized MIME type paired with an unsupported extension', () => {
    const result = detectFormat('notes.txt', 'application/pdf');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Unsupported file extension ".txt"');
    }
  });

  it('rejects a valid extension paired with an unrecognized MIME type', () => {
    const result = detectFormat('contract.pdf', 'application/octet-stream');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Unsupported MIME type "application/octet-stream"');
    }
  });

  it('rejects a .pdf extension paired with the DOCX MIME type (mismatch), and does not guess', () => {
    const result = detectFormat(
      'contract.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('extension ".pdf"');
      expect(result.message).toContain('MIME type');
      expect(result.message).toContain('refusing to guess');
    }
  });
});

// ---------------------------------------------------------------------------
// cleanExtractedText
// ---------------------------------------------------------------------------

describe('cleanExtractedText', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(cleanExtractedText('Line one\r\nLine two\rLine three')).toBe('Line one\nLine two\nLine three');
  });

  it('strips trailing spaces/tabs at the end of a line', () => {
    expect(cleanExtractedText('Line one   \t\nLine two')).toBe('Line one\nLine two');
  });

  it('collapses runs of 2+ horizontal spaces/tabs to a single space', () => {
    expect(cleanExtractedText('Word1     Word2\t\tWord3')).toBe('Word1 Word2 Word3');
  });

  it('collapses 3+ consecutive newlines down to exactly one blank line', () => {
    expect(cleanExtractedText('Para one\n\n\n\n\nPara two')).toBe('Para one\n\nPara two');
  });

  it('preserves a single genuine paragraph break (double newline)', () => {
    expect(cleanExtractedText('Para one\n\nPara two')).toBe('Para one\n\nPara two');
  });

  it('preserves single newlines (real line structure within a page) as-is', () => {
    expect(cleanExtractedText('Heading\nBody line one.\nBody line two.')).toBe(
      'Heading\nBody line one.\nBody line two.',
    );
  });

  it('trims leading/trailing whitespace and blank lines', () => {
    expect(cleanExtractedText('\n\n  padded text  \n\n')).toBe('padded text');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(cleanExtractedText('   \n\n\t  ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// countAlphanumericChars
// ---------------------------------------------------------------------------

describe('countAlphanumericChars', () => {
  it('counts letters and digits, ignoring punctuation and whitespace', () => {
    expect(countAlphanumericChars('Net 30 days!')).toBe(9); // N e t 3 0 d a y s
  });

  it('counts Unicode letters (e.g. accented characters) as alphanumeric', () => {
    expect(countAlphanumericChars('café 123')).toBe(7); // c a f é 1 2 3
  });

  it('returns 0 for empty or purely symbolic input', () => {
    expect(countAlphanumericChars('')).toBe(0);
    expect(countAlphanumericChars('*** --- ...')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractDocument — PDF
// ---------------------------------------------------------------------------

describe('extractDocument — PDF', () => {
  it('extracts a real 3-page PDF into an OK ExtractedDocument with correct offsets', async () => {
    const buffer = await buildSamplePdf();
    const result = await extractDocument({ buffer, filename: 'sample.pdf', mimeType: 'application/pdf' });

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    const doc: ExtractedDocument = result.document;
    expect(doc.pageCount).toBe(3);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);

    // Every page's stored text must equal the exact slice of fullText at its own offsets.
    for (const page of doc.pages) {
      expect(doc.fullText.slice(page.startOffset, page.endOffset)).toBe(page.text);
    }

    // Content sanity: each page's known heading appears in its own page text, not another page's.
    expect(doc.pages[0].text).toContain('RECITALS');
    expect(doc.pages[1].text).toContain('LIMITATION OF LIABILITY');
    expect(doc.pages[2].text).toContain('SIGNATURES');
    expect(doc.pages[0].text).not.toContain('LIMITATION OF LIABILITY');

    // Offsets strictly increase and never overlap.
    for (let i = 1; i < doc.pages.length; i++) {
      expect(doc.pages[i].startOffset).toBeGreaterThanOrEqual(doc.pages[i - 1].endOffset);
    }

    expect(doc.id).toBeTruthy();
    expect(typeof doc.createdAt).toBe('number');
  });

  it('flags a text-less (scanned-style) PDF as SCANNED_PDF_NO_TEXT instead of an empty OK document', async () => {
    const buffer = await buildScannedPdf();
    const result = await extractDocument({ buffer, filename: 'scanned.pdf', mimeType: 'application/pdf' });

    expect(result.status).toBe('SCANNED_PDF_NO_TEXT');
    if (result.status !== 'SCANNED_PDF_NO_TEXT') return;
    expect(result.averageCharsPerPage).toBe(0);
    expect(result.totalAlphanumericChars).toBe(0);
    expect(result.message.toLowerCase()).toContain('scan');
  });

  it('respects a custom, higher density threshold that a normally-passing PDF now fails', async () => {
    // sample.pdf easily clears the default 50 chars/page floor; raising the
    // bar well above its actual density proves the threshold argument is
    // truly honored, not just decorative.
    const buffer = await buildSamplePdf();
    const result = await extractDocument(
      { buffer, filename: 'sample.pdf', mimeType: 'application/pdf' },
      { minAvgCharsPerPage: 100_000, minTotalAlphanumericChars: 100 },
    );
    expect(result.status).toBe('SCANNED_PDF_NO_TEXT');
  });

  it('never lets the injected inter-page separator count toward extracted-text density', async () => {
    // A genuinely empty multi-page PDF must read as exactly 0 chars/page —
    // the "\n\n" we insert between pages when building fullText is a
    // formatting artifact, not extracted content, and must not leak into
    // the density calculation even with permissive thresholds.
    const buffer = await buildScannedPdf();
    const result = await extractDocument(
      { buffer, filename: 'scanned.pdf', mimeType: 'application/pdf' },
      { minAvgCharsPerPage: 0, minTotalAlphanumericChars: 0 },
    );
    expect(result.status).toBe('SCANNED_PDF_NO_TEXT');
    if (result.status !== 'SCANNED_PDF_NO_TEXT') return;
    expect(result.averageCharsPerPage).toBe(0);
    expect(result.totalAlphanumericChars).toBe(0);
  });

  it('returns EXTRACTION_ERROR (not a throw) for a corrupted/non-PDF buffer with a .pdf extension', async () => {
    const buffer = Buffer.from('this is not a real pdf file at all');
    const result = await extractDocument({ buffer, filename: 'broken.pdf', mimeType: 'application/pdf' });

    expect(result.status).toBe('EXTRACTION_ERROR');
    if (result.status !== 'EXTRACTION_ERROR') return;
    expect(result.message).toContain('broken.pdf');
  });
});

// ---------------------------------------------------------------------------
// extractDocument — DOCX
// ---------------------------------------------------------------------------

describe('extractDocument — DOCX', () => {
  it('extracts a real DOCX as a single logical page with paragraph breaks preserved', async () => {
    const buffer = await buildSampleDocx();
    const result = await extractDocument({
      buffer,
      filename: 'sample.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    const doc = result.document;
    expect(doc.pageCount).toBe(1);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].pageNumber).toBe(1);
    expect(doc.pages[0].startOffset).toBe(0);
    expect(doc.pages[0].endOffset).toBe(doc.fullText.length);

    // Paragraph breaks preserved as blank lines; no run of 3+ newlines survives.
    expect(doc.fullText).toContain('MASTER SERVICES AGREEMENT');
    expect(doc.fullText).toContain('CONFIDENTIALITY');
    expect(doc.fullText).not.toMatch(/\n{3,}/);
    expect(doc.fullText.split('\n\n').length).toBeGreaterThan(1);
  });

  it('treats a DOCX with no extractable text as EXTRACTION_ERROR, not SCANNED_PDF_NO_TEXT', async () => {
    const buffer = await buildEmptyDocx();
    const result = await extractDocument({
      buffer,
      filename: 'empty.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    expect(result.status).toBe('EXTRACTION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// extractDocument — cross-cutting validation
// ---------------------------------------------------------------------------

describe('extractDocument — validation', () => {
  it('rejects an empty (0-byte) buffer', async () => {
    const result = await extractDocument({ buffer: Buffer.alloc(0), filename: 'empty.pdf' });
    expect(result.status).toBe('EXTRACTION_ERROR');
    if (result.status !== 'EXTRACTION_ERROR') return;
    expect(result.message).toContain('empty');
  });

  it('rejects an unsupported file type outright, before attempting to parse it', async () => {
    const buffer = Buffer.from('plain text content');
    const result = await extractDocument({ buffer, filename: 'notes.txt' });
    expect(result.status).toBe('UNSUPPORTED_FORMAT');
  });

  it('rejects a file whose extension and declared MIME type disagree', async () => {
    const buffer = await buildSamplePdf();
    const result = await extractDocument({
      buffer,
      filename: 'contract.pdf',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(result.status).toBe('UNSUPPORTED_FORMAT');
  });
});

// ---------------------------------------------------------------------------
// Cross-phase integration: extractor output feeds directly into the
// Phase 1 quote-verifier with correct page attribution.
// ---------------------------------------------------------------------------

describe('extractDocument + verifyQuote integration', () => {
  it('produces a document whose page 2 citation resolves correctly through the quote-verifier', async () => {
    const buffer = await buildSamplePdf();
    const extraction = await extractDocument({ buffer, filename: 'sample.pdf', mimeType: 'application/pdf' });

    expect(extraction.status).toBe('OK');
    if (extraction.status !== 'OK') return;

    const verification = verifyQuote(
      'liability shall not exceed fees paid in the prior 12 months',
      extraction.document,
    );

    expect(verification.isVerified).toBe(true);
    expect(verification.pageNumber).toBe(2);
    expect(
      extraction.document.fullText.slice(verification.startChar!, verification.endChar!),
    ).toBe(verification.matchedText);
  });

  it('correctly declines to verify a quote that was never in the source PDF', async () => {
    const buffer = await buildSamplePdf();
    const extraction = await extractDocument({ buffer, filename: 'sample.pdf', mimeType: 'application/pdf' });
    if (extraction.status !== 'OK') throw new Error('expected OK extraction');

    const verification = verifyQuote('the parties agree to arbitrate all disputes in Delaware', extraction.document);
    expect(verification.isVerified).toBe(false);
  });
});
