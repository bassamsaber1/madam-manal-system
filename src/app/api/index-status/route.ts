import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { indexExists, isIndexComplete } from '@/lib/lookup';

export async function GET() {
  const dataDir = path.join(process.cwd(), 'data');
  const progressPath = path.join(dataDir, 'index.progress');
  const complete = isIndexComplete();
  const exists = indexExists();

  let indexedCount = 0;
  if (complete && fs.existsSync(path.join(dataDir, 'index.complete'))) {
    indexedCount = Number(fs.readFileSync(path.join(dataDir, 'index.complete'), 'utf-8')) || 0;
  } else if (fs.existsSync(progressPath)) {
    indexedCount = Number(fs.readFileSync(progressPath, 'utf-8')) || 0;
  }

  return NextResponse.json({
    indexExists: exists,
    indexReady: complete,
    indexedCount,
    totalEstimate: 45_000_000,
    building: exists && !complete,
  });
}
