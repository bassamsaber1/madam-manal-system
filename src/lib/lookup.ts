import { isSearchReady, searchInIndex } from './index';

export type { SearchRecord } from './search';
export { getDataFilePath } from './search';
export { isSearchReady } from './index';

export async function searchRecords(query: string) {
  if (isSearchReady()) {
    const indexed = searchInIndex(query);
    if (indexed) return { status: 'found' as const, data: indexed };
    return { status: 'not_found' as const };
  }

  return { status: 'not_ready' as const };
}
