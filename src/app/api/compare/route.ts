import { NextRequest, NextResponse } from 'next/server';
import { documentStore } from '@/lib/document-store';
import { compareDocuments } from '@/lib/comparator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentAId, documentBId } = body;

    if (!documentAId || !documentBId) {
      return NextResponse.json(
        { success: false, error: 'Both documentAId and documentBId are required.' },
        { status: 400 }
      );
    }

    const docA = documentStore.getDocument(documentAId);
    const docB = documentStore.getDocument(documentBId);

    if (!docA || !docB) {
      return NextResponse.json(
        { success: false, error: 'One or both documents were not found in the store.' },
        { status: 404 }
      );
    }

    const comparison = compareDocuments(docA, docB);

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Comparison failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
