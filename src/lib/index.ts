import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getCompleteFlagPath, getDbPath } from './paths';
import { normalizePhone, normalizeQuery, type SearchRecord } from './search';

let db: Database.Database | null = null;

export function getIndexPath(): string {
  return getDbPath();
}

export function indexExists(): boolean {
  return fs.existsSync(getIndexPath());
}

export function isIndexComplete(): boolean {
  return fs.existsSync(getCompleteFlagPath());
}

export function isSearchReady(): boolean {
  return isIndexComplete() && indexExists();
}

function getDb(): Database.Database | null {
  if (!isSearchReady()) return null;
  if (db) return db;

  db = new Database(getIndexPath(), { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  db.pragma('busy_timeout = 3000');
  db.pragma('cache_size = -64000');
  db.pragma('temp_store = MEMORY');
  return db;
}

export function searchInIndex(query: string): SearchRecord | null {
  const database = getDb();
  if (!database) return null;

  const cleanQuery = normalizeQuery(query);
  const phoneQuery = normalizePhone(query);
  if (!cleanQuery) return null;

  try {
    const row = database
      .prepare('SELECT id, phone FROM records WHERE id = ? OR phone_norm = ? LIMIT 1')
      .get(cleanQuery, phoneQuery) as SearchRecord | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}
