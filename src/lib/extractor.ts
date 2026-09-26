// @ts-nocheck
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { randomUUID } from 'crypto';
import type { DocumentPage, DocumentSection, ExtractedDocument } from '@/types';

function extractStreams(buffer: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  const streamMarker = Buffer.from('stream');
  const endstreamMarker = Buffer.from('endstream');

  let searchStart = 0;
  while (true) {
    const streamIdx = buffer.indexOf(streamMarker, searchStart);
    if (streamIdx === -1) break;

    let dataStart = streamIdx + streamMarker.length;
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const endIdx = buffer.indexOf(endstreamMarker, dataStart);
    if (endIdx === -1) break;

    let dataEnd = endIdx;
    while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) {
      dataEnd--;
    }

    streams.push(buffer.slice(dataStart, dataEnd));
    searchStart = endIdx + endstreamMarker.length;
  }
  return streams;
}

function inflateIfPossible(data: Buffer): Buffer | null {
  try {
    return zlib.inflateSync(data);
  } catch {
    try {
      return zlib.inflateRawSync(data);
    } catch {
      return null;
    }
  }
}

function decodeLiteral(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractTextFromContentStream(content: string): string {
  const parts: string[] = [];

  const literalTjRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = literalTjRegex.exec(content))) {
    parts.push(decodeLiteral(m[1]));
  }

  const tjArrayRegex = /\[((?:[^\[\]]|\\.)*)\]\s*TJ/g;
  while ((m = tjArrayRegex.exec(content))) {
    const strRegex = /\(((?:[^()\\]|\\.)*)\)/g;
    let sm: RegExpExecArray | null;
    let piece = '';
    while ((sm = strRegex.exec(m[1]))) {
      piece += decodeLiteral(sm[1]);
    }
    if (piece) parts.push(piece);
  }

  return parts.join(' ');
}

function parseBufferFallback(buffer: Buffer): { pages: DocumentPage[]; fullText: string } {
  const streams = extractStreams(buffer);
  const textChunks: string[] = [];

  for (const raw of streams) {
    const decompressed = inflateIfPossible(raw) ?? raw;
    const content = decompressed.toString('latin1');
    const extracted = extractTextFromContentStream(content);
    if (extracted.trim()) textChunks.push(extracted);
  }

  const fullText = textChunks.join(' ').replace(/\s+/g, ' ').trim()
    || 'No extractable text found in this document.';

  const rawLatin1 = buffer.toString('latin1');
  const pageMatch = rawLatin1.match(/\/Type\s*\/Page\b/g);
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
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];
    pages = pageTexts.map((t, i) => ({ pageNumber: i + 1, text: t }));
    fullText = pageTexts.join(' ').replace(/\s+/g, ' ').trim()
      || 'No extractable text found in this document.';
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
