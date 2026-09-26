// @ts-nocheck
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { randomUUID } from 'crypto';
import type { DocumentPage, DocumentSection, ExtractedDocument } from '@/types';

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

export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractedDocument> {
  const id = randomUUID();
  let rawPages: { pageNumber: number; text: string }[] = [];

  const isDocx = filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    rawPages = [{ pageNumber: 1, text: result.value }];
  } else {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];
    rawPages = pageTexts.map((t, i) => ({ pageNumber: i + 1, text: t }));
  }

  // Build fullText and per-page character offsets from ONE source of truth,
  // so page.startOffset/endOffset always agree exactly with fullText.
  // (Previously these offsets were never set, silently breaking quote
  // verification and search context windows downstream.)
  let cursor = 0;
  const pages: DocumentPage[] = [];
  const fullTextParts: string[] = [];

  for (const rp of rawPages) {
    const text = rp.text || '';
    const startOffset = cursor;
    const endOffset = startOffset + text.length;
    pages.push({ pageNumber: rp.pageNumber, text, startOffset, endOffset });
    fullTextParts.push(text);
    cursor = endOffset + 1; // +1 accounts for the '\n' separator joined below
  }

  const fullText = fullTextParts.join('\n').trim() || 'No extractable text found in this document.';
  const sections = detectSections(pages);

  return {
    id,
    name: filename,
    filename,
    pageCount: pages.length,
    pages,
    sections,
    fullText,
    createdAt: Date.now(),
    uploadedAt: new Date().toISOString(),
  };
}
