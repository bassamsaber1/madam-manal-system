import { NextResponse } from 'next/server';
import fs from 'fs';
import { getCompleteFlagPath, getProgressPath } from '@/lib/paths';
import { isSearchReady, searchRecords } from '@/lib/lookup';

function getIndexedCount(): number {
  if (fs.existsSync(getCompleteFlagPath())) {
    return Number(fs.readFileSync(getCompleteFlagPath(), 'utf-8')) || 0;
  }
  if (fs.existsSync(getProgressPath())) {
    return Number(fs.readFileSync(getProgressPath(), 'utf-8')) || 0;
  }
  return 0;
}

export async function POST(request: Request) {
  try {
    const { searchQuery } = await request.json();

    if (!searchQuery || !String(searchQuery).trim()) {
      return NextResponse.json(
        { success: false, message: 'الرجاء إدخال ID أو رقم الموبايل' },
        { status: 400 }
      );
    }

    if (!isSearchReady()) {
      const count = getIndexedCount();
      return NextResponse.json(
        {
          success: false,
          notReady: true,
          indexedCount: count,
          message: count
            ? `جاري تجهيز البيانات (${count.toLocaleString('ar-EG')} / 45 مليون) — انتظر دقائق`
            : 'جاري تجهيز البيانات لأول مرة — انتظر 30-45 دقيقة ثم جرب',
        },
        { status: 503 }
      );
    }

    const result = await searchRecords(String(searchQuery));

    if (result.status === 'found') {
      return NextResponse.json({ success: true, data: result.data });
    }

    return NextResponse.json(
      { success: false, message: 'لا توجد بيانات مطابقة لهذا البحث' },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ success: false, message: 'حدث خطأ أثناء البحث' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
