import { NextResponse } from 'next/server';
import fs from 'fs';
import { getCompleteFlagPath, getProgressPath, getDbPath } from '@/lib/paths';
import { getDbSizeBytes, isSearchReady } from '@/lib/index';

export async function GET() {
  const totalEstimate = 45_183_047;
  let indexedCount = 0;

  if (fs.existsSync(getCompleteFlagPath())) {
    indexedCount = Number(fs.readFileSync(getCompleteFlagPath(), 'utf-8')) || 0;
  } else if (fs.existsSync(getProgressPath())) {
    indexedCount = Number(fs.readFileSync(getProgressPath(), 'utf-8')) || 0;
  }

  const dbSizeGb = getDbSizeBytes() / (1024 * 1024 * 1024);
  const searchReady = isSearchReady();
  const percent = searchReady
    ? 100
    : indexedCount
      ? Math.min(100, Math.round((indexedCount / totalEstimate) * 100))
      : dbSizeGb > 0
        ? Math.min(99, Math.round((dbSizeGb / 3.74) * 100))
        : 0;

  const mode = searchReady
    ? 'ready'
    : process.env.SEARCH_DB_URL
      ? 'download'
      : 'build';

  return NextResponse.json({
    searchReady,
    indexedCount,
    dbSizeGb: Number(dbSizeGb.toFixed(2)),
    percent,
    mode,
  });
}

export const dynamic = 'force-dynamic';
