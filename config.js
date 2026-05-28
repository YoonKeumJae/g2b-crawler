// 검색 기간 직접 지정 (형식: 'YYYYMMDD')
// null 로 두면 오늘 기준 최근 6개월로 자동 설정됩니다.
const fs = require('fs');
const path = require('path');

loadLocalEnv();

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

module.exports = {
  keywords: ['ees', '오피스365', 'ms오피스'],
  headless: true,
  outputPath: 'output/results.xlsx',
  jsonOutputPath: 'output/results.json',
  attachmentDir: 'output/attachments',
  dataGoKrApiKey: process.env.DATA_GO_KR_API_KEY || process.env.API_KEY || '',
  getDateRange,
};

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
