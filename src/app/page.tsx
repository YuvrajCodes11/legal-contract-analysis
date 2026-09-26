'use client';

import React, { useState, useEffect } from 'react';
import type { ExtractedDocument } from '@/types';
import { Header } from '@/components/workspace/Header';
import { ChatPane } from '@/components/chat/ChatPane';
import { DocumentViewer } from '@/components/viewer/DocumentViewer';
import { FileUploadModal } from '@/components/workspace/FileUploadModal';
import { DocumentLibrary } from '@/components/workspace/DocumentLibrary';
import { ComparisonView } from '@/components/comparison/ComparisonView';

export default function Home() {
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDocuments(data.data);
        if (data.data.length > 0 && !selectedDocId) {
          setSelectedDocId(data.data[0].id);
        }
      }
    } catch (e) {
      // Ignore initial load error
    }
  };

  const handleUploadSuccess = (doc: ExtractedDocument) => {
    setDocuments((prev) => [doc, ...prev]);
    setSelectedDocId(doc.id);
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDocId === id) {
        const remaining = documents.filter((d) => d.id !== id);
        setSelectedDocId(remaining[0]?.id);
      }
    } catch (e) {
      // Ignore delete error
    }
  };

  const selectedDocument = documents.filter(Boolean).find((d) => d.id === selectedDocId) || documents.filter(Boolean)[0];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Workspace Header */}
      <Header
        documentCount={documents.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
      />

      {/* Dual-Pane Workstation Interface */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Chat & Agent Trace Feed (45% width) */}
        <div className="w-[45%] h-full flex flex-col min-w-[380px] max-w-[650px] border-r border-zinc-800">
          <ChatPane
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={(id) => setSelectedDocId(id)}
          />
        </div>

        {/* Right Pane: Responsive PDF & DOCX Document Viewer (55% width) */}
        <div className="flex-1 h-full bg-zinc-950 overflow-hidden">
          <DocumentViewer document={selectedDocument} />
        </div>
      </main>

      {/* Workspace Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <DocumentLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        documents={documents}
        activeDocId={selectedDocId}
        onSelectDoc={(id) => setSelectedDocId(id)}
        onDeleteDoc={handleDeleteDoc}
      />

      <ComparisonView
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        documents={documents}
      />
    </div>
  );
}
