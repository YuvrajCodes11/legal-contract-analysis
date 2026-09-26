// @ts-nocheck
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { randomUUID } from 'crypto';
import type { DocumentPage, DocumentSection, ExtractedDocument, ExtractionResult } from '@/types';
import { DEFAULT_EXTRACTION_THRESHOLDS } from '@/types';

function detectSections(pages: DocumentPage[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const sectionRegex = /(?:SECTION|ARTICLE|CLAUSE)\s+([0-9A-Z]+)[.:\s]+([^\n]+)/i;

  for (const page of pages) {
    for (const line of page.text.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(sectionRegex);
      if (match) {
        sections.push({ title: trimmed.slice(0, 80), level: 1, pageNumber: page.pageNumber, startChar: page.startOffset });
      } else if (/^[0-9]\.[0-9]\s+[A-Z]/.test(trimmed)) {
        sections.push({ title: trimmed.slice(0, 60), level: 2, pageNumber: page.pageNumber, startChar: page.startOffset });
      }
    }
  }

  if (sections.length === 0) {
    sections.push({ title: 'General Provisions', level: 1, pageNumber: 1, startChar: 0 });
  }

  return sections;
}

function countAlphanumeric(text: string): number {
  const matches = text.match(/[a-zA-Z0-9]/g);
  return matches ? matches.length : 0;
}

/**
 * Extracts a document's text and returns a discriminated ExtractionResult.
 * Callers MUST check `status` before treating the result as a usable document.
 * A scanned/image-only PDF with no real text layer is reported as
 * SCANNED_PDF_NO_TEXT rather than silently saved as an empty "successful" doc.
 */
export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractionResult> {
  const isDocx = filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = filename.endsWith('.pdf') || mimeType === 'application/pdf';

  if (!isDocx && !isPdf) {
    return {
      status: 'UNSUPPORTED_FORMAT',
      message: 'Unsupported file type. Only PDF (.pdf) and Word (.docx) documents are supported.',
      filename,
    };
  }

  let rawPages: { pageNumber: number; text: string }[] = [];

  try {
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      rawPages = [{ pageNumber: 1, text: result.value || '' }];
    } else {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: false });
      const pageTexts = Array.isArray(text) ? text : [text];
      rawPages = pageTexts.map((t, i) => ({ pageNumber: i + 1, text: t || '' }));
    }
  } catch (err) {
    return {
      status: 'EXTRACTION_ERROR',
      message: `Failed to extract text from "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      filename,
    };
  }

  // Build fullText and per-page offsets from ONE source of truth so
  // page.startOffset/endOffset always agree exactly with fullText.
  let cursor = 0;
  const pages: DocumentPage[] = [];
  const fullTextParts: string[] = [];

  for (const rp of rawPages) {
    const text = rp.text || '';
    const startOffset = cursor;
    const endOffset = startOffset + text.length;
    pages.push({ pageNumber: rp.pageNumber, text, startOffset, endOffset });
    fullTextParts.push(text);
    cursor = endOffset + 1; // +1 for the '\n' separator joined below
  }

  const fullText = fullTextParts.join('\n').trim();

  // Only PDFs go through the scanned/image-only check — mammoth basically
  // never produces an empty result for a real .docx file.
  if (isPdf) {
    const totalAlphanumericChars = countAlphanumeric(fullText);
    const averageCharsPerPage = totalAlphanumericChars / Math.max(1, pages.length);

    if (
      totalAlphanumericChars < DEFAULT_EXTRACTION_THRESHOLDS.minTotalAlphanumericChars ||
      averageCharsPerPage < DEFAULT_EXTRACTION_THRESHOLDS.minAvgCharsPerPage
    ) {
      return {
        status: 'SCANNED_PDF_NO_TEXT',
        message: 'This PDF appears to be scanned/image-only with no readable text layer. OCR would be required before it can be analyzed.',
        filename,
        averageCharsPerPage,
        totalAlphanumericChars,
      };
    }
  }

  const sections = detectSections(pages);
  const id = randomUUID();

  const document: ExtractedDocument = {
    id,
    name: filename,
    filename,
    pageCount: pages.length,
    pages,
    sections,
    fullText,
    createdAt: Date.now(),
    uploadedAt: new Date().toISOString(),
  } as ExtractedDocument;

  return { status: 'OK', document };
}
