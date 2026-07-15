import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDataFilePath, indexExists, isIndexComplete, searchRecords } from '@/lib/lookup';

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
    if (!fs.existsSync(filePath) && !indexExists()) {
      return NextResponse.json(
        { success: false, message: 'ملف البيانات غير موجود على السيرفر' },
        { status: 500 }
      );
    }

    const result = await searchRecords(String(searchQuery));

    if (result.status === 'found') {
      return NextResponse.json({
        success: true,
        data: result.data,
        indexReady: isIndexComplete(),
      });
    }

    return NextResponse.json(
      { success: false, message: 'لا توجد بيانات مطابقة لهذا البحث', indexReady: isIndexComplete() },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ success: false, message: 'حدث خطأ أثناء البحث' }, { status: 500 });
  }
}
