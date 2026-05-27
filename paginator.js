/**
 * paginator.js
 * Extracts result rows from G2B testTable and handles pagination.
 * G2B is a WebSquare SPA — results live in the main page DOM, not iframes.
 * Row IDs: mf_wfm_container_grdTotalSrch_{N}_totalSrchTr
 */

/**
 * Collects bid number and row index for every data row on the current results page.
 * @param {Page} page
 * @returns {Promise<Array<{bidNumber: string, rowIndex: number}>>}
 */
async function collectCurrentPageRows(page) {
  return await page.evaluate(() => {
    const results = [];
    let n = 0;
    while (true) {
      const row = document.getElementById(`mf_wfm_container_grdTotalSrch_${n}_totalSrchTr`);
      if (!row) break;
      const match = row.textContent.match(/[A-Z]\d{2}[A-Z]{2}\d{8}/);
      if (match) results.push({ bidNumber: match[0], rowIndex: n });
      n++;
    }
    return results;
  });
}

/**
 * Clicks the next-page button and waits for fresh results to load.
 * @param {Page} page
 * @returns {Promise<boolean>} true if navigated to next page
 */
async function goToNextPage(page) {
  const responsePromise = page.waitForResponse(
    r => r.url().includes('srchBidPbanc.do') && r.status() === 200,
    { timeout: 15000 }
  ).catch(() => null);

  const clicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('a')).filter(a => {
      const text = a.textContent.trim();
      const title = (a.getAttribute('title') || '').trim();
      return (text === '다음' || title === '다음' || title === '다음 페이지') &&
             !a.classList.contains('disabled') &&
             a.style.display !== 'none';
    });
    if (candidates.length > 0) { candidates[0].click(); return true; }
    const btn = document.querySelector('a.btn_next:not(.disabled)');
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!clicked) return false;

  await responsePromise;
  await page.waitForTimeout(1500);
  return true;
}

module.exports = { collectCurrentPageRows, goToNextPage };
