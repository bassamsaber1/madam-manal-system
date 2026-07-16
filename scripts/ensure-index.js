const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const {
  getDataDir,
  getDbPath,
  getCompleteFlag,
  getProgressPath,
  getDataFilePath,
} = require('./data-paths');

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

function isGoogleDriveUrl(url) {
  return /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/.test(url);
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

function request(url, cookies = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': USER_AGENT };
    if (Object.keys(cookies).length) headers.Cookie = cookieHeader(cookies);

    const req = client.request(
      parsed,
      { method, headers },
      (response) => resolve({ response, cookies })
    );
    req.on('error', reject);
    req.end();
  });
}

async function follow(url, cookies = {}, maxRedirects = 12) {
  let currentUrl = url;
  let jar = { ...cookies };

  for (let i = 0; i < maxRedirects; i += 1) {
    const { response } = await request(currentUrl, jar);
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

  throw new Error('تعذر متابعة التحويلات');
}

function readLimited(response, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    response.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        reject(new Error('استجابة كبيرة غير متوقعة'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    response.on('error', reject);
  });
}

function extractDownloadHref(html) {
  const patterns = [
    /id="uc-download-link"[^>]*href="([^"]+)"/i,
    /href="(\/uc\?export=download[^"]+)"/i,
    /href="(https:\/\/drive\.google\.com\/uc\?export=download[^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].replace(/&amp;/g, '&');
  }
  return null;
}

function extractConfirmToken(html) {
  const patterns = [
    /confirm=([0-9A-Za-z_-]+)/,
    /name="confirm"\s+value="([0-9A-Za-z_-]+)"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return 't';
}

function looksLikeHtmlFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(64);
  fs.readSync(fd, buf, 0, 64, 0);
  fs.closeSync(fd);
  const head = buf.toString('utf-8').trim().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html');
}

async function tryGoogleDrive(fileId) {
  const attempts = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];

  let cookies = {};

  for (const attemptUrl of attempts) {
    let { response, cookies: jar, url } = await follow(attemptUrl, cookies);
    cookies = jar;
    const type = String(response.headers['content-type'] || '');

    if (response.statusCode === 200 && type.includes('text/html')) {
      const html = await readLimited(response);
      response.destroy?.();

      const href = extractDownloadHref(html);
      if (href) {
        const nextUrl = href.startsWith('http')
          ? href
          : `https://drive.google.com${href.startsWith('/') ? '' : '/'}${href}`;
        ({ response, cookies: jar, url } = await follow(nextUrl, cookies));
        cookies = jar;
      } else {
        const confirm = extractConfirmToken(html);
        const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirm}`;
        ({ response, cookies: jar, url } = await follow(confirmUrl, cookies));
        cookies = jar;
      }
    }

    const finalType = String(response.headers['content-type'] || '');
    const length = Number(response.headers['content-length'] || 0);

    if (response.statusCode === 200 && !finalType.includes('text/html')) {
      return { response, url };
    }

    if (response.statusCode === 200 && length > MIN_DB_BYTES) {
      return { response, url };
    }

    response.destroy?.();
  }

  throw new Error(
    'Google Drive رجّع HTML — افتح الملف Share → Anyone with the link، أو ارفع search.db على GitHub Release'
  );
}

async function openDownloadStream(url) {
  const fileId = extractGoogleDriveFileId(url);

  if (fileId || isGoogleDriveUrl(url)) {
    if (!fileId) throw new Error('تعذر استخراج ID من رابط Google Drive');
    return tryGoogleDrive(fileId);
  }

  const { response } = await follow(url);
  if (response.statusCode !== 200) {
    response.destroy?.();
    throw new Error(`فشل التحميل: HTTP ${response.statusCode}`);
  }
  return { response, url };
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

function startBuildFromAllTxt() {
  const dataFile = getDataFilePath();
  if (!fs.existsSync(dataFile)) {
    console.warn('⚠️ ALL.txt غير موجود — لا يمكن بناء الفهرس');
    return false;
  }

  console.log('⏳ التحميل فشل — بناء الفهرس من ALL.txt (~45 دقيقة)...');
  const child = spawn(process.execPath, ['scripts/build-index.js'], {
    detached: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
  return true;
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
    console.log('🧹 مسح فهرس جزئي');
    clearPartialIndex();
  }

  const url = process.env.SEARCH_DB_URL;
  if (!url) {
    console.log('ℹ️ SEARCH_DB_URL غير موجود');
    return startBuildFromAllTxt();
  }

  console.log('⬇️ تحميل الفهرس الجاهز من SEARCH_DB_URL...');
  fs.mkdirSync(dataDir, { recursive: true });

  const tempPath = `${dbPath}.download`;
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  try {
    const { response } = await openDownloadStream(url);
    const downloaded = await downloadResponse(response, tempPath);

    if (looksLikeHtmlFile(tempPath)) {
      fs.unlinkSync(tempPath);
      throw new Error('الملف المحمّل HTML وليس قاعدة بيانات');
    }

    const size = fs.statSync(tempPath).size;
    if (size < MIN_DB_BYTES) {
      fs.unlinkSync(tempPath);
      throw new Error(`الملف المحمّل صغير (${(size / 1024 / 1024).toFixed(1)} MB)`);
    }

    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.renameSync(tempPath, dbPath);
    fs.writeFileSync(completeFlag, TOTAL_RECORDS, 'utf-8');

    const progressPath = getProgressPath();
    if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

    const sizeGb = (size / 1024 / 1024 / 1024).toFixed(2);
    console.log(`✅ تم تحميل الفهرس (${sizeGb} GB) — البحث جاهز فوراً`);
    return true;
  } catch (err) {
    console.error('⚠️ لم يتم تحميل الفهرس:', err.message);
    return startBuildFromAllTxt();
  }
}

module.exports = { ensureIndex };

if (require.main === module) {
  ensureIndex().then(() => process.exit(0));
}
