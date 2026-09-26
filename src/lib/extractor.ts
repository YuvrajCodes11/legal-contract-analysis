// @ts-nocheck
import fs from 'fs';
import mammoth from 'mammoth';
import { randomUUID } from 'crypto';
import type { DocumentPage, DocumentSection, ExtractedDocument } from '@/types';

// Guard against pdf-parse internal debug crash on Vercel
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;

fs.readFileSync = function (targetPath: any, ...args: any[]) {
  if (typeof targetPath === 'string' && targetPath.includes('05-versions-space.pdf')) {
    return Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n120\n%%EOF');
  }
  return originalReadFileSync.call(fs, targetPath, ...args);
};

fs.writeFileSync = function (targetPath: any, ...args: any[]) {
  if (typeof targetPath === 'string' && targetPath.includes('05-versions-space.pdf')) {
    return;
  }
  try {
    return originalWriteFileSync.call(fs, targetPath, ...args);
  } catch (e) {
    // Suppress EROFS errors on read-only serverless filesystems
  }
};

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
    try {
      const pdfModule = await import('pdf-parse');
      const parseFn = typeof pdfModule === 'function' ? pdfModule : (pdfModule as any).default || pdfModule;
      const data = await parseFn(buffer);
      fullText = data.text || '';
      
      const rawPages = fullText.split(/\f/);
      if (rawPages.length > 1) {
        pages = rawPages.map((txt, idx) => ({ pageNumber: idx + 1, text: txt.trim() }));
      } else {
        const pageCount = data.numpages || 1;
        const lines = fullText.split('\n');
        const linesPerPage = Math.max(1, Math.ceil(lines.length / pageCount));
        pages = Array.from({ length: pageCount }, (_, idx) => ({
          pageNumber: idx + 1,
          text: lines.slice(idx * linesPerPage, (idx + 1) * linesPerPage).join('\n').trim(),
        }));
      }
    } catch (err) {
      console.warn("pdf-parse fallback engaged:", err);
      const fallback = parseBufferFallback(buffer);
      pages = fallback.pages;
      fullText = fallback.fullText;
    }
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
