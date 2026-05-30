const { loadEnvFile } = require('./envLoader');

loadEnvFile();

// 검색 기간 직접 지정 (형식: 'YYYYMMDD')
// null 로 두면 오늘 기준 최근 6개월로 자동 설정됩니다.
const DATE_FROM = null;  // 예: '20260101'
const DATE_TO   = null;  // 예: '20260527'

function getDateRange() {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  if (DATE_FROM && DATE_TO) {
    return { from: DATE_FROM, to: DATE_TO };
  }
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return { from: fmt(from), to: fmt(to) };
}

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY || process.env.DATA_GO_KR_API_KEY || process.env.API_KEY || '';

module.exports = {
  keywords: ['ees', '오피스365', 'ms오피스'],
  headless: true,
  outputPath: 'output/results.xlsx',
  jsonOutputPath: 'output/results.json',
  attachmentDir: 'output/attachments',
  apiEnabled: true,
  apiTimeoutMs: 20000,
  apiRetries: 2,
  serviceKey,
  dataGoKrApiKey: serviceKey,
  getDateRange,
};
