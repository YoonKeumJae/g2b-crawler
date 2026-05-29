const { restoreSearchResultsPage } = require('../searchRestore');

test('restores the current search page by re-running search and replaying pagination', async () => {
  const page = {};
  const dateRange = { from: '20260101', to: '20260601' };
  const calls = [];
  const searchFn = jest.fn(async () => calls.push('search'));
  const nextPageFn = jest.fn(async () => {
    calls.push('next');
    return true;
  });

  const restored = await restoreSearchResultsPage({
    page,
    keyword: 'ms오피스',
    dateRange,
    pageNum: 3,
    searchFn,
    nextPageFn,
  });

  expect(restored).toBe(true);
  expect(searchFn).toHaveBeenCalledWith(page, 'ms오피스', dateRange);
  expect(nextPageFn).toHaveBeenCalledTimes(2);
  expect(calls).toEqual(['search', 'next', 'next']);
});

test('reports failed restoration when pagination replay fails', async () => {
  const restored = await restoreSearchResultsPage({
    page: {},
    keyword: 'ees',
    dateRange: { from: '20260101', to: '20260601' },
    pageNum: 2,
    searchFn: jest.fn(),
    nextPageFn: jest.fn(async () => false),
  });

  expect(restored).toBe(false);
});
