/**
 * detail.js
 * Clicks a result row in the G2B testTable, extracts all th→td field pairs
 * from the detail view, then calls page.goBack() to restore the results list.
 */

/**
 * Extracts all meaningful th→td label/value pairs from the current page DOM.
 * Uses content-based filtering to remove search form dropdown noise.
 * @param {Page} page
 * @returns {Promise<Object>}
 */
async function extractFields(page) {
  return await page.evaluate(() => {
    function isNoise(v) {
      if (!v || v.trim() === '') return true;
      if (v === '달력에서 선택' || v === '원' || v === '￦' || v === '＄' || v === '$') return true;
      if (v.includes('\t')) return true;
      // Search form dropdowns concatenate all options, typically starting with "전체"
      if (/^전체[가-힣]{2,}/.test(v)) return true;
      // Date range dropdown: "~1개월3개월..."
      if (v.startsWith('~') && v.includes('개월')) return true;
      // Year selector dropdown: "1950년1951년..."
      if (/\d{4}년\d{4}년/.test(v)) return true;
      // N/A + concatenated options: "N/A일반경쟁..."
      if (/^N\/A[가-힣]/.test(v)) return true;
      return false;
    }

    const result = {};
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const ths = row.querySelectorAll('th');
      const tds = row.querySelectorAll('td');
      for (let i = 0; i < ths.length; i++) {
        const label = ths[i].textContent.trim();
        const value = tds[i] ? tds[i].textContent.trim() : '';
        if (!label || isNoise(value)) continue;
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
async function extractDetail(page, rowIndex) {
  const selector = `#mf_wfm_container_grdTotalSrch_${rowIndex}_untyTitleTd`;

  console.log(`[detail] Clicking row ${rowIndex}...`);
  const responsePromise = page.waitForResponse(
    r => r.url().includes('selectItemAnncMngV.do') && r.status() === 200,
    { timeout: 30000 }
  );
  await page.click(selector, { force: true });
  await responsePromise;
  await page.waitForTimeout(2000);

  const fields = await extractFields(page);
  console.log(`[detail] ✓ Extracted ${Object.keys(fields).length} fields`);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mf_wfm_container_testTable', { timeout: 20000 });
  await page.waitForTimeout(1000);

  return Object.keys(fields).length > 0 ? fields : null;
}

module.exports = { extractDetail };
