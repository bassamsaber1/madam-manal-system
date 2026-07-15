import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { indexExists, isIndexComplete, isSearchReady } from '@/lib/index';

export async function GET() {
  const dataDir = path.join(process.cwd(), 'data');
  const progressPath = path.join(dataDir, 'index.progress');
  const complete = isIndexComplete();
  const exists = indexExists();
  const totalEstimate = 45_183_047;

  let indexedCount = 0;
  if (complete && fs.existsSync(path.join(dataDir, 'index.complete'))) {
    indexedCount = Number(fs.readFileSync(path.join(dataDir, 'index.complete'), 'utf-8')) || 0;
  } else if (fs.existsSync(progressPath)) {
    indexedCount = Number(fs.readFileSync(progressPath, 'utf-8')) || 0;
  }

  const percent = indexedCount ? Math.min(100, Math.round((indexedCount / totalEstimate) * 100)) : 0;

  return NextResponse.json({
    indexExists: exists,
    indexReady: complete,
    searchReady: isSearchReady(),
    indexedCount,
    totalEstimate,
    percent,
    building: !isSearchReady(),
  });
}

export const dynamic = 'force-dynamic';
