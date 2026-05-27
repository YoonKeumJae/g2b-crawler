const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');
const { collectUrls } = require('./paginator');
const { extractDetail } = require('./detail');
const { write, reset } = require('./writer');

(async () => {
  const dateRange = config.getDateRange();
  console.log(`Searching: keyword="${config.keyword}", from=${dateRange.from}, to=${dateRange.to}`);

  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage();

  try {
    await search(page, config.keyword, dateRange);
    console.log('Search submitted. Collecting result URLs...');

    const urls = await collectUrls(page);
    console.log(`Found ${urls.length} announcements. Extracting details...`);

    if (urls.length === 0) {
      console.log('No results found. Exiting.');
      return;
    }

    reset();
    const detailPage = await browser.newPage();
    for (let i = 0; i < urls.length; i++) {
      console.log(`[${i + 1}/${urls.length}] ${urls[i]}`);
      const record = await extractDetail(detailPage, urls[i]);
      if (record) write(config.outputPath, record);
      else console.log(`  ⚠ Failed to extract details for: ${urls[i]}`);
    }

    console.log(`Done. Results saved to ${config.outputPath}`);
  } catch (err) {
    console.error('Crawler error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
