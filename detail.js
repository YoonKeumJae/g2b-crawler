/**
 * detail.js
 * Clicks a result row in the G2B testTable, extracts all th→td field pairs
 * from the detail view, then calls page.goBack() to restore the results list.
 */

/**
 * Extracts all meaningful th→td label/value pairs from the detail view only.
 * Targets the bid detail container (bidPbancWfrm_mainContents) to exclude
 * search form noise (calendar widgets, dropdowns, etc.).
 * @param {Page} page
 * @returns {Promise<Object>}
 */
const { downloadAttachments, extractAttachments } = require('./attachment');

const DETAIL_DEFAULTS = {
  clickTimeoutMs: 7000,
  detailLoadTimeoutMs: 12000,
  listReturnTimeoutMs: 10000,
  maxRetries: 1,
  minFieldCount: 30,
  playwrightDefaultTimeoutMs: 30000,
};

function buildDetailOptions(options = {}) {
  return {
    ...DETAIL_DEFAULTS,
    ...options,
  };
}

function normalizeBidNumberForCompare(value = '') {
  const text = String(value).trim();
  const match = text.match(/[A-Z]\d{2}[A-Z]{2}\d{8}/);
  return match ? match[0] : text.replace(/\s*-\s*\d+$/, '').trim();
}

function isLikelyCompleteDetail(fields, options = {}) {
  const detailOptions = buildDetailOptions(options);
  const fieldCount = Object.keys(fields || {}).filter(key => !key.startsWith('__')).length;
  if (fieldCount < detailOptions.minFieldCount) return false;

  const expectedBidNumber = normalizeBidNumberForCompare(detailOptions.expectedBidNumber || '');
  if (!expectedBidNumber) return true;

  const actualBidNumber = normalizeBidNumberForCompare(fields.입찰공고번호 || fields.공고번호 || '');
  return !actualBidNumber || actualBidNumber === expectedBidNumber;
}

async function waitForListRow(page, selector, timeout) {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout });
    return true;
  } catch (_) {
    return false;
  }
}

async function returnToResultList(page, timeout) {
  try { await page.goBack({ waitUntil: 'domcontentloaded', timeout }); } catch (_) {}
  try { await page.waitForSelector('#mf_wfm_container_testTable', { timeout }); } catch (_) {}
}

async function extractFields(page) {
  return await page.evaluate(() => {
    // Find the detail content container - excludes the search form
    const container =
      document.querySelector('[id*="bidPbancWfrm_mainContents"]') ||
      document.querySelector('[id*="bidPbancWfrm_mainWframe_pageType"]') ||
      document.querySelector('[id*="bidPbancWfrm"]') ||
      document.body;

    function getCellValue(td) {
      // WebSquare uses readonly input/textarea elements for field values
      const input = td.querySelector('input[type="text"], textarea');
      if (input) return input.value.trim();
      const select = td.querySelector('select');
      if (select) return select.options[select.selectedIndex]?.text.trim() || '';
      return td.textContent.trim();
    }

    const result = {};
    const rows = container.querySelectorAll('tr');
    for (const row of rows) {
      const ths = row.querySelectorAll('th');
      const tds = row.querySelectorAll('td');
      for (let i = 0; i < ths.length; i++) {
        const label = ths[i].textContent.trim();
        const td = tds[i];
        if (!label || !td) continue;
        const value = getCellValue(td);
        if (!value) continue;
        result[label] = value;
      }
    }
    return result;
  });
}

/**
 * Clicks the bid-name cell for the given rowIndex, waits for the detail view to load,
 * extracts all fields, then navigates back to the results list.
 * @param {Page} page
 * @param {number} rowIndex  - 0-based index matching grdTotalSrch_{N}_untyTitleTd
 * @returns {Promise<Object|null>}
 */
async function extractDetail(page, rowIndex, options = {}) {
  const detailOptions = buildDetailOptions(options);
  const selector = `#mf_wfm_container_grdTotalSrch_${rowIndex}_untyTitleTd`;

  for (let attempt = 0; attempt <= detailOptions.maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[detail] ↺ Retry ${attempt} for row ${rowIndex}...`);
      await returnToResultList(page, detailOptions.listReturnTimeoutMs);
      await page.waitForTimeout(800);
    }

    try {
      console.log(`[detail] Clicking row ${rowIndex}...`);

      const rowVisible = await waitForListRow(page, selector, detailOptions.clickTimeoutMs);
      if (!rowVisible) {
        throw new Error(`result row selector not visible within ${detailOptions.clickTimeoutMs}ms: ${selector}`);
      }

      // Set up response waiter before click (race condition prevention)
      let responsePromise;
      try {
        responsePromise = page.waitForResponse(
          r => r.url().includes('selectItemAnncMngV.do') && r.status() === 200,
          { timeout: detailOptions.detailLoadTimeoutMs }
        ).catch(() => null);
      } catch (_) {
        responsePromise = Promise.resolve();
      }

      await page.locator(selector).click({ force: true, timeout: detailOptions.clickTimeoutMs });

      // Wait for response OR for detail container to appear (whichever first)
      await Promise.race([
        responsePromise,
        page.waitForSelector('[id*="bidPbancWfrm_mainContents"]', { timeout: detailOptions.detailLoadTimeoutMs }),
      ]);
      await page.waitForTimeout(1500);

      const fields = await extractFields(page);
      const fieldCount = Object.keys(fields).length;
      if (!isLikelyCompleteDetail(fields, detailOptions)) {
        throw new Error(`incomplete detail extraction (${fieldCount} fields)`);
      }

      const attachments = await extractAttachments(page, fields.입찰공고번호 || fields.공고번호 || '');
      fields.__attachments = options.attachmentDir
        ? await downloadAttachments(page, attachments, options.attachmentDir)
        : attachments;
      console.log(`[detail] ✓ Extracted ${fieldCount} fields`);

      await returnToResultList(page, detailOptions.listReturnTimeoutMs);
      await page.waitForTimeout(1000);

      return fieldCount > 0 ? fields : null;
    } catch (err) {
      console.log(`[detail] ⚠ Attempt ${attempt} failed: ${err.message.slice(0, 80)}`);
      if (attempt >= detailOptions.maxRetries) {
        console.log(`[detail] ✗ All retries exhausted for row ${rowIndex}`);
        await returnToResultList(page, detailOptions.listReturnTimeoutMs);
        return null;
      }
    }
  }
  return null;
}

module.exports = {
  DETAIL_DEFAULTS,
  buildDetailOptions,
  extractDetail,
  isLikelyCompleteDetail,
};
