import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export type SearchRecord = {
  id: string;
  phone: string;
};

export function getDataFilePath(): string {
  if (process.env.DATA_FILE_PATH && fs.existsSync(process.env.DATA_FILE_PATH)) {
    return process.env.DATA_FILE_PATH;
  }

  const candidates = [
    path.join(process.cwd(), 'ALL.txt'),
    path.join(process.cwd(), 'all.txt'),
    path.join(process.cwd(), 'src', 'data', 'all.txt'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.join(process.cwd(), 'src', 'data', 'all.txt');
}

export function normalizeQuery(value: string): string {
  return value.trim().replace(/["\s+]/g, '').toLowerCase();
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/[^\d]/g, '');
  if (digits.startsWith('20') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

function parseLine(line: string): SearchRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(',').map((part) => part.replace(/"/g, '').trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;

  return {
    id: parts[0],
    phone: parts[1],
  };
}

function recordMatches(record: SearchRecord, cleanQuery: string, phoneQuery: string): boolean {
  const id = normalizeQuery(record.id);
  const phone = normalizePhone(record.phone);

  return (
    id === cleanQuery ||
    phone === phoneQuery ||
    phone.endsWith(phoneQuery) ||
    phoneQuery.endsWith(phone)
  );
}

export async function searchInDataFile(query: string): Promise<SearchRecord | null> {
  const filePath = getDataFilePath();
  if (!fs.existsSync(filePath)) return null;

  const cleanQuery = normalizeQuery(query);
  const phoneQuery = normalizePhone(query);

  if (!cleanQuery) return null;

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const record = parseLine(line);
      if (record && recordMatches(record, cleanQuery, phoneQuery)) {
        rl.close();
        stream.destroy();
        return record;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return null;
}
