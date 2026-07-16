const { spawn } = require('child_process');
const fs = require('fs');
const { getDbPath, getCompleteFlag } = require('./data-paths');

function startPrepareIndex() {
  if (fs.existsSync(getCompleteFlag()) && fs.existsSync(getDbPath())) return;

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

if (fs.existsSync(getDbPath()) && fs.existsSync(getCompleteFlag())) {
  console.log('✅ الفهرس جاهز — بحث فوري');
} else {
  startPrepareIndex();
}

startNextServer();
