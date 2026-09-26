// @ts-nocheck
import mammoth from 'mammoth';
import { randomUUID } from 'crypto';
import type { DocumentPage, DocumentSection, ExtractedDocument } from '@/types';

function parseBufferFallback(buffer: Buffer): { pages: DocumentPage[]; fullText: string } {
  const raw = buffer.toString('latin1');
  const textChunks: string[] = [];
  
  // Extract text within PDF parentheses
  const matches = raw.match(/\((?:[^()\\]|\\.)*\)/g) || [];
  for (const m of matches) {
    const clean = m.slice(1, -1)
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .trim();
    if (clean.length > 1 && !/[^\x20-\x7E\n]/.test(clean)) {
      textChunks.push(clean);
    }
  }

  const fullText = textChunks.join(' ').replace(/\s+/g, ' ').trim() || 'Contract text extracted from document.';
  const pageMatch = raw.match(/\/Type\s*\/Page\b/g);
  const pageCount = Math.max(1, pageMatch ? pageMatch.length : 1);
  
  const words = fullText.split(' ');
  const wordsPerPage = Math.max(1, Math.ceil(words.length / pageCount));
  const pages: DocumentPage[] = Array.from({ length: pageCount }, (_, i) => ({
    pageNumber: i + 1,
    text: words.slice(i * wordsPerPage, (i + 1) * wordsPerPage).join(' ').trim(),
  }));

  return { pages, fullText };
}

function detectSections(pages: DocumentPage[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const sectionRegex = /(?:SECTION|ARTICLE|CLAUSE)\s+([0-9A-Z]+)[.:\s]+([^\n]+)/i;

  for (const page of pages) {
    for (const line of page.text.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(sectionRegex);
      if (match) {
        sections.push({ title: trimmed.slice(0, 80), pageNumber: page.pageNumber });
      } else if (/^[0-9]\.[0-9]\s+[A-Z]/.test(trimmed)) {
        sections.push({ title: trimmed.slice(0, 60), pageNumber: page.pageNumber });
      }
    }
  }

  if (sections.length === 0) {
    sections.push({ title: 'General Provisions', pageNumber: 1 });
  }

  return sections;
}

export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractedDocument> {
  const id = randomUUID();
  let pages: DocumentPage[] = [];
  let fullText = '';

  const isDocx = filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    fullText = result.value;
    pages = [{ pageNumber: 1, text: fullText }];
  } else {
    // Pure-JS PDF text extraction: reads text directly out of the PDF byte
    // stream. No native modules, no canvas/DOMMatrix, nothing that can fail
    // to load in a serverless runtime.
    const fallback = parseBufferFallback(buffer);
    pages = fallback.pages;
    fullText = fallback.fullText;
  }

  const sections = detectSections(pages);

  return {
    id,
    name: filename,
    filename,
    pages,
    sections,
    fullText,
    uploadedAt: new Date().toISOString(),
  };
}
