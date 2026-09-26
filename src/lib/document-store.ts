/**
 * Document Store
 * ------------------------------------------------------------------------
 * Thread-safe, in-memory repository for ExtractedDocument instances
 * and raw uploaded file buffers.
 */

import type { ExtractedDocument } from '@/types';

class DocumentStore {
  private documents: Map<string, ExtractedDocument> = new Map();
  private fileBuffers: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  /**
   * Adds an extracted document and optional file buffer to the store.
   */
  public addDocument(
    doc: ExtractedDocument,
    buffer?: Buffer,
    mimeType?: string
  ): void {
    this.documents.set(doc.id, doc);
    if (buffer) {
      this.fileBuffers.set(doc.id, {
        buffer,
        mimeType: mimeType || (doc.filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      });
    }
  }

  /**
   * Retrieves an ExtractedDocument by ID.
   */
  public getDocument(id: string): ExtractedDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Retrieves raw file buffer and MIME type by document ID.
   */
  public getFileBuffer(id: string): { buffer: Buffer; mimeType: string } | undefined {
    return this.fileBuffers.get(id);
  }

  /**
   * Lists all stored documents.
   */
  public listDocuments(): ExtractedDocument[] {
    return Array.from(this.documents.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Deletes a document by ID.
   */
  public deleteDocument(id: string): boolean {
    const existed = this.documents.has(id);
    this.documents.delete(id);
    this.fileBuffers.delete(id);
    return existed;
  }

  /**
   * Clears all stored documents.
   */
  public clear(): void {
    this.documents.clear();
    this.fileBuffers.clear();
  }
}

// Global instance preserved across HMR in Next.js dev server
const globalForStore = globalThis as unknown as { documentStore?: DocumentStore };

export const documentStore = globalForStore.documentStore || new DocumentStore();
if (process.env.NODE_ENV !== 'production') {
  globalForStore.documentStore = documentStore;
}
