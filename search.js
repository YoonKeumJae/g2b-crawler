/**
 * search.js
 * Navigates to G2B and performs a bid announcement search
 */

/**
 * Dismisses notice/announcement popups on G2B homepage
 * @param {Page} page
 */
async function dismissPopups(page) {
  console.log('[search] Checking for popups...');
  try {
    // Try common close button selectors for G2B notice popups
    const closeSelectors = [
      'a:has-text("닫기")',
      'button:has-text("닫기")',
      'img[alt="닫기"]',
      '.w2popup_close',
      '.close_btn',
      '[class*="close"]:visible',
    ];

    for (const selector of closeSelectors) {
      const buttons = await page.locator(selector).all();
      for (const btn of buttons) {
        if (await btn.isVisible()) {
          await btn.click({ force: true }).catch(() => {});
          console.log(`[search] ✓ Closed popup with selector: ${selector}`);
          await page.waitForTimeout(500);
        }
      }
    }
  } catch (e) {
    console.log('[search] (no popups found or already closed)');
  }
}

/**
 * Performs bid announcement search on G2B
 * @param {Page} page - Playwright page object
 * @param {string} keyword - Search keyword (e.g., "ees")
 * @param {Object} dateRange - Date range object
 * @param {string} dateRange.from - Start date in yyyyMMdd format (e.g. "20260427")
 * @param {string} dateRange.to - End date in yyyyMMdd format (e.g. "20260527")
 * @returns {Promise<void>}
 */
async function search(page, keyword, dateRange) {
  // Parameter validation
  if (!page) throw new Error('page is required');
  if (!keyword) throw new Error('keyword is required');
  if (!dateRange?.from || !dateRange?.to) throw new Error('dateRange must have from and to dates');
  
  console.log(`[search] Navigating to G2B homepage...`);
  
  // Navigate to G2B homepage
  await page.goto('https://www.g2b.go.kr/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  // Wait for dynamic content to load
  await page.waitForTimeout(3000);

  // Dismiss any notice/announcement popups (공지사항 팝업)
  await dismissPopups(page);
  
  console.log(`[search] Filling search form - keyword: "${keyword}", dates: ${dateRange.from} ~ ${dateRange.to}`);
  
  // Fill in the announcement name (공고명) field
  // Using placeholder selector as it's more stable than dynamic IDs
  await page.fill('input[placeholder="입찰공고"]', keyword);
  console.log('[search] ✓ Filled keyword field');
  
  // Fill in the date range
  // Find the visible date inputs (the ones for the active tab)
  // The inputs have IDs containing 'ibxStrDay' and 'ibxEndDay'
  const visibleDateInputs = await page.locator('input.udcDateReadOnly:visible').all();
  
  if (visibleDateInputs.length >= 2) {
    // Typically first two visible are start and end date
    await visibleDateInputs[0].fill(dateRange.from);
    await visibleDateInputs[1].fill(dateRange.to);
    console.log('[search] ✓ Filled date range');
  } else {
    // Fallback: try by ID pattern
    await page.fill('input[id*="ibxStrDay"]:visible', dateRange.from);
    await page.fill('input[id*="ibxEndDay"]:visible', dateRange.to);
    console.log('[search] ✓ Filled date range (fallback method)');
  }
  
  // Wait for any loading overlays to disappear
  console.log('[search] Waiting for UI to stabilize...');
  await page.waitForTimeout(1000);
  
  // Wait for modal overlays to disappear
  await page.waitForSelector('.w2modal', { state: 'hidden', timeout: 10000 }).catch(() => {
    console.log('[search] (no modal to wait for)');
  });
  
  // Find and click the search button (검색하기)
  // There are multiple search buttons for different tabs, need the visible one
  // Use force: true to bypass any overlays
  const searchButton = page.locator('a.main-srch:has-text("검색하기"):visible').first();
  
  console.log('[search] Clicking search button...');
  await searchButton.click({ force: true, timeout: 10000 });
  
  // Wait for the processing iframe to appear (this indicates the search is being processed)
  console.log('[search] Waiting for search results to process...');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  
  // The G2B site shows a processing message in an iframe, then loads results
  // We need to wait for the processing to complete
  let attempts = 0;
  const maxAttempts = 15; // 15 seconds max
  
  while (attempts < maxAttempts) {
    const frames = page.frames();
    
    // Check if any frame has loaded with results (not the processing message)
    for (const frame of frames) {
      const url = frame.url();
      
      // Check if this is a results frame (contains viewBidInfoList or similar)
      if (url && (url.includes('viewBidInfoList') || url.includes('bidInfoList'))) {
        console.log('[search] ✓ Results page loaded:', url);
        
        // Wait a bit more for the results to fully render
        await page.waitForTimeout(2000);
        return;
      }
    }
    
    await page.waitForTimeout(1000);
    attempts++;
  }
  
  // If we get here, the iframe did not load within the timeout
  throw new Error('Search iframe did not load within timeout');
}

module.exports = { search };
