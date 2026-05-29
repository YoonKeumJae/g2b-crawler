const { search } = require('./search');
const { goToNextPage } = require('./paginator');

async function restoreSearchResultsPage({
  page,
  keyword,
  dateRange,
  pageNum,
  searchFn = search,
  nextPageFn = goToNextPage,
}) {
  await searchFn(page, keyword, dateRange);

  for (let currentPage = 1; currentPage < pageNum; currentPage++) {
    const moved = await nextPageFn(page);
    if (!moved) return false;
  }

  return true;
}

module.exports = { restoreSearchResultsPage };
