import { searchInIndex, isSearchReady } from './index';
import { isLargeDataFile, searchInDataFile } from './search';

export type { SearchRecord } from './search';
export { getDataFilePath } from './search';
export { indexExists, isIndexComplete, isSearchReady } from './index';

export type SearchOutcome =
  | { status: 'found'; data: import('./search').SearchRecord }
  | { status: 'not_found' }
  | { status: 'index_building' };

export async function searchRecords(query: string): Promise<SearchOutcome> {
  if (isSearchReady()) {
    const indexed = searchInIndex(query);
    if (indexed) return { status: 'found', data: indexed };
    return { status: 'not_found' };
  }

  if (isLargeDataFile()) {
    return { status: 'index_building' };
  }

  const fromFile = await searchInDataFile(query);
  if (fromFile) return { status: 'found', data: fromFile };

  return { status: 'not_found' };
}
