const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');
const { collectCurrentPageRows, goToNextPage } = require('./paginator');
const { extractDetail } = require('./detail');
const { ExcelWriter } = require('./writer');
const { ResultStore } = require('./resultStore');
const { classifyAwardStatus, inferBusinessType, inferOpeningDate, lookupAwardViaOpenApi, normalizeBidNumber } = require('./award');

(async () => {
  const dateRange = config.getDateRange();
  const keywords = config.keywords;

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

  const writer = new ExcelWriter();
  await writer.init(config.outputPath);
  const resultStore = new ResultStore({
    outputPath: config.jsonOutputPath,
    dateRange,
    keywords,
  });

  let totalSaved = 0;

  try {
    for (const keyword of keywords) {
      console.log(`\n=== Keyword: "${keyword}" | ${dateRange.from} ~ ${dateRange.to} ===`);
      const page = await context.newPage();

      writer.prepareSheet(keyword, dateRange);

      try {
        await search(page, keyword, dateRange);
        console.log('Search submitted. Processing results...');

        let pageNum = 1;
        const maxPages = 100;

        while (pageNum <= maxPages) {
          const rows = await collectCurrentPageRows(page);
          if (rows.length === 0) {
            console.log(pageNum === 1 ? 'No results found.' : 'No more results.');
            break;
          }
          console.log(`Page ${pageNum}: ${rows.length} results`);

          for (const row of rows) {
            totalSaved++;
            console.log(`[${totalSaved}] ${row.bidNumber} (row ${row.rowIndex})`);
            try {
              const record = await extractDetail(page, row.rowIndex, { attachmentDir: config.attachmentDir });
              if (record) {
                const downloadedAttachments = record.__attachments || [];
                delete record.__attachments;

                const bidNumber = normalizeBidNumber(record.입찰공고번호 || record.공고번호 || row.bidNumber);
                const award = await lookupAwardViaOpenApi({
                  apiKey: config.dataGoKrApiKey,
                  bidNumber,
                  businessType: inferBusinessType(record),
                  openingDate: inferOpeningDate(record),
                });
                award.classification = classifyAwardStatus({ award, detailFields: record });

                writer.addRecord(keyword, dateRange, record);
                resultStore.upsertBid({
                  keyword,
                  bidNumber,
                  title: record.공고명 || '',
                  detailFields: record,
                  attachments: downloadedAttachments,
                  award,
                });
                resultStore.save();
              } else {
                console.log(`  ⚠ Failed to extract details for row ${row.rowIndex}`);
              }
            } catch (rowErr) {
              console.log(`  ⚠ Skipped row ${row.rowIndex}: ${rowErr.message.slice(0, 80)}`);
            }
          }

          const hasNext = await goToNextPage(page);
          if (!hasNext) break;
          pageNum++;
        }
      } finally {
        await page.close();
      }
    }

    writer.addAnalysisSheets(resultStore.toJSON());
    await writer.save();
    resultStore.save();
    if (totalSaved > 0) {
      console.log(`Total: ${totalSaved} records across ${keywords.length} keyword(s).`);
    } else {
      console.log('No records found. Empty sheets saved.');
    }
  } catch (err) {
    console.error('Crawler error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
