'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

type SearchRecord = {
  id: string;
  phone: string;
};

const SESSION_KEY = 'data_egypt_session';
const SESSION_MS = 20 * 60 * 1000;

type StoredSession = {
  username: string;
  role: string;
  expiresAt: number;
};

function saveSession(username: string, role: string) {
  const session: StoredSession = {
    username,
    role,
    expiresAt: Date.now() + SESSION_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchRecord | null>(null);
  const [systemError, setSystemError] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback((message?: string) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    clearSession();
    setIsLoggedIn(false);
    setUserRole('');
    setSearchResult(null);
    setSearchQuery('');
    setUsername('');
    setPassword('');
    setSystemError(message || '');
  }, []);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setIsLoggedIn(true);
      setUserRole(session.role);
      setUsername(session.username);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const session = readSession();
    if (!session) {
      handleLogout('انتهت الجلسة — سجّل الدخول مرة أخرى');
      return;
    }

    const remaining = session.expiresAt - Date.now();
    logoutTimerRef.current = setTimeout(
      () => handleLogout('انتهت الجلسة بعد 20 دقيقة — سجّل الدخول مرة أخرى'),
      remaining
    );

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [isLoggedIn, handleLogout]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const checkIndex = async () => {
      try {
        const res = await fetch('/api/index-status');
        const data = await res.json();
        setIndexBuilding(data.building);
        setIndexedCount(data.indexedCount || 0);
      } catch {
        /* ignore */
      }
    };

    checkIndex();
    const timer = setInterval(checkIndex, 15000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

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
        saveSession(username, data.role);
        setIsLoggedIn(true);
        setUserRole(data.role);
      } else {
        setSystemError(data.message || 'خطأ في بيانات الدخول');
      }
    } catch {
      setSystemError('تعذر الاتصال بالسيرفر');
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
        setSystemError(data.message || 'لا توجد بيانات مطابقة');
      }
    } catch {
      setSystemError('خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  const onManualLogout = () => handleLogout();

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row bg-slate-950 font-sans text-right" dir="rtl">
      <div
        className="relative w-full md:w-1/2 lg:w-[58%] min-h-[220px] sm:min-h-[280px] md:min-h-screen bg-cover bg-center bg-no-repeat shrink-0"
        style={{ backgroundImage: "url('/manal-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-slate-950/20 via-slate-950/50 to-slate-950/90" />
        <div className="relative z-10 flex flex-col justify-end h-full p-6 sm:p-10 md:p-12 text-white">
          <div className="inline-flex items-center gap-2 w-fit mb-4 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Data Egypt Platform
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 leading-tight drop-shadow-lg">داتا مصر</h1>
          <p className="text-base sm:text-lg text-emerald-300 font-semibold mb-3" dir="ltr">
            Data Egypt Search &amp; Analysis
          </p>
          <p className="text-sm sm:text-base text-slate-200/90 max-w-lg leading-relaxed">
            +45 مليون سجل بيانات — ابحث بالـ ID أو الموبايل في ثوانٍ
          </p>
        </div>
      </div>

      <div className="w-full md:w-1/2 lg:w-[42%] flex flex-col bg-white md:shadow-2xl z-20">
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-10 lg:px-12 py-8 sm:py-10 overflow-y-auto text-slate-800">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">لوحة الدخول</h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">+45 مليون سجل — بحث وتحليل فوري</p>
          </div>

          {systemError && (
            <div className="p-3 sm:p-4 mb-5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">
              {systemError}
            </div>
          )}

          {!isLoggedIn ? (
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs sm:text-sm text-slate-500 leading-relaxed">
                🔐 سجّل الدخول للوصول إلى محرك البحث في 45+ مليون سجل
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left font-mono text-base"
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left text-base"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-base"
              >
                {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </button>
            </form>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {indexBuilding && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-semibold text-center">
                  ⏳ الفهرس بيتبنى ({indexedCount.toLocaleString('ar-EG')} / 45 مليون) — البحث شغال
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 sm:p-4 text-sm text-emerald-800">
                <span>
                  مرحباً: <strong>{username}</strong>
                  <span className="block text-[10px] text-emerald-600/80 mt-0.5">الجلسة نشطة لمدة 20 دقيقة</span>
                </span>
                {userRole === 'admin' && (
                  <Link
                    href="/admin"
                    className="text-center text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                  >
                    ⚙️ لوحة الأدمن
                  </Link>
                )}
              </div>

              <SearchGuide />

              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ابحث في 45+ مليون سجل</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID أو رقم الموبايل..."
                    className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-center text-slate-800 text-base"
                    inputMode="search"
                    autoComplete="off"
                    required
                  />
                  <p className="mt-2 text-xs text-slate-400 text-center">نتائج فورية ودقيقة — ID · موبايل</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-base"
                >
                  {loading ? 'جاري البحث...' : '🔍 بحث واستخراج البيانات'}
                </button>
              </form>

              {searchResult && (
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-inner">
                  <h3 className="text-xs font-bold text-emerald-600 border-b border-slate-200 pb-2">
                    ✅ تم العثور على البيانات
                  </h3>
                  <FacebookProfileLink id={searchResult.id} />
                  <ResultRow label="رقم الموبايل" value={searchResult.phone} />
                </div>
              )}

              <button
                onClick={onManualLogout}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center font-medium"
              >
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-10 py-4 text-center text-xs text-slate-400 border-t border-slate-100">
          Data Egypt © 2026 — جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
}

function SearchGuide() {
  return (
    <div className="p-4 sm:p-5 bg-blue-50 border border-blue-100 rounded-2xl space-y-3">
      <h3 className="text-sm font-black text-blue-900">📋 طريقة البحث بالـ ID</h3>
      <ol className="space-y-2.5 text-xs sm:text-sm text-blue-900/90 leading-relaxed list-none">
        <li className="flex gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
          <span>خُذ رابط حساب الفيسبوك (Profile URL)</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
          <span>
            ضعه في موقع{' '}
            <a
              href="https://findidfb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900"
              dir="ltr"
            >
              findidfb.com
            </a>{' '}
            — هيطلع لك الـ ID
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
          <span>انسخ الـ ID وحطه في خانة البحث — سيتم استخراج النتائج فوراً</span>
        </li>
      </ol>
      <a
        href="https://findidfb.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors"
        dir="ltr"
      >
        🔗 findidfb.com — استخراج ID من رابط Facebook
      </a>
    </div>
  );
}

function FacebookProfileLink({ id }: { id: string }) {
  const profileUrl = `https://www.facebook.com/${id}`;

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm">
      <span className="font-semibold text-slate-500">رابط Facebook</span>
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 font-bold text-blue-700 break-all text-left transition-colors underline underline-offset-2"
        dir="ltr"
      >
        {profileUrl}
      </a>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span
        className="font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-800 break-all text-left"
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}
