import { searchInIndex, indexExists, isIndexComplete } from './index';
import { searchInDataFile } from './search';

export type { SearchRecord } from './search';
export { getDataFilePath } from './search';
export { indexExists, isIndexComplete } from './index';

export type SearchOutcome =
  | { status: 'found'; data: import('./search').SearchRecord }
  | { status: 'not_found'; indexReady: boolean }
  | { status: 'index_building' };

export async function searchRecords(query: string): Promise<SearchOutcome> {
  if (indexExists()) {
    const indexed = searchInIndex(query);
    if (indexed) return { status: 'found', data: indexed };

    if (!isIndexComplete()) {
      const fromFile = await searchInDataFile(query);
      if (fromFile) return { status: 'found', data: fromFile };
    }

    return { status: 'not_found', indexReady: isIndexComplete() };
  }

  const fromFile = await searchInDataFile(query);
  if (fromFile) return { status: 'found', data: fromFile };

  return { status: 'not_found', indexReady: false };
}
