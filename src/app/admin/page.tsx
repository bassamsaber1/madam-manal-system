'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error('خطأ أثناء جلب المستخدمين');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(data.message);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        setError(data.message || 'فشلت إضافة المستخدم');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالسيرفر');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10 font-sans text-right" dir="rtl text-slate-800">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-slate-800">لوحة التحكم وإدارة اليوزرات ⚙️</h1>
            <p className="text-sm text-slate-400">إضافة موظفين وتعديل صلاحيات دخول سيستم مدام منال</p>
          </div>
          <Link href="/" className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors">⬅️ العودة للرئيسية</Link>
        </div>

        {message && <div className="p-4 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100 text-center">{message}</div>}
        {error && <div className="p-4 bg-rose-50 text-rose-700 font-bold rounded-xl border border-rose-100 text-center">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-1 text-slate-700">
            <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">➕ إضافة مستخدم جديد</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم المستخدم (User)</label>
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-left" placeholder="username" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور (Password)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-left" placeholder="••••••••" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الصلاحية</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg bg-white font-medium">
                  <option value="staff">موظف بحث (Staff)</option>
                  <option value="admin">مسؤول نظام (Admin)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors">حفظ وحساب جديد</button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
            <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">👥 يوزرات السيستم النشطة حالياً</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold">
                    <th className="p-3 rounded-r-lg">اسم المستخدم</th>
                    <th className="p-3">الصلاحية</th>
                    <th className="p-3 rounded-l-lg text-left">حالة الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user: any, index) => (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-700">{user.username}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                          {user.role === 'admin' ? '👑 أدمن' : '💼 موظف'}
                        </span>
                      </td>
                      <td className="p-3 text-left text-xs text-emerald-600 font-bold">● نشط على السيرفر</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}