import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { normalizePhone, normalizeQuery, type SearchRecord } from './search';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'search.db');
const COMPLETE_FLAG = path.join(DB_DIR, 'index.complete');

let db: Database.Database | null = null;

export function getIndexPath(): string {
  if (process.env.SEARCH_DB_PATH) return process.env.SEARCH_DB_PATH;
  return DB_PATH;
}

export function indexExists(): boolean {
  return fs.existsSync(getIndexPath());
}

export function isIndexComplete(): boolean {
  return fs.existsSync(COMPLETE_FLAG);
}

export function isSearchReady(): boolean {
  return isIndexComplete() && indexExists();
}

function getDb(): Database.Database | null {
  if (!isSearchReady()) return null;
  if (db) return db;

  const dbPath = getIndexPath();
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
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
