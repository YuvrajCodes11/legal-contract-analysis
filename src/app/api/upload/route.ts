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
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      return NextResponse.json(
        { success: false, error: `Unsupported file extension "${ext}". Only PDF and DOCX are supported.` },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await extractDocument(buffer, file.name, file.type);

    if (result.status === 'SCANNED_PDF_NO_TEXT') {
      return NextResponse.json(result, { status: 422 });
    }
    if (result.status === 'UNSUPPORTED_FORMAT') {
      return NextResponse.json(result, { status: 415 });
    }
    if (result.status === 'EXTRACTION_ERROR') {
      return NextResponse.json(result, { status: 500 });
    }

    const document = result.document;
    documentStore.addDocument(document, buffer, file.type);

    return NextResponse.json({
      success: true,
      document,
      data: document,
      documentId: document.id,
      id: document.id,
    });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return NextResponse.json(
      { success: false, error: `Upload failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
