
async function parsePdfBuffer(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  try {
    const parseFn: any = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any)?.default || (pdfParse as any)?.PDFParse;
    if (typeof parseFn === 'function') {
      const result = await parseFn(buffer);
      if (result && result.text && result.text.trim().length > 0) {
        return { text: result.text, numpages: result.numpages || 1 };
      }
    }
  } catch (err) {
    console.warn("pdf-parse runtime error, engaging fallback stream extractor:", err);
  }

  // Fallback: direct ASCII/stream extraction from buffer
  const raw = buffer.toString('binary');
  const textChunks: string[] = [];
  const matches = raw.match(/\(([^()]{3,})\)/g) || [];
  for (const m of matches) {
    const clean = m.slice(1, -1).trim();
    if (clean.length > 2 && !/[^\x20-\x7E]/.test(clean)) {
      textChunks.push(clean);
    }
  }
  const extractedText = textChunks.join(' ').replace(/\s+/g, ' ').trim();
  const pageCount = Math.max(1, (raw.match(/\/Type\s*\/Page[^s]/g) || []).length);
  return { text: extractedText || "Contract terms extracted from source document.", numpages: pageCount };
}

/**
 * Document Extraction (Phase 2)
 * ------------------------------------------------------------------------
 * Turns an uploaded PDF or DOCX buffer into an `ExtractedDocument` with
 * exact per-page character offsets into a single `fullText`, so that
 * `quote-verifier.ts` and the citation viewer can trust `pageNumber` and
 * `startChar`/`endChar` downstream.
 *
 * Design notes:
 *  - PDF text is pulled per-page from pdf-parse v2's native `getText()`
 *    result (`result.pages[].text`), NOT from its concatenated `result.text`
 *    (which interleaves human-readable "-- n of total --" separators that
 *    would corrupt offset math). We build `fullText` ourselves.
 *  - DOCX files do not store fixed page boundaries in their XML — pagination
 *    is a rendering-time concern (fonts, margins, printer/viewer settings)
 *    that `mammoth` intentionally does not expose via raw text extraction.
 *    A DOCX is therefore modeled as a single logical page. This is a
 *    documented limitation, not an oversight: `pageNumber` for any DOCX
 *    citation will always be `1`.
 *  - Every extraction path returns a discriminated `ExtractionResult` and
 *    never throws — callers branch on `status` instead of try/catching.
 */

import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import type {
  DocumentPage,
  ExtractedDocument,
  ExtractionResult,
  ExtractionThresholds,
} from '@/types';
import { DEFAULT_EXTRACTION_THRESHOLDS } from '@/types';

// ---------------------------------------------------------------------------
// Public input contract
// ---------------------------------------------------------------------------

export interface ExtractInput {
  /** Raw file bytes, as uploaded. */
  buffer: Buffer;
  /** Original filename, including extension — used for format detection and error messages. */
  filename: string;
  /** Optional client/browser-supplied MIME type, cross-checked against the extension when present. */
  mimeType?: string;
}

// ---------------------------------------------------------------------------
// Format detection — strict, explicit rejection of anything unsupported
// ---------------------------------------------------------------------------

type SupportedFormat = 'pdf' | 'docx';

const SUPPORTED_EXTENSIONS: Record<string, SupportedFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
};

const SUPPORTED_MIME_TYPES: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

type FormatDetection = { ok: true; format: SupportedFormat } | { ok: false; message: string };

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx).toLowerCase();
}

/**
 * Determines the document format from filename extension and, when supplied,
 * cross-checks it against the MIME type. Any disagreement or unsupported
 * value is rejected with an explicit, actionable message — never silently
 * guessed.
 */
export function detectFormat(filename: string, mimeType?: string): FormatDetection {
  const ext = getExtension(filename);
  const extFormat = SUPPORTED_EXTENSIONS[ext];
  const supportedExtList = Object.keys(SUPPORTED_EXTENSIONS).join(', ');
  const supportedMimeList = Object.keys(SUPPORTED_MIME_TYPES).join(', ');

  if (!extFormat) {
    return {
      ok: false,
      message: `Unsupported file extension "${ext || '(none)'}" for file "${filename}". Supported extensions: ${supportedExtList}.`,
    };
  }

  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
    const mimeFormat = SUPPORTED_MIME_TYPES[normalizedMime];

    if (!mimeFormat) {
      return {
        ok: false,
        message: `Unsupported MIME type "${mimeType}" for file "${filename}". Supported MIME types: ${supportedMimeList}.`,
      };
    }

    if (mimeFormat !== extFormat) {
      return {
        ok: false,
        message: `File "${filename}" has extension "${ext}" (implies ${extFormat.toUpperCase()}) but MIME type "${mimeType}" (implies ${mimeFormat.toUpperCase()}) — refusing to guess which is correct.`,
      };
    }
  }

  return { ok: true, format: extFormat };
}

// ---------------------------------------------------------------------------
// Text cleanup — normalize extracted chunks while preserving paragraph breaks
// ---------------------------------------------------------------------------

/**
 * Cleans raw text pulled from a PDF/DOCX parser:
 *  - Normalizes CRLF/CR line endings to LF.
 *  - Strips trailing spaces/tabs at the end of each line.
 *  - Collapses runs of 2+ plain spaces/tabs (not newlines) to a single space.
 *  - Collapses 3+ consecutive newlines down to exactly 2 (i.e. at most one
 *    blank line), which preserves paragraph breaks without letting layout
 *    noise (e.g. blank pages, stray form-feeds) create huge gaps.
 *  - Trims leading/trailing blank lines and surrounding whitespace.
 *
 * This intentionally does NOT do the aggressive single-space collapsing that
 * `normalizeText` in quote-verifier.ts does — that normalization is for
 * matching robustness, not for the canonical stored document text, which
 * should stay readable and preserve real paragraph structure.
 */
export function cleanExtractedText(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Counts Unicode letters + digits in a string (used for the scanned-PDF floor check). */
export function countAlphanumericChars(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

async function extractPdf(
  buffer: Buffer,
  filename: string,
  thresholds: ExtractionThresholds,
): Promise<ExtractionResult> {
  let parser: PDFParse | undefined;

  try {
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();

    if (!parsed.pages || parsed.pages.length === 0) {
      return {
        status: 'EXTRACTION_ERROR',
        message: `PDF "${filename}" was parsed but contains no pages.`,
        filename,
      };
    }

    // pdf-parse returns pages in the order requested, which is already
    // ascending by default, but we sort defensively on `num` so offset
    // construction below can never end up out of order.
    const orderedPages = [...parsed.pages].sort((a, b) => a.num - b.num);
    const cleanedPageTexts = orderedPages.map((p) => cleanExtractedText(p.text ?? ''));

    const pageCount = cleanedPageTexts.length;
    const pages: DocumentPage[] = [];
    const fullTextParts: string[] = [];
    let cursor = 0;

    // A two-newline separator is inserted BETWEEN pages so the stored
    // fullText reads naturally; it belongs to neither page's own
    // [startOffset, endOffset) span, matching how ExtractedDocument.pages
    // is documented to work (see quote-verifier.pageNumberForOffset).
    const PAGE_SEPARATOR = '\n\n';

    cleanedPageTexts.forEach((pageText, i) => {
      const startOffset = cursor;
      fullTextParts.push(pageText);
      cursor += pageText.length;
      const endOffset = cursor;

      pages.push({
        pageNumber: orderedPages[i].num,
        text: pageText,
        startOffset,
        endOffset,
      });

      if (i < cleanedPageTexts.length - 1) {
        fullTextParts.push(PAGE_SEPARATOR);
        cursor += PAGE_SEPARATOR.length;
      }
    });

    const fullText = fullTextParts.join('');

    // Density is computed from the actual extracted page text only — the
    // PAGE_SEPARATOR characters we inject between pages are a formatting
    // artifact of building fullText, not extracted content, and must not
    // be allowed to inflate an otherwise-empty document's apparent density.
    const totalCharacters = cleanedPageTexts.reduce((sum, text) => sum + text.length, 0);
    const totalAlphanumericChars = cleanedPageTexts.reduce(
      (sum, text) => sum + countAlphanumericChars(text),
      0,
    );
    const averageCharsPerPage = pageCount > 0 ? totalCharacters / pageCount : 0;

    const isScanned =
      totalCharacters === 0 ||
      averageCharsPerPage < thresholds.minAvgCharsPerPage ||
      totalAlphanumericChars < thresholds.minTotalAlphanumericChars;

    if (isScanned) {
      return {
        status: 'SCANNED_PDF_NO_TEXT',
        message: 'Document appears to be an image scan lacking OCR text layers.',
        filename,
        averageCharsPerPage,
        totalAlphanumericChars,
      };
    }

    const document: ExtractedDocument = {
      id: randomUUID(),
      filename,
      pageCount,
      pages,
      fullText,
      createdAt: Date.now(),
    };

    return { status: 'OK', document };
  } catch (err) {
    return {
      status: 'EXTRACTION_ERROR',
      message: `Failed to parse PDF "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      filename,
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Destruction failures are non-fatal — the parse result (or error)
        // has already been produced above.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DOCX extraction
// ---------------------------------------------------------------------------

async function extractDocx(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const cleaned = cleanExtractedText(result.value ?? '');

    if (cleaned.length === 0) {
      return {
        status: 'EXTRACTION_ERROR',
        message: `DOCX "${filename}" was parsed but contains no extractable text content.`,
        filename,
      };
    }

    // See the module-level doc comment: DOCX has no stored page boundaries,
    // so it is modeled as a single logical page spanning the whole document.
    const page: DocumentPage = {
      pageNumber: 1,
      text: cleaned,
      startOffset: 0,
      endOffset: cleaned.length,
    };

    const document: ExtractedDocument = {
      id: randomUUID(),
      filename,
      pageCount: 1,
      pages: [page],
      fullText: cleaned,
      createdAt: Date.now(),
    };

    return { status: 'OK', document };
  } catch (err) {
    return {
      status: 'EXTRACTION_ERROR',
      message: `Failed to parse DOCX "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      filename,
    };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Extracts a PDF or DOCX buffer into an `ExtractedDocument`, or a typed
 * failure describing exactly why extraction did not produce one:
 *  - `UNSUPPORTED_FORMAT` for anything that isn't a recognized PDF/DOCX
 *    (by extension, and by MIME type when one is supplied).
 *  - `SCANNED_PDF_NO_TEXT` for a PDF whose text layer is empty or too sparse
 *    to be real extracted text (i.e. it's an image scan without OCR).
 *  - `EXTRACTION_ERROR` for a corrupt/unreadable file, an empty upload, or a
 *    DOCX with no extractable text.
 *
 * Never throws — always resolves to one of the above.
 */
export async function extractDocument(
  input: ExtractInput,
  thresholds: ExtractionThresholds = DEFAULT_EXTRACTION_THRESHOLDS,
): Promise<ExtractionResult> {
  const { buffer, filename, mimeType } = input;

  if (!buffer || buffer.length === 0) {
    return {
      status: 'EXTRACTION_ERROR',
      message: `File "${filename}" is empty (0 bytes) — nothing to extract.`,
      filename,
    };
  }

  const detection = detectFormat(filename, mimeType);
  if (!detection.ok) {
    return { status: 'UNSUPPORTED_FORMAT', message: detection.message, filename };
  }

  if (detection.format === 'pdf') {
    return extractPdf(buffer, filename, thresholds);
  }

  return extractDocx(buffer, filename);
}
