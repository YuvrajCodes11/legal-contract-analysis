import { NextRequest, NextResponse } from 'next/server';
import { extractDocument } from '@/lib/extractor';
import { documentStore } from '@/lib/document-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const document = await extractDocument(buffer, file.name, file.type);

    documentStore.addDocument(document);

    return NextResponse.json({
      success: true,
      document,
      documentId: document.id,
      id: document.id,
    });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process document upload.' },
      { status: 500 }
    );
  }
}
