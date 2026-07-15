import { searchInDataFile } from './search';

export type { SearchRecord } from './search';
export { getDataFilePath } from './search';

export async function searchRecords(query: string) {
  const result = await searchInDataFile(query);
  if (result) return { status: 'found' as const, data: result };
  return { status: 'not_found' as const };
}
