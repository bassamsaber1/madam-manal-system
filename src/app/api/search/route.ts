import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { searchQuery } = await request.json();

    if (!searchQuery) {
      return NextResponse.json({ error: 'الرجاء إدخال الـ ID أو رقم الموبايل' }, { status: 400 });
    }

    const cleanQuery = searchQuery.trim().replace(/["\s+]/g, '');

    const filePath = path.join(process.cwd(), 'src', 'data', 'all.txt');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'ملف البيانات غير موجود على السيرفر' }, { status: 500 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    let foundData = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(',');
      if (parts.length >= 2) {
        const id = parts[0].replace(/["\s]/g, '').trim();
        const phone = parts[1].replace(/["\s+]/g, '').trim();

        if (id === cleanQuery || phone === cleanQuery) {
          foundData = { 
            id: parts[0].replace(/"/g, '').trim(), 
            phone: parts[1].replace(/"/g, '').trim() 
          };
          break;
        }
      }
    }

    if (foundData) {
      return NextResponse.json({ success: true, data: foundData });
    } else {
      return NextResponse.json({ success: false, message: 'الداتا مش موجودة يا فندم!' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ أثناء فحص الملف' }, { status: 500 });
  }
}