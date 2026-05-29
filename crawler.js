const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');
const { collectCurrentPageRows, goToNextPage } = require('./paginator');
const { extractDetail } = require('./detail');
const { ExcelWriter } = require('./writer');
const { resolveBidKey } = require('./bidKeyResolver');
const { G2BApiClient } = require('./g2bApiClient');
const { lookupEnrichmentByBidNumber } = require('./enrichment');
const { buildReportRows } = require('./reportRows');
const { ResultStore } = require('./resultStore');
const { restoreSearchResultsPage } = require('./searchRestore');
const { normalizeBidNumber } = require('./award');
const { lookupAwardForResultStore } = require('./awardLookup');

(async () => {
  const dateRange = config.getDateRange();
  const keywords = config.keywords;

  if (config.apiEnabled && !config.serviceKey) {
    console.error('DATA_GO_KR_SERVICE_KEY is required for award/contract enrichment');
    process.exitCode = 1;
    return;
  }

  const apiClient = new G2BApiClient({
    serviceKey: config.serviceKey,
    timeoutMs: config.apiTimeoutMs,
    retries: config.apiRetries,
  });

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

  let totalAttempted = 0;
  let totalSaved = 0;
  let apiSuccessCount = 0;
  let apiNoResultCount = 0;
  let apiErrorCount = 0;

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
            totalAttempted++;
            console.log(`[${totalAttempted}] ${row.bidNumber} (row ${row.rowIndex})`);
            try {
              const record = await extractDetail(page, row.rowIndex, {
                attachmentDir: config.attachmentDir,
                expectedBidNumber: row.bidNumber,
              });
              if (!record) {
                console.log(`  ⚠ Failed to extract details for row ${row.rowIndex}`);
                writer.addErrorLog({
                  검색키워드: keyword,
                  입찰공고번호: row.bidNumber || '',
                  단계: '상세 추출',
                  오류코드: 'DETAIL_EMPTY',
                  오류메시지: `Failed to extract details for row ${row.rowIndex}`,
                });
                await restoreSearchResultsPage({ page, keyword, dateRange, pageNum });
                continue;
              }

              const downloadedAttachments = record.__attachments || [];
              delete record.__attachments;

              writer.addRecord(keyword, dateRange, record);

              const bidNumber = normalizeBidNumber(record.입찰공고번호 || record.공고번호 || row.bidNumber);
              const bidKey = resolveBidKey({
                rawBidNumber: record.입찰공고번호,
                normalizedBidNumber: bidNumber,
                rowBidNumber: row.bidNumber,
              });
              let enrichment = null;

              if (!bidKey) {
                writer.addErrorLog({
                  검색키워드: keyword,
                  입찰공고번호: record.입찰공고번호 || row.bidNumber || '',
                  단계: '공고번호 정규화',
                  오류코드: 'INVALID_BID_NUMBER',
                  오류메시지: '입찰공고번호 형식이 비어 있거나 불완전합니다.',
                });
              } else if (config.apiEnabled) {
                try {
                  enrichment = await lookupEnrichmentByBidNumber(apiClient, bidKey);
                  if (enrichment.status === '확인') apiSuccessCount++;
                  else if (enrichment.status === '정보 없음') apiNoResultCount++;
                  else apiErrorCount++;
                } catch (apiErr) {
                  apiErrorCount++;
                  enrichment = {
                    status: 'API 조회 실패',
                    items: [],
                    errors: [{
                      stage: '계약/낙찰 API 보강',
                      code: 'UNEXPECTED_ERROR',
                      message: apiErr.message,
                    }],
                  };
                }
              }

              const reportRows = buildReportRows({ keyword, record, bidKey, enrichment });
              writer.addIntegratedRecord(reportRows.integrated);
              reportRows.award.forEach((award) => writer.addAwardRecord(award));
              reportRows.contract.forEach((contract) => writer.addContractRecord(contract));
              reportRows.errors.forEach((error) => writer.addErrorLog(error));

              const award = await lookupAwardForResultStore({
                apiKey: config.dataGoKrApiKey,
                bidNumber,
                record,
              });

              resultStore.upsertBid({
                keyword,
                bidNumber,
                title: record.공고명 || '',
                detailFields: record,
                attachments: downloadedAttachments,
                award,
              });
              resultStore.save();
              totalSaved++;
            } catch (rowErr) {
              console.log(`  ⚠ Skipped row ${row.rowIndex}: ${rowErr.message.slice(0, 80)}`);
              writer.addErrorLog({
                검색키워드: keyword,
                입찰공고번호: row.bidNumber || '',
                단계: '행 처리',
                오류코드: 'ROW_ERROR',
                오류메시지: rowErr.message,
              });
              await restoreSearchResultsPage({ page, keyword, dateRange, pageNum });
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
      console.log(`Total: ${totalSaved} saved records (${totalAttempted} attempted) across ${keywords.length} keyword(s).`);
      console.log(`API: success=${apiSuccessCount}, noResult=${apiNoResultCount}, error=${apiErrorCount}`);
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
