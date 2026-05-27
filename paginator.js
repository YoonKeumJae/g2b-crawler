/**
 * paginator.js
 * Collects all detail page URLs from search results across all pages
 */

/**
 * Finds the iframe containing search results
 * @param {Page} page - Playwright page object
 * @returns {Frame|null} The results frame or null if not found
 */
async function findResultsFrame(page) {
  const frames = page.frames();
  
  for (const frame of frames) {
    const url = frame.url();
    // Results are typically in iframe with these URL patterns
    if (url && (url.includes('bidInfoList') || url.includes('viewBidInfoList') || url.includes('bidResult'))) {
      console.log('[paginator] Found results iframe:', url);
      return frame;
    }
  }
  
  // If no iframe found, try main page
  console.log('[paginator] No results iframe found, checking main page');
  return page.mainFrame();
}

/**
 * Extracts detail page identifiers from result rows in current page
 * @param {Frame} frame - Frame containing results
 * @returns {Promise<Array<string>>} Array of detail page identifiers/URLs
 */
async function extractUrlsFromCurrentPage(frame) {
  return await frame.evaluate(() => {
    const urls = [];
    
    // Common patterns for G2B result links:
    // 1. Links with onclick containing bidding number (공고번호)
    // 2. Links in table rows with onclick="fn_detail(...)"
    // 3. Links with data attributes containing bid info
    
    // Try multiple selectors to find result links
    const selectors = [
      'tbody tr a[onclick*="fn_detail"]',
      'tbody tr a[onclick*="bidInfo"]',
      'tbody tr a[onclick*="viewDetail"]',
      '.list-wrap a[onclick*="fn_detail"]',
      'tr[id*="row"] a:first-child',
    ];
    
    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      
      if (links.length > 0) {
        console.log(`Found ${links.length} links with selector: ${selector}`);
        
        links.forEach(link => {
          // Try to extract the bidding number from onclick
          const onclick = link.getAttribute('onclick') || '';
          
          // Pattern 1: onclick="fn_detail('202600001', 'params')"
          const match1 = onclick.match(/fn_detail\s*\(\s*['"]([^'"]+)['"]/);
          if (match1) {
            urls.push(match1[1]);
            return;
          }
          
          // Pattern 2: onclick="viewBidInfo('number', ...)"
          const match2 = onclick.match(/\(['"]([0-9\-]+)['"]/);
          if (match2) {
            urls.push(match2[1]);
            return;
          }
          
          // Pattern 3: href if available
          const href = link.getAttribute('href');
          if (href && href !== '#' && href !== 'javascript:void(0)') {
            urls.push(href);
            return;
          }
          
          // Fallback: use link text if it looks like a number
          const text = link.textContent.trim();
          if (/^[0-9\-]+$/.test(text) && text.length >= 8) {
            urls.push(text);
          }
        });
        
        // If we found URLs with this selector, stop trying others
        if (urls.length > 0) {
          break;
        }
      }
    }
    
    return urls;
  });
}

/**
 * Checks if there is a next page and clicks it
 * @param {Frame} frame - Frame containing pagination
 * @returns {Promise<boolean>} True if next page exists and was clicked
 */
async function goToNextPage(frame) {
  try {
    const hasNext = await frame.evaluate(() => {
      // Common pagination patterns:
      // 1. Next button with text "다음" or ">"
      // 2. Link with onclick="fn_Page(nextPageNum)"
      // 3. Numbered page links, find current + 1

      // Try simple CSS selectors first (no :has-text — that's Playwright-only)
      const cssSelectors = [
        'a.page_next:not(.disabled)',
        'a[title*="다음"]',
        'img[alt*="다음"]',
      ];
      for (const selector of cssSelectors) {
        const btn = document.querySelector(selector);
        if (btn && !btn.classList.contains('disabled')) {
          btn.click();
          return true;
        }
      }

      // Find any <a> whose text contains "다음"
      const allLinks = Array.from(document.querySelectorAll('a'));
      const nextByText = allLinks.find(a =>
        (a.textContent.trim() === '다음' || a.textContent.trim() === '>') &&
        !a.classList.contains('disabled')
      );
      if (nextByText) {
        nextByText.click();
        return true;
      }
      
      // Try to find current page number and click next one
      const currentPage = document.querySelector('.page_num.on, .current, [class*="active"]');
      if (currentPage) {
        const nextElement = currentPage.nextElementSibling;
        if (nextElement && nextElement.tagName === 'A') {
          nextElement.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (hasNext) {
      // Wait for page to load
      await frame.page().waitForTimeout(2000);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('[paginator] Error navigating to next page:', error.message);
    return false;
  }
}

/**
 * Collects all detail page URLs from search results
 * @param {Page} page - Playwright page object (should be on results page after search)
 * @returns {Promise<Array<string>>} Array of detail page identifiers/URLs
 */
async function collectUrls(page) {
  console.log('[paginator] Starting URL collection...');
  
  const allUrls = [];
  let currentPage = 1;
  const maxPages = 100; // Safety limit
  
  try {
    // Find the frame containing results
    const resultsFrame = await findResultsFrame(page);
    
    if (!resultsFrame) {
      throw new Error('Could not find results frame or container');
    }
    
    // Wait for results to load
    await page.waitForTimeout(2000);
    
    // Collect URLs from all pages
    while (currentPage <= maxPages) {
      console.log(`[paginator] Processing page ${currentPage}...`);
      
      // Extract URLs from current page
      const pageUrls = await extractUrlsFromCurrentPage(resultsFrame);
      
      if (pageUrls.length === 0) {
        console.log(`[paginator] No URLs found on page ${currentPage}`);
        
        // If first page has no results, might be an error
        if (currentPage === 1) {
          console.log('[paginator] Warning: No results found on first page');
          
          // Check if there's an error message
          const errorMsg = await resultsFrame.evaluate(() => {
            const msg = document.querySelector('.error_msg, .no_result, [class*="empty"]');
            return msg ? msg.textContent.trim() : null;
          });
          
          if (errorMsg) {
            console.log('[paginator] Error message:', errorMsg);
          }
        }
        
        break;
      }
      
      console.log(`[paginator] Found ${pageUrls.length} URLs on page ${currentPage}`);
      allUrls.push(...pageUrls);
      
      // Try to go to next page
      const hasNextPage = await goToNextPage(resultsFrame);
      
      if (!hasNextPage) {
        console.log(`[paginator] No more pages after page ${currentPage}`);
        break;
      }
      
      currentPage++;
    }
    
    if (currentPage > maxPages) {
      console.log(`[paginator] Stopped at safety limit of ${maxPages} pages`);
    }
    
  } catch (error) {
    console.error('[paginator] Error during URL collection:', error.message);
    throw error;
  }
  
  console.log(`[paginator] Collection complete. Total URLs: ${allUrls.length}`);
  return allUrls;
}

module.exports = { collectUrls };
