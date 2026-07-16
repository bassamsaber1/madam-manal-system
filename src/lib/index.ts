import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getCompleteFlagPath, getDbPath } from './paths';
import { normalizePhone, normalizeQuery, type SearchRecord } from './search';

const MIN_DB_BYTES = 3 * 1024 * 1024 * 1024;
const MIN_RECORD_COUNT = 40_000_000;

let db: Database.Database | null = null;

export function getDbSizeBytes(): number {
  if (!indexExists()) return 0;
  try {
    return fs.statSync(getDbPath()).size;
  } catch {
    return 0;
  }
}

export function indexExists(): boolean {
  return fs.existsSync(getDbPath());
}

export function isIndexComplete(): boolean {
  return fs.existsSync(getCompleteFlagPath());
}

export function isSearchReady(): boolean {
  if (!isIndexComplete() || !indexExists()) return false;
  return getDbSizeBytes() >= MIN_DB_BYTES;
}

function getPhoneVariants(query: string): string[] {
  const digits = query.replace(/[^\d]/g, '');
  const normalized = normalizePhone(query);
  const variants = new Set<string>([normalized, digits]);

  if (digits.startsWith('20') && digits.length >= 12) {
    variants.add(digits.slice(2));
  }
  if (digits.startsWith('0')) {
    variants.add(digits.slice(1));
  }
  if (digits.length === 10 && !digits.startsWith('0')) {
    variants.add(`0${digits}`);
  }

  return Array.from(variants).filter(Boolean);
}

function getDb(): Database.Database | null {
  if (!isSearchReady()) return null;
  if (db) return db;

  db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  db.pragma('busy_timeout = 3000');
  return db;
}

export function getRecordCount(): number | null {
  const database = getDb();
  if (!database) return null;
  try {
    const row = database.prepare('SELECT COUNT(*) as c FROM records').get() as { c: number };
    return row.c;
  } catch {
    return null;
  }
}

export function searchInIndex(query: string): SearchRecord | null {
  const database = getDb();
  if (!database) return null;

  const cleanQuery = normalizeQuery(query);
  if (!cleanQuery) return null;

  const phoneVariants = getPhoneVariants(query);
  const placeholders = phoneVariants.map(() => '?').join(', ');

  try {
    const row = database
      .prepare(
        `SELECT id, phone FROM records WHERE id = ? OR phone_norm IN (${placeholders}) LIMIT 1`
      )
      .get(cleanQuery, ...phoneVariants) as SearchRecord | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

export function isIndexHealthy(): boolean {
  if (!isSearchReady()) return false;
  const count = getRecordCount();
  return count !== null && count >= MIN_RECORD_COUNT;
}
