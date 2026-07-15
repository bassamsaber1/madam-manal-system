import { NextResponse } from 'next/server';
import { getUsers, saveUsers } from '@/lib/users-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password, role } = body;
    const users = await getUsers();

    if (action === 'login') {
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        return NextResponse.json({ success: true, role: user.role });
      }
      return NextResponse.json(
        { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    if (action === 'add') {
      if (users.some((u) => u.username === username)) {
        return NextResponse.json({ success: false, message: 'اسم المستخدم موجود بالفعل' }, { status: 400 });
      }
      users.push({ username, password, role: role || 'staff' });
      await saveUsers(users);
      return NextResponse.json({
        success: true,
        message: 'تم إضافة المستخدم وحفظه على GitHub ✅',
      });
    }

    if (action === 'list') {
      const safeUsers = users.map(({ username, role }) => ({ username, role }));
      return NextResponse.json({ success: true, users: safeUsers });
    }

    return NextResponse.json({ error: 'العملية غير مدعومة' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في خادم اليوزرات';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
