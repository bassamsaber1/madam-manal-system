const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');
const { getDataDir, getDbPath, getCompleteFlag, getProgressPath, getDataFilePath } = require('./data-paths');

const BATCH_SIZE = 20000;

function normalizePhone(value) {
  let digits = value.replace(/[^\d]/g, '');
  if (digits.startsWith('20') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(',').map((part) => part.replace(/"/g, '').trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;

  return { id: parts[0], phone: parts[1] };
}

async function buildSearchIndex() {
  const filePath = getDataFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`ملف البيانات غير موجود: ${filePath}`);
  }

  const dataDir = getDataDir();
  const dbPath = getDbPath();
  const completeFlag = getCompleteFlag();
  const progressPath = getProgressPath();

  console.log(`📂 قراءة من: ${filePath}`);
  console.log(`💾 الفهرس على: ${dbPath}`);

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(completeFlag)) fs.unlinkSync(completeFlag);
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE records (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      phone_norm TEXT NOT NULL
    );
    CREATE INDEX idx_phone_norm ON records(phone_norm);
  `);

  const insert = db.prepare(
    'INSERT OR IGNORE INTO records (id, phone, phone_norm) VALUES (?, ?, ?)'
  );

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.id, row.phone, normalizePhone(row.phone));
    }
  });

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const batch = [];
  let total = 0;
  const started = Date.now();

  for await (const line of rl) {
    const record = parseLine(line);
    if (!record) continue;

    batch.push(record);
    if (batch.length >= BATCH_SIZE) {
      insertBatch(batch);
      total += batch.length;
      batch.length = 0;

      if (total % 500000 === 0) {
        const mins = ((Date.now() - started) / 60000).toFixed(1);
        console.log(`⏳ ${total.toLocaleString()} سجل (${mins} دقيقة)`);
        fs.writeFileSync(progressPath, String(total), 'utf-8');
      }
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    total += batch.length;
  }

  rl.close();
  stream.destroy();
  db.close();

  fs.writeFileSync(completeFlag, String(total), 'utf-8');
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`✅ تم: ${total.toLocaleString()} سجل في ${mins} دقيقة`);

  return total;
}

buildSearchIndex().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
