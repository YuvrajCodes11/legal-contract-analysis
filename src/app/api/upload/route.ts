export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { extractDocument } from '@/lib/extractor';
import { documentStore } from '@/lib/document-store';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided in request.' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extractionResult = await extractDocument({ buffer, filename, mimeType });

    if (extractionResult.status === 'SCANNED_PDF_NO_TEXT') {
      return NextResponse.json(
        {
          success: false,
          status: 'SCANNED_PDF_NO_TEXT',
          message: extractionResult.message,
          filename: extractionResult.filename,
          averageCharsPerPage: extractionResult.averageCharsPerPage,
          totalAlphanumericChars: extractionResult.totalAlphanumericChars,
        },
        { status: 422 }
      );
    }

    if (extractionResult.status !== 'OK') {
      return NextResponse.json(
        {
          success: false,
          error: extractionResult.message,
          filename: extractionResult.filename,
        },
        { status: 400 }
      );
    }

    // Save extracted document & buffer
    documentStore.addDocument(extractionResult.document, buffer, mimeType);

    return NextResponse.json({
      success: true,
      data: extractionResult.document,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Upload processing failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
