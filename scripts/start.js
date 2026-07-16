const { spawn } = require('child_process');
const fs = require('fs');
const { getDbPath, getCompleteFlag } = require('./data-paths');

const MIN_DB_BYTES = 3 * 1024 * 1024 * 1024;

function isIndexReady() {
  if (!fs.existsSync(getCompleteFlag()) || !fs.existsSync(getDbPath())) return false;
  return fs.statSync(getDbPath()).size >= MIN_DB_BYTES;
}

function startPrepareIndex() {
  if (isIndexReady()) return;

  if (fs.existsSync(getDbPath()) || fs.existsSync(getCompleteFlag())) {
    console.log('⚠️ الفهرس ناقص — إعادة التحميل');
  }

  console.log('🔧 تجهيز الفهرس في الخلفية...');
  const child = spawn(process.execPath, ['scripts/ensure-index.js'], {
    detached: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
}

function startNextServer() {
  const port = process.env.PORT || '3000';
  const nextBin = require.resolve('next/dist/bin/next');

  spawn(process.execPath, [nextBin, 'start', '-p', port], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
}

if (isIndexReady()) {
  console.log('✅ الفهرس جاهز — بحث فوري');
} else {
  startPrepareIndex();
}

startNextServer();
