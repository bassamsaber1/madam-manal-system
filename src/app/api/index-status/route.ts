import { NextResponse } from 'next/server';
import fs from 'fs';
import { getCompleteFlagPath, getDataDir, getProgressPath } from '@/lib/paths';
import { indexExists, isIndexComplete, isSearchReady } from '@/lib/index';

export async function GET() {
  const totalEstimate = 45_183_047;

  let indexedCount = 0;
  if (isIndexComplete() && fs.existsSync(getCompleteFlagPath())) {
    indexedCount = Number(fs.readFileSync(getCompleteFlagPath(), 'utf-8')) || 0;
  } else if (fs.existsSync(getProgressPath())) {
    indexedCount = Number(fs.readFileSync(getProgressPath(), 'utf-8')) || 0;
  }

  const percent = indexedCount ? Math.min(100, Math.round((indexedCount / totalEstimate) * 100)) : 0;

  return NextResponse.json({
    indexExists: indexExists(),
    indexReady: isIndexComplete(),
    searchReady: isSearchReady(),
    indexedCount,
    totalEstimate,
    percent,
    building: !isSearchReady(),
    dataDir: getDataDir(),
  });
}

export const dynamic = 'force-dynamic';
