const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getDataDir, getDbPath, getCompleteFlag } = require('./data-paths');

const TOTAL_RECORDS = '45183047';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`فشل التحميل: HTTP ${response.statusCode}`));
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
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function ensureIndex() {
  const dbPath = getDbPath();
  const completeFlag = getCompleteFlag();
  const dataDir = getDataDir();

  if (fs.existsSync(completeFlag) && fs.existsSync(dbPath)) {
    console.log('✅ الفهرس موجود مسبقاً');
    return;
  }

  const url = process.env.SEARCH_DB_URL;
  if (!url) {
    console.log('ℹ️ SEARCH_DB_URL غير موجود — سيتم بناء الفهرس عند التشغيل');
    return;
  }

  console.log('⬇️ تحميل الفهرس الجاهز من SEARCH_DB_URL...');
  fs.mkdirSync(dataDir, { recursive: true });

  const tempPath = `${dbPath}.download`;
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  await downloadFile(url, tempPath);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  fs.renameSync(tempPath, dbPath);
  fs.writeFileSync(completeFlag, TOTAL_RECORDS, 'utf-8');

  const sizeGb = (fs.statSync(dbPath).size / 1024 / 1024 / 1024).toFixed(2);
  console.log(`✅ تم تحميل الفهرس (${sizeGb} GB) — البحث جاهز فوراً`);
}

ensureIndex().catch((err) => {
  console.error('❌ فشل تحميل الفهرس:', err.message);
  process.exit(1);
});
