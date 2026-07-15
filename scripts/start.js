const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const completeFlag = path.join(process.cwd(), 'data', 'index.complete');
const dbPath = path.join(process.cwd(), 'data', 'search.db');
const allTxt = path.join(process.cwd(), 'ALL.txt');

function startIndexBuildInBackground() {
  if (fs.existsSync(completeFlag)) return;

  const hasSource = fs.existsSync(allTxt) || fs.existsSync(path.join(process.cwd(), 'src', 'data', 'all.txt'));
  if (!hasSource) {
    console.warn('⚠️ ملف ALL.txt غير موجود — البحث لن يعمل');
    return;
  }

  console.log('⏳ بدء بناء الفهرس في الخلفية...');
  const child = spawn(process.execPath, ['scripts/build-index.js'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
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
  console.log('✅ الفهرس جاهز — بحث سريع');
}

startNextServer();
