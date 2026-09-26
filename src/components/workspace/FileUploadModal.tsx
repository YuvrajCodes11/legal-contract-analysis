import React, { useState, useRef } from 'react';
import type { ExtractedDocument } from '@/types';
import { Upload, FileText, AlertTriangle, X, CheckCircle2, FileCode } from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (doc: ExtractedDocument) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAlert, setScannedAlert] = useState<{
    filename: string;
    message: string;
    averageCharsPerPage: number;
    totalAlphanumericChars: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setError(null);
    setScannedAlert(null);

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      setError(`Unsupported file extension "${ext}". Strictly PDF (.pdf) and DOCX (.docx) documents are supported.`);
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error("Upload failed (" + res.status + "): " + (resText || res.statusText || "Server error"));
      }

      if (res.status === 422 && data.status === 'SCANNED_PDF_NO_TEXT') {
        setScannedAlert({
          filename: data.filename,
          message: data.message,
          averageCharsPerPage: data.averageCharsPerPage,
          totalAlphanumericChars: data.totalAlphanumericChars,
        });
        setIsUploading(false);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload document.');
      }

      onUploadSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100 uppercase font-mono tracking-wider">
              Upload Legal Contract
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all ${
              isDragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />

            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <FileCode className="w-6 h-6 text-zinc-400" />
            </div>

            <p className="text-xs font-semibold text-zinc-200">
              {isUploading ? 'Ingesting and parsing document text...' : 'Click to browse or drop PDF / DOCX file here'}
            </p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">
              Supports searchable PDF (.pdf) and Word DOCX (.docx) up to 50MB
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Upload Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Scanned PDF No Text Trap Alert */}
          {scannedAlert && (
            <div className="p-3.5 rounded bg-amber-950/40 border border-amber-800 text-amber-200 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>SCANNED_PDF_NO_TEXT Detected</span>
              </div>
              <p className="text-zinc-300 font-sans text-xs">
                {scannedAlert.message} The uploaded file &ldquo;{scannedAlert.filename}&rdquo; has no OCR text layer.
              </p>
              <div className="bg-zinc-900/80 p-2 rounded border border-amber-900/50 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Average Chars / Page:</span>
                  <span className="font-semibold text-amber-300">{scannedAlert.averageCharsPerPage.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Alphanumeric Chars:</span>
                  <span className="font-semibold text-amber-300">{scannedAlert.totalAlphanumericChars}</span>
                </div>
              </div>
              <p className="text-[10px] text-amber-400/80 italic">
                Please re-upload an OCR-processed PDF or DOCX file with readable text layers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
