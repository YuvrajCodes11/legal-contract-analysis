import { describe, it, expect } from 'vitest';
import { normalizeText, verifyQuote, verifyQuotes } from '../quote-verifier';
import type { ExtractedDocument } from '@/types';

function makeDocument(pagesText: string[], filename = 'test.pdf'): ExtractedDocument {
  const pages: ExtractedDocument['pages'] = [];
  let cursor = 0;
  let fullText = '';

  pagesText.forEach((text, i) => {
    const startOffset = cursor;
    fullText += text;
    cursor += text.length;
    pages.push({ pageNumber: i + 1, text, startOffset, endOffset: cursor });
  });

  return {
    id: `doc-${filename}`,
    filename,
    pageCount: pagesText.length,
    pages,
    fullText,
    createdAt: Date.now(),
  };
}

describe('normalizeText', () => {
  it('collapses runs of spaces, tabs, and newlines into a single space', () => {
    const { normalized } = normalizeText('Hello   \t\n  World');
    expect(normalized).toBe('Hello World');
  });

  it('removes soft hyphens entirely, joining hyphenated line-break words', () => {
    const { normalized } = normalizeText('indem\u00adnification');
    expect(normalized).toBe('indemnification');
  });

  it('treats non-breaking spaces as ordinary spaces', () => {
    const { normalized } = normalizeText('Net\u00a030 days');
    expect(normalized).toBe('Net 30 days');
  });

  it('folds smart/curly quotes to straight ASCII quotes', () => {
    const { normalized } = normalizeText('\u201cTermination\u201d and \u2018Cause\u2019');
    expect(normalized).toBe('"Termination" and \'Cause\'');
  });

  it('trims leading and trailing whitespace', () => {
    const { normalized } = normalizeText('   padded text   ');
    expect(normalized).toBe('padded text');
  });

  it('produces an indexMap of equal length that resolves back to correct raw offsets', () => {
    const raw = 'A  B\nC';
    const { normalized, indexMap } = normalizeText(raw);
    expect(normalized).toBe('A B C');
    expect(indexMap.length).toBe(normalized.length);
    // 'A' -> raw[0], the collapsed space -> the first space at raw[1],
    // 'B' -> raw[3], collapsed newline -> raw[4], 'C' -> raw[5]
    expect(indexMap).toEqual([0, 1, 3, 4, 5]);
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] !== ' ') {
        expect(raw[indexMap[i]]).toBe(normalized[i]);
      }
    }
  });

  it('handles \\r\\n as a single collapsed whitespace unit', () => {
    const { normalized } = normalizeText('Line one\r\nLine two');
    expect(normalized).toBe('Line one Line two');
  });

  it('returns an empty result for an all-whitespace / all-soft-hyphen string', () => {
    const { normalized, indexMap } = normalizeText('  \u00ad\u00ad\n\t ');
    expect(normalized).toBe('');
    expect(indexMap).toEqual([]);
  });
});

describe('verifyQuote — exact matches', () => {
  it('verifies a quote that appears verbatim', () => {
    const doc = makeDocument([
      'This Agreement may be terminated by either party upon 30 days written notice.',
    ]);
    const result = verifyQuote('terminated by either party upon 30 days written notice', doc);
    expect(result.isVerified).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.confidence).toBe(1);
    expect(result.pageNumber).toBe(1);
    expect(doc.fullText.slice(result.startChar!, result.endChar!)).toBe(result.matchedText);
  });

  it('verifies a quote despite extra internal whitespace/newlines in the quote itself', () => {
    const doc = makeDocument(['The Indemnifying Party shall defend, indemnify, and hold harmless the Indemnified Party.']);
    const result = verifyQuote('defend,   indemnify,\nand hold   harmless', doc);
    expect(result.isVerified).toBe(true);
    expect(result.matchType).toBe('exact');
  });

  it('verifies a quote across a soft-hyphenated line break in the source', () => {
    const doc = makeDocument(['Any breach of this provision constitutes a material\u00ad breach of the Agreement.']);
    const result = verifyQuote('a material breach of the Agreement', doc);
    expect(result.isVerified).toBe(true);
    expect(result.matchType).toBe('exact');
  });

  it('verifies a quote written with smart quotes against source text using straight quotes, and vice versa', () => {
    const doc = makeDocument(['The term "Confidential Information" means any non-public data.']);
    const result = verifyQuote('the term \u201cConfidential Information\u201d means', doc);
    expect(result.isVerified).toBe(true);
  });

  it('correctly resolves pageNumber and offsets for a match on a later page', () => {
    const doc = makeDocument([
      'Page one contains introductory recitals and definitions section.',
      'Page two contains the limitation of liability clause capping damages at fees paid.',
      'Page three contains signature blocks and exhibits.',
    ]);
    const result = verifyQuote('limitation of liability clause capping damages', doc);
    expect(result.isVerified).toBe(true);
    expect(result.pageNumber).toBe(2);
    expect(doc.fullText.slice(result.startChar!, result.endChar!)).toBe(result.matchedText);
  });

  it('does not verify a quote that is not present anywhere in the document', () => {
    const doc = makeDocument(['This Agreement contains no such clause whatsoever.']);
    const result = verifyQuote('a completely fabricated clause about spaceships', doc);
    expect(result.isVerified).toBe(false);
    expect(result.matchType).toBe('unverified');
    expect(result.matchedText).toBeUndefined();
    expect(result.pageNumber).toBeUndefined();
  });

  it('returns unverified (not a crash) for an empty or whitespace-only quote', () => {
    const doc = makeDocument(['Some contract text here.']);
    expect(verifyQuote('', doc).isVerified).toBe(false);
    expect(verifyQuote('   \n\t  ', doc).isVerified).toBe(false);
  });
});

describe('verifyQuote — fuzzy fallback (OCR / extraction jitter)', () => {
  it('verifies a quote with a single OCR-style character substitution above threshold', () => {
    // 'l' -> '1' substitution simulating OCR noise, single word out of many.
    const doc = makeDocument([
      'The Contractor shall maintain commercial general liability insurance throughout the term.',
    ]);
    const noisyQuote = 'The Contractor sha1l maintain commercial general liability insurance';
    const result = verifyQuote(noisyQuote, doc, { fuzzyThreshold: 0.85 });
    expect(result.isVerified).toBe(true);
    expect(result.matchType).toBe('fuzzy');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.confidence).toBeLessThan(1);
  });

  it('verifies a quote missing one word (dropped token) via window-size variance', () => {
    const doc = makeDocument([
      'Either party may terminate this Agreement immediately for material breach of these terms.',
    ]);
    // "immediately" dropped — should still align via +/- token window search.
    const result = verifyQuote('Either party may terminate this Agreement for material breach', doc, {
      fuzzyThreshold: 0.8,
    });
    expect(result.isVerified).toBe(true);
    expect(result.matchType).toBe('fuzzy');
  });

  it('rejects a quote that is only superficially similar (below threshold)', () => {
    const doc = makeDocument(['The Buyer shall pay the Purchase Price within thirty (30) days of Closing.']);
    const result = verifyQuote('The Seller must deliver the Product within sixty (60) days of Signing', doc);
    expect(result.isVerified).toBe(false);
  });

  it('never fabricates page numbers or offsets for an unverified quote', () => {
    const doc = makeDocument(['Totally unrelated boilerplate recitals paragraph number one.']);
    const result = verifyQuote('governing law shall be the State of Delaware exclusively', doc);
    expect(result.isVerified).toBe(false);
    expect(result.startChar).toBeUndefined();
    expect(result.endChar).toBeUndefined();
    expect(result.pageNumber).toBeUndefined();
  });
});

describe('verifyQuotes (batch)', () => {
  it('preserves order and verifies a mix of verified/unverified quotes independently', () => {
    const doc = makeDocument(['Confidentiality survives termination for a period of five years.']);
    const results = verifyQuotes(
      ['survives termination for a period of five years', 'this quote does not exist anywhere'],
      doc,
    );
    expect(results).toHaveLength(2);
    expect(results[0].isVerified).toBe(true);
    expect(results[1].isVerified).toBe(false);
  });
});
