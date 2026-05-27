function getDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  return { from: fmt(from), to: fmt(to) };
}

module.exports = {
  keyword: 'ees',
  headless: true,
  outputPath: 'output/results.csv',
  getDateRange,
};
