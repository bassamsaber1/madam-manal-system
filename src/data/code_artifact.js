const express = require('express');
const fs = require('fs').promises; // Safe async file operations to prevent blocking DoS
const { existsSync } = require('fs'); // Only used for sync checking at startup
const path = require('path');
const crypto = require('crypto'); // Built-in advanced cryptography library for signing and hashing

const app = express();
const PORT = process.env.PORT || 3000;

// Security configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'); // Dynamic highly secure cryptokey
const PASSWORD_SALT_LENGTH = 16;

// Force JSON size limit to prevent Payload Injection / Buffer Overflow DoS attacks
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
    // Prevent Clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    // Block MIME-sniffing vulnerabilities
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Sanitize XSS vectors
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Safe Referrer Policy
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// Database file paths
const CLIENTS_FILE_PATH = path.join(__dirname, 'all.txt');
const USERS_FILE_PATH = path.join(__dirname, 'users.json');
const LOGS_FILE_PATH = path.join(__dirname, 'logs.json');

// Advanced PBKDF2 Secure Password Hashing
function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(PASSWORD_SALT_LENGTH).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// Generate Secure Cryptographic Token to replace easily fakeable client data
function generateSecureToken(userPayload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const expiresAt = Date.now() + (3600 * 1000 * 12); // Token valid for 12 hours
    const payload = Buffer.from(JSON.stringify({ ...userPayload, exp: expiresAt })).toString('base64url');
    
    const signature = crypto.createHmac('sha256', JWT_SECRET)
                            .update(`${header}.${payload}`)
                            .digest('base64url');
    return `${header}.${payload}.${signature}`;
}

// Verify Secure Cryptographic Token signature and expiration
function verifySecureToken(token) {
    try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [header, payload, signature] = parts;
        const verifiedSignature = crypto.createHmac('sha256', JWT_SECRET)
                                        .update(`${header}.${payload}`)
                                        .digest('base64url');
        
        if (signature !== verifiedSignature) return null; // Reject forged/tampered tokens
        
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (Date.now() > decodedPayload.exp) return null; // Reject expired sessions
        
        return decodedPayload;
    } catch (e) {
        return null;
    }
}

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const user = verifySecureToken(token);
        if (user) {
            req.user = user;
            return next();
        }
    }
    return res.status(401).json({ success: false, message: "غير مصرح لك بالوصول، الجلسة منتهية أو مزيفة 🔒" });
}

function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ success: false, message: "صلاحية غير كافية، هذه العملية للمشرفين فقط 🛡️" });
}

async function initDatabaseFiles() {
    // 1. Initialize Users Database with salted hashes instead of plaintext
    if (!existsSync(USERS_FILE_PATH)) {
        const passAdmin = hashPassword("admin123");
        const passManal = hashPassword("manal123");
        
        const defaultUsers = [
            { username: "admin", hash: passAdmin.hash, salt: passAdmin.salt, fullname: "بسام المشرف", role: "admin" },
            { username: "manal", hash: passManal.hash, salt: passManal.salt, fullname: "مدام منال", role: "staff" }
        ];
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(defaultUsers, null, 4), 'utf-8');
    }

    // 2. Initialize Logs Database
    if (!existsSync(LOGS_FILE_PATH)) {
        const defaultLogs = [
            { id: "log-init", user: "system", action: "system", text: "تم تشغيل سيرفر مدام منال وبناء نظام التشفير والحماية والمصادقة الأمنية بنجاح 🛡️", time: new Date().toLocaleTimeString('ar-EG') }
        ];
        await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(defaultLogs, null, 4), 'utf-8');
    }

    // 3. Initialize default clients file (all.txt) if not present
    if (!existsSync(CLIENTS_FILE_PATH)) {
        const defaultClients = `"100007319070330","+201002258912"\n"100005342984321","+201003389658"\n"100014797141860","+201007264681"`;
        await fs.writeFile(CLIENTS_FILE_PATH, defaultClients, 'utf-8');
    }
}

// Safe async log writer
async function writeLog(username, actionType, logText) {
    try {
        let logs = [];
        if (existsSync(LOGS_FILE_PATH)) {
            const data = await fs.readFile(LOGS_FILE_PATH, 'utf-8');
            logs = JSON.parse(data);
        }
        
        // Clean dynamic parameters to protect against Stored XSS logs
        const safeUsername = String(username).replace(/[<>]/g, "");
        const safeText = String(logText).replace(/[<>]/g, "");

        const newLog = {
            id: `log-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
            user: safeUsername,
            action: actionType,
            text: safeText,
            time: new Date().toLocaleTimeString('ar-EG')
        };
        logs.unshift(newLog); // Put latest logs first
        if (logs.length > 1000) logs = logs.slice(0, 1000);
        await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(logs, null, 4), 'utf-8');
    } catch (err) {
        console.error("Error writing logs:", err);
    }
}

initDatabaseFiles().then(() => {
    console.log("🔒 Security protocols initialized. Database storage secured.");
});

const rateLimiterStore = {};
function rateLimiter(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    if (!rateLimiterStore[ip]) {
        rateLimiterStore[ip] = [];
    }
    // Keep requests made in the last 1 minute
    rateLimiterStore[ip] = rateLimiterStore[ip].filter(timestamp => now - timestamp < 60000);
    if (rateLimiterStore[ip].length >= 30) { // Limit to 30 API calls per minute
        return res.status(429).json({ success: false, message: "تم كشف محاولة إغراق! يرجى الانتظار دقيقة والمحاولة مجدداً لحماية الخادم ⚠️" });
    }
    rateLimiterStore[ip].push(now);
    next();
}

// Secure Login API with Rate Limiting & PBKDF2 Password verification
app.post('/api/login', rateLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "يرجى تعبئة جميع الحقول" });
        }

        const safeUsername = String(username).trim().toLowerCase();
        const data = await fs.readFile(USERS_FILE_PATH, 'utf-8');
        const users = JSON.parse(data);
        
        const matchedUser = users.find(u => u.username.toLowerCase() === safeUsername);

        if (matchedUser) {
            // Verify Password Hash
            const { hash } = hashPassword(password, matchedUser.salt);
            if (hash === matchedUser.hash) {
                // Generate signed cryptographically secure web token
                const token = generateSecureToken({
                    username: matchedUser.username,
                    fullname: matchedUser.fullname,
                    role: matchedUser.role
                });

                await writeLog(matchedUser.username, "system", `تم تسجيل دخول موفق للمنظومة بصلاحية: ${matchedUser.role === 'admin' ? 'مشرف نظام' : 'موظف فحص'}`);
                return res.json({
                    success: true,
                    token: token,
                    user: {
                        username: matchedUser.username,
                        fullname: matchedUser.fullname,
                        role: matchedUser.role
                    }
                });
            }
        }
        
        await writeLog(safeUsername || "مجهول", "fail", "محاولة تسجيل دخول فاشلة بالسيستم بسبب بيانات خاطئة أو هجوم brute force");
        return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "خطأ داخلي في السيرفر" });
    }
});

// Secure Search Match API
app.post('/api/search', authenticateJWT, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, message: "يرجى كتابة رقم الـ ID أو رقم الموبايل للبحث" });
        }

        const cleanQuery = query.trim().replace(/["\s+]/g, ''); // Deep sanitize input query to prevent parsing escape exploits
        const executor = req.user.username;

        if (!existsSync(CLIENTS_FILE_PATH)) {
            await writeLog(executor, "fail", `فشل الفحص للطلب بسبب عدم وجود ملف البيانات`);
            return res.status(404).json({ success: false, message: "خطأ: ملف البيانات  غير موجود على السيرفر" });
        }

        const fileContent = await fs.readFile(CLIENTS_FILE_PATH, 'utf-8');
        const lines = fileContent.split('\n');
        let matchedClient = null;

        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split(',');
            if (parts.length >= 2) {
                const id = parts[0].replace(/["\s]/g, '').trim();
                const phone = parts[1].replace(/["\s+]/g, '').trim();

                if (id === cleanQuery || phone === cleanQuery) {
                    matchedClient = {
                        id: parts[0].replace(/"/g, '').trim(),
                        phone: parts[1].replace(/"/g, '').trim()
                    };
                    break;
                }
            }
        }

        if (matchedClient) {
            await writeLog(executor, "success", `تم العثور على العميل ومطابقة السجلات للطلب: "${cleanQuery}"`);
            return res.json({ success: true, data: matchedClient });
        } else {
            await writeLog(executor, "fail", `فحص ومطابقة غير ناجحة للطلب: "${cleanQuery}" (الداتا مش موجودة)`);
            return res.status(404).json({ success: false, message: "الداتا مش موجوده يا فندم!" });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "خطأ أثناء قراءة ملف البيانات" });
    }
});

// Get Dashboard Data (Protected with signed JWT validation)
app.post('/api/admin/dashboard', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf-8');
        const users = JSON.parse(usersData).map(u => ({ username: u.username, fullname: u.fullname, role: u.role })); // Strip password salt/hash for complete security
        
        const logsData = await fs.readFile(LOGS_FILE_PATH, 'utf-8');
        const logs = JSON.parse(logsData);
        
        let rawClients = "";
        let clientsCount = 0;
        if (existsSync(CLIENTS_FILE_PATH)) {
            rawClients = await fs.readFile(CLIENTS_FILE_PATH, 'utf-8');
            clientsCount = rawClients.split('\n').filter(l => l.trim()).length;
        }

        return res.json({
            success: true,
            users,
            logs,
            rawClients,
            clientsCount
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "فشل استيراد بيانات الإدارة" });
    }
});

// Add Employee Endpoint
app.post('/api/admin/add-user', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const { newUsername, newPassword, newFullname, newRole } = req.body;
        if (!newUsername || !newPassword || !newFullname) {
            return res.status(400).json({ success: false, message: "يرجى تعبئة كافة حقول الموظف" });
        }

        const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''); // Strict documentation against exploits
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf-8');
        const users = JSON.parse(usersData);
        
        if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
            return res.status(400).json({ success: false, message: "اسم المستخدم هذا مسجل مسبقاً لموظف آخر" });
        }

        // Salt and hash the new password securely
        const { hash, salt } = hashPassword(newPassword);

        const newUser = {
            username: cleanUsername,
            hash: hash,
            salt: salt,
            fullname: newFullname.trim().replace(/[<>]/g, ''), // escape XSS
            role: newRole === "admin" ? "admin" : "staff"
        };
        users.push(newUser);
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 4), 'utf-8');

        await writeLog(req.user.username, "info", `تم تسجيل موظف تشغيل جديد: ${newUser.fullname} (@${newUser.username}) وصلاحية ${newUser.role}`);
        return res.json({ success: true, message: "تم تسجيل حساب الموظف الجديد بنجاح" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "فشل تسجيل الموظف" });
    }
});

// Delete Employee Endpoint
app.post('/api/admin/delete-user', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const { targetUsername } = req.body;

        if (targetUsername === 'admin') {
            return res.status(400).json({ success: false, message: "أمان السيستم: لا يمكن حذف حساب المشرف الرئيسي!" });
        }

        let users = JSON.parse(await fs.readFile(USERS_FILE_PATH, 'utf-8'));
        users = users.filter(u => u.username !== targetUsername);
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 4), 'utf-8');

        await writeLog(req.user.username, "info", `تم حذف حساب وإلغاء صلاحيات الموظف: @${targetUsername}`);
        return res.json({ success: true, message: "تم إزالة الموظف بنجاح" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "فشل حذف الموظف" });
    }
});

// Save Raw data directly to all.txt
app.post('/api/admin/save-data', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const { rawData } = req.body;
        // Strict input sanitization of database modifications
        const sanitizedData = String(rawData).replace(/[^0-9,"\n+]/g, ''); 
        
        await fs.writeFile(CLIENTS_FILE_PATH, sanitizedData, 'utf-8');
        const clientsCount = sanitizedData.split('\n').filter(l => l.trim()).length;

        await writeLog(req.user.username, "info", `تعديل ملف البيانات الرئيسي all.txt - يحتوي الآن على ${clientsCount} عميل`);
        return res.json({ success: true, message: `تم تحديث ملف البيانات بنجاح! يحتوي الآن على ${clientsCount} سطر` });
    } catch (err) {
        return res.status(500).json({ success: false, message: "فشل حفظ وتحديث الداتا" });
    }
});

// Clear Logs Endpoint
app.post('/api/admin/clear-logs', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const freshLogs = [
            { id: `log-${Date.now()}`, user: "system", action: "success", text: "تم تفريغ وتنظيف سجل المراقبة والاستخدام بواسطة الأدمن 🧹", time: new Date().toLocaleTimeString('ar-EG') }
        ];
        await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(freshLogs, null, 4), 'utf-8');

        await writeLog(req.user.username, "success", "تم تصفير سجلات الاستخدام بالكامل");
        return res.json({ success: true, message: "تم تصفير السجلات بنجاح" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "فشل تنظيف السجلات" });
    }
});

// Serve UI via Express Server Route
app.get('/', (req, res) => {
    const htmlPage = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مدام منال بتاعة الخضار | MADAM MANAL</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap');
        body {
            font-family: 'Cairo', sans-serif;
            background-color: #060913;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #090d16;
        }
        ::-webkit-scrollbar-thumb {
            background: #10b981;
            border-radius: 4px;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
            animation: fadeIn 0.4s ease-out forwards;
        }
    </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col justify-between overflow-x-hidden">

    <div id="toast-container" class="fixed top-6 left-6 z-50 space-y-3 max-w-sm w-full"></div>

    <main class="flex-grow flex flex-col justify-center">

        <section id="page-login" class="min-h-screen w-full flex flex-col lg:flex-row animate-fadeIn">
            
            <div class="hidden lg:flex lg:w-3/5 xl:w-2/3 bg-gradient-to-tr from-emerald-950 via-slate-900 to-[#060913] relative items-center justify-end p-12 overflow-hidden">
                <div class="absolute inset-0 opacity-[0.05] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
                <div class="absolute -bottom-16 -left-16 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div class="absolute -top-16 -right-16 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div class="text-right z-20 max-w-xl space-y-6">
                    <div class="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full backdrop-blur-md">
                        <span class="flex h-3 w-3 relative">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span class="text-xs text-emerald-400 font-bold tracking-wider">نظام فحص وتأمين البيانات النشط 🛡️</span>
                    </div>
                    
                    <div class="space-y-2">
                        <h1 class="text-6xl font-black text-white leading-tight drop-shadow-2xl">مدام منال بتاعة الخضار</h1>
                        <p class="text-2xl font-bold text-emerald-400 tracking-wider uppercase font-mono">Madam Manal Bt3at elkhodar</p>
                    </div>
                    <p class="text-slate-300 leading-relaxed text-sm">
                        البوابة الرقمية الموحدة لتدقيق وتتبع سجلات العملاء ومطابقة البيانات المرجعية بدقة متناهية وسرعة فورية من واقع ملف all.txt المباشر.
                    </p>
                </div>
            </div>

            <div class="w-full lg:w-2/5 xl:w-1/3 bg-[#0d1424] border-r border-slate-800 flex flex-col justify-between p-8 sm:p-12 relative">
                <div class="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
                
                <div class="my-auto space-y-8 z-10">
                    <div class="text-center lg:text-right space-y-2">
                        <div class="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto lg:mx-0 shadow-lg mb-4">
                            <span class="text-4xl">🥬</span>
                        </div>
                        <h2 class="text-3xl font-black text-white">تسجيل الدخول</h2>
                        <p class="text-xs text-slate-400">يرجى تسجيل الدخول بحسابك المعتمد للوصول لبيانات الملف</p>
                    </div>

                    <form onsubmit="handleLogin(event)" class="space-y-5">
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">اسم المستخدم</label>
                            <input type="text" id="login-username" class="w-full bg-[#060913] border border-slate-800 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left font-mono font-bold transition-all" placeholder="username" required>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">كلمة المرور</label>
                            <input type="password" id="login-password" class="w-full bg-[#060913] border border-slate-800 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left font-bold transition-all" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.99]">
                            دخول للوحة التحكم والمطابقة
                        </button>
                    </form>
                </div>

                <div class="pt-8 border-t border-slate-800/60 flex justify-between items-center text-[11px] text-slate-500 font-medium">
                    <span>جميع الحقوق محفوظة © 2026</span>
                    <span>v2.5.0-Production-Hardened</span>
                </div>
            </div>

        </section>

        <section id="page-dashboard" class="hidden min-h-screen w-full flex flex-col bg-[#060913] animate-fadeIn">
            
            <header class="border-b border-slate-800/80 bg-[#0d1424]/80 backdrop-blur-md sticky top-0 z-40">
                <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">🥬</span>
                        <div>
                            <h1 class="text-lg font-black text-white leading-none">مدام منال بتاعة الخضار</h1>
                            <span class="text-[9px] text-emerald-400 font-mono tracking-widest uppercase" dir="ltr">Madam Manal Bt3at elkhodar</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <span id="user-badge" class="bg-slate-800/60 text-slate-300 border border-slate-700/60 px-3.5 py-1.5 rounded-xl text-xs font-bold"></span>
                        <button id="btn-admin-panel" onclick="toggleView('admin')" class="hidden bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-xl text-xs font-black hover:bg-emerald-600 hover:text-white transition-all shadow-md">
                            ⚙️ لوحة الإدارة والنشاط
                        </button>
                        <button onclick="handleLogout()" class="bg-rose-950/40 text-rose-400 border border-rose-900/30 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-600 hover:text-white transition-all">
                            تسجيل الخروج 🔒
                        </button>
                    </div>
                </div>
            </header>

            <div class="max-w-4xl mx-auto w-full p-4 sm:p-8 flex-grow flex flex-col justify-center">
                
                <div class="bg-[#0d1424] border border-slate-800 p-6 sm:p-10 rounded-3xl shadow-2xl space-y-8 relative">
                    <div class="absolute inset-0 opacity-[0.01] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

                    <div class="text-center space-y-2 z-10 relative">
                        <h2 class="text-2xl font-black text-white">محرك المطابقة الفورية للأرقام</h2>
                        <p class="text-xs text-slate-400">ابحث عن بيانات العميل عن طريق كتابة رقم الـ ID أو رقم الموبايل المسجل في ملف all.txt</p>
                    </div>

                    <form onsubmit="handleSearch(event)" class="space-y-4 max-w-xl mx-auto z-10 relative">
                        <div class="relative">
                            <input type="text" id="search-input" class="w-full bg-[#060913] border-2 border-slate-800 text-white p-4 pr-12 rounded-2xl focus:border-emerald-500 outline-none text-center font-bold text-lg tracking-wide transition-all placeholder:font-normal placeholder:text-sm" placeholder="اكتب رقم الـ ID أو رقم الموبايل..." required>
                            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">🔍</span>
                        </div>
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.99] text-sm">
                            فحص واستخراج البيانات الآن
                        </button>
                    </form>

                    <div id="search-result-box" class="hidden max-w-xl mx-auto animate-fadeIn z-10 relative">
                        </div>
                </div>

            </div>

        </section>

        <section id="page-admin" class="hidden min-h-screen w-full flex flex-col bg-[#060913] animate-fadeIn">
            
            <header class="border-b border-slate-800/80 bg-[#0d1424]/80 backdrop-blur-md sticky top-0 z-40">
                <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">⚙️</span>
                        <div>
                            <h1 class="text-lg font-black text-white">لوحة الإدارة الفائقة</h1>
                            <span class="text-[9px] text-emerald-400 font-mono tracking-widest uppercase">Admin Command Center</span>
                        </div>
                    </div>
                    <button onclick="toggleView('dashboard')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-all">
                        ⬅️ العودة لمحرك البحث
                    </button>
                </div>
            </header>

            <div class="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full space-y-8">
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-[#0d1424] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                            <span class="block text-slate-400 text-xs font-bold mb-1">إجمالي العمليات المنفذة</span>
                            <span id="stat-total" class="text-2xl font-black text-white">0</span>
                        </div>
                        <span class="text-3xl bg-slate-800/60 p-3 rounded-xl">📊</span>
                    </div>
                    <div class="bg-[#0d1424] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                            <span class="block text-emerald-400 text-xs font-bold mb-1">المطابقات الناجحة</span>
                            <span id="stat-success" class="text-2xl font-black text-emerald-400">0</span>
                        </div>
                        <span class="text-3xl bg-emerald-950/40 p-3 rounded-xl">✅</span>
                    </div>
                    <div class="bg-[#0d1424] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                            <span class="block text-rose-400 text-xs font-bold mb-1">المطابقات الفاشلة</span>
                            <span id="stat-failed" class="text-2xl font-black text-rose-400">0</span>
                        </div>
                        <span class="text-3xl bg-rose-950/40 p-3 rounded-xl">⚠️</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div class="lg:col-span-1 space-y-8">
                        
                        <div class="bg-[#0d1424] p-6 rounded-2xl border border-slate-800 space-y-4">
                            <h3 class="text-sm font-black text-white border-b border-slate-800 pb-2">➕ إضافة موظف جديد</h3>
                            <form onsubmit="handleRegisterEmployee(event)" class="space-y-3">
                                <div>
                                    <label class="block text-[10px] text-slate-400 mb-1">اسم الموظف</label>
                                    <input type="text" id="new-fullname" class="w-full bg-[#060913] border border-slate-800 text-white p-2.5 rounded-lg text-xs" placeholder="الاسم الكامل" required>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-slate-400 mb-1">اسم المستخدم (User)</label>
                                    <input type="text" id="new-username" class="w-full bg-[#060913] border border-slate-800 text-white p-2.5 rounded-lg text-xs text-left font-mono" placeholder="username" required>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-slate-400 mb-1">باسورد الحساب</label>
                                    <input type="password" id="new-password" class="w-full bg-[#060913] border border-slate-800 text-white p-2.5 rounded-lg text-xs text-left" placeholder="••••••••" required>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-slate-400 mb-1">الصلاحيات والوصول</label>
                                    <select id="new-role" class="w-full bg-[#060913] border border-slate-800 text-white p-2.5 rounded-lg text-xs font-bold cursor-pointer">
                                        <option value="staff">💼 موظف فحص (Staff)</option>
                                        <option value="admin">👑 مشرف نظام (Admin)</option>
                                    </select>
                                </div>
                                <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md mt-2">
                                    إنشاء وحفظ حساب الموظف
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script>
        let SESSION_TOKEN = localStorage.getItem('manal_jwt') || null;
        let CURRENT_USER = null;

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if(!container) return;
            const toast = document.createElement('div');
            
            let badgeStyle = "bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/50";
            if(type === 'success') badgeStyle = "bg-emerald-950/90 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40";
            if(type === 'fail') badgeStyle = "bg-rose-950/90 border-rose-500/40 text-rose-300 shadow-rose-950/40";
            
            toast.className = 'p-4 border rounded-2xl shadow-2xl flex justify-between items-center gap-3 animate-fadeIn ' + badgeStyle;
            toast.innerHTML = '<span class="text-xs font-black">' + message + '</span>';
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        function toggleView(viewName) {
            document.getElementById('page-login').classList.add('hidden');
            document.getElementById('page-dashboard').classList.add('hidden');
            document.getElementById('page-admin').classList.add('hidden');

            if(viewName === 'login') document.getElementById('page-login').classList.remove('hidden');
            if(viewName === 'dashboard') document.getElementById('page-dashboard').classList.remove('hidden');
            if(viewName === 'admin') {
                document.getElementById('page-admin').classList.remove('hidden');
                loadAdminDashboard();
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const resData = await response.json();
                if(resData.success) {
                    SESSION_TOKEN = resData.token;
                    CURRENT_USER = resData.user;
                    localStorage.setItem('manal_jwt', resData.token);
                    showToast("تم التحقق بنجاح.. أهلاً بك يا فندم 🔓", "success");
                    setupDashboardUI();
                } else {
                    showToast(resData.message, "fail");
                }
            } catch(err) {
                showToast("خطأ في الاتصال بالخادم", "fail");
            }
        }

        function setupDashboardUI() {
            if(!SESSION_TOKEN) return toggleView('login');
            
            // Basic JWT token decoding trick (pure Front-end payload extraction)
            try {
                const base64Url = SESSION_TOKEN.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                CURRENT_USER = JSON.parse(window.atob(base64));
            } catch(e) {
                return handleLogout();
            }

            document.getElementById('user-badge').innerText = CURRENT_USER.fullname + " | " + (CURRENT_USER.role === 'admin' ? "👑 مشرف" : "💼 موظف");
            
            if(CURRENT_USER.role === 'admin') {
                document.getElementById('btn-admin-panel').classList.remove('hidden');
            } else {
                document.getElementById('btn-admin-panel').classList.add('hidden');
            }
            toggleView('dashboard');
        }

        async function handleSearch(e) {
            e.preventDefault();
            const query = document.getElementById('search-input').value;
            const resultBox = document.getElementById('search-result-box');
            resultBox.className = "hidden max-w-xl mx-auto animate-fadeIn z-10 relative";

            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + SESSION_TOKEN
                    },
                    body: JSON.stringify({ query })
                });
                const resData = await response.json();
                
                resultBox.classList.remove('hidden');
                if(resData.success) {
                    showToast("تم مطابقة وتأكيد السجلات الفورية!", "success");
                    resultBox.innerHTML = \`
                        <div class="bg-emerald-950/30 border-2 border-emerald-500/40 p-6 rounded-2xl text-right space-y-3 backdrop-blur-sm">
                            <div class="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                                <span class="text-xs font-black text-emerald-400">حالة المطابقة: موجود بالملف ✅</span>
                                <span class="text-xl">🥬</span>
                            </div>
                            <div class="grid grid-cols-2 gap-4 pt-1">
                                <div>
                                    <span class="block text-[10px] text-slate-400 font-bold">رقم حساب العميل (ID):</span>
                                    <span class="font-mono text-white text-base select-all font-bold">\${resData.data.id}</span>
                                </div>
                                <div>
                                    <span class="block text-[10px] text-slate-400 font-bold">رقم الموبايل المسجل:</span>
                                    <span class="font-mono text-emerald-400 text-base select-all font-bold">\${resData.data.phone}</span>
                                </div>
                            </div>
                        </div>\`;
                } else {
                    showToast(resData.message, "fail");
                    resultBox.innerHTML = \`
                        <div class="bg-rose-950/30 border-2 border-rose-500/40 p-6 rounded-2xl text-center space-y-2 backdrop-blur-sm">
                            <span class="text-2xl block">🕵️‍♂️</span>
                            <h4 class="text-sm font-black text-rose-400">\${resData.message}</h4>
                            <p class="text-[11px] text-slate-400">الرقم المكتوب غير مدرج نهائياً بملف البيانات المرفوع على السيستم</p>
                        </div>\`;
                }
            } catch(err) {
                showToast("انتهت الجلسة أو حدث خطأ بالخادم", "fail");
            }
        }

        async function loadAdminDashboard() {
            try {
                const response = await fetch('/api/admin/dashboard', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + SESSION_TOKEN
                    }
                });
                const resData = await response.json();
                if(resData.success) {
                    document.getElementById('stat-total').innerText = resData.logs.length;
                    document.getElementById('stat-success').innerText = resData.logs.filter(l => l.action === 'success').length;
                    document.getElementById('stat-failed').innerText = resData.logs.filter(l => l.action === 'fail').length;
                } else {
                    showToast(resData.message, "fail");
                    toggleView('dashboard');
                }
            } catch(err) {
                showToast("فشل جلب التقارير الفورية", "fail");
            }
        }

        async function handleRegisterEmployee(e) {
            e.preventDefault();
            const newFullname = document.getElementById('new-fullname').value;
            const newUsername = document.getElementById('new-username').value;
            const newPassword = document.getElementById('new-password').value;
            const newRole = document.getElementById('new-role').value;

            try {
                const response = await fetch('/api/admin/add-user', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + SESSION_TOKEN
                    },
                    body: JSON.stringify({ newUsername, newPassword, newFullname, newRole })
                });
                const resData = await response.json();
                if(resData.success) {
                    showToast(resData.message, "success");
                    e.target.reset();
                    loadAdminDashboard();
                } else {
                    showToast(resData.message, "fail");
                }
            } catch(err) {
                showToast("خطأ أثناء تسجيل الموظف", "fail");
            }
        }

        function handleLogout() {
            SESSION_TOKEN = null;
            CURRENT_USER = null;
            localStorage.removeItem('manal_jwt');
            showToast("تم قفل الجلسة وتأمين المنظومة بنجاح 🔒", "info");
            toggleView('login');
        }

        // Initialize App Session Status check
        if(SESSION_TOKEN) {
            setupDashboardUI();
        } else {
            toggleView('login');
        }
    </script>
</body>
</html>
`;
    res.send(htmlPage);
});

// Start listening
app.listen(PORT, () => {
    console.log(`🚀 Server running perfectly on http://localhost:${PORT}`);
});