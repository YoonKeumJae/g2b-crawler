/**
 * Manual test script for detail.js
 * This demonstrates how extractDetail should be called
 */

const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');
const { collectUrls } = require('./paginator');
const { extractDetail } = require('./detail');

(async () => {
  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage();
  
  try {
    console.log('Step 1: Search');
    await search(page, config.keyword, config.getDateRange());
    
    console.log('\nStep 2: Collect URLs');
    const urls = await collectUrls(page);
    console.log(`Collected ${urls.length} URLs`);
    
    if (urls.length > 0) {
      console.log('\nStep 3: Extract first detail');
      const record = await extractDetail(page, urls[0]);
      
      if (record) {
        console.log('\n✓ Success! Extracted fields:');
        console.log(JSON.stringify(record, null, 2));
      } else {
        console.log('\n✗ Failed to extract detail');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
