const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');
const { collectCurrentPageRows, goToNextPage } = require('./paginator');
const { extractDetail } = require('./detail');
const { write, reset } = require('./writer');

(async () => {
  const dateRange = config.getDateRange();
  console.log(`Searching: keyword="${config.keyword}", from=${dateRange.from}, to=${dateRange.to}`);

  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();

  try {
    await search(page, config.keyword, dateRange);
    console.log('Search submitted. Processing results...');

    reset();
    let pageNum = 1;
    let totalProcessed = 0;
    const maxPages = 100;

    while (pageNum <= maxPages) {
      const rows = await collectCurrentPageRows(page);
      if (rows.length === 0) {
        console.log(pageNum === 1 ? 'No results found. Exiting.' : 'No more results.');
        break;
      }
      console.log(`Page ${pageNum}: ${rows.length} results`);

      for (const row of rows) {
        totalProcessed++;
        console.log(`[${totalProcessed}] ${row.bidNumber} (row ${row.rowIndex})`);
        const record = await extractDetail(page, row.rowIndex);
        if (record) write(config.outputPath, record);
        else console.log(`  ⚠ Failed to extract details for row ${row.rowIndex}`);
      }

      const hasNext = await goToNextPage(page);
      if (!hasNext) break;
      pageNum++;
    }

    if (totalProcessed > 0) {
      console.log(`\nDone. ${totalProcessed} records saved to ${config.outputPath}`);
    }
  } catch (err) {
    console.error('Crawler error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
