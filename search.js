/**
 * search.js
 * Navigates to G2B and performs a bid announcement search
 */

/**
 * Performs bid announcement search on G2B
 * @param {Page} page - Playwright page object
 * @param {string} keyword - Search keyword (e.g., "ees")
 * @param {Object} dateRange - Date range object
 * @param {string} dateRange.from - Start date in YYYY/MM/DD format
 * @param {string} dateRange.to - End date in YYYY/MM/DD format
 * @returns {Promise<void>}
 */
async function search(page, keyword, dateRange) {
  console.log(`[search] Navigating to G2B homepage...`);
  
  // Navigate to G2B homepage
  await page.goto('https://www.g2b.go.kr/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  // Wait for dynamic content to load
  await page.waitForTimeout(3000);
  
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
  await searchButton.click({ force: true });
  
  // Wait for the processing iframe to appear (this indicates the search is being processed)
  console.log('[search] Waiting for search results to process...');
  await page.waitForTimeout(2000);
  
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
  
  // If we get here, the results might be loaded in the main page instead of iframe
  // or the site behavior has changed
  console.log('[search] Search submitted (results may be in main page or iframe)');
  
  // Take a final wait to ensure any async operations complete
  await page.waitForTimeout(2000);
}

module.exports = { search };
