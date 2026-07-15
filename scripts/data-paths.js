const fs = require('fs');
const path = require('path');

function getDataDir() {
  const dir = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDbPath() {
  return process.env.SEARCH_DB_PATH || path.join(getDataDir(), 'search.db');
}

function getCompleteFlag() {
  return path.join(getDataDir(), 'index.complete');
}

function getProgressPath() {
  return path.join(getDataDir(), 'index.progress');
}

function getDataFilePath() {
  if (process.env.DATA_FILE_PATH && fs.existsSync(process.env.DATA_FILE_PATH)) {
    return process.env.DATA_FILE_PATH;
  }

  const persistentAll = path.join(getDataDir(), 'ALL.txt');
  if (fs.existsSync(persistentAll)) return persistentAll;

  const candidates = [
    path.join(process.cwd(), 'ALL.txt'),
    path.join(process.cwd(), 'all.txt'),
    path.join(process.cwd(), 'src', 'data', 'all.txt'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

module.exports = {
  getDataDir,
  getDbPath,
  getCompleteFlag,
  getProgressPath,
  getDataFilePath,
};
