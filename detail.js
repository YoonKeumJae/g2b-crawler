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
  const selector = `#mf_wfm_container_grdTotalSrch_${rowIndex}_untyTitleTd`;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[detail] ↺ Retry ${attempt} for row ${rowIndex}...`);
      try { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }); } catch (_) {}
      try { await page.waitForSelector('#mf_wfm_container_testTable', { timeout: 15000 }); } catch (_) {}
      await page.waitForTimeout(2000);
    }

    try {
      console.log(`[detail] Clicking row ${rowIndex}...`);

      // Set up response waiter before click (race condition prevention)
      let responsePromise;
      try {
        responsePromise = page.waitForResponse(
          r => r.url().includes('selectItemAnncMngV.do') && r.status() === 200,
          { timeout: 20000 }
        ).catch(() => null);
      } catch (_) {
        responsePromise = Promise.resolve();
      }

      await page.click(selector, { force: true });

      // Wait for response OR for detail container to appear (whichever first)
      await Promise.race([
        responsePromise,
        page.waitForSelector('[id*="bidPbancWfrm_mainContents"]', { timeout: 20000 }),
      ]);
      await page.waitForTimeout(1500);

      const fields = await extractFields(page);
      const fieldCount = Object.keys(fields).length;
      const attachments = await extractAttachments(page, fields.입찰공고번호 || fields.공고번호 || '');
      fields.__attachments = options.attachmentDir
        ? await downloadAttachments(page, attachments, options.attachmentDir)
        : attachments;
      console.log(`[detail] ✓ Extracted ${fieldCount} fields`);

      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#mf_wfm_container_testTable', { timeout: 20000 });
      await page.waitForSelector(selector, { timeout: 20000 });
      await page.waitForTimeout(1000);

      return fieldCount > 0 ? fields : null;
    } catch (err) {
      console.log(`[detail] ⚠ Attempt ${attempt} failed: ${err.message.slice(0, 80)}`);
      if (attempt >= MAX_RETRIES) {
        console.log(`[detail] ✗ All retries exhausted for row ${rowIndex}`);
        return null;
      }
    }
  }
  return null;
}

module.exports = { extractDetail };
