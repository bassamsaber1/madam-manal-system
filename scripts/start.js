const { spawn } = require('child_process');
const fs = require('fs');
const { getDbPath, getCompleteFlag, getDataFilePath } = require('./data-paths');

const dbPath = getDbPath();
const completeFlag = getCompleteFlag();

function startIndexBuildInBackground() {
  if (fs.existsSync(completeFlag)) return;

  const dataFile = getDataFilePath();
  if (!fs.existsSync(dataFile)) {
    console.warn('⚠️ ملف ALL.txt غير موجود — البحث لن يعمل');
    return;
  }

  console.log('⏳ بدء بناء الفهرس في الخلفية...');
  console.log(`📁 مسار التخزين الدائم: ${process.env.PERSISTENT_DATA_DIR || './data'}`);

  const child = spawn(process.execPath, ['scripts/build-index.js'], {
    detached: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
}

function startNextServer() {
  const next = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start:next'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });

  next.on('exit', (code) => process.exit(code ?? 0));
}

if (!fs.existsSync(dbPath) || !fs.existsSync(completeFlag)) {
  startIndexBuildInBackground();
} else {
  console.log('✅ الفهرس جاهز على القرص الدائم — بحث سريع');
}

startNextServer();
