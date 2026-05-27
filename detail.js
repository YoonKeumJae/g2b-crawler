/**
 * detail.js
 * Navigates to detail page and extracts all field label→value pairs
 */

/**
 * Finds the frame containing detail page content
 * @param {Page} page - Playwright page object
 * @returns {Frame|null} The detail frame or null if not found
 */
async function findDetailFrame(page) {
  const frames = page.frames();
  
  for (const frame of frames) {
    const url = frame.url();
    // Detail pages typically contain these patterns in the URL
    if (url && (
      url.includes('selectSubFrame') ||
      url.includes('frameTgong') ||
      url.includes('bidDetail') ||
      url.includes('viewBidInfo')
    )) {
      console.log('[detail] Found detail frame:', url);
      return frame;
    }
  }
  
  // If no specific detail frame found, use main frame
  console.log('[detail] No detail frame found, using main frame');
  return page.mainFrame();
}

/**
 * Extracts all label→value pairs from the detail page
 * @param {Frame} frame - Frame containing detail content
 * @returns {Promise<Object>} Flat key-value object of all fields
 */
async function extractFieldsFromFrame(frame) {
  return await frame.evaluate(() => {
    const fields = {};
    
    // G2B detail pages typically use table rows with <th> labels and <td> values
    // Pattern 1: <tr><th>label</th><td>value</td></tr>
    const rows = document.querySelectorAll('tr');
    
    for (const row of rows) {
      const ths = Array.from(row.querySelectorAll('th'));
      const tds = Array.from(row.querySelectorAll('td'));
      
      // Handle single th/td pair in a row
      if (ths.length === 1 && tds.length === 1) {
        const label = ths[0].textContent.trim();
        const value = tds[0].textContent.trim();
        
        if (label && value) {
          fields[label] = value;
        }
      }
      // Handle multiple th/td pairs in a row (2 columns layout)
      else if (ths.length === 2 && tds.length === 2) {
        for (let i = 0; i < 2; i++) {
          const label = ths[i].textContent.trim();
          const value = tds[i].textContent.trim();
          
          if (label && value) {
            fields[label] = value;
          }
        }
      }
      // Handle alternating th/td/th/td pattern
      else if (ths.length > 0 && tds.length > 0 && ths.length === tds.length) {
        for (let i = 0; i < ths.length; i++) {
          const label = ths[i].textContent.trim();
          const value = tds[i].textContent.trim();
          
          if (label && value) {
            fields[label] = value;
          }
        }
      }
    }
    
    // Pattern 2: <dt>label</dt><dd>value</dd> (definition lists)
    const dls = document.querySelectorAll('dl');
    for (const dl of dls) {
      const dts = Array.from(dl.querySelectorAll('dt'));
      const dds = Array.from(dl.querySelectorAll('dd'));
      
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        const label = dts[i].textContent.trim();
        const value = dds[i].textContent.trim();
        
        if (label && value) {
          fields[label] = value;
        }
      }
    }
    
    // Pattern 3: Labeled divs with specific class patterns
    const labeledDivs = document.querySelectorAll('[class*="label"], [class*="title"]');
    for (const labelDiv of labeledDivs) {
      const label = labelDiv.textContent.trim();
      // Look for sibling or next element as value
      const valueDiv = labelDiv.nextElementSibling;
      
      if (valueDiv && label && !label.includes('검색') && !label.includes('목록')) {
        const value = valueDiv.textContent.trim();
        if (value && value !== label) {
          fields[label] = value;
        }
      }
    }
    
    return fields;
  });
}

/**
 * Navigates to detail page via clicking link in results frame
 * @param {Page} page - Playwright page object
 * @param {string} identifier - Bid number identifier
 * @returns {Promise<boolean>} True if navigation succeeded
 */
async function navigateToDetailByClick(page, identifier) {
  try {
    // Find the results frame
    const frames = page.frames();
    let resultsFrame = null;
    
    for (const frame of frames) {
      const url = frame.url();
      if (url && (url.includes('bidInfoList') || url.includes('viewBidInfoList'))) {
        resultsFrame = frame;
        break;
      }
    }
    
    if (!resultsFrame) {
      console.log('[detail] Results frame not found');
      return false;
    }
    
    // Find and click the link matching this identifier
    const clicked = await resultsFrame.evaluate((id) => {
      // Find all detail links
      const links = document.querySelectorAll('tbody tr a[onclick*="fn_detail"]');
      
      for (const link of links) {
        const onclick = link.getAttribute('onclick') || '';
        const text = link.textContent.trim();
        
        // Check if this link matches the identifier
        if (onclick.includes(id) || text === id) {
          link.click();
          return true;
        }
      }
      
      // If identifier not found, don't click random links
      return false;
    }, identifier);
    
    if (clicked) {
      // Wait for detail page to load
      await page.waitForTimeout(2000);
      return true;
    }
    
    console.log(`[detail] Could not find link for identifier: ${identifier}`);
    return false;
  } catch (error) {
    console.log('[detail] Error navigating by click:', error.message);
    return false;
  }
}

/**
 * Extracts all fields from a detail page
 * @param {Page} page - Playwright page object (should be on results page)
 * @param {string} identifier - Detail page URL or bid number identifier
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object|null>} Flat key-value object or null on failure
 */
async function extractDetail(page, identifier, retries = 3) {
  if (!page) throw new Error('page is required');
  if (!identifier) throw new Error('identifier is required');
  
  console.log(`[detail] Extracting detail for: ${identifier}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if identifier is a full URL or just a bid number
      if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
        // Navigate directly to the URL
        console.log('[detail] Navigating to URL:', identifier);
        await page.goto(identifier, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      } else {
        // It's a bid number, need to click the link in results frame
        console.log('[detail] Navigating via click for identifier:', identifier);
        const navigated = await navigateToDetailByClick(page, identifier);
        
        if (!navigated) {
          console.log('[detail] Warning: Could not navigate to detail page');
          if (attempt < retries) {
            console.log(`[detail] Retrying... (${attempt}/${retries})`);
            await page.waitForTimeout(1000);
            continue;
          }
          return null;
        }
      }
      
      // Find the frame containing detail content
      const detailFrame = await findDetailFrame(page);
      
      if (!detailFrame) {
        throw new Error('Could not find detail frame');
      }
      
      // Wait for content to load
      await detailFrame.waitForSelector('tr, table', { timeout: 5000 }).catch(() => {});
      
      // Extract all fields
      const fields = await extractFieldsFromFrame(detailFrame);
      
      console.log(`[detail] Extracted ${Object.keys(fields).length} fields from detail page`);
      if (Object.keys(fields).length === 0) {
        throw new Error(`No fields extracted from detail page for identifier: ${identifier}`);
      }
      
      console.log(`[detail] ✓ Extracted ${Object.keys(fields).length} fields`);
      return fields;
      
    } catch (error) {
      console.log(`[detail] Attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt < retries) {
        console.log('[detail] Retrying...');
        await page.waitForTimeout(2000);
      } else {
        console.log('[detail] ⚠ Failed to extract detail after all retries');
        return null;
      }
    }
  }
  
  return null;
}

module.exports = { extractDetail };
