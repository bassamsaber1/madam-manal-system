import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const getUsersPath = () => path.join(process.cwd(), 'src', 'data', 'system_users.json');

const readUsers = () => {
  const filePath = getUsersPath();
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password, role } = body;
    const users = readUsers();

    if (action === 'login') {
      const user = users.find((u: any) => u.username === username && u.password === password);
      if (user) {
        return NextResponse.json({ success: true, role: user.role });
      }
      return NextResponse.json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    if (action === 'add') {
      if (users.some((u: any) => u.username === username)) {
        return NextResponse.json({ success: false, message: 'اسم المستخدم موجود بالفعل' }, { status: 400 });
      }
      users.push({ username, password, role: role || 'staff' });
      fs.writeFileSync(getUsersPath(), JSON.stringify(users, null, 2), 'utf-8');
      return NextResponse.json({ success: true, message: 'تم إضافة المستخدم بنجاح' });
    }

    if (action === 'list') {
      const safeUsers = users.map(({ username, role }: any) => ({ username, role }));
      return NextResponse.json({ success: true, users: safeUsers });
    }

    return NextResponse.json({ error: 'العملية غير مدعومة' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ في خادم اليوزرات' }, { status: 500 });
  }
}