import { searchInIndex, indexExists, isIndexComplete } from './index';
import { getDataFilePath, isLargeDataFile, searchInDataFile } from './search';

export type { SearchRecord } from './search';
export { getDataFilePath } from './search';
export { indexExists, isIndexComplete } from './index';

export type SearchOutcome =
  | { status: 'found'; data: import('./search').SearchRecord }
  | { status: 'not_found'; indexReady: boolean }
  | { status: 'index_building'; indexedCount?: number };

export async function searchRecords(query: string): Promise<SearchOutcome> {
  const largeFile = isLargeDataFile();
  const indexReady = isIndexComplete();

  if (indexExists()) {
    const indexed = searchInIndex(query);
    if (indexed) return { status: 'found', data: indexed };

    if (largeFile && !indexReady) {
      return { status: 'index_building' };
    }

    if (!indexReady) {
      const fromFile = await searchInDataFile(query);
      if (fromFile) return { status: 'found', data: fromFile };
    }

    return { status: 'not_found', indexReady };
  }

  if (largeFile) {
    return { status: 'index_building' };
  }

  const fromFile = await searchInDataFile(query);
  if (fromFile) return { status: 'found', data: fromFile };

  return { status: 'not_found', indexReady: false };
}
