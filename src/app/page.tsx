'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [systemError, setSystemError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError('');
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsLoggedIn(true);
        setUserRole(data.role);
      } else {
        setSystemError(data.message || 'خطأ في بيانات الدخول');
      }
    } catch (err) {
      setSystemError('تعذر الاتصال بسيرفر التحكم باليوزرات');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError('');
    setSearchResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSearchResult(data.data);
      } else {
        setSystemError(data.message || 'الداتا مش موجودة يا فندم!');
      }
    } catch (err) {
      setSystemError('خطأ أثناء جلب البيانات من السيرفر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 font-sans text-right" dir="rtl">
      <div className="hidden md:block md:w-1/2 lg:w-2/3 bg-cover bg-center relative" style={{ backgroundImage: "url('/manal-bg.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/10 via-black/40 to-black/70"></div>
        <div className="absolute bottom-12 right-12 text-white z-10 hidden lg:block text-right">
          <h1 className="text-5xl font-black mb-3 tracking-wide drop-shadow-lg">Madam Manal Bt3at elkhodar</h1>
          <p className="text-emerald-400 text-xl font-medium drop-shadow-md">منظومة تدقيق وفحص البيانات والملفات الذكية</p>
        </div>
      </div>

      <div className="w-full md:w-1/2 lg:w-1/3 flex flex-col justify-center px-8 sm:px-12 bg-white shadow-2xl z-20 overflow-y-auto text-slate-800">
        <div className="mb-8 text-center md:text-right">
          <h2 className="text-3xl font-black text-slate-800 mb-1">مدام منال بتاعة الخضار</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider text-left md:text-right" dir="ltr">
            Madam Manal Bt3at elkhodar
          </p>
        </div>

        {systemError && <div className="p-4 mb-6 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">{systemError}</div>}

        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 font-semibold leading-relaxed">
              🔐 يرجى تسجيل الدخول للوصول لمحرك فحص واستخراج البيانات من ملف الداتا.
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-left font-mono" placeholder="Username" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-left" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg">{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
              <span>مرحباً بك: <strong className="font-bold">{username}</strong></span>
              {userRole === 'admin' && (
                <Link href="/admin" className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors">
                  ⚙️ لوحة الأدمن
                </Link>
              )}
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ابحث في ملف البيانات</label>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="اكتب الـ ID أو رقم الموبايل المطلوب..." className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-center text-slate-800" required />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg">{loading ? 'جاري الفحص...' : 'فحص واستخراج البيانات'}</button>
            </form>

            {searchResult && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-inner">
                <h3 className="text-xs font-bold text-emerald-600 border-b pb-2">تم مطابقة العميل بنجاح ✅</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">رقم التعريف (ID):</span>
                  <span className="font-mono bg-white px-2.5 py-1 rounded border font-bold text-slate-800">{searchResult.id}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">رقم الموبايل المسجل:</span>
                  <span className="font-mono bg-white px-2.5 py-1 rounded border font-bold text-slate-800">{searchResult.phone}</span>
                </div>
              </div>
            )}
            
            <button onClick={() => { setIsLoggedIn(false); setSearchResult(null); setUsername(''); setPassword(''); }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors text-center block font-medium">تسجيل الخروج</button>
          </div>
        )}

        <div className="mt-auto pt-8 text-center text-xs text-slate-400">جميع الحقوق محفوظة لسيستم مدام منال © 2026</div>
      </div>
    </div>
  );
}