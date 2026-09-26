import { describe, it, expect } from 'vitest';
import { extractClauses, compareDocuments } from '../comparator';
import type { ExtractedDocument } from '@/types';

const docA: ExtractedDocument = {
  id: 'doc-A',
  filename: 'contract_v1.pdf',
  pageCount: 1,
  pages: [
    {
      pageNumber: 1,
      text: 'LIMITATION OF LIABILITY\nTotal liability shall not exceed $100,000.\n\nTERMINATION\nEither party may terminate with 30 days notice.',
      startOffset: 0,
      endOffset: 120,
    },
  ],
  fullText:
    'LIMITATION OF LIABILITY\nTotal liability shall not exceed $100,000.\n\nTERMINATION\nEither party may terminate with 30 days notice.',
  createdAt: Date.now(),
};

const docB: ExtractedDocument = {
  id: 'doc-B',
  filename: 'contract_v2.pdf',
  pageCount: 1,
  pages: [
    {
      pageNumber: 1,
      text: 'LIMITATION OF LIABILITY\nTotal liability shall not exceed $500,000.\n\nTERMINATION\nEither party may terminate with 30 days notice.\n\nGOVERNING LAW\nThis agreement shall be governed by Delaware law.',
      startOffset: 0,
      endOffset: 195,
    },
  ],
  fullText:
    'LIMITATION OF LIABILITY\nTotal liability shall not exceed $500,000.\n\nTERMINATION\nEither party may terminate with 30 days notice.\n\nGOVERNING LAW\nThis agreement shall be governed by Delaware law.',
  createdAt: Date.now(),
};

describe('comparator', () => {
  it('extractClauses extracts paragraphs and headings', () => {
    const clauses = extractClauses(docA);
    expect(clauses.length).toBe(2);
    expect(clauses[0].heading).toBe('LIMITATION OF LIABILITY');
  });

  it('compareDocuments evaluates critical modifications and added clauses', () => {
    const result = compareDocuments(docA, docB);

    expect(result.documentAId).toBe('doc-A');
    expect(result.documentBId).toBe('doc-B');
    expect(result.changes.length).toBeGreaterThanOrEqual(3);

    const criticalChanges = result.changes.filter((c) => c.severity === 'CRITICAL');
    expect(criticalChanges.length).toBeGreaterThan(0);

    const addedChanges = result.changes.filter((c) => c.changeType === 'added');
    expect(addedChanges.length).toBe(1);

    expect(result.summary.critical).toBeGreaterThan(0);
  });
});
