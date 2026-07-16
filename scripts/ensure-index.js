const fs = require('fs');
const https = require('https');
const http = require('http');
const { getDataDir, getDbPath, getCompleteFlag, getProgressPath } = require('./data-paths');

const TOTAL_RECORDS = '45183047';
const MIN_DB_BYTES = 500 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractGoogleDriveFileId(url) {
  const byQuery = url.match(/[?&]id=([^&]+)/);
  if (byQuery) return byQuery[1];
  const byPath = url.match(/\/file\/d\/([^/]+)/);
  if (byPath) return byPath[1];
  return null;
}

function parseCookies(setCookieHeaders = []) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    const part = String(header).split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function fetchOnce(url, cookies = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const headers = { 'User-Agent': USER_AGENT };
    if (Object.keys(cookies).length) headers.Cookie = cookieHeader(cookies);

    const request = client.get(url, { headers }, (response) => resolve({ response, cookies }));
    request.on('error', reject);
  });
}

async function fetchWithRedirects(url, cookies = {}, maxRedirects = 10) {
  let currentUrl = url;
  let jar = { ...cookies };

  for (let i = 0; i < maxRedirects; i += 1) {
    const { response } = await fetchOnce(currentUrl, jar);
    const setCookie = response.headers['set-cookie'] || [];
    jar = { ...jar, ...parseCookies(setCookie) };

    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      currentUrl = response.headers.location.startsWith('http')
        ? response.headers.location
        : new URL(response.headers.location, currentUrl).href;
      response.resume();
      continue;
    }

    return { response, cookies: jar, url: currentUrl };
  }

  throw new Error('تعذر متابعة تحميل Google Drive');
}

function readHtml(response) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    response.on('data', (chunk) => {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) {
        response.destroy();
        reject(new Error('استجابة HTML غير متوقعة'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    response.on('error', reject);
  });
}

function extractConfirmToken(html) {
  const patterns = [
    /confirm=([0-9A-Za-z_]+)/,
    /name="confirm"\s+value="([0-9A-Za-z_]+)"/,
    /id="download-form"[\s\S]*?action="([^"]+)"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return 't';
}

async function resolveGoogleDriveUrl(url) {
  const fileId = extractGoogleDriveFileId(url);
  const baseUrl = fileId
    ? `https://drive.google.com/uc?export=download&id=${fileId}`
    : url;

  let { response, cookies, url: currentUrl } = await fetchWithRedirects(baseUrl);
  const type = String(response.headers['content-type'] || '');

  if (response.statusCode === 200 && type.includes('text/html')) {
    const html = await readHtml(response);
    response.destroy?.();

    const confirm = extractConfirmToken(html);
    const confirmUrl = fileId
      ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirm}`
      : `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}confirm=${confirm}`;

    ({ response, cookies, url: currentUrl } = await fetchWithRedirects(confirmUrl, cookies));
  }

  if (response.statusCode !== 200) {
    response.destroy?.();
    throw new Error(`فشل التحميل: HTTP ${response.statusCode}`);
  }

  const finalType = String(response.headers['content-type'] || '');
  if (finalType.includes('text/html')) {
    response.destroy?.();
    throw new Error('Google Drive رجّع HTML — افتح الملف Share للجميع');
  }

  return { response, url: currentUrl };
}

function writeProgress(bytes, total) {
  const progressPath = getProgressPath();
  const count = total ? Math.round((bytes / total) * TOTAL_RECORDS) : 0;
  fs.writeFileSync(progressPath, String(count), 'utf-8');
}

function downloadResponse(response, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const total = Number(response.headers['content-length'] || 0);
    let downloaded = 0;

    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total && downloaded % (50 * 1024 * 1024) < chunk.length) {
        const pct = Math.round((downloaded / total) * 100);
        console.log(`⬇️ ${pct}% (${(downloaded / 1024 / 1024 / 1024).toFixed(2)} GB)`);
        writeProgress(downloaded, total);
      }
    });

    response.pipe(file);
    file.on('finish', () => {
      file.close();
      resolve(downloaded);
    });
    file.on('error', reject);
    response.on('error', reject);
  });
}

function clearPartialIndex() {
  const dbPath = getDbPath();
  const completeFlag = getCompleteFlag();
  const progressPath = getProgressPath();
  for (const file of [dbPath, completeFlag, progressPath, `${dbPath}.download`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

async function ensureIndex() {
  const dbPath = getDbPath();
  const completeFlag = getCompleteFlag();
  const dataDir = getDataDir();

  if (fs.existsSync(completeFlag) && fs.existsSync(dbPath)) {
    const size = fs.statSync(dbPath).size;
    if (size >= MIN_DB_BYTES) {
      console.log('✅ الفهرس موجود مسبقاً');
      return true;
    }
    console.log('⚠️ ملف الفهرس تالف — إعادة التحميل');
    clearPartialIndex();
  } else if (fs.existsSync(getProgressPath()) || fs.existsSync(dbPath)) {
    console.log('🧹 مسح فهرس جزئي — بدء التحميل من SEARCH_DB_URL');
    clearPartialIndex();
  }

  const url = process.env.SEARCH_DB_URL;
  if (!url) {
    console.log('ℹ️ SEARCH_DB_URL غير موجود — سيتم بناء الفهرس من ALL.txt');
    return false;
  }

  console.log('⬇️ تحميل الفهرس الجاهز من SEARCH_DB_URL...');
  fs.mkdirSync(dataDir, { recursive: true });

  const tempPath = `${dbPath}.download`;
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  const { response } = await resolveGoogleDriveUrl(url);
  const downloaded = await downloadResponse(response, tempPath);

  const size = fs.statSync(tempPath).size;
  if (size < MIN_DB_BYTES) {
    fs.unlinkSync(tempPath);
    throw new Error(`الملف المحمّل صغير (${(size / 1024 / 1024).toFixed(1)} MB) — تحقق من SEARCH_DB_URL`);
  }

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  fs.renameSync(tempPath, dbPath);
  fs.writeFileSync(completeFlag, TOTAL_RECORDS, 'utf-8');

  const progressPath = getProgressPath();
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  const sizeGb = (size / 1024 / 1024 / 1024).toFixed(2);
  console.log(`✅ تم تحميل الفهرس (${sizeGb} GB, ${downloaded} bytes) — البحث جاهز فوراً`);
  return true;
}

module.exports = { ensureIndex };

if (require.main === module) {
  ensureIndex()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('⚠️ لم يتم تحميل الفهرس:', err.message);
      process.exit(0);
    });
}
