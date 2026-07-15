import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDataFilePath, indexExists, isIndexComplete, searchRecords } from '@/lib/lookup';

function getIndexedCount(): number {
  const completePath = path.join(process.cwd(), 'data', 'index.complete');
  const progressPath = path.join(process.cwd(), 'data', 'index.progress');
  if (fs.existsSync(completePath)) {
    return Number(fs.readFileSync(completePath, 'utf-8')) || 0;
  }
  if (fs.existsSync(progressPath)) {
    return Number(fs.readFileSync(progressPath, 'utf-8')) || 0;
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

    if (result.status === 'index_building') {
      const count = getIndexedCount();
      return NextResponse.json(
        {
          success: false,
          indexBuilding: true,
          indexedCount: count,
          message: count
            ? `الفهرس لسه بيتبنى (${count.toLocaleString('ar-EG')} / 45 مليون) — جرب بعد دقائق`
            : 'الفهرس بيتبنى الآن — انتظر 30-45 دقيقة ثم جرب البحث',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'لا توجد بيانات مطابقة لهذا البحث', indexReady: isIndexComplete() },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ success: false, message: 'حدث خطأ أثناء البحث' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
