const { spawn } = require('child_process');

const port = process.env.PORT || '3000';
const nextBin = require.resolve('next/dist/bin/next');

spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});
