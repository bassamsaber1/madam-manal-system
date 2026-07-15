# 🇪🇬 Data Egypt | داتا مصر

## 🆓 Render — الخطة المجانية (Free Plan)

الخطة المجانية **ما فيهاش Persistent Disk** — الفهرس بيتمسح لو اتبنى وقت التشغيل.

### ✅ الحل: ارفع الفهرس الجاهز وحمّله وقت الـ Build

#### 1. عندك الفهرس محلياً؟
بعد `npm run build-index` هتلاقي:
```
data/search.db   (~3.7 GB)
```

#### 2. ارفعه على Google Drive أو Mega
- ارفع ملف `search.db`
- خُذ **رابط تحميل مباشر**

**Google Drive:**
```
https://drive.google.com/uc?export=download&id=FILE_ID_HERE
```

#### 3. على Render → Environment Variables
```
SEARCH_DB_URL = رابط التحميل المباشر
```

#### 4. Deploy
- كل deploy هيحمّل الفهرس تلقائياً
- **مش هيتمسح** مع restart عادي
- البحث **فوري** من أول ما الـ deploy يخلص

---

## 💰 لو عندك خطة مدفوعة
أضف **Persistent Disk** 10GB على `/var/data` +:
```
PERSISTENT_DATA_DIR=/var/data
SEARCH_DB_PATH=/var/data/search.db
```

---

## 🔒 حسابات الدخول
| User | Password |
|------|----------|
| admin | admin123 |
| manal | manal123 |

## 🛠️ محلياً
```bash
npm install
npm run build-index   # مرة واحدة (~45 دقيقة)
npm run dev
```
