const { spawn } = require('child_process');
const fs = require('fs');
const { getDbPath, getCompleteFlag, getDataFilePath } = require('./data-paths');

function startIndexBuildInBackground() {
  if (fs.existsSync(getCompleteFlag())) return;

  const dataFile = getDataFilePath();
  if (!fs.existsSync(dataFile)) {
    console.warn('⚠️ ALL.txt غير موجود');
    return;
  }

  console.log('⏳ بناء الفهرس في الخلفية...');
  const child = spawn(process.execPath, ['scripts/build-index.js'], {
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

if (fs.existsSync(getDbPath()) && fs.existsSync(getCompleteFlag())) {
  console.log('✅ الفهرس جاهز — بحث فوري');
} else {
  startIndexBuildInBackground();
}

startNextServer();
