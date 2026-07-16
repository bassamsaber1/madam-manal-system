import fs from 'fs';
import path from 'path';

function resolveDataDir() {
  if (process.env.PERSISTENT_DATA_DIR) return process.env.PERSISTENT_DATA_DIR;

  const legacyData = path.join(process.cwd(), 'data');
  if (fs.existsSync(path.join(legacyData, 'index.complete'))) return legacyData;

  return path.join(process.cwd(), 'render-db');
}

export function getDataDir(): string {
  const dir = resolveDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath(): string {
  if (process.env.SEARCH_DB_PATH) return process.env.SEARCH_DB_PATH;
  return path.join(getDataDir(), 'search.db');
}

export function getCompleteFlagPath(): string {
  return path.join(getDataDir(), 'index.complete');
}

export function getProgressPath(): string {
  return path.join(getDataDir(), 'index.progress');
}
