const { spawn } = require('child_process');
const fs = require('fs');
const { getDbPath, getCompleteFlag, getDataFilePath } = require('./data-paths');

function startBackgroundScript(scriptPath, label) {
  console.log(label);
  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  child.unref();
}

function prepareIndexInBackground() {
  if (fs.existsSync(getCompleteFlag()) && fs.existsSync(getDbPath())) return;

  if (process.env.SEARCH_DB_URL) {
    startBackgroundScript('scripts/ensure-index.js', '⬇️ تحميل الفهرس الجاهز في الخلفية...');
    return;
  }

  const dataFile = getDataFilePath();
  if (!fs.existsSync(dataFile)) {
    console.warn('⚠️ ALL.txt غير موجود و SEARCH_DB_URL غير مضبوط');
    return;
  }

  startBackgroundScript('scripts/build-index.js', '⏳ بناء الفهرس من ALL.txt في الخلفية...');
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

if (fs.existsSync(getDbPath()) && fs.existsSync(getCompleteFlag())) {
  console.log('✅ الفهرس جاهز — بحث فوري');
} else {
  prepareIndexInBackground();
}

startNextServer();
