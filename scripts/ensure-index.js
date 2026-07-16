const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getDataDir, getDbPath, getCompleteFlag } = require('./data-paths');

const TOTAL_RECORDS = '45183047';
const MIN_DB_BYTES = 500 * 1024 * 1024;

function fetchResponse(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return fetchResponse(response.headers.location, options).then(resolve).catch(reject);
      }
      resolve(response);
    });
    request.on('error', reject);
  });
}

function readBody(response, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    response.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        reject(new Error('استجابة غير متوقعة من رابط التحميل'));
        return;
      }
      chunks.push(chunk);
    });

    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    response.on('error', reject);
  });
}

function extractGoogleDriveFileId(url) {
  const byQuery = url.match(/[?&]id=([^&]+)/);
  if (byQuery) return byQuery[1];
  const byPath = url.match(/\/file\/d\/([^/]+)/);
  if (byPath) return byPath[1];
  return null;
}

function extractGoogleDriveConfirm(html, fileId) {
  const tokenMatch =
    html.match(/confirm=([0-9A-Za-z_]+)/) ||
    html.match(/name="confirm"\s+value="([0-9A-Za-z_]+)"/);

  if (tokenMatch) return tokenMatch[1];
  if (fileId) return 't';
  return null;
}

async function resolveDownloadUrl(url) {
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  const response = await fetchResponse(url);
  const type = String(response.headers['content-type'] || '');

  if (response.statusCode === 200 && type.includes('text/html')) {
    const html = await readBody(response);
    const confirm = extractGoogleDriveConfirm(html, fileId);
    if (!confirm) throw new Error('تعذر تأكيد تحميل Google Drive');

    response.destroy?.();
    const base = fileId
      ? `https://drive.google.com/uc?export=download&id=${fileId}`
      : url.split('&confirm=')[0];
    return `${base}${base.includes('?') ? '&' : '?'}confirm=${confirm}`;
  }

  response.destroy?.();
  return url;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const run = (currentUrl) => {
      const client = currentUrl.startsWith('https') ? https : http;

      client.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          return run(response.headers.location);
        }

        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return reject(new Error(`فشل التحميل: HTTP ${response.statusCode}`));
        }

        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('text/html')) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return reject(new Error('Google Drive رجّع صفحة HTML — تأكد من SEARCH_DB_URL'));
        }

        const total = Number(response.headers['content-length'] || 0);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total && downloaded % (100 * 1024 * 1024) < chunk.length) {
            const pct = Math.round((downloaded / total) * 100);
            console.log(`⬇️ ${pct}% (${(downloaded / 1024 / 1024 / 1024).toFixed(2)} GB)`);
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };

    run(url);
  });
}

async function ensureIndex() {
  const dbPath = getDbPath();
  const completeFlag = getCompleteFlag();
  const dataDir = getDataDir();

  if (fs.existsSync(completeFlag) && fs.existsSync(dbPath)) {
    const size = fs.statSync(dbPath).size;
    if (size >= MIN_DB_BYTES) {
      console.log('✅ الفهرس موجود مسبقاً');
      return;
    }
    console.log('⚠️ ملف الفهرس تالف — إعادة التحميل');
    fs.unlinkSync(dbPath);
    fs.unlinkSync(completeFlag);
  }

  const url = process.env.SEARCH_DB_URL;
  if (!url) {
    console.log('ℹ️ SEARCH_DB_URL غير موجود — سيتم بناء الفهرس عند التشغيل');
    return;
  }

  console.log('⬇️ تحميل الفهرس الجاهز من SEARCH_DB_URL...');
  console.log(`🔗 ${url.slice(0, 80)}...`);
  fs.mkdirSync(dataDir, { recursive: true });

  const tempPath = `${dbPath}.download`;
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  const downloadUrl = await resolveDownloadUrl(url);
  await downloadFile(downloadUrl, tempPath);

  const size = fs.statSync(tempPath).size;
  if (size < MIN_DB_BYTES) {
    fs.unlinkSync(tempPath);
    throw new Error('الملف المحمّل صغير جداً — تحقق من SEARCH_DB_URL');
  }

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  fs.renameSync(tempPath, dbPath);
  fs.writeFileSync(completeFlag, TOTAL_RECORDS, 'utf-8');

  const sizeGb = (size / 1024 / 1024 / 1024).toFixed(2);
  console.log(`✅ تم تحميل الفهرس (${sizeGb} GB) — البحث جاهز فوراً`);
}

ensureIndex().catch((err) => {
  console.error('⚠️ لم يتم تحميل الفهرس:', err.message);
});
