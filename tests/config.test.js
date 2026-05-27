const { getDateRange } = require('../config');

test('getDateRange returns YYYY/MM/DD strings spanning last 1 month', () => {
  const { from, to } = getDateRange();
  const fromDate = new Date(from.replace(/\//g, '-'));
  const toDate = new Date(to.replace(/\//g, '-'));
  const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  expect(diffDays).toBeGreaterThanOrEqual(28);
  expect(diffDays).toBeLessThanOrEqual(31);
  expect(from).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  expect(to).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
});
