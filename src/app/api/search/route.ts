import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDataFilePath, searchRecords } from '@/lib/lookup';

export async function POST(request: Request) {
  try {
    const { searchQuery } = await request.json();

    if (!searchQuery || !String(searchQuery).trim()) {
      return NextResponse.json(
        { success: false, message: 'الرجاء إدخال ID أو رقم الموبايل' },
        { status: 400 }
      );
    }

    const filePath = getDataFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, message: 'ملف ALL.txt غير موجود على السيرفر' },
        { status: 500 }
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
export const maxDuration = 300;
