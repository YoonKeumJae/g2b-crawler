const { getDateRange } = require('../config');

test('getDateRange returns yyyyMMdd strings spanning last 1 month', () => {
  const { from, to } = getDateRange();
  const fromDate = new Date(from.slice(0,4) + '-' + from.slice(4,6) + '-' + from.slice(6,8));
  const toDate = new Date(to.slice(0,4) + '-' + to.slice(4,6) + '-' + to.slice(6,8));
  const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  expect(diffDays).toBeGreaterThanOrEqual(28);
  expect(diffDays).toBeLessThanOrEqual(31);
  expect(from).toMatch(/^\d{8}$/);
  expect(to).toMatch(/^\d{8}$/);
});
