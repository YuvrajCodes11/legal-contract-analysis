import { NextRequest, NextResponse } from 'next/server';
import { documentStore } from '@/lib/document-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const raw = searchParams.get('raw');

  if (id) {
    const doc = documentStore.getDocument(id);
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    if (raw === 'true') {
      const fileData = documentStore.getFileBuffer(id);
      if (fileData) {
        return new Response(new Uint8Array(fileData.buffer), {
          headers: {
            'Content-Type': fileData.mimeType,
            'Content-Disposition': `inline; filename="${doc.filename}"`,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: doc });
  }

  const list = documentStore.listDocuments();
  return NextResponse.json({ success: true, data: list });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID parameter is required' }, { status: 400 });
  }

  const deleted = documentStore.deleteDocument(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Document deleted successfully' });
}
