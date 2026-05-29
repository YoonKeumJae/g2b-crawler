const {
  DETAIL_DEFAULTS,
  buildDetailOptions,
  extractDetail,
  isLikelyCompleteDetail,
} = require('../detail');

test('rejects partial detail extraction below the minimum field count', () => {
  const fields = Object.fromEntries(
    Array.from({ length: 22 }, (_, index) => [`field${index}`, `value${index}`])
  );

  expect(isLikelyCompleteDetail(fields, { expectedBidNumber: 'R26BK01432805' })).toBe(false);
});

test('accepts complete detail extraction when bid number and field count are valid', () => {
  const fields = Object.fromEntries(
    Array.from({ length: 35 }, (_, index) => [`field${index}`, `value${index}`])
  );
  fields.입찰공고번호 = 'R26BK01432805 - 00';

  expect(isLikelyCompleteDetail(fields, { expectedBidNumber: 'R26BK01432805' })).toBe(true);
});

test('uses bounded detail timeouts instead of Playwright default click timeout', () => {
  const options = buildDetailOptions({});

  expect(options.clickTimeoutMs).toBeLessThan(DETAIL_DEFAULTS.playwrightDefaultTimeoutMs);
  expect(options.maxRetries).toBe(1);
});

test('restores the result list before returning null after exhausted failures', async () => {
  const page = {
    locator: jest.fn(() => ({
      waitFor: jest.fn().mockRejectedValue(new Error('missing row')),
    })),
    goBack: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
  };

  const result = await extractDetail(page, 0, {
    clickTimeoutMs: 1,
    listReturnTimeoutMs: 1,
    maxRetries: 0,
  });

  expect(result).toBeNull();
  expect(page.goBack).toHaveBeenCalledWith({ waitUntil: 'domcontentloaded', timeout: 1 });
  expect(page.waitForSelector).toHaveBeenCalledWith('#mf_wfm_container_testTable', { timeout: 1 });
});
